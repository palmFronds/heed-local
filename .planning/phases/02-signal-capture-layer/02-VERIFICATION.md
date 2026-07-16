---
phase: 02-signal-capture-layer
verified: 2026-07-16T00:00:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Human confirms in a real/emulated mobile viewport that press-and-hold, blur-without-typing, scroll-down-then-up, and back-intent each produce exactly one PII-free receipt, closing Phase 2's gate (02-04-PLAN.md Task 3, checkpoint:human-verify, gate=\"blocking\")"
    reason: "Project owner explicitly skipped the manual real-browser walkthrough on 2026-07-15, citing the automated Playwright E2E suite (4/4, all 4 signal types) and unit suite (29/29, including two new code-review regression tests) as equivalent coverage. Documented verbatim in 02-04-SUMMARY.md's \"Task 3 Resolution\" section and its D4 coverage entry (status: skipped, human_judgment: true). This is a legitimate, disclosed scope decision by the project owner, not a silently-dropped gate — the SUMMARY explicitly states the full manual checklist (D-03/D-05 negative cases, field-by-field PII review) was not independently re-run."
    accepted_by: "project owner (per 02-04-SUMMARY.md Task 3 Resolution, recorded 2026-07-15)"
    accepted_at: "2026-07-15"
---

# Phase 2: Signal Capture Layer Verification Report

