import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual adapter without a browser or a real API key.
const source = readFileSync(new URL('../src/home/banners.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
let response;
let failure;
let last;
const exports = {};
vm.runInNewContext(compiled, {
  exports, URL,
  require: () => ({
    api: { GET: async (path, options) => {
      last = { path, options };
      if (failure) throw failure;
      return response;
    } },
    unwrap: async (call) => call,
  }),
});
const { safeExternalUrl, getBanners, getPerformance } = exports;
assert.equal(safeExternalUrl('javascript:alert(1)'), undefined);
assert.equal(safeExternalUrl('data:text/html,test'), undefined);
assert.equal(safeExternalUrl('https://user:password@example.com/'), undefined);
assert.equal(safeExternalUrl('not a URL'), undefined);
assert.equal(safeExternalUrl('http://www.kopis.or.kr/poster.jpg'), 'https://www.kopis.or.kr/poster.jpg');
assert.equal(safeExternalUrl('https://example.com/booking?id=1'), 'https://example.com/booking?id=1');
response = {
  from: '2026-10-01', to: '2026-10-07', attribution: ['KOPIS test attribution'],
  items: [{ kopisId: 'PF123', name: '테스트 공연', rank: 1, posterUrl: 'http://www.kopis.or.kr/a.jpg',
    venueName: '공연장', area: '서울', performancePeriod: '2026.11.01~2026.11.02' },
  { kopisId: '../bad', name: 'Invalid', rank: 2 }],
};
const signal = new AbortController().signal;
const result = await getBanners(signal);
assert.equal(last.path, '/api/performances/rankings');
assert.equal(last.options.params.query.size, 5);
assert.equal(last.options.signal, signal);
assert.equal(result.banners.length, 1);
assert.equal(result.banners[0].id, 'PF123');
assert.equal(result.banners[0].title, '테스트 공연');
assert.equal(result.banners[0].image, 'https://www.kopis.or.kr/a.jpg');
assert.equal(result.banners[0].venue, '서울 · 공연장');
assert.equal(result.attribution[0], 'KOPIS test attribution');
assert.equal('ticketOpenAt' in result.banners[0], false);
response = { from: '', to: '', items: [] };
assert.equal((await getBanners()).banners.length, 0);
failure = new Error('503');
await assert.rejects(getBanners(), /503/);
failure = undefined;
response = { name: '상세', bookingLinks: [] };
assert.equal((await getPerformance('PF123', signal)).name, '상세');
assert.equal(last.path, '/api/performances/{kopisId}');
assert.equal(last.options.params.path.kopisId, 'PF123');
assert.equal(last.options.signal, signal);
console.log('KOPIS banner adapter: all assertions passed (mapping, empty/error, URLs, cancellation, detail).');
