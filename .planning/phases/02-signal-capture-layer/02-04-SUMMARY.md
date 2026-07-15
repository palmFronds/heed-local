---
phase: 02-signal-capture-layer
plan: 04
subsystem: testing
tags: [dom-events, playwright, e2e, debug-panel, real-browser, vitest]

# Dependency graph
requires:
  - phase: 02-signal-capture-layer
    provides: "src/signal.js fully implements all 4 signal types (SIG-01 through SIG-06) with SPA-safety and back-intent detection; src/index.js's init()/initDemo() instrument the DOM automatically (Plan 02-03)"
provides:
  - "test-harness/index.html: debug-panel buttons dispatch real DOM events (TouchEvent/FocusEvent/scroll Event/PopStateEvent) that drive signal.js's real listeners, instead of calling window.Heed.publish() directly (D-08)"
  - "test-harness/index.html: 1000px scroll-height filler so a real/simulated scroll can genuinely cross the 40% depth threshold (Pitfall 7)"
  - "playwright.config.js: first Playwright config in the project — 390x844 mobile viewport, hasTouch/isMobile, no webServer block (file:// navigation)"
  - "tests/e2e/harness.spec.js: first Playwright E2E suite — proves D-08's rewiring drives signal.js's real listeners for all 4 signal types with PII-free payloads, in a real headless browser"
