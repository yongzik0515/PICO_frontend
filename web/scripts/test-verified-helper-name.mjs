import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jsx from 'react/jsx-runtime';
const exports = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/transactions/VerifiedHelperName.tsx', import.meta.url), 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText, { exports, require: () => jsx });
const render = name => renderToStaticMarkup(React.createElement(exports.VerifiedHelperName,{name}));
assert.equal(render(undefined),'');
assert.equal(render(''),'');
const html = render('Test Helper');
assert.ok(html.includes('본인인증 이름'));
assert.ok(html.includes('Test Helper'));
assert.ok(html.includes('송금 전 예금주'));
assert.ok(html.includes('동명이인'));
assert.ok(!render('<script>alert(1)</script>').includes('<script>'));
console.log('Verified helper name: authorized-value display, absent-name hiding, comparison notice and HTML escaping passed.');
