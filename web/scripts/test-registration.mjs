import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
const input = { kind: 'email', email: 'resume@example.test', nickname: '테스트', termsDocumentId: 1, privacyDocumentId: 2, adultConfirmed: true };
const session = () => ({ identityVerificationToken: 'test-token', identityVerificationId: 'test-identity', storeId: 'test-store', channelKey: 'test-channel', expiresAt: new Date(Date.now() + 600_000).toISOString() });
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function harness() {
  const values = new Map(), logs = [], requests = [], sdkRequests = [];
  const h = { values, logs, requests, sdkRequests, sdk: async () => undefined, post: async () => null, social: async () => null };
  const globals = { URL, Request, Date, Error, setTimeout, location: { origin: 'https://example.test' },
    console: { info: (...args) => logs.push(args) }, sessionStorage: {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    } };
  function load(path, imports = {}) {
    const exports = {};
    const source = readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('import.meta.env.VITE_API_BASE_URL', "''");
    vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { ...globals, exports, require: name => imports[name] ?? {} });
    return exports;
  }
  h.draft = load('../src/auth/registrationDraft.ts');
  h.identity = load('../src/auth/registrationIdentity.ts', {
    './registrationDraft': h.draft, '../api/client': { ApiError, unwrap: value => value, api: { POST: async (path, request) => {
      requests.push({ path, body: request.body }); return path.endsWith('/identity-session') ? session() : h.post(path, request.body);
    } } }, './social': { socialRequest: async (path, body) => {
      requests.push({ path, body }); return path.endsWith('/identity-session') ? session() : h.social(path, body);
    } }, '../api/portone': { loadPortOne: async () => ({ requestIdentityVerification: async config => { sdkRequests.push(config); return h.sdk(config); } }) },
  });
  h.start = async (value = input) => { let saved; await h.identity.startRegistrationIdentity(value, draft => { saved = draft; }).catch(() => {}); return saved; };
  h.socialModule = fetch => load('../src/auth/social.ts', { '../api/client': { ApiError, authFetch: fetch } });
  return h;
}

test('persist before SDK, allowlist excludes passwords, platform routing and safe logs', async () => {
  const h = harness();
  h.sdk = async config => {
    const saved = h.draft.readRegistrationDraft().draft;
    assert.equal(saved.identityVerificationId, config.identityVerificationId);
    assert.equal(h.values.get(h.draft.registrationKey).includes('password'), false);
    assert.deepEqual(JSON.parse(JSON.stringify(config.windowType)), { pc: 'POPUP', mobile: 'REDIRECTION' });
    assert.equal(config.redirectUrl, 'https://example.test/auth/registration/return');
    return { identityVerificationId: config.identityVerificationId };
  };
  await h.identity.startRegistrationIdentity({ ...input, password: 'never-persist-this' }, () => {});
  const logs = JSON.stringify(h.logs);
  for (const secret of ['test-token', 'test-identity', input.email, input.nickname, 'never-persist-this']) assert.equal(logs.includes(secret), false);
});

test('missing popup callback can resume via existing register API without reopening SDK', async () => {
  const h = harness(), draft = await h.start();
  assert.ok(h.draft.readRegistrationDraft().draft);
  await h.identity.finishRegistration(draft, input, 'fresh-password');
  assert.equal(h.sdkRequests.length, 1);
  assert.equal(h.requests.filter(r => r.path === '/api/auth/register').length, 1);
  assert.equal(h.requests.at(-1).body.identityVerificationToken, draft.identityVerificationToken);
  assert.equal(h.requests.at(-1).body.password, 'fresh-password');
  assert.equal(h.draft.readRegistrationDraft().draft, null);
});

test('concurrent finalization is coalesced and late popup callback cannot retry a failed request', async () => {
  const h = harness(), sdk = deferred(), post = deferred(), saved = deferred();
  h.sdk = () => sdk.promise; h.post = () => post.promise;
  const opening = h.identity.startRegistrationIdentity(input, saved.resolve);
  const draft = await saved.promise;
  const first = h.identity.finishRegistration(draft, input, 'password');
  assert.equal(h.identity.finishRegistration(draft, input, 'password'), first);
  post.reject(new ApiError(0, 'response lost'));
  await assert.rejects(first);
  assert.equal(h.draft.readRegistrationDraft().draft.stage, 'uncertain');
  assert.match(h.identity.registrationErrorMessage(new ApiError(0, 'lost')), /먼저 로그인/);
  sdk.resolve({ identityVerificationId: draft.identityVerificationId });
  assert.equal(await opening, null);
  assert.equal(h.requests.filter(r => r.path === '/api/auth/register').length, 1);
});

