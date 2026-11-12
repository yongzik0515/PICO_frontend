import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/transactions/ui.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, require: (name) => {
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'react') return React;
  if (name === '../ui/Icon') return { Icon: () => React.createElement('i', { 'data-check': true }) };
  return {};
}});
const complete = renderToStaticMarkup(React.createElement(exports.Progress, { stage: 'matching_completed', direct: true }));
assert.equal((complete.match(/class="done"/g) ?? []).length, 4);
assert.equal(complete.includes('현재 진행 단계예요'), false);
assert.equal(complete.includes('aria-current'), false);
const upcoming = renderToStaticMarkup(React.createElement(exports.Progress, { stage: 'booking_upcoming', direct: true }));
assert.equal((upcoming.match(/class="done"/g) ?? []).length, 3);
assert.equal(upcoming.includes('현재 진행 단계예요'), true);
const notice = renderToStaticMarkup(React.createElement(exports.NextStep, { stage: 'matching_completed', role: 'user', reviewWritten: true }));
assert.equal(notice.includes('후기 작성까지 완료했어요'), true);
console.log('Reviewed direct trade has four completed steps, no current-step label, and a completion notice.');
