import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, modules = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: name => {
    if (!(name in modules)) throw new Error(`Unexpected module: ${name}`);
    return modules[name];
  } });
  return exports;
}
const pick = load('../src/api/pick.ts');
let request;
const client = { api: { PUT: (path, options) => { request = { path, ...options }; return options.body; } }, unwrap: value => value };
const profile = load('../src/agent/profile.ts', {
  '../api/client': client, '../api/pick': pick, '../api/portone': {}, '../transactions/model': {},
});
const agents = load('../src/discovery/agent.ts', { react: {}, '../api/client': client, '../api/pick': pick });
const existing = profile.toProfile({ id: 10, status: 'PUBLISHED', careerDescription: '기존 경력', careerStartedOn: '2022-01-01' });
assert.equal(existing.body.careerDescription, '기존 경력');
for (const careerDescription of ['콘서트 예매 도움 4년', '']) {
  await profile.savePublicProfile({ ...existing.body, careerDescription }, 10);
  assert.equal(request.path, '/api/me/agent/public-profile');
  assert.equal(request.body.expectedProfileId, 10);
  assert.equal(request.body.careerDescription, careerDescription);
}
assert.equal(agents.toAgent({ careerDescription: '수정한 활동 경력', careerStartedOn: '2022-01-01' }).career, '수정한 활동 경력');
assert.equal(agents.toAgent({ careerDescription: '' }).career, '미입력');
assert.match(agents.toAgent({ careerStartedOn: '2022-01-01' }).career, /년/);
console.log('Profile career: existing value, update/clear payload, displayed description and legacy date fallback passed.');