affects: [phase-3-inference, phase-6-integration-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Playwright config with no webServer block — the harness has no server (file:// URL navigation), matching Phase 1's 01-05-PLAN.md manual 'double-click the file' precedent"
    - "Vitest config explicitly excludes tests/e2e/** — Vitest's default *.spec.js include glob otherwise collides with Playwright's own test files"

key-files:
  created:
    - playwright.config.js
    - tests/e2e/harness.spec.js
  modified:
    - test-harness/index.html
    - vitest.config.js
    - .gitignore

key-decisions:
  - "test-harness/index.html's flow-complete marker now starts display:none (matching the unit-test fixture pattern) rather than always-visible — the static harness renders all 3 screens simultaneously with no real screen-based routing, so without this fix checkFlowComplete latched flowCompleteFlag true on the very first attach pass, structurally preventing back_intent from ever firing in the real harness (found via the Playwright suite, not caught by unit tests whose fixture already hid the element)."
  - "vitest.config.js excludes tests/e2e/** — without this, Vitest's default *.spec.js glob attempts to load the Playwright spec file and fails with 'Playwright Test did not expect test.beforeEach() to be called here.'"

patterns-established:
  - "D-08 real-event dispatch pattern: simulateHold/simulateBlurIncomplete/simulateScrollReversal/simulateBackIntent construct and dispatch real (isTrusted:false) DOM events onto data-heed elements/window, rather than calling the bus directly — this is now the debug panel's permanent shape for any future signal type added to the harness."

requirements-completed: []

coverage:
  - id: D1
    description: "Debug-panel buttons dispatch real TouchEvent/FocusEvent/scroll Event/PopStateEvent onto the mapped data-heed elements/window, driving signal.js's actual listeners (D-08) — no window.Heed.publish() bypass remains in any button handler"
    requirement: "SIG-01"
    verification:
      - kind: other
        ref: "grep -q for 'new TouchEvent'/'new PopStateEvent'/'new FocusEvent'/'window.Heed.subscribe' in test-harness/index.html — all present; grep for publish( inside button handler bodies — no match"
        status: pass
    human_judgment: false
  - id: D2
    description: "test-harness/index.html has genuine scrollable height (document.documentElement.scrollHeight > window.innerHeight * 1.5) so scroll_reversal can be meaningfully triggered (Pitfall 7)"
    requirement: "SIG-03"
    verification:
      - kind: e2e
        ref: "ad-hoc Playwright page.evaluate() check during Task 2 verification: scrollHeight=2211, innerHeight=844, threshold=1266 — confirmed exceeds by design, not part of the committed spec file"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/e2e/harness.spec.js proves, in a real headless browser after npm run build, that clicking each rewired debug-panel button produces a #log receipt for touch_hesitation, blur_incomplete, scroll_reversal, and back_intent — and that back_intent's payload key set matches D-07's exact allow-list (no PII-shaped extra key)"
    requirement: "SIG-05"
    verification:
      - kind: e2e
        ref: "tests/e2e/harness.spec.js — all 4 tests (npx playwright test tests/e2e/harness.spec.js)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Human confirms in a real/emulated mobile viewport that press-and-hold, blur-without-typing, scroll-down-then-up, and back-intent each produce exactly one PII-free receipt, closing Phase 2's gate (Task 3)"
    requirement: "SIG-01, SIG-02, SIG-03, SIG-04"
    verification:
      - kind: other
        ref: "GATE SKIPPED BY OWNER DECISION (2026-07-15) — the manual mobile-viewport walkthrough was not performed. Owner cited the automated Playwright E2E suite (4/4, D3) and unit suite (26/26) as equivalent coverage across all four signal types and both negative cases (D-03 typed-then-cleared, D-05 scroll jitter). Note: the Playwright run only exercises touch_hesitation end-to-end with the debug panel; the D-03/D-05 negative cases and the blur/scroll/back_intent PII field-by-field human review described in the plan's <how-to-verify> were not independently re-run as part of this decision — this is a scope reduction accepted by the project owner, not a claim that the full manual checklist was executed."
        status: skipped
    human_judgment: true
    rationale: "Task 3 is a checkpoint:human-verify gate (gate=\"blocking\") that per plan design requires an actual human operator interacting with a real/emulated mobile browser — a Playwright headless run (D3) does not, on its own terms, substitute for real touch/tap/scroll input fidelity per 02-RESEARCH.md's fidelity note. The project owner explicitly overrode this gate rather than performing the walkthrough, judging the existing automated coverage sufficient. Recorded here verbatim so the audit trail does not read as a completed human verification."

# Metrics
duration: 8min (Tasks 1-2 automated); Task 3 gate skipped by owner decision, not executed
completed: 2026-07-15
status: complete (gate skipped by owner)
---

# Phase 2 Plan 4: Debug-Panel Real-Event Rewiring and Playwright E2E Proof Summary

**Rewired test-harness/index.html's debug-panel buttons to dispatch real TouchEvent/FocusEvent/scroll/PopStateEvent instances into signal.js's actual listeners (D-08), added scroll-height filler for the 40% threshold, and authored the project's first Playwright E2E suite proving all 4 signal types produce PII-free #log receipts in a real headless browser. Task 3's human-verify checkpoint (closing Phase 2) was skipped by explicit project-owner decision on 2026-07-15 rather than completed — see the "Task 3 Resolution" section below.**

## Performance

- **Duration:** ~8 min (Tasks 1-2 only; Task 3 not started)
- **Started:** 2026-07-14T13:45:36Z
- **Completed (Tasks 1-2):** 2026-07-14T13:53:00Z
- **Tasks:** 2 of 3 completed
- **Files modified:** 5 (test-harness/index.html, playwright.config.js, tests/e2e/harness.spec.js, vitest.config.js, .gitignore)

## Accomplishments

- `test-harness/index.html`'s four debug-panel buttons now dispatch real DOM events (`simulateHold` → `TouchEvent` touchstart/touchend with a 900ms hold; `simulateBlurIncomplete` → `FocusEvent` focus/blur with `el.value` forced empty; `simulateScrollReversal` → `window.scrollTo` + `scroll` `Event` past 40% then back by >50px; `simulateBackIntent` → `PopStateEvent`) instead of calling `window.Heed.publish()` directly — the panel now genuinely exercises `signal.js`'s real listeners (D-08).
- Added a 1000px scroll-height filler `<div>` so `document.documentElement.scrollHeight` (confirmed 2211px) exceeds `window.innerHeight * 1.5` (844 × 1.5 = 1266px) on a 390×844 mobile viewport — the scroll_reversal gesture has genuine room to operate (Pitfall 7).
- `playwright.config.js` — the project's first Playwright config: 390×844 viewport, `hasTouch: true`, `isMobile: true`, no `webServer` block (harness has no server; tests navigate via `file://`).
- `tests/e2e/harness.spec.js` — the project's first Playwright E2E suite: one test per signal type, all asserting a `#log` receipt after clicking the corresponding rewired button; the `back_intent` test additionally parses the last logged JSON line and asserts `Object.keys(payload).sort()` matches D-07's exact allow-list (`bbox, pathname, targetSelector, timestamp, type`) — 4/4 tests pass against the built `dist/sdk.js`.
- `npx vitest run` remains green (26/26, 6 files) after `tests/e2e/**` was excluded from Vitest's config.

## Task Commits

Each completed task was committed atomically:

1. **Task 1: Rewire debug-panel buttons to dispatch real DOM events and add scroll-height filler (D-08, Pitfall 7)** - `03a52fe` (feat)
2. **Task 2: Scaffold Playwright config and author the D-08 real-browser E2E spec** - `36de01e` (feat)
3. **Task 3: Human-verify the rewired harness end-to-end (checkpoint:human-verify)** - SKIPPED BY OWNER DECISION (2026-07-15). No manual walkthrough was performed; see "Task 3 Resolution" below.

## Task 3 Resolution

The `checkpoint:human-verify` gate was not executed. During execution, a separate diagnostic
investigation (initiated by the project owner, working from the browser to trace a suspected
bus-duplication bug) exercised `touch_hesitation` end-to-end via a real headless-Chromium
Playwright run with temporary debug `console.log` statements — that investigation concluded the
signal path works correctly and the logs were removed afterward (`dist/sdk.js` rebuilt clean). It
did not, however, cover the full Task 3 checklist (blur/scroll/back_intent, the D-03/D-05 negative
cases, or the field-by-field PII review across all four signal types).

The project owner then explicitly decided to skip Task 3's manual walkthrough entirely, citing the
existing automated coverage (`npx vitest run` 26/26, `npx playwright test` 4/4) as sufficient. This
is recorded verbatim as an owner override, not as a completed human verification — see the `D4`
coverage entry above for the full rationale.

**Plan metadata:** complete (gate skipped by explicit owner decision, not approved via the checklist)

## Files Created/Modified

- `test-harness/index.html` - MODIFIED. Debug-panel button handlers rewired to dispatch real DOM events (D-08); added 1000px scroll-height filler (Pitfall 7); `flow-complete` marker now starts `display: none` (Rule 1 bug fix, see Deviations); `#log` subscriber wiring and all 7 `data-heed` selectors kept byte-identical.
- `playwright.config.js` - NEW. First Playwright config: `testDir: './tests/e2e'`, `reporter: 'list'`, 390×844 viewport, `hasTouch: true`, `isMobile: true`, no `webServer` block.
- `tests/e2e/harness.spec.js` - NEW. First Playwright E2E spec: 4 tests (one per signal type) against the built harness, plus a D-07 allow-list structural assertion on `back_intent`'s payload.
- `vitest.config.js` - MODIFIED. Excludes `tests/e2e/**` from Vitest's default `*.spec.js` glob (Rule 3 fix — see Deviations).
- `.gitignore` - MODIFIED. Added `test-results/` and `playwright-report/` (Playwright's generated output directories).

## Decisions Made

- `test-harness/index.html`'s `flow-complete` marker starts `display: none`, matching the unit-test fixture convention already established in `tests/signal.test.js`/`tests/signal-spa.test.js` — see Deviations for the concrete bug this fixes.
- Vitest excludes `tests/e2e/**` entirely rather than attempting any other resolution (e.g. renaming the Playwright file away from `*.spec.js`) — this is the standard, documented way multiple projects separate Vitest unit suites from Playwright E2E suites, and keeps the Playwright file's `*.spec.js` naming convention intact.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest's default `*.spec.js` glob collided with the new Playwright spec file**
- **Found during:** Task 2, first `npx vitest run` after creating `tests/e2e/harness.spec.js`
- **Issue:** Vitest's default `include` pattern matches `**/*.{test,spec}.*`, so it attempted to load `tests/e2e/harness.spec.js` as a Vitest test file. The file imports `{ test, expect }` from `@playwright/test`, not `vitest` — `test.beforeEach()` threw `"Playwright Test did not expect test.beforeEach() to be called here."`, failing the whole `npx vitest run` invocation (1 failed suite, though the 26 pre-existing tests still passed).
- **Fix:** Added `exclude: [...configDefaults.exclude, 'tests/e2e/**']` to `vitest.config.js`.
- **Files modified:** vitest.config.js
- **Verification:** `npx vitest run` — 6 files, 26/26 tests pass, no failed suites.
- **Committed in:** `36de01e` (Task 2 commit)

**2. [Rule 1 - Bug] `flow-complete` marker's missing `display: none` structurally prevented `back_intent` from ever firing in the real harness**
- **Found during:** Task 2, `npx playwright test tests/e2e/harness.spec.js` — the `back_intent` test failed with an empty `#log` (`Received string: ""`) despite the other 3 tests passing.
- **Issue:** `test-harness/index.html` is a static single-page mockup that renders Screens 2, 3, and 4 simultaneously (no client-side routing hides inactive screens). The `flow-complete` success marker (`<div class="success-marker" data-heed="flow-complete">`) had no inline `display: none`, unlike the shared unit-test fixture in `tests/signal.test.js`/`tests/signal-spa.test.js` (which explicitly sets `style="display: none"` and only flips it to `'block'` to simulate the completion screen appearing). `signal.js`'s `checkFlowComplete` gates on `el.style.display !== 'none'` (a Plan 02-03 decision, see `02-03-SUMMARY.md`), so in the real harness the element resolved as "visible" on `initSignalCapture`'s very first `attachListeners` pass, latching `flowCompleteFlag = true` immediately — after which the `popstate` handler's `if (!flowCompleteFlag)` guard permanently skips publishing `back_intent`, regardless of how faithfully D-08's rewiring dispatches the `popstate` event. Unit tests never caught this because their fixture already started the element hidden.
- **Fix:** Added `style="display: none;"` to the `flow-complete` div in `test-harness/index.html`, matching the established fixture pattern, with a comment explaining why (referencing D-06/SIG-04 and the Playwright test that surfaced it).
- **Files modified:** test-harness/index.html
- **Verification:** `npx playwright test tests/e2e/harness.spec.js` — 4/4 pass, including `back_intent`'s allow-list assertion; `npx vitest run` re-confirmed 26/26 still green (the fixture-based unit tests were unaffected, since they already set this explicitly).
- **Committed in:** `36de01e` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking-issue fix, 1 Rule 1 bug fix — both required to make Task 2's own Playwright verification command pass, and both would have equally blocked Task 3's human-verify checkpoint had they gone unfixed, since step 8 of the checkpoint's `<how-to-verify>` requires a working `back_intent` receipt)
**Impact on plan:** No scope creep — both fixes are narrowly targeted at making the plan's own specified verification commands (`npx vitest run`, `npx playwright test tests/e2e/harness.spec.js`) pass correctly, and the second fix directly protects the integrity of Task 3's still-pending human-verify checklist.

## Issues Encountered

None beyond the two deviations documented above, both resolved within Task 2.

## Known Stubs

None.

## Threat Flags

None — this plan's `<threat_model>` already anticipated the exact risk exercised here (T-02-01: re-checking the SIG-05 payload allow-list at the real-DOM-dispatch layer). No new, undocumented security-relevant surface was introduced by either deviation fix.

## User Setup Required

None - no external service configuration required. Task 3, when resumed, requires a human operator with access to a real or emulated mobile browser (e.g. Chrome DevTools device toolbar) — no additional service/credential setup.

## Next Phase Readiness

**This plan is complete.** Tasks 1-2 executed and verified automatically; Task 3 (`checkpoint:human-verify`, `gate="blocking"`) was skipped by explicit project-owner decision on 2026-07-15 rather than completed via its manual checklist — see "Task 3 Resolution" above and the `D4` coverage entry for the full record.

- All automated coverage cited in the owner's skip decision is green: `npm run build` succeeds, `npx vitest run` is 26/26, `npx playwright test` is 4/4.
- Phase 2's gate is now closed on that basis. `src/signal.js` and `src/index.js` are feature-complete and unit-tested (Plan 02-03); `test-harness/index.html`'s debug panel exercises the real capture path (D-08, this plan).
- No blockers for Phase 3 (inference.js).

---
*Phase: 02-signal-capture-layer*
*Completed: 2026-07-15 (Tasks 1-2 automated; Task 3 gate skipped by owner decision)*

## Self-Check: PASSED

`test-harness/index.html`, `playwright.config.js`, `tests/e2e/harness.spec.js`, `vitest.config.js` found on disk; `.planning/phases/02-signal-capture-layer/02-04-SUMMARY.md` found on disk; all three commit hashes (03a52fe, 36de01e, 8401fdd) found in git log.
