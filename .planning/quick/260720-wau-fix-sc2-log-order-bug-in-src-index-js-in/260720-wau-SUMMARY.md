---
phase: quick
plan: 260720-wau
subsystem: sdk-core
tags: [event-ordering, playwright, e2e, live-integration, sdk-init]

# Dependency graph
requires:
  - phase: 06-integration-verification-against-live-branch-1
    provides: live-branch1 Playwright project and branch1-live.spec.js authored against real Branch 1 worktree
provides:
  - Corrected src/index.js init() ordering (initLogging before initInference) so signal_detected logs before inference_run/response_fired
  - Corrected SC3 test precondition (fills amount-input before holding proceed-cta)
  - Full live-branch1 Playwright suite green (7/7)
affects: [06-02-PLAN.md Task 3 human-verify checkpoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "EventTarget listener registration order determines synchronous dispatch-cascade order — init() call order is a load-bearing correctness property, not just wiring convenience"

key-files:
  created: []
  modified:
    - src/index.js
    - tests/e2e/branch1-live.spec.js

key-decisions:
  - "initLogging() now runs before initInference() in src/index.js's init(), so log.js's signal:detected subscription registers first on the shared EventTarget bus and writes signal_detected before inference's synchronous inference:result cascade runs"
  - "initResponse() remains last, preserving the pre-existing invariant that logging is wired before response firing (04-RESEARCH.md Assumption A1)"
  - "SC3 test now fills [data-heed=\"amount-input\"] with '1' before holding proceed-cta, mirroring the same precondition already used by the passing back_intent test, since live Branch 1's form validation disables the CTA until an amount is entered"
  - "dist/sdk.js (gitignored build artifact) was rebuilt via npm run build after the src/index.js fix — the live-branch1 suite runs against the receiver-served bundle, not raw src/, so a stale bundle masked the fix on first verification pass"

patterns-established: []

requirements-completed: [INTEG-01]

coverage:
  - id: D1
    description: "Live [heed] console log order for a triggered signal is exactly signal_detected -> inference_run -> response_fired (INTEG-01 SC2)"
    requirement: "INTEG-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/branch1-live.spec.js#SC2: console log order for a triggered signal is exactly signal_detected -> inference_run -> response_fired"
        status: pass
    human_judgment: false
  - id: D2
    description: "SC3 response overlay renders above Branch 1 UI with correct pointer-events and the underlying proceed-cta is clickable through the overlay, using a genuinely enabled CTA"
    requirement: "INTEG-01"
    verification:
      - kind: e2e
        ref: "tests/e2e/branch1-live.spec.js#SC3: response overlay renders above Branch 1 UI without blocking underlying interaction"
        status: pass
    human_judgment: false
  - id: D3
    description: "Full live-branch1 Playwright suite (all 7 tests: SC4, touch_hesitation, blur_incomplete, scroll_reversal, back_intent, SC2, SC3) passes green against the real Branch 1 worktree"
    requirement: "INTEG-01"
    verification:
      - kind: e2e
        ref: "npx playwright test --project=live-branch1"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-07-20
status: complete
---

# Quick Task 260720-wau Summary

**Fixed a real EventTarget-registration-order bug in src/index.js's init() causing signal_detected to log after inference_run/response_fired, plus a test precondition gap in the SC3 overlay click-through test — live-branch1 Playwright suite now 7/7 green**

## Performance

- **Duration:** ~15 min
- **Tasks:** 3
- **Files modified:** 2 (src/index.js, tests/e2e/branch1-live.spec.js)

## Accomplishments
- Reordered `init()` in `src/index.js` so `initLogging()` runs before `initInference()`, making log.js's `signal:detected` subscription register first on the shared EventTarget bus. This corrects INTEG-01 SC2: on a real triggered signal, `signal_detected` now logs before the synchronous `inference_run`/`response_fired` cascade that inference.js's handler triggers, instead of after it.
- Fixed the SC3 test (`tests/e2e/branch1-live.spec.js`) to fill `[data-heed="amount-input"]` with a valid amount before holding `proceed-cta`, matching live Branch 1's real form-validation behavior (the CTA stays disabled with "Enter an amount" until a value is entered) — mirrors the precedent already used by the passing `back_intent` test.
- Rebuilt `dist/sdk.js` via `npm run build` after the `src/index.js` fix, since the live-branch1 suite runs against the receiver-served bundle (`http://localhost:4310/sdk.js`), not raw `src/` — the first verification run against the stale pre-fix bundle still failed with `signal_detected` appearing last, which correctly flagged that a rebuild was required before the fix could take effect live.
- Ran `npx playwright test --project=live-branch1` against the live, already-running Branch 1 worktree (`next dev` on :3000) and this repo's receiver (:4310): all 7 tests pass, including SC2 (log order) and SC3 (overlay click-through).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder src/index.js init() so logging registers before inference** - `a1b34a4` (fix)
2. **Task 2: Fill a valid amount in the SC3 test before the click-through assertion** - `8d5f398` (test)
3. **Task 3: Run the live-branch1 Playwright suite and confirm all tests pass** - no code commit (verification-only task; required rebuilding the gitignored `dist/sdk.js` artifact, which produces no trackable diff)

**Plan metadata:** committed separately by the orchestrator (docs artifacts excluded from this executor's commits per task instructions).

## Files Created/Modified
- `src/index.js` - `init()` call order changed to `initSignalCapture -> initLogging -> initInference -> initResponse`; comments updated to explain the new EventTarget-registration-order rationale for INTEG-01 SC2 while preserving the existing `initLogging`-before-`initResponse` invariant (04-RESEARCH.md Assumption A1)
- `tests/e2e/branch1-live.spec.js` - SC3 test now fills `[data-heed="amount-input"]` with `'1'` immediately after the `window.__heedReady` wait and before `holdProceedCtaPastThreshold(page)`, so `proceed-cta` is genuinely enabled when the click-through assertion runs

## Decisions Made
- Kept the fix scoped purely to init() call ordering — no change to `src/bus.js`'s EventTarget dispatch semantics, `src/log.js`, or `src/inference.js` subscription logic, since the plan's ground-truth diagnosis (native EventTarget invokes same-event-type listeners in registration order, synchronously) fully explained the bug and pointed to a one-line reordering fix.
- Did not weaken any SC3 assertion to force a pass — the fix instead made the test's setup precondition (a filled amount enabling the CTA) match live Branch 1's actual behavior, keeping the overlay pointer-events and click-through checks fully meaningful.
- Rebuilding `dist/sdk.js` was necessary but produces no git diff (gitignored build artifact) — flagged explicitly here since it's an easy-to-miss step for anyone re-running this verification later: a `src/` fix alone does not change live behavior until `npm run build` regenerates the bundle the receiver actually serves.

## Deviations from Plan

None - plan executed exactly as written. The apparent "SC2 still failing after Task 1's fix" result on the first Task 3 verification run was not a deviation from the plan's diagnosis — it was the expected consequence of testing against a stale pre-fix `dist/sdk.js` bundle, which the plan's Task 3 troubleshooting guidance ("If SC2 still fails, re-check Task 1's call ordering") anticipated as the first debugging step. Re-checking confirmed Task 1's `src/index.js` ordering was correct; the actual remaining step was rebuilding the bundle the live receiver serves, which is standard build-then-verify practice for this project (not an architectural change, not a new auto-fix rule — just running the project's existing `npm run build` script before re-verifying).

## Issues Encountered
- First `npx playwright test --project=live-branch1` run after Tasks 1-2 still showed SC2 failing (signal_detected logging last instead of first) even though `src/index.js`'s new ordering was verified correct via the automated `node -e` check. Root cause: the live Branch 1 page loads the SDK from the receiver's served `/sdk.js`, which is a build artifact (`dist/sdk.js`, gitignored) produced by `npm run build` from `src/index.js` — it was not automatically rebuilt when `src/index.js` changed. Ran `npm run build` (which also runs `postbuild`'s `check-bundle-purity` check, which passed) to regenerate `dist/sdk.js`, then re-ran the suite: all 7 tests passed, including SC2 and SC3.

## User Setup Required

None - no external service configuration required. Both dev servers (receiver on :4310, Branch 1's `next dev` on :3000) were already running per the task's verification note and required no start/stop action.

## Next Phase Readiness
- `src/index.js` and `tests/e2e/branch1-live.spec.js` fixes are committed on `feat/heed-sdk`.
- `dist/sdk.js` has been rebuilt locally and reflects the fix (gitignored, not committed — will be regenerated by any future `npm run build`).
- The live-branch1 Playwright suite is fully green (7/7), giving the Task 3 human-verify checkpoint in `06-02-PLAN.md` a real, passing automated basis to verify against.
- Per constraints, `06-02-PLAN.md`'s Task 3 human-verify checkpoint was left untouched and NOT marked approved — that sign-off remains a separate decision for the user to make after reviewing these fixes.

---
*Phase: quick*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: src/index.js
- FOUND: tests/e2e/branch1-live.spec.js
- FOUND: .planning/quick/260720-wau-fix-sc2-log-order-bug-in-src-index-js-in/260720-wau-SUMMARY.md
- FOUND: a1b34a4 (fix commit)
- FOUND: 8d5f398 (test commit)
