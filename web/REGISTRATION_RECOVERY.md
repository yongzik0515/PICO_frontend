# Registration recovery

PC uses the PortOne popup; mobile uses redirection to `/auth/registration/return`.
Before opening PortOne, `pico.registration.v1` in `sessionStorage` retains the server-issued
identity token, request ID, server expiry, nickname, current consent document IDs, and
email or social-flow binding. Passwords and provider identity data are never stored.
Recovery is limited to the same browser tab and server validity period.

Both the popup response and **가입 이어하기** use the existing register API. The server
rechecks PortOne, expiry, identity uniqueness, age and consent. Return URL parameters
only select guidance; they never authorize registration. No new API or DB change is required.
The return URL is replaced immediately, and its initial document skips the X pixel.

- Email redirect/refresh requires password re-entry.
- A missing popup callback preserves the draft. Continue without reopening verification.
- Concurrent submissions for one token share a request. A late popup callback cannot
  automatically retry a request that has already been sent.
- Network/response failure retains the draft and asks the user to check login first.
- Explicit cancellation, expiry and success clear the draft. Social registration also
  needs the existing OAuth session; an expired session restarts social login.
- Diagnostics retain the last 20 stage/time/safe-code records in `pico.registration.events`
  and console output. No password, token, email, nickname, CI or raw provider error is logged.
  This is local troubleshooting history, not centralized monitoring.

## Verification

Run from `web/`:

```sh
node --test scripts/test-registration.mjs
npm run build
npm run lint
```

Optional browser regression and responsive QA use Playwright installed outside the project,
so no production dependency or lockfile change is needed:

```sh
npm install --prefix /tmp/pico-registration-qa --no-audit --no-fund playwright
/tmp/pico-registration-qa/node_modules/.bin/playwright install chromium webkit
npm run dev -- --host 127.0.0.1 --port 5177 --strictPort
# In another terminal, from web/:
PLAYWRIGHT_MODULE=/tmp/pico-registration-qa/node_modules/playwright/index.mjs \
  node scripts/qa-registration-browser.mjs
```

`QA_BASE_URL` may select another local `127.0.0.1` port. `QA_OUTPUT_DIR` selects the
screenshot/JSON report directory (default: system temp directory, `pico-registration-qa/screenshots`).
All API and PortOne responses are fixtures; no real registration or authentication is performed.
The existing font CDN is loaded to check Pretendard, input/button font consistency,
mobile input sizes and overflow at 320, 375, 390, 768, 1024 and 1440 px.

Coverage includes PC completion, mobile return, refresh, missing callback, late callback,
double submission, lost signup response, explicit cancellation, expiry, forged return hints,
social registration and expired social sessions. Kakao/Naver/Instagram checks simulate user
agents in Chromium; WebKit checks are browser-engine tests, not physical iPhone Safari tests.
Actual provider completion and physical mobile/in-app browsers still require a manual smoke test.

Reference: [PortOne identity verification request](https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request).
