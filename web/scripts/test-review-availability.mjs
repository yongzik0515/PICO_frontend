import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/transactions/reviewAvailability.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, { exports });
const open = exports.isReviewOpen;
const at = Date.parse('2026-11-03T09:00:00Z');
const r = { status: 'MATCHING_COMPLETED', opensAt: '2026-11-03T09:00:00', useAt: '2026-11-10T09:00:00' };
assert.equal(open(r, at - 1), false);
assert.equal(open(r, at), true);
assert.equal(open(r, at + 1), true);
assert.equal(open({ ...r, opensAt: '2026-11-03T18:00:00+09:00' }, at), true);
assert.equal(open({ ...r, opensAt: '' }, at), true);
assert.equal(open({ ...r, opensAt: 'invalid' }, at), false);
for (const status of ['PENDING', 'MATCHED', 'IN_PROGRESS', 'CANCELLED']) assert.equal(open({ ...r, status }, at), false);
assert.equal(open({ ...r, status: 'COMPLETED' }, at - 1), true);
console.log('Review opening boundaries, timezone, legacy records and statuses passed.');
