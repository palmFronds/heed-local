---
phase: 06-integration-verification-against-live-branch-1
plan: 02
subsystem: verification
tags: [playwright, e2e, integration, human-verify]

# Dependency graph
requires:
  - phase: 06-integration-verification-against-live-branch-1
    plan: 01
    provides: live-route config, receiver static routes, worktree wiring
provides:
  - "tests/e2e/branch1-live.spec.js — repeatable live-branch1 regression gate for INTEG-01"
  - "playwright.config.js live-branch1 project targeting http://localhost:3000"
  - "src/index.js init() ordering fix (signal_detected now logs before the inference/response cascade)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real page.goBack() for back_intent verification, never a click on the on-screen back-btn (Pitfall 1)"
    - "page.on('console') array collection + substring/JSON parse for [heed] log-order assertions"

key-files:
  created:
    - tests/e2e/branch1-live.spec.js
  modified:
    - playwright.config.js
    - src/index.js
    - .planning/quick/260720-wau-fix-sc2-log-order-bug-in-src-index-js-in/ (quick task, see below)

key-decisions:
  - "Task 3 checkpoint surfaced two real bugs during first live run (SC2 log-order, SC3 test precondition) — routed through GSD quick task 260720-wau rather than hand-editing mid-checkpoint, per repo's GSD-workflow-enforcement rule"
  - "SC2 root cause: src/index.js called initInference() before initLogging(); both subscribe to the same bus 'signal:detected' event on a shared EventTarget, which invokes same-event listeners in registration order, synchronously — inference's handler (and its full inference:result/response:fired cascade) ran to completion before log.js's own signal_detected write. Fixed by reordering init() to initSignalCapture -> initLogging -> initInference -> initResponse"
  - "SC3 failure was test-only: live Branch 1's real /swap gates proceed-cta as disabled until amount-input has a value (Branch 1's own form validation, unrelated to Heed). Fixed by filling amount-input before the click-through assertion"
  - "Discovered during quick-task verification: the receiver serves the built dist/sdk.js bundle, not raw src/ — any src/ fix requires npm run build before re-testing against the live suite, or the suite silently exercises a stale bundle"
  - "Manual 8-step walkthrough performed via a driven real (headless) Chromium browser at 390px with screenshots + DOM/CSS inspection, not a human on a physical device — documented as a substitution, not literal 'human hands on phone' verification"

patterns-established: []

requirements-completed: [INTEG-01]

coverage:
  - id: SC1
    description: "All four signal types (touch_hesitation, blur_incomplete, scroll_reversal, back_intent) fire correctly against live Branch 1"
    verification:
      - kind: e2e
        ref: "npx playwright test --project=live-branch1 -- 4 signal tests, 7/7 suite green"
        status: pass
      - kind: manual
        ref: "driven-browser walkthrough steps a-e; raw [heed] console capture confirmed each signal_detected payload"
        status: pass
    human_judgment: true
  - id: SC2
    description: "Console log order for a triggered signal is exactly signal_detected -> inference_run -> response_fired"
    verification:
      - kind: e2e
        ref: "tests/e2e/branch1-live.spec.js SC2 test; failed pre-fix (inference_run -> response_fired -> signal_detected), passed post-fix"
        status: pass
    human_judgment: false
  - id: SC3
    description: "Response overlay renders above Branch 1's UI without blocking underlying interaction (overlay pointer-events:none, bubble pointer-events:auto, CTA still clickable through it)"
    verification:
      - kind: e2e
        ref: "tests/e2e/branch1-live.spec.js SC3 test; failed pre-fix (CTA disabled, no amount entered), passed post-fix"
        status: pass
      - kind: manual
        ref: "screenshot confirms tooltip bubble rendered visibly above CTA, non-overlapping; DOM inspection confirmed pointer-events values and successful click-through"
        status: pass
    human_judgment: true
  - id: SC4
    description: "No [heed] logs fire on Screen 1 (/), which is excluded from activeScreens"
    verification:
      - kind: e2e
        ref: "tests/e2e/branch1-live.spec.js SC4 test"
        status: pass
      - kind: manual
        ref: "driven-browser walkthrough step a; 0 [heed] log lines observed"
        status: pass
    human_judgment: true
  - id: D-06
    description: "Both automated live suite AND manual 8-step walkthrough required (not either/or)"
    verification:
      - kind: e2e
        ref: "npx playwright test --project=live-branch1 -- 7/7 pass; npx playwright test (full suite) -- file-harness 6/6, live-branch1 7/7, no regressions"
        status: pass
      - kind: manual
        ref: "all 8 manual steps from 06-02-PLAN.md's how-to-verify walked via driven browser; user reviewed evidence and gave explicit approval"
        status: pass
    human_judgment: true
  - id: T-06-03
    description: "Worktree's uncommitted app/layout.tsx script-tag edit discarded before sign-off; feat/demo-platform history untouched (CLAUDE.md no-cross-branch-contamination)"
    verification:
      - kind: other
        ref: "git -C ../heed-worktree-demo-platform checkout -- app/layout.tsx (user-approved); git status --porcelain clean afterward; git log confirms no new commits on feat/demo-platform"
        status: pass
    human_judgment: true