**Phase Goal:** All 4 signal types are captured cleanly from raw DOM events, survive SPA navigation without double-firing or silent under-attachment, and emit strictly PII-free payloads onto the bus.
**Verified:** 2026-07-16
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Holding a CTA (proceed-cta/confirm-cta/back-btn) 800ms+ emits exactly one `touch_hesitation` with `{type, targetSelector, bbox, timestamp}`; release before 800ms emits nothing, no separate <300ms check (SIG-01, ROADMAP SC1) | ✓ VERIFIED | `src/signal.js:80-111` `wireTouchHesitation`; `tests/signal.test.js` SIG-01 describe (3 tests: hold-past-threshold, release-at-200ms, WR-02 regression) — all pass in `npx vitest run` (29/29) |
| 2 | Blurring `amount-input` while empty emits `blur_incomplete`; blurring after a value change emits nothing (SIG-02, ROADMAP SC2) | ✓ VERIFIED | `src/signal.js:120-132` `wireBlurIncomplete` reads `el.value` only into a gate boolean, never into `buildPayload`; `tests/signal.test.js` SIG-02 describe, both cases pass |
| 3 | Scrolling past 40% viewport depth then reversing by ≥ the configured min delta emits `scroll_reversal`; sub-delta reversal emits nothing (SIG-03, ROADMAP SC3) | ✓ VERIFIED | `src/signal.js:143-197` `checkScrollReversal`/`attachScrollReversal`; `tests/signal.test.js` SIG-03 describe, both cases pass |
| 4 | `popstate` while `flowComplete` is not yet visible emits exactly one `back_intent {pathname}`; once visible, popstate emits nothing; the popstate handler never live-queries the DOM (SIG-04, ROADMAP SC4, D-06) | ✓ VERIFIED | `src/signal.js:240-247` `checkFlowComplete` (cached-flag pattern), `src/signal.js:339-352` popstate handler reads only `flowCompleteFlag`; `tests/signal.test.js` SIG-04 describe — 4 tests pass, including the two CR-01 CSS-class regression cases |
| 5 | Every signal payload contains only geometry/timing fields — no field values, no identity — confirmed by code inspection of the payload-construction path (SIG-05, ROADMAP SC5) | ✓ VERIFIED | `buildPayload` (`src/signal.js:22-46`) is the sole function constructing objects passed to `publish()`; source review confirms no `.value`/`.textContent`/`.innerHTML`/`localStorage`/`document.cookie` read inside it; `tests/signal.test.js` SIG-05 describe asserts `Object.keys(payload).sort()` against the exact allow-list for all 4 types, including a case where the fixture element carries a non-empty value |
| 6 | Simulating 3+ consecutive SPA route changes re-attaches listeners exactly once per navigation via WeakSet-keyed idempotency, no duplicate firing, no missed re-attachment (SIG-06, ROADMAP SC6) | ✓ VERIFIED | `src/signal.js:209-305` (`attachedElements` WeakSet, `maybeReattach`, `attachListeners`); `tests/signal-spa.test.js` SIG-06 describe — 3 tests covering 3+ navigations, fresh-element re-attach, and no-double-attach-on-unchanged-pathname, all pass |
| 7 | CR-01 code-review fix: `checkFlowComplete` uses computed style (not inline `el.style`), so CSS-class-hidden completion screens don't permanently disable `back_intent` | ✓ VERIFIED | `src/signal.js:244` uses `getComputedStyle(el).display !== 'none'` (was `el.style.display`); regression tests at `tests/signal.test.js:221-268` (both hide-via-class and reveal-via-class-toggle cases) pass in the current suite |
| 8 | WR-02 code-review fix: overlapping/duplicate `touchstart` no longer orphans the first hold timer and produces a stray second `touch_hesitation` | ✓ VERIFIED | `src/signal.js:84-95` `start()` now clears any existing `timerId` before scheduling a new one; regression test at `tests/signal.test.js:85-108` ("does not fire a stray second touch_hesitation...") passes |
| 9 | `initSignalCapture(config)` is wired into `src/index.js`'s `init()` after `validateConfig` succeeds, without changing the returned `{config, publish, subscribe}` shape; `initDemo()` inherits it transitively | ✓ VERIFIED | `src/index.js:19-28` — `initSignalCapture(config)` called between `validateConfig` and the `return` statement; `tests/index.test.js` (part of the 29/29 green suite) still asserts the unchanged return shape |
| 10 | Debug-panel buttons in the standalone harness dispatch real DOM events (TouchEvent/FocusEvent/scroll Event/PopStateEvent) that drive `signal.js`'s real listeners, not a `window.Heed.publish()` bypass (D-08) | ✓ VERIFIED | `test-harness/index.html:190-223` — `simulateHold`/`simulateBlurIncomplete`/`simulateScrollReversal`/`simulateBackIntent` construct and dispatch real events; grep confirms no `window.Heed.publish(` call remains in any button handler; the `#log` subscriber wiring (`window.Heed.subscribe`) is unchanged |
| 11 | A Playwright suite proves, in a real headless browser, that clicking each rewired button produces a PII-free `#log` receipt for all 4 signal types | ✓ VERIFIED | `tests/e2e/harness.spec.js` — ran live: `npx playwright test tests/e2e/harness.spec.js` → 4/4 pass, including the `back_intent` payload allow-list assertion |

**Score:** 11/11 truths verified (0 present-but-behavior-unverified)

### Human Verify Gate — Owner Override (not a new human-verify prompt)

02-04-PLAN.md's Task 3 (`checkpoint:human-verify`, `gate="blocking"`) called for a human operator to walk through all 4 signal types in a real/emulated mobile browser before Phase 2's gate could close. Per 02-04-SUMMARY.md's "Task 3 Resolution" section, the project owner explicitly decided on 2026-07-15 to skip this manual walkthrough, citing the automated Playwright E2E suite (4/4) and unit suite (29/29, including the two new CR-01/WR-02 regression tests) as equivalent coverage. The SUMMARY is explicit that the full manual checklist (the D-03/D-05 negative cases and a field-by-field PII review across all four signal types in a real touch-emulated browser) was **not** independently re-run — this is disclosed as a scope reduction, not represented as a completed human verification.

