import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/discovery/recentMatch.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports, Intl });
const recent = exports.recentMatch;
const now = Date.parse('2026-10-29T05:00:00Z');
const at = (ms) => new Date(now - ms).toISOString();
assert.equal(recent(undefined, now), null);
assert.equal(recent('not-a-date', now), null);
assert.equal(recent('2026-10-29T05:00:00', now).text, '방금 전');
assert.equal(recent(at(59_999), now).text, '방금 전');
assert.equal(recent(at(60_000), now).text, '1분 전');
assert.equal(recent(at(59 * 60_000), now).text, '59분 전');
assert.equal(recent(at(3_600_000), now).text, '1시간 전');
assert.equal(recent(at(6 * 3_600_000), now).text, '6시간 전');
assert.equal(recent(at(86_400_000), now).text, '1일 전');
assert.equal(recent(at(2 * 86_400_000), now).text, '2일 전');
assert.equal(recent(at(7 * 86_400_000), now).text, '10월 22일');
assert.equal(recent('2025-12-31T16:00:00Z', now).text, '1월 1일');
assert.equal(recent('2025-01-01T00:00:00Z', now).text, '2025년 1월 1일');
assert.equal(recent(at(-3_600_000), now), null);
assert.equal(recent('2026-10-29T14:00:00+09:00', now).dateTime, '2026-10-29T05:00:00.000Z');
console.log('Recent matching: UTC/KST, minute/hour/day boundaries, invalid/future dates, and old-year tests passed.');
