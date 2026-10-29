import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
const calls = [];
let failed = false;
let response = { date: '2026-10-28', items: [{ rank: 1, keyword: 'NOL 티켓', category: 'PLATFORM' }, { rank: 2, keyword: '', category: 'AGENT' }] };
const storage = new Map();
const source = readFileSync(new URL('../src/home/popularSearch.ts', import.meta.url), 'utf8');
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports, crypto: { randomUUID },
  localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
  require: () => ({ api: {
    GET: async (path, options) => { calls.push({ path, options }); if (failed) throw Error('offline'); return response; },
    POST: async (path, options) => { calls.push({ path, options }); if (failed) throw Error('offline'); return { recorded: true }; },
  }, unwrap: async (call) => call }),
});
const signal = new AbortController().signal;
assert.equal((await exports.loadPopularSearch(signal)).items.length, 1);
assert.equal(calls[0].options.signal, signal);
response = {};
assert.equal((await exports.loadPopularSearch()).items.length, 0);
await exports.recordSearch(' 태연콘 ');
const first = calls.at(-1);
assert.equal(first.path, '/api/search/events');
assert.equal(first.options.body.query, '태연콘');
await exports.recordSearch('놀티켓');
assert.equal(calls.at(-1).options.body.browserId, first.options.body.browserId);
const before = calls.length;
await exports.recordSearch(''); await exports.recordSearch('a'.repeat(81));
assert.equal(calls.length, before);
failed = true;
await assert.doesNotReject(exports.recordSearch('태연콘'));
await assert.rejects(exports.loadPopularSearch(), /offline/);
const home = readFileSync(new URL('../src/pages/HomePage.tsx', import.meta.url), 'utf8');
assert.equal(home.includes("const popular = ['태연 콘서트'"), false);
assert.ok(home.includes('!e.nativeEvent.isComposing'));
assert.ok(home.includes('void recordSearch(keyword)'));
console.log('Popular search frontend tests passed: API results, empty results, UUID reuse, validation, error isolation, IME guard.');
