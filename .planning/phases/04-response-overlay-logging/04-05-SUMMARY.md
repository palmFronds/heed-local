---
phase: 04-response-overlay-logging
plan: 05
subsystem: sdk-integration
tags: [vanilla-js, playwright, e2e, postMessage, crypto.randomUUID, sessionId, bundling]

# Dependency graph
requires:
  - phase: 04-response-overlay-logging (04-03, 04-04)
    provides: src/log.js (initLogging) and src/response.js (initResponse) implementations, both expecting a sessionId parameter
provides:
  - index.js orchestrator wiring sessionId + both new modules into the real init() path
  - Real-browser E2E proof (Playwright) that response.js/log.js bundle and render correctly
  - A demo config that actually fires responses in the standalone harness
affects: [phase-05-weight-persistence, phase-06-integration-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "postMessage-override capture: intercept window.postMessage at the call site in an E2E test instead of relying on same-window MessageEvent delivery, which is impossible over a file:// opaque origin with any non-wildcard targetOrigin"
    - "Demo-specific inference.confidenceThreshold override (0.4) to compensate for intentionally non-saturated cold-start softmax margins (~0.44-0.50), distinct from the 0.65 production default"

key-files:
  created: []
  modified:
    - src/index.js
    - tests/e2e/harness.spec.js
    - test-harness/index.html
    - config/demo-platform.json

key-decisions:
  - "sessionId generated once per init() call via crypto.randomUUID(), threaded into initLogging then initResponse (log.js registers subscriptions first per RESEARCH Assumption A1)"
  - "demo-platform.json's activeScreens changed from a concrete placeholder list to [] (permissive) — the static single-page harness has no real routing, and its file:// pathname never matches any concrete route (04-RESEARCH.md Pitfall 3 explicitly anticipated this)"
  - "demo-platform.json gained inference.confidenceThreshold: 0.4 — the bundled cold-start weights are deliberately non-saturated (~0.44-0.50 real margin, enforced by admin/print-softmax-margins.mjs's own gate), so the 0.65 production default can never fire in the demo harness without a demo-specific override"
  - "discount_offer postMessage E2E coverage captured by overriding window.postMessage in-page rather than asserting real cross-window delivery — over file://, the page's opaque origin can never satisfy the browser's same-origin delivery check against an explicit non-wildcard targetOrigin (verified directly against this exact harness with Playwright); this is a same-origin-policy fact independent of the SDK, not a gap in coverage"

patterns-established: []

requirements-completed: [RESP-01, RESP-02, RESP-03, LOG-01]

coverage:
  - id: D1
    description: "init() generates one sessionId per page load via crypto.randomUUID() and threads it into initLogging(config, sessionId) and initResponse(config, sessionId); return shape unchanged"
    requirement: "LOG-01"
    verification:
      - kind: unit
        ref: "tests/index.test.js (full suite, existing assertions unmodified)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Built dist/sdk.js wires response + logging so a triggered signal renders a bubble in a real mobile-emulated browser (tooltip via touch_hesitation), overlay never blocks the host page underneath"
    requirement: "RESP-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/harness.spec.js#touch_hesitation: renders a tooltip bubble above the host UI without blocking host interaction"
        status: pass
    human_judgment: false
  - id: D3
    description: "discount_offer's postMessage carries the locked payload shape and an explicit non-wildcard target origin"
    requirement: "RESP-03"
    verification:
      - kind: e2e
        ref: "tests/e2e/harness.spec.js#discount_offer: scroll_reversal fires an explicit-origin postMessage carrying the locked payload shape"
        status: pass
    human_judgment: false
  - id: D4
    description: "test-harness/index.html has a parent-context window.addEventListener('message', ...) surfacing discount_offer payloads for manual verification"
    requirement: "RESP-03"
    verification: []
    human_judgment: true
    rationale: "The listener is present and code-correct, but cannot actually receive a delivered message when the harness is opened via file:// (opaque origin can never match an explicit non-wildcard targetOrigin) — a human opening the harness over a real http(s) origin (Phase 6, live Branch 1) is the only way to observe an actual delivered postMessage end-to-end."

# Metrics
duration: 12min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 5: SDK Wiring, E2E Response Coverage & Demo-Harness Fixes Summary

**Wired `crypto.randomUUID()` sessionId generation + `initLogging`/`initResponse` into `index.js`'s `init()`, then proved response.js/log.js bundle and render correctly in a real 390px mobile-emulated Chromium via two new Playwright E2E tests (tooltip rendering + discount_offer postMessage), fixing two demo-config gaps (permissive `activeScreens`, a lowered demo-only `confidenceThreshold`) that were silently blocking any response from ever firing in the standalone harness.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-19T13:03:00-04:00 (approx, first tool call)
- **Completed:** 2026-07-19T13:08:20-04:00
- **Tasks:** 2/2 completed
- **Files modified:** 4 (`src/index.js`, `tests/e2e/harness.spec.js`, `test-harness/index.html`, `config/demo-platform.json`)

## Accomplishments
- `index.js`'s `init()` now generates exactly one `sessionId` per page load and threads it into both `initLogging(config, sessionId)` and `initResponse(config, sessionId)`, in that order — the SDK's response/logging layers are now actually reachable from the real init path, not just unit-tested in isolation.
- Two new real-browser Playwright tests prove the overlay renders above the host UI without blocking a real tap underneath, and that `discount_offer` calls `window.postMessage` with the locked payload shape and an explicit non-wildcard origin.
- Discovered and fixed two latent demo-config defects that would have made every response-rendering scenario silently no-op in the standalone harness (see Deviations).
- Rebuilt `dist/sdk.js`; bundle purity check still passes (no brain.js leakage) and now contains the `data-heed-overlay` marker.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire sessionId generation and initLogging/initResponse into src/index.js init()** - `67a4c86` (feat)
2. **Task 2: Extend the E2E harness with response-rendering + postMessage-capture assertions, add a manual-verify message listener, and rebuild the bundle** - `5998819` (feat)

**Plan metadata:** (this commit, docs)

## Files Created/Modified
- `src/index.js` - `init()` generates `sessionId` via `crypto.randomUUID()` (D-08), imports and calls `initLogging(config, sessionId)` then `initResponse(config, sessionId)`; return shape (`{ config, publish, subscribe }`) unchanged
- `tests/e2e/harness.spec.js` - new `response overlay rendering + postMessage capture` describe block: tooltip-rendering-without-blocking-host test, discount_offer postMessage-shape/origin test
- `test-harness/index.html` - parent-context `window.addEventListener('message', ...)` debug listener surfacing `heed:discount_offer` payloads into `#log`, with an inline comment documenting the file:// opaque-origin delivery limitation
- `config/demo-platform.json` - `activeScreens` changed to `[]`; added `inference.confidenceThreshold: 0.4` (both deviations, see below)

## Decisions Made
- sessionId generation and both new module wirings live entirely inside `index.js`'s `init()`, matching the plan's exact "validate first, then wire side-effecting modules in sequence" shape — no new return key.
- `log.js` initialized before `response.js` so its `flow:complete`/`inference:result`/etc. subscriptions register before response.js's, per 04-RESEARCH.md Assumption A1.
- postMessage E2E coverage uses an in-page override/capture technique rather than relying on actual `message` event delivery — verified directly (via a standalone Playwright script) that this file:// harness's opaque page origin can never satisfy the browser's same-origin delivery check against any explicit non-wildcard `targetOrigin`, including the page's own serialized origin string; only `'*'` is ever delivered, which RESP-03 explicitly forbids. The override proves the SDK issues the correct call; real delivery is deferred to Phase 6 against a real http(s)-served Branch 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `activeScreens`'s concrete placeholder list silently blocked all logging/response rendering in the E2E harness**
- **Found during:** Task 2 (writing the response-rendering E2E assertions)
- **Issue:** `demo-platform.json`'s `activeScreens: ["/swap", "/confirm", "/success"]` gates `isActiveScreen()` in both `log.js` and `response.js` against `window.location.pathname`. Verified directly (via a standalone Playwright script against the exact harness URL) that Chromium's `location.pathname` for a `file://...test-harness/index.html` URL is the full filesystem path (e.g. `/C:/Users/.../test-harness/index.html`), which never matches any of the three configured routes — so `isActiveScreen()` always returned `false`, meaning no response bubble and no `console.log('[heed]', ...)` line could ever fire against this config, regardless of which signal was triggered. 04-RESEARCH.md's own Pitfall 3 anticipated exactly this ("the standalone test harness has no real routing... do NOT expect the Playwright E2E harness test to meaningfully exercise multi-screen gating"), but the concrete config value left in `demo-platform.json` since Plan 04-01 still blocked functional response rendering, not just gating-specificity testing.
- **Fix:** Changed `demo-platform.json`'s `activeScreens` to `[]` — the explicitly documented, unit-tested "permissive default (always true) — no gate configured" behavior (`tests/log.test.js`: "an empty activeScreens array is permissive"). Real per-screen gating logic is untouched and remains fully covered by `tests/log.test.js`'s `history.pushState()`-driven unit tests against inline test configs (not `demo-platform.json`).
- **Files modified:** `config/demo-platform.json`
- **Verification:** Full Vitest suite (75/75) unaffected (no test imports `demo-platform.json`'s `activeScreens` value); `npx playwright test tests/e2e/harness.spec.js` green, response bubbles now render.
- **Committed in:** `5998819` (Task 2 commit)

**2. [Rule 3 - Blocking] Cold-start weights never cross the 0.65 default confidence threshold, so no response could ever fire in the demo harness**
- **Found during:** Task 2 (writing the response-rendering E2E assertions)
- **Issue:** Verified directly (`node -e` against `admin/weights.js` + `forwardPass`) that all four canonical cold-start mappings produce a max softmax probability in the ~0.44-0.50 range — by design, per `admin/print-softmax-margins.mjs`'s own gate, which explicitly requires "not saturated toward ~1.0" margins. With no `config.inference.confidenceThreshold` override, `initInference` defaults to 0.65, so `fires` was `false` for every canonical signal in the demo config — `response.js`'s `inference:result` handler never rendered a bubble no matter which debug-panel button was clicked, and Task 2's core deliverable ("trigger a signal that produces an above-threshold inference:result") was unreachable as originally configured.
- **Fix:** Added `"inference": { "confidenceThreshold": 0.4 }` to `demo-platform.json` — below every canonical signal's real margin (lowest observed: `price_doubt` at 0.4410), so all four signals reliably fire in the demo/E2E harness. This is a demo-config-only value; the 0.65 production default in `inference.js` and its dedicated unit-test coverage (`tests/inference.test.js`) are unchanged.
- **Files modified:** `config/demo-platform.json`
- **Verification:** `npx playwright test tests/e2e/harness.spec.js -g "response"` green (2/2); manually verified via a standalone script that `touch_hesitation` → `tooltip` and `scroll_reversal` → `discount_offer` both render.
- **Committed in:** `5998819` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 - blocking issues, both confined to the demo-only config file)
**Impact on plan:** Both fixes were prerequisites for Task 2's stated acceptance criteria ("trigger a signal that produces an above-threshold inference:result", "the overlay renders above the harness UI"). Neither touches production-path defaults (0.65 threshold in `inference.js`, real per-screen gating logic in `log.js`/`response.js`) or their existing unit-test coverage. No scope creep beyond the two config values.

## Issues Encountered
- Confirmed via a standalone Playwright script that `window.postMessage(data, targetOrigin)` cannot be delivered back to the same `file://` window for ANY non-wildcard `targetOrigin` string (including the page's own serialized `location.origin`, `"file://"`) — Chromium treats file:// origins as opaque, serialized as `"null"` for the delivery check, and the literal string `"null"` is itself rejected by the `postMessage` API as an invalid target origin. Resolved by testing the postMessage *call* (payload + origin) via an in-page override rather than relying on delivery, which is orthogonal to what RESP-03 requires of the SDK. Documented as a known, Phase-6-deferred limitation in both the E2E test comment and `test-harness/index.html`'s debug listener.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 4's four requirements this plan covers (RESP-01, RESP-02, RESP-03, LOG-01) are now demonstrated end-to-end via a real, built, mobile-emulated-browser bundle, not just isolated unit tests.
- Plan 04-06 (final phase-4 plan) can proceed; no blockers identified.
- Phase 6 (Integration Verification, externally blocked on Branch 1) should re-verify `activeScreens`' real pathname list and the discount_offer postMessage's actual cross-window delivery once a real http(s)-served Branch 1 platform exists — both are explicitly flagged as demo-harness-only workarounds above, not production-path changes.

## Self-Check: PASSED

- FOUND: src/index.js
- FOUND: tests/e2e/harness.spec.js
- FOUND: test-harness/index.html
- FOUND: config/demo-platform.json
- FOUND: .planning/phases/04-response-overlay-logging/04-05-SUMMARY.md
- FOUND commit: 67a4c86 (Task 1)
- FOUND commit: 5998819 (Task 2)

---
*Phase: 04-response-overlay-logging*
*Completed: 2026-07-19*