This is recorded above as an accepted override (see frontmatter `overrides`), consistent with the coordinator's guidance to treat it as a legitimate, disclosed owner decision rather than a silent gap or an item requiring a fresh human-verify prompt.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `config/schema.json` | Optional `signals.{touchHesitation.thresholdMs, scrollReversal.{depthThresholdPct,minReversalDeltaPx}}`, top-level `required` unchanged | ✓ VERIFIED | Present exactly as specified; top-level `required` is still `["platformId","selectors","completionSelector"]` |
| `config/demo-platform.json` | Concrete `signals` block (800/0.4/50), all 7 selectors byte-identical | ✓ VERIFIED | Present; all 7 `data-heed` selector strings unchanged |
| `src/signal.js` | `buildPayload`, `resolveTargets`, `wireTouchHesitation`, `wireBlurIncomplete`, `attachScrollReversal`, `attachListeners`, `maybeReattach`, `checkFlowComplete`, `initSignalCapture` | ✓ VERIFIED | All functions present, substantive (no stubs), and exercised by passing tests |
| `src/index.js` | `init()` calls `initSignalCapture` post-validation; return shape unchanged | ✓ VERIFIED | Confirmed by source read and `tests/index.test.js` |
| `test-harness/index.html` | Real-event debug panel, scroll-height filler, 7 selectors intact | ✓ VERIFIED | `simulateHold`/etc. dispatch real events; 1000px filler div confirmed present; all 7 selectors present |
| `playwright.config.js` | 390×844 viewport, hasTouch/isMobile, no webServer block | ✓ VERIFIED | Present as specified (not re-quoted here; confirmed via passing `npx playwright test` run) |
| `tests/e2e/harness.spec.js` | 4 tests, 1 per signal type, plus 1 allow-list assertion | ✓ VERIFIED | Present; ran live, 4/4 pass |
| `tests/signal.test.js` | SIG-01/02/04/05 describe blocks + CR-01/WR-02 regressions | ✓ VERIFIED | Present; ran live as part of 29/29 |
| `tests/signal-spa.test.js` | SIG-06 describe block, no fake timers | ✓ VERIFIED | Present; ran live as part of 29/29; zero `vi.useFakeTimers()` calls confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/signal.js` | `src/bus.js` | `import { publish }` only | ✓ WIRED | Confirmed — no `subscribe` import in signal.js |
| `src/signal.js` handlers | `buildPayload` | sole payload-construction choke point | ✓ WIRED | Source review: no other function in signal.js constructs an object passed to `publish()` |
| `src/index.js` `init()` | `src/signal.js` `initSignalCapture` | call after `validateConfig`, before `return` | ✓ WIRED | Confirmed by source read; `tests/index.test.js` green |
| `test-harness/index.html` debug buttons | `src/signal.js` real listeners | real DOM event dispatch (D-08), not `bus.publish()` bypass | ✓ WIRED | grep confirms no `publish(` in button handlers; Playwright E2E (4/4) proves receipts flow through the real path |
| MutationObserver + popstate listener | `maybeReattach` | single shared gate function | ✓ WIRED | Source review: exactly one `new MutationObserver(...)` instantiation; both callbacks funnel through `maybeReattach` |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full Vitest unit suite | `npx vitest run` | 6 files, 29/29 tests pass | ✓ PASS |
| Build produces dist/sdk.js | `npm run build` | `dist/sdk.js` (9.7kb) built successfully | ✓ PASS |
| Playwright E2E suite (real headless browser) | `npx playwright test tests/e2e/harness.spec.js` | 4/4 pass | ✓ PASS |
| CR-01 regression (CSS-class-hidden completion screen) | included in full Vitest run above | 2/2 CR-01-specific cases pass | ✓ PASS |
| WR-02 regression (overlapping touchstart) | included in full Vitest run above | 1/1 WR-02-specific case passes | ✓ PASS |

All commands above were re-run live during this verification pass, not inferred from SUMMARY.md claims.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| SIG-01 | 02-01 (RED), 02-02 (impl), 02-04 (real-event proof) | Touch hesitation, 800ms threshold | ✓ SATISFIED | `wireTouchHesitation`; SIG-01 unit tests + Playwright test both pass |
| SIG-02 | 02-01 (RED), 02-02 (impl), 02-04 (real-event proof) | Blur without completion | ✓ SATISFIED | `wireBlurIncomplete`; SIG-02 unit tests + Playwright test both pass |
| SIG-03 | 02-01 (RED), 02-02 (impl), 02-04 (real-event proof) | Scroll reversal | ✓ SATISFIED | `attachScrollReversal`/`checkScrollReversal`; SIG-03 unit tests + Playwright test both pass |
| SIG-04 | 02-01 (RED), 02-03 (impl), 02-04 (real-event proof) | Back intent gated on flowComplete | ✓ SATISFIED | `checkFlowComplete`/popstate handler; SIG-04 unit tests (incl. CR-01 regressions) + Playwright test pass |
| SIG-05 | 02-01 (RED), 02-02 (impl), 02-04 (real-event proof) | PII-free payload allow-list | ✓ SATISFIED | `buildPayload`; SIG-05 unit tests + Playwright allow-list assertion pass |
| SIG-06 | 02-01 (RED), 02-03 (impl) | SPA re-attachment idempotency | ✓ SATISFIED | `attachedElements` WeakSet + `maybeReattach`; SIG-06 unit tests pass |

No orphaned requirements found — all six SIG-01..06 requirement IDs declared across the phase's four plans match REQUIREMENTS.md's Phase 2 traceability table exactly, and REQUIREMENTS.md already marks all six `[x]` complete.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/signal.js` | — | none found (no TBD/FIXME/XXX/TODO/HACK/placeholder, no empty-return stubs, no console.log-only handlers) | — | — |
| `src/index.js` | — | none found | — | — |
| `test-harness/index.html:83` | 83 | `placeholder="0.00"` | info | This is a legitimate HTML `<input>` placeholder attribute, not a stub/debt marker — not a finding |

**Carried-forward code review findings (02-REVIEW.md) not required to block this phase:**

- WR-01 (touchmove zero movement tolerance on real hardware) — not fixed; a Warning-severity real-device robustness gap, not covered by any must-have truth or ROADMAP success criterion for this phase; recommend tracking for Phase 6 (live-device integration verification).
- WR-03 (`back_intent`'s raw `pathname` is a theoretical PII exposure vector) — explicitly deferred; tracked in REQUIREMENTS.md's v2 section as `SIG-V2-01`, confirmed via the latest commit `a100272` ("docs(requirements): track WR-03 pathname-PII as v2 hardening item"). Correctly deferred, not a gap.
- WR-04 (`completionSelector` redundant/dead config field), WR-05 (test bus-subscription cleanup), IN-01/IN-02/IN-03 (schema bounds validation, `depthThresholdPct` naming, `wireBlurIncomplete`'s `.value` assumption) — all Info/Warning-level code-quality items, none of which block the phase's observable truths; not fixed in this phase, no evidence they were required to be.

None of the above are blockers: none contradict a ROADMAP success criterion or PLAN must-have, and the two review findings the task explicitly called out for verification (CR-01, WR-02) are both fixed and regression-tested.

### Human Verification Required

None requiring a new prompt. The only outstanding human-facing item (02-04-PLAN.md Task 3's real-mobile-browser walkthrough) was explicitly and transparently skipped by the project owner on 2026-07-15, with reasoning and scope-reduction caveats recorded in 02-04-SUMMARY.md. This is captured as an accepted override in this report's frontmatter, not as a pending human-verification item.

### Gaps Summary

No gaps found. All 11 must-have truths (6 ROADMAP success criteria + 2 verified code-review fixes + 3 D-08/harness/E2E truths) are verified against the actual codebase and a live re-run of the automated suites (29/29 Vitest, 4/4 Playwright), not merely against SUMMARY.md's claims. The one outstanding item — Task 3's blocking human-verify gate — was explicitly and disclosedly skipped by the project owner and is recorded as an accepted override rather than a gap or a new human-verification prompt.

---

_Verified: 2026-07-16_
_Verifier: Claude (gsd-verifier)_
