import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:5177';
if (new URL(base).hostname !== '127.0.0.1') throw new Error('Run against a local fixture server only.');
const out = process.env.QA_OUTPUT_DIR || join(tmpdir(), 'pico-registration-qa', 'screenshots');
await mkdir(out, { recursive: true });
const key = 'pico.registration.v1';
const input = { kind: 'email', email: 'resume@example.test', nickname: '이어가기테스트', termsDocumentId: 1, privacyDocumentId: 2, adultConfirmed: true };
const draft = (social = false) => ({ version: 1, input: social ? { ...input, kind: 'social', flowSecret: 'qa-flow' } : input,
 identityVerificationToken: 'qa-token', identityVerificationId: 'qa-identity', expiresAt: new Date(Date.now() + 600000).toISOString(), stage: 'identity' });
const flow = () => ({ flowSecret: 'qa-flow', purpose: 'LOGIN', from: '/user-profile', expiresAt: Date.now() + 600000 });
const results = [];
async function setup(browser, { width = 390, mobile = true, seed, socialFlow, sdk = 'missing', register = 'success', ua } = {}) {
 const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: mobile, hasTouch: mobile, ...(ua ? { userAgent: ua } : {}) });
 const state = { sessions: 0, registers: [], complete: 0, register, errors: [], completeResult: null };
 await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  if (url.hostname !== '127.0.0.1') {
   if (url.hostname === 'cdn.jsdelivr.net') return route.continue();
   return route.abort();
  }
  if (!url.pathname.startsWith('/api/')) return route.continue();
  const envelope = (data, status = 200, message = '') => route.fulfill({ status, json: { success: status < 400, data, message } });
  if (url.pathname === '/api/policies') return envelope([{ id: 1, type: 'TERMS', contentUrl: '/terms' }, { id: 2, type: 'PRIVACY', contentUrl: '/signup-privacy' }]);
  if (url.pathname.endsWith('/identity-session')) { state.sessions++; return envelope({ ...draft(), storeId: 'qa-store', channelKey: 'qa-channel' }); }
  if (url.pathname === '/api/auth/social/complete') { state.complete++; return envelope(state.completeResult || { status: 'REGISTRATION_REQUIRED', provider: 'google', tokens: null }); }
  if (url.pathname === '/api/auth/register' || url.pathname === '/api/auth/social/register') {
   state.registers.push(route.request().postDataJSON());
   if (state.register === 'abort') return route.abort('connectionreset');
   if (state.register === 'pending') return envelope(null, 409, '본인인증을 완료해 주세요.');
   if (state.register === 'expired') return envelope(null, 401, '소셜 인증 세션이 만료됐어요.');
   await new Promise(r => setTimeout(r, 200));
   return envelope(url.pathname.includes('/social/') ? { status: 'LOGGED_IN', provider: 'google', tokens: { accessToken: 'qa-access', refreshToken: 'qa-refresh', userId: 1 } } : { id: 1 }, url.pathname.includes('/social/') ? 200 : 201);
  }
  if (url.pathname === '/api/me') return envelope({ id: 1, nickname: '테스트', email: input.email, role: 'USER' });
  return envelope([]);
 });
 await context.addInitScript(({ seed, socialFlow, sdk, key }) => {
  if (!sessionStorage.getItem('qa.initialized')) {
   sessionStorage.setItem('qa.initialized', '1');
   if (seed) sessionStorage.setItem(key, JSON.stringify(seed));
   if (socialFlow) sessionStorage.setItem('pico.socialFlow', JSON.stringify(socialFlow));
  }
  window.PortOne = { requestIdentityVerification: async config => {
   sessionStorage.setItem('qa.sdk.config', JSON.stringify(config));
   sessionStorage.setItem('qa.sdk.calls', String(Number(sessionStorage.getItem('qa.sdk.calls') || 0) + 1));
   if (sdk === 'redirect') { location.assign(config.redirectUrl + '?identityVerificationId=qa-identity'); return new Promise(() => {}); }
   if (sdk === 'unresolved') return new Promise(resolve => { window.qaResolveSDK = resolve; });
   if (sdk === 'cancel') return { code: 'Cancelled' };
   if (sdk === 'success') return { identityVerificationId: config.identityVerificationId };
   return undefined;
  } };
 }, { seed, socialFlow, sdk, key });
 const page = await context.newPage();
 page.on('pageerror', e => state.errors.push(e.message));
 return { context, page, state };
}
async function ready(page, social = false) { await page.locator('input[name=nickname]').waitFor(); if (!social) await page.locator('input[name=email]').waitFor(); }
async function fill(page, social = false) {
 await ready(page, social);
 if (!social) { const email = page.locator('input[name=email]'); if (!(await email.getAttribute('readonly'))) await email.fill(input.email); await page.locator('input[name=password]').fill('qa-password-123'); }
 await page.locator('input[name=nickname]').fill(input.nickname);
 for (const box of await page.locator('form input[type=checkbox]').all()) await box.check();
}
async function submit(page) { await page.locator('form .account-form-footer button').click(); }
async function waitDraft(page) { await page.waitForFunction(key => !!sessionStorage.getItem(key), key); }
async function waitSuccess(page) { await page.getByRole('heading', { name: /님 반가워요/ }).waitFor(); }
async function checkLayout(page, name, width) {
 await page.evaluate(() => document.fonts.ready);
 const geometry = await page.evaluate(() => {
  const form = document.querySelector('.account-contained');
  const bad = [...form.querySelectorAll('input:not([type=checkbox]), button, .account-note, .check-row, .field')].map(e => ({ tag: e.tagName, text: e.textContent.slice(0, 40), rect: e.getBoundingClientRect() })).filter(e => e.rect.left < -1 || e.rect.right > innerWidth + 1);
  const font = getComputedStyle(document.querySelector('input[name=nickname]')).fontFamily;
  const button = document.querySelector('form .account-form-footer button');
  return { viewport: innerWidth, scroll: document.documentElement.scrollWidth, bad, font, fontLoaded: document.fonts.check('16px "Pretendard Variable"'), inputSize: getComputedStyle(document.querySelector('input[name=nickname]')).fontSize, buttonHeight: button.getBoundingClientRect().height, buttonFont: getComputedStyle(button).fontFamily };
 });
 assert.ok(geometry.scroll <= geometry.viewport + 1, JSON.stringify(geometry));
 assert.equal(geometry.bad.length, 0, JSON.stringify(geometry));
 assert.match(geometry.font, /Pretendard/);
 assert.equal(geometry.fontLoaded, true, 'The existing Pretendard font must load.');
 assert.equal(await page.locator('form .account-form-footer button').evaluate(e => e.scrollWidth <= e.clientWidth + 1), true, 'Button label must fit.');
 assert.equal(geometry.font, geometry.buttonFont);
 assert.ok(geometry.buttonHeight >= 40);
 if (width < 768) assert.ok(parseFloat(geometry.inputSize) >= 16, JSON.stringify(geometry));
 await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
 return geometry;
}
const chrome = await chromium.launch({ headless: true });
const safari = await webkit.launch({ headless: true });
try {
 for (const [label, browser, mobile, sdk] of [['desktop-popup', chrome, false, 'success'], ['chrome-mobile-redirect', chrome, true, 'redirect'], ['webkit-mobile-redirect', safari, true, 'redirect']]) {
  const t = await setup(browser, { width: mobile ? 390 : 1440, mobile, sdk });
  await t.page.goto(base + '/signup'); await fill(t.page); await submit(t.page);
  if (mobile) {
   await t.page.waitForURL(base + '/signup');
   await t.page.getByRole('status').filter({ hasText: /비밀번호를 다시/ }).waitFor();
   assert.equal(await t.page.locator('input[name=password]').inputValue(), '');
   assert.equal(await t.page.locator('input[name=email]').inputValue(), input.email);
   assert.equal(await t.page.locator('input[name=nickname]').inputValue(), input.nickname);
   assert.equal(await t.page.locator('input[type=checkbox]:checked').count(), 3);
   assert.equal(t.state.registers.length, 0);
   assert.equal(await t.page.evaluate(() => location.search), '');
   await t.page.locator('input[name=password]').fill('new-password-123'); await submit(t.page);
  }
  await waitSuccess(t.page);
  assert.equal(t.state.sessions, 1); assert.equal(t.state.registers.length, 1);
  assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  assert.equal(t.state.errors.length, 0, t.state.errors.join('\n'));
  results.push({ scenario: label, passed: true }); await t.context.close();
 }
 // Unresolved callback + refresh: existing token is sufficient and no SDK/session restart occurs.
 {
  const t = await setup(chrome, { sdk: 'unresolved' });
  await t.page.goto(base + '/signup'); await fill(t.page); await submit(t.page); await waitDraft(t.page);
  assert.equal((await t.page.evaluate(key => sessionStorage.getItem(key), key)).includes('qa-password'), false);
  await t.page.reload(); await ready(t.page);
  assert.equal(await t.page.locator('input[name=password]').inputValue(), '');
  await t.page.locator('input[name=password]').fill('new-password-123');
  await t.page.locator('form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
  await waitSuccess(t.page); assert.equal(t.state.registers.length, 1); assert.equal(t.state.sessions, 1);
  results.push({ scenario: 'refresh-missing-callback-double-submit', passed: true }); await t.context.close();
 }
 {
  const t = await setup(chrome, { sdk: 'unresolved', register: 'abort' });
  await t.page.goto(base + '/signup'); await fill(t.page); await submit(t.page); await waitDraft(t.page); await submit(t.page);
  await t.page.getByText(/가입 결과를 확인하지 못했어요. 먼저 로그인/).waitFor();
  assert.equal(await t.page.evaluate(key => JSON.parse(sessionStorage.getItem(key)).stage, key), 'uncertain');
  await t.page.evaluate(() => window.qaResolveSDK({ identityVerificationId: 'qa-identity' }));
  await t.page.waitForTimeout(250); assert.equal(t.state.registers.length, 1);
  t.state.register = 'success'; await submit(t.page); await waitSuccess(t.page);
  assert.equal(t.state.registers.length, 2); assert.equal(t.state.sessions, 1);
  results.push({ scenario: 'lost-response-and-late-callback', passed: true }); await t.context.close();
 }
 for (const [label, seed, suffix, expected] of [
  ['expired-token', { ...draft(), expiresAt: new Date(Date.now() - 1000).toISOString() }, '', /만료/],
  ['untrusted-success-url', undefined, '?identityVerificationId=forged', /남아 있는 가입 정보가 없어요/],
  ['mismatched-id', draft(), '?identityVerificationId=other', /인증 결과를 확인하지 못했어요/],
  ['explicit-cancel-return', draft(), '?code=Cancelled', /취소/],
 ]) {
  const t = await setup(chrome, { seed }); await t.page.goto(base + '/auth/registration/return' + suffix);
  await ready(t.page); await t.page.getByRole('status').filter({ hasText: expected }).waitFor();
  assert.equal(t.state.registers.length, 0); assert.equal(t.state.sessions, 0);
  if (label !== 'mismatched-id') assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  results.push({ scenario: label, passed: true }); await t.context.close();
 }
 for (const browser of [chrome, safari]) {
  const t = await setup(browser, { socialFlow: flow(), sdk: 'redirect' });
  await t.page.goto(base + '/auth/social/callback'); await fill(t.page, true); await submit(t.page);
  await t.page.getByRole('status').filter({ hasText: /가입 이어하기를 눌러 본인인증/ }).waitFor();
  assert.equal(await t.page.locator('input[name=nickname]').inputValue(), input.nickname);
  assert.equal(await t.page.locator('input[type=checkbox]:checked').count(), 3);
  await submit(t.page); await t.page.waitForURL(base + '/user-profile');
  assert.equal(t.state.registers.length, 1); assert.equal(t.state.sessions, 1);
  assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  results.push({ scenario: browser === safari ? 'webkit-social-redirect' : 'chrome-social-redirect', passed: true }); await t.context.close();
 }
 for (const clientExpired of [false, true]) {
  const t = await setup(chrome, { seed: draft(true), socialFlow: { ...flow(), ...(clientExpired ? { expiresAt: Date.now() - 1 } : {}) }, register: 'expired' });
  await t.page.goto(base + '/auth/social/callback');
  if (!clientExpired) { await ready(t.page, true); await submit(t.page); }
  await t.page.getByRole('alert').filter({ hasText: /만료/ }).waitFor();
  assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  assert.equal(await t.page.evaluate(() => sessionStorage.getItem('pico.socialFlow')), null);
  results.push({ scenario: clientExpired ? 'social-client-expiry' : 'social-server-expiry', passed: true }); await t.context.close();
 }
 {
  const t = await setup(chrome, { seed: draft(true), socialFlow: flow() });
  t.state.completeResult = { status: 'LOGGED_IN', provider: 'google', tokens: { accessToken: 'qa-access', refreshToken: 'qa-refresh', userId: 1 } };
  await t.page.goto(base + '/auth/social/callback'); await t.page.waitForURL(base + '/user-profile');
  assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  assert.equal(t.state.registers.length, 0);
  results.push({ scenario: 'social-already-completed-cleans-draft', passed: true }); await t.context.close();
 }
 for (const sdk of ['cancel', 'unresolved']) {
  const t = await setup(chrome, { sdk }); await t.page.goto(base + '/signup'); await fill(t.page); await submit(t.page);
  if (sdk === 'unresolved') { await waitDraft(t.page); await t.page.getByRole('button', { name: '가입 진행 취소하고 다시 시작' }).click(); }
  await t.page.getByText(/본인인증을 취소했어요|가입 진행을 취소했어요/).waitFor();
  assert.equal(await t.page.evaluate(key => sessionStorage.getItem(key), key), null);
  assert.equal(t.state.registers.length, 0);
  results.push({ scenario: `cancel-${sdk}`, passed: true }); await t.context.close();
 }
 for (const width of [320, 390, 1440]) {
  const t = await setup(chrome, { width, mobile: width < 768 });
  await t.page.goto(base + '/signup'); await ready(t.page);
  results.push({ scenario: `initial-email-${width}`, ...await checkLayout(t.page, 'initial-email', width) }); await t.context.close();
 }
 // Layout/font checks use real application CSS and the deployed font CDN, with API fixtures only.
 for (const [name, browser] of [['chromium', chrome], ['webkit', safari]]) {
  for (const width of [320, 375, 390, 768, 1024, 1440]) {
   for (const social of [false, true]) {
    const t = await setup(browser, { width, mobile: width < 768, seed: draft(social), socialFlow: social ? flow() : undefined });
    await t.page.goto(base + (social ? '/auth/social/callback' : '/signup')); await ready(t.page, social);
    const geometry = await checkLayout(t.page, `${name}-${social ? 'social' : 'email'}`, width);
    assert.equal(t.state.errors.length, 0, t.state.errors.join('\n'));
    results.push({ scenario: `${name}-${social ? 'social' : 'email'}-${width}`, ...geometry }); await t.context.close();
   }
  }
 }
 for (const suffix of ['KAKAOTALK 26.1.0', 'NAVER(inapp; search; 1200; 12.0.0)', 'Instagram 420.0.0']) {
  const t = await setup(chrome, { sdk: 'redirect', ua: `Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Mobile Safari/537.36 ${suffix}` });
  await t.page.goto(base + '/signup'); await fill(t.page); await submit(t.page);
  await t.page.getByRole('status').filter({ hasText: /비밀번호를 다시/ }).waitFor();
  await t.page.locator('input[name=password]').fill('new-password-123'); await submit(t.page); await waitSuccess(t.page);
  results.push({ scenario: `inapp-UA-simulation-${suffix}`, passed: true }); await t.context.close();
 }
 await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
 console.log(JSON.stringify({ passed: results.length, report: `${out}/results.json` }));
} finally { await chrome.close(); await safari.close(); }