duration: ~3.5 hours (including quick-task detour)
completed: 2026-07-21
status: complete
---

# Phase 6 Plan 2: Integration Verification Against Live Branch 1 Summary

**Ran the live-branch1 Playwright suite and the spec's 8-step manual walkthrough against a real worktree'd Branch 1, found and fixed two real bugs surfaced only by live integration (an `init()` ordering bug and a test precondition gap), then re-verified fully green before the operator approved the blocking human-verify gate.**

## Performance

- **Duration:** ~3.5 hours (including a mid-checkpoint detour to fix bugs the live run surfaced)
- **Completed:** 2026-07-21
- **Tasks:** 3 (Task 1: Playwright project; Task 2: live spec; Task 3: human-verify checkpoint)
- **Files modified:** `playwright.config.js`, `tests/e2e/branch1-live.spec.js`, `src/index.js` (via quick task 260720-wau)

## Accomplishments

- Added a `live-branch1` Playwright project (`playwright.config.js`) targeting `http://localhost:3000`, alongside the existing `file-harness` project — no `webServer` auto-launch, both dev servers started manually per D-06
- Authored `tests/e2e/branch1-live.spec.js` covering INTEG-01's SC1-SC4: all four signal types, console log order, overlay non-blocking behavior, and Screen-1 exclusion
- First live run against the real worktree'd Branch 1 surfaced two real bugs the file:// static harness never could have caught:
  - **SC2 (real SDK bug):** `src/index.js`'s `init()` called `initInference()` before `initLogging()`. Both subscribe to the bus's `signal:detected` event on a shared `EventTarget`; native `EventTarget` invokes same-event listeners in registration order, synchronously. Because inference's handler registered first, a `signal:detected` publish synchronously cascaded through the entire `inference:result -> response:fired` chain (and their log writes) *before* control returned to log.js's own `signal:detected` listener — producing an observed order of `inference_run -> response_fired -> signal_detected` instead of the required `signal_detected -> inference_run -> response_fired`.
  - **SC3 (test-only bug):** live Branch 1's real `/swap` page keeps `proceed-cta` disabled until `amount-input` has a value (Branch 1's own form validation) — the test never filled it in, so Playwright's click-through assertion timed out waiting for the CTA to become enabled.
- Routed both fixes through a GSD quick task (`260720-wau`) per the repo's GSD-workflow-enforcement rule rather than hand-editing mid-checkpoint: reordered `init()` to `initSignalCapture -> initLogging -> initInference -> initResponse`, and added an amount-fill step to the SC3 test
- Discovered during quick-task re-verification that the receiver serves the *built* `dist/sdk.js` bundle, not raw `src/` — the first post-fix run still failed SC2 until `npm run build` regenerated the bundle; documented as a Blockers/Concerns entry in STATE.md so it doesn't surprise anyone else
- Re-ran the full live suite: **7/7 pass**, `npx playwright test` (both projects): `file-harness` 6/6, `live-branch1` 7/7, no regressions
- Completed the manual 8-step walkthrough via a driven real (headless) Chromium browser at the 390px mobile viewport — real `TouchEvent` dispatch (matching production listener code), real `page.goBack()` for back_intent, screenshots and DOM/CSS inspection for the overlay/pointer-events/click-through checks — substituting for literal human-hands-on-device testing, documented as such
- Performed the mandatory cleanup (D-02/T-06-03): discarded the worktree's uncommitted `app/layout.tsx` script-tag edit after explicit operator approval; confirmed `feat/demo-platform`'s working tree clean and its git history untouched
- Operator reviewed the full evidence trail (automated results, screenshots, cleanup confirmation) and gave explicit sign-off ("approved") closing the Task 3 blocking gate

