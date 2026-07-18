---
phase: 4
slug: response-overlay-logging
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.10 (unit, environment: happy-dom) + @playwright/test ^1.61.1 (E2E) |
| **Config file** | `vitest.config.js` (excludes `tests/e2e/**`) / `playwright.config.js` (testDir: `./tests/e2e`, 390px viewport, `hasTouch: true`) |
| **Quick run command** | `npx vitest run tests/response.test.js tests/log.test.js` |
| **Full suite command** | `npm test` (Vitest) + `npx playwright test` (E2E, requires `npm run build` first) |
| **Estimated runtime** | ~10 seconds (Vitest) + ~30 seconds (Playwright) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/response.test.js tests/log.test.js`
- **After every plan wave:** Run `npm test` (full Vitest suite) + `npx playwright test`
- **Before `/gsd-verify-work`:** Full suite must be green (Vitest + Playwright)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | RESP-01 | — | Overlay container `pointer-events: none`; response elements `pointer-events: auto`; host DOM untouched | unit | `npx vitest run tests/response.test.js -t "RESP-01"` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | RESP-02 | — | `clampToViewport()` clamps correctly for both bbox-present and bbox-null (fallback) inputs | unit | `npx vitest run tests/response.test.js -t "RESP-02"` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 0 | RESP-03 | T-04-01 | All 4 response types render correct copy; `discount_offer` `postMessage` uses explicit `targetOrigin`, never `'*'` | unit | `npx vitest run tests/response.test.js -t "RESP-03"` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 0 | RESP-01/02/03 | — | Overlay renders above host UI without blocking interaction, real 390px mobile-emulated Chromium | e2e | `npx playwright test tests/e2e/harness.spec.js -g "response"` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 0 | LOG-01 | T-04-03 | All 6 event types produce exactly one `console.log('[heed]', ...)` line with `{ts,sessionId,partnerId,event,data}`, gated by `activeScreens` | unit | `npx vitest run tests/log.test.js -t "LOG-01"` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 0 | LOG-01 (session-end) | — | `flow:complete` and `pagehide` both call `endSession` exactly once combined via `sessionEnded` guard | unit | `npx vitest run tests/log.test.js -t "session-lifecycle"` | ❌ W0 | ⬜ pending |
| 04-02-03 | 02 | 0 | LOG-01 (activeScreens) | T-04-03 | Gate allows/blocks logging + response rendering based on `history.pushState`-simulated pathname | unit | `npx vitest run tests/log.test.js -t "activeScreens"` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 0 | RESP-03 (concurrency) | — | Second above-threshold `inference:result` while a bubble shows dismisses old bubble with `dismissReason: "replaced"` before rendering new | unit | `npx vitest run tests/response.test.js -t "D-05"` | ❌ W0 | ⬜ pending |
| 04-00-01 | 00 | 0 | (regression) | T-04-03 | `config/schema.json` array-type fields (`activeScreens`) hard-fail correctly, not silently pass `typeof === 'object'` | unit | `npx vitest run tests/config.test.js -t "array"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/response.test.js` — RED suite for RESP-01, RESP-02, RESP-03, D-05
- [ ] `tests/log.test.js` — RED suite for LOG-01, D-01/D-02/D-03 session-lifecycle wiring, D-06/D-07 activeScreens gating
- [ ] `tests/e2e/harness.spec.js` — extend existing file with response-rendering and postMessage-capture assertions (no new E2E file)
- [ ] `tests/config.test.js` — add array-type schema regression cases (existing file, Phase 1 origin)
- [ ] `src/config.js` — fix the verified array-type validation bug (`typeof [] === 'object'`, no array special-case in `walk()`) as part of Wave 0/1, not deferred

*Existing infrastructure (Vitest/happy-dom, Playwright) covers all phase requirements — no new framework installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual overlay appearance (colors, spacing, animation timing) matches 04-UI-SPEC.md | RESP-01/02/03 | Pixel/visual fidelity to a design contract isn't meaningfully assertable via unit tests | Open `test-harness/index.html` in a real mobile-viewport browser, trigger each of the 4 signal types, confirm each response type's copy/color/positioning/animation matches UI-SPEC |
| `discount_offer` postMessage received by a host-page listener | RESP-03 | Cross-window messaging is unit-testable via happy-dom's synchronous `postMessage`, but confirming it in a genuine parent/iframe browser context needs a manual check | Add a temporary `window.addEventListener('message', console.log)` in test-harness's parent context, trigger `price_doubt`, confirm the exact payload shape logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
