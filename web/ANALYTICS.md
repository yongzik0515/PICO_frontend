# Main-site analytics

- GA4: `G-90PSYD8LD5` (existing project).
- Enabled only for production builds on `pico-kr.app`. No new dependency or backend endpoint.
- Main-app Clarity recording is disabled at the product owner's request to avoid its browser overhead. The existing onboarding integration is unchanged.
- No notice/consent banner is added, per the product owner's explicit instruction. This implementation does not claim legal compliance or send a fabricated consent-granted signal.
- Browser Do Not Track / Global Privacy Control disable this integration.

## Data boundaries

GA sends manual page views with a fixed `PICO` title, route IDs replaced by `:id`, and only limited ASCII campaign parameters. Authentication recovery/verification, social callbacks, admin, reports, inquiries and unknown routes are excluded. Referrer is reduced to its origin; no member ID, email, name or payment amount is submitted. Google Signals and ad-personalization signals are disabled. Keep GA enhanced measurement/history-based automatic page views **off** for this stream; manual events would otherwise duplicate visits or capture raw URLs. This stream setting also applies to the existing onboarding integration.

The normal React Router SPA navigation is unchanged. There is no screen recording, DOM observer, or Clarity navigation facade in the main app.

## Verification

Use Node.js 24 for `node --test scripts/test-analytics.mjs`, then `npm run build`. The focused tests cover sensitive URL exclusion and campaign retention.

For live QA, use a separate campaign such as `?utm_source=codex_qa&utm_medium=test&utm_campaign=analytics_setup_20261105`. Confirm GA realtime events under this campaign; don't count these as ad results. Verify main-app documents contain `pico-ga4` and no Clarity script. No payment or identity-verification operation is needed.

Reference: [GA manual page views](https://developers.google.com/analytics/devguides/collection/ga4/views).