## Task Commits

1. **Task 1: Add live-branch1 Playwright project** — `b1c7464` (feat)
2. **Task 2: Author branch1-live.spec.js** — `70d3a37` (test)
3. **Task 3: Human-verify checkpoint** — no direct commit (checkpoint itself is a verification gate, not code); the two bugs it surfaced were fixed via quick task 260720-wau:
   - `a1b34a4` (fix) — reorder `init()` so logging registers before inference
   - `8d5f398` (test) — fill amount-input before SC3's click-through assertion
   - `2f32d09` (docs) — quick task STATE.md record + SUMMARY.md

## Files Created/Modified

- `tests/e2e/branch1-live.spec.js` - new live-branch1 Playwright suite covering INTEG-01 SC1-SC4
- `playwright.config.js` - added `file-harness`/`live-branch1` projects array
- `src/index.js` - init() call order fixed (logging before inference)
- `.planning/quick/260720-wau-fix-sc2-log-order-bug-in-src-index-js-in/` - quick task plan/summary for the two bug fixes

## Decisions Made

- Bugs found mid-checkpoint were fixed via a GSD quick task rather than ad-hoc edits, keeping the fix auditable and separately committed from the verification plan itself
- The receiver-serves-built-bundle gotcha was captured as a standing Blockers/Concerns entry in STATE.md rather than only in this summary, since it will recur for any future `src/` change verified against `live-branch1`
- Manual walkthrough evidence was gathered via automation (driven browser + screenshots) rather than literal human device testing, with that substitution explicitly disclosed to the operator before requesting sign-off

## Deviations from Plan

- The plan's Task 3 anticipated the operator personally running the automated suite and manual walkthrough. In practice, the assistant ran both (automated suite directly, manual walkthrough via a driven browser) and presented the evidence for the operator's review and sign-off, rather than the operator executing each step themselves. This was disclosed explicitly before requesting approval.
- Two real bugs (SC2, SC3) were found and fixed mid-checkpoint that the plan did not anticipate — handled via an out-of-band quick task (260720-wau), documented above, rather than a plan revision.

## Issues Encountered

- SC2/SC3 failures on first live run (see Accomplishments) — root-caused and fixed via quick task 260720-wau.
- Stale `dist/sdk.js` bundle masked the SC2 fix on first re-verification attempt — resolved with `npm run build`.
- `git checkout -- app/layout.tsx` (the mandated cleanup step) was blocked by the environment's destructive-action permission classifier; resolved by requesting and receiving explicit operator confirmation before proceeding.

## User Setup Required

None going forward. Both dev servers (`npm run receiver` on :4310, worktree's `npm run dev` on :3000) remain manually started per D-06's established pattern for any future live-branch1 runs.

## Next Phase Readiness

- INTEG-01 fully satisfied: SC1-SC4 pass both automated and (assistant-substituted) manual verification
- Phase 6 is the final phase in `.planning/ROADMAP.md` — closing this checkpoint completes the `heed-sdk` v1.0 milestone
- Recommended next step: `/gsd-complete-milestone` to archive

---
*Phase: 06-integration-verification-against-live-branch-1*
*Completed: 2026-07-21*

## Self-Check: PASSED

All claimed files exist (`tests/e2e/branch1-live.spec.js`, `playwright.config.js`, `src/index.js`) and all referenced commits (`b1c7464`, `70d3a37`, `a1b34a4`, `8d5f398`, `2f32d09`) are present in git history. Live suite re-confirmed 7/7 green prior to cleanup; full suite confirmed no regressions in `file-harness`.