test('explicit cancellation clears; provider error retains; expiry clears', async () => {
  const h = harness();
  h.sdk = async () => ({ code: 'PG_PROVIDER_ERROR', message: '사용자가 본인인증을 취소하였습니다.' });
  await h.start(); assert.equal(h.draft.readRegistrationDraft().draft, null);
  h.sdk = async () => ({ code: 'PG_PROVIDER_ERROR', message: 'temporary error' });
  const saved = await h.start(); assert.ok(h.draft.readRegistrationDraft().draft);
  h.draft.saveRegistrationDraft({ ...saved, expiresAt: new Date(Date.now() - 1).toISOString() });
  assert.match(h.draft.readRegistrationDraft().notice, /만료/);
  assert.equal(h.values.has(h.draft.registrationKey), false);
});

test('malformed storage and changed identity binding cannot finalize; server rejection remains authoritative', async () => {
  const h = harness();
  h.values.set(h.draft.registrationKey, '{');
  assert.equal(h.draft.readRegistrationDraft().draft, null);
  const draft = await h.start();
  await assert.rejects(h.identity.finishRegistration(draft, { ...input, email: 'other@example.test' }));
  assert.equal(h.requests.filter(r => r.path === '/api/auth/register').length, 0);
  h.post = async () => { throw new ApiError(409, '본인인증을 완료해 주세요.'); };
  await assert.rejects(h.identity.finishRegistration(draft, input, 'password'), { status: 409 });
  assert.ok(h.draft.readRegistrationDraft().draft);
});

test('social incomplete/lost response stays recoverable; successful response clears draft', async () => {
  const h = harness(), social = { ...input, kind: 'social', flowSecret: 'test-flow' };
  const draft = await h.start(social);
  h.social = async () => ({ status: 'LOGGED_IN', tokens: null });
  await assert.rejects(h.identity.finishRegistration(draft, social), { status: 0 });
  assert.equal(h.draft.readRegistrationDraft().draft.stage, 'uncertain');
  h.social = async () => ({ status: 'LOGGED_IN', tokens: { accessToken: 'test-access', refreshToken: 'test-refresh', userId: 1 } });
  await h.identity.finishRegistration(draft, social);
  assert.equal(h.draft.readRegistrationDraft().draft, null);
  assert.equal(JSON.stringify(h.logs).includes('test-flow'), false);
});

test('social transport/non-JSON failures report ambiguous outcome; HTTP session expiry preserved', async () => {
  const h = harness();
  for (const fetch of [async () => { throw new TypeError('network'); }, async () => ({ json: async () => { throw new SyntaxError('html'); } })]) {
    await assert.rejects(h.socialModule(fetch).socialRequest('/api/auth/social/register', {}), { status: 0 });
  }
  await assert.rejects(h.socialModule(async () => ({ ok: false, status: 401, json: async () => ({ success: false, message: 'expired' }) })).socialRequest('/api/auth/social/register', {}), { status: 401 });
});

test('request draft return path survives identity navigation without storing passwords', async () => {
  const h = harness();
  const value = { ...input, returnTo: '/request/start', password: 'never-persist-this' };
  const draft = await h.start(value);
  assert.equal(h.draft.readRegistrationDraft().draft.input.returnTo, '/request/start');
  assert.equal(h.values.get(h.draft.registrationKey).includes('never-persist-this'), false);
  await h.identity.finishRegistration(draft, value, 'fresh-password');
  assert.equal('returnTo' in h.requests.at(-1).body, false);
});

test('registration only persists the known request return path', async () => {
  for (const returnTo of ['https://example.com', '//example.com', '/admin']) {
    const h = harness();
    await h.start({ ...input, returnTo });
    assert.equal(h.draft.readRegistrationDraft().draft.input.returnTo, undefined);
  }
});
