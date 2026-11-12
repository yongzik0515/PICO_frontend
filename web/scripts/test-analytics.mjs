// Node.js 24: node --test scripts/test-analytics.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { safeAnalyticsUrl } from '../src/analytics.ts';

const origin = 'https://pico-kr.app';
const url = value => new URL(value, origin);

test('광고 UTM은 유지하고 토큰·이름·이메일 검색값은 GA에 보내지 않는다', () => {
  const page = safeAnalyticsUrl(url('/?utm_source=twitter&utm_medium=paid_social&token=SECRET&name=PERSON&q=test%40mail.com#SECRET'));
  assert.equal(page, `${origin}/?utm_source=twitter&utm_medium=paid_social`);
  assert.equal(safeAnalyticsUrl(url('/requests/123/payment?identityVerificationId=SECRET')), `${origin}/requests/:id/payment`);
  assert.equal(safeAnalyticsUrl(url('/agents/456?utm_content=blue_v1')), `${origin}/agents/:id?utm_content=blue_v1`);
});

test('민감 URL과 알려지지 않은 경로는 GA 페이지뷰에서 제외한다', () => {
  for (const path of ['/reset-password?token=SECRET', '/verify-email?token=SECRET', '/recovery?code=SECRET',
    '/auth/social/callback?code=SECRET', '/admin?q=PRIVATE', '/report?name=PERSON', '/unknown/SECRET']) {
    assert.equal(safeAnalyticsUrl(url(path)), null, path);
  }
});
