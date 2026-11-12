import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const exports = {};
const calls = [];
let answer = { keyword: '태연 콘서트' };
let failed = false;
const source = readFileSync(new URL('../src/home/aiKeyword.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports,
  require: () => ({
    api: { POST: async (path, options) => { calls.push({ path, options }); if (failed) throw Error('503'); return answer; } },
    unwrap: async (call) => call,
  }),
});
const correct = exports.correctKeyword;

assert.equal(await correct(' 태연콘 '), '태연 콘서트');
assert.equal(calls[0].path, '/api/ai/search-keyword');
assert.equal(calls[0].options.body.query, '태연콘');
answer = { keyword: '태연콘' };
assert.equal(await correct('태연콘'), null); // nothing to correct
answer = { keyword: 'IU 콘서트' };
assert.equal(await correct('iu콘서트'), null); // spacing/case only
answer = {};
assert.equal(await correct('태연콘'), null);
const before = calls.length;
assert.equal(await correct('   '), null);
assert.equal(await correct('a'.repeat(101)), null);
assert.equal(calls.length, before); // no call for empty or over-long input
failed = true;
assert.equal(await correct('태연콘'), null); // AI off or failing: original search only

const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
assert.ok(home.includes('submitSearch(p.keyword, false)')); // popular chips skip AI
assert.ok(home.includes('ai && loggedIn')); // only signed-in confirmed searches call AI
assert.ok(home.includes('aiAlias.query === query.trim()')); // a stale correction is dropped once the input changes
const agent = readFileSync(new URL('../src/discovery/agent.ts', import.meta.url), 'utf8');
assert.ok(agent.includes("alias: q && alias?.trim() ? alias.trim() : undefined"));
console.log('AI keyword: corrected spelling, unchanged/spacing-only answers, empty/long input, failures, home wiring passed.');
