---
phase: 02-signal-capture-layer
plan: 02
subsystem: signal-capture
tags: [dom-events, touch-events, happy-dom, vitest, pii-safety]

# Dependency graph
requires:
  - phase: 02-signal-capture-layer
    provides: "tests/signal.test.js RED suites (SIG-01..05), config/schema.json + demo-platform.json signals.* threshold surface (Plan 02-01)"
provides:
  - "src/signal.js: buildPayload(type, ctx) — single PII-safe payload choke point for all four signal types (SIG-05, D-07)"
  - "src/signal.js: resolveTargets(config) — DOM-presence-filtered selector resolution"
  - "src/signal.js: wireTouchHesitation — live-firing single-setTimeout hold detector, CTA-scoped (SIG-01, D-01, D-02)"
  - "src/signal.js: wireBlurIncomplete — final-value-diff empty-check gate, amountInput-only (SIG-02, D-03, D-04)"
  - "src/signal.js: attachScrollReversal/checkScrollReversal — 40% depth + hysteresis-delta reversal detector (SIG-03, D-05)"
  - "src/signal.js: attachListeners(config) entry point wiring all three; initSignalCapture(config) stub wrapper"
affects: [02-03, phase-3-inference]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Centralized buildPayload(type, ctx) choke point — switch-per-type allow-list, no call site outside it constructs a publish() payload"
    - "Single setTimeout + clearTimeout pair per held element for long-press detection (no second tap-duration check)"
    - "Value-read/payload-construction separation for PII firewalls: el.value read only into a local boolean gate, never passed into buildPayload's ctx"
    - "Module-scoped scroll-tracking state reset on every attachListeners/attachScrollReversal call (new scroll session semantics), while the underlying `scroll` listener itself is attached at most once (scrollListenerAttached guard)"

key-files:
  created:
    - src/signal.js
  modified: []

key-decisions:
  - "Scroll-reversal computation runs synchronously inside the `scroll` event listener rather than deferred through requestAnimationFrame, deviating from 02-RESEARCH.md's rAF-coalescing suggestion — happy-dom implements requestAnimationFrame via Node's async setImmediate (verified by direct source inspection of node_modules/happy-dom/lib/window/BrowserWindow.js), which would not have resolved before the pre-authored synchronous SIG-03 tests assert (no await in those `it()` blocks). Synchronous computation is correctness-equivalent for this cheap check and keeps the listener `{ passive: true }`."
  - "attachScrollReversal resets maxScrollY/thresholdCrossed on every call, not just on first attach — this fixes real cross-test module-state pollution discovered during Task 3 (SIG-03's test run left maxScrollY=400, silently breaking SIG-05's scroll_reversal payload test) and is also the semantically correct behavior for a real SPA route change (Plan 02-03): a new page/route starts with a fresh scroll baseline."
  - "Added a minimal initSignalCapture(config) stub (wraps attachListeners) even though 02-02-PLAN.md's own artifact list assigns it to Plan 02-03 — tests/signal.test.js imports { attachListeners, initSignalCapture } as a single ES module statement; a missing named export fails the whole file's module load (not just the SIG-04 tests that use it), which would have blocked SIG-01/02/03/05 from running at all."

requirements-completed: [SIG-01, SIG-02, SIG-03, SIG-05]

coverage:
  - id: D1
    description: "buildPayload(type, ctx) is the single PII-safe choke point constructing every emitted payload, enforcing D-07's per-type allow-list (touch_hesitation/blur_incomplete: type/targetSelector/bbox/timestamp; scroll_reversal: +scrollDepth, null targetSelector/bbox; back_intent: +pathname, null targetSelector/bbox)"
    requirement: "SIG-05"
    verification:
      - kind: unit
        ref: "tests/signal.test.js#SIG-05 touch_hesitation/blur_incomplete/scroll_reversal payload allow-list assertions"
        status: pass
      - kind: other
        ref: "grep for .value/.textContent/.innerHTML/localStorage/document.cookie in src/signal.js — only match outside comments is wireBlurIncomplete's internal emptiness gate (line 121), never inside buildPayload"
        status: pass
    human_judgment: false
  - id: D2
    description: "Touch hesitation fires live via a single setTimeout at the configured threshold (default 800ms) while still held, CTA-scoped to proceedCta/confirmCta/backBtn only; release before the threshold emits nothing"
    requirement: "SIG-01"
    verification:
      - kind: unit
        ref: "tests/signal.test.js#SIG-01 (both assertions)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Blur on amountInput while empty emits blur_incomplete (D-03 final-value diff); non-empty blur emits nothing; only amountInput is monitored (D-04)"
    requirement: "SIG-02"
    verification:
      - kind: unit
        ref: "tests/signal.test.js#SIG-02 (both assertions)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Scroll past 40% viewport depth then reversing by >=50px emits scroll_reversal; sub-delta reversal (momentum jitter) emits nothing"
    requirement: "SIG-03"
    verification:
      - kind: unit
        ref: "tests/signal.test.js#SIG-03 (both assertions)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-14
status: complete
---

# Phase 2 Plan 2: Signal Capture Implementation (Touch/Blur/Scroll) Summary

**Implemented src/signal.js's centralized PII-safe buildPayload choke point plus live-firing touch-hesitation, blur-incomplete, and scroll-reversal handlers, flipping SIG-01/02/03/05 from RED to GREEN while leaving SIG-04/06 (back intent, SPA re-attachment) for Plan 02-03.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-14T13:17:00Z
- **Completed:** 2026-07-14T13:26:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- `buildPayload(type, ctx)` is the sole function in `src/signal.js` that constructs any object passed to `publish()` — a `switch` per signal type encodes D-07's exact allow-list (touch_hesitation/blur_incomplete get `{type, targetSelector, bbox, timestamp}`; scroll_reversal/back_intent get null `targetSelector`/`bbox` plus their own `scrollDepth`/`pathname` field), and the unknown-type branch throws a `[heed]`-prefixed Error.
- `wireTouchHesitation` implements the single-`setTimeout`/`clearTimeout` live-fire pattern (D-01): one timer per `touchstart`, cancelled by `touchend`/`touchcancel`/`touchmove`, firing exactly once while still held with no second `<300ms` tap check (Pitfall 1). Wired only for `proceedCta`/`confirmCta`/`backBtn` (D-02) via `attachListeners`.
- `wireBlurIncomplete` reads `amountInput.value` only into a local `isEmpty` boolean gate (D-03 final-value diff) — that boolean never flows into `buildPayload`, which never reads `.value` itself. Wired only for `amountInput` (D-04).
- `attachScrollReversal`/`checkScrollReversal` implement the 40%-depth-then-≥50px-reversal hysteresis detector (D-05), reading thresholds via `config.signals?.scrollReversal?.{depthThresholdPct,minReversalDeltaPx}` with 0.4/50 defaults.
- SIG-01, SIG-02, SIG-03 tests fully green; SIG-05's touch_hesitation/blur_incomplete/scroll_reversal payload-allow-list sub-tests green. SIG-04 and SIG-05's back_intent sub-test, and all of SIG-06, remain RED as expected — back intent and SPA re-attachment are Plan 02-03's scope, not this plan's (confirmed by running the full suite: 21/26 tests pass, all 5 failures attributable to back_intent/SIG-06 machinery this plan intentionally does not implement).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/signal.js with the centralized PII-safe buildPayload choke point (SIG-05, D-07)** - `2fb40c1` (feat)
2. **Task 2: Implement live-firing touch-hesitation timer, CTA-scoped (SIG-01, D-01, D-02)** - `dbb27b3` (feat)
3. **Task 3: Implement blur-incomplete (SIG-02, D-03, D-04) and scroll-reversal (SIG-03, D-05)** - `1cdc1cb` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/signal.js` - NEW. `buildPayload`, `resolveTargets`, `wireTouchHesitation`, `wireBlurIncomplete`, `attachScrollReversal`/`checkScrollReversal`, `attachListeners`, `initSignalCapture` (stub). Imports only `{ publish }` from `./bus.js`.

## Decisions Made
- Scroll-reversal computation runs synchronously inside the `scroll` listener rather than deferred through `requestAnimationFrame`, because happy-dom's `requestAnimationFrame` resolves via an async Node `setImmediate` (confirmed by reading `node_modules/happy-dom/lib/window/BrowserWindow.js`), which would not fire before the pre-authored synchronous `SIG-03` `it()` blocks assert. See Deviations below.
- `attachScrollReversal` resets `maxScrollY`/`thresholdCrossed` on every call (not just the first) rather than only on the initial attach — both fixes a genuine cross-test module-state leak and matches the intended real-world semantics of a fresh scroll session on SPA navigation.
- Added a minimal `initSignalCapture` stub in this plan (wraps `attachListeners`) despite the plan's own artifact list assigning it to Plan 02-03, purely so the test file's `import { attachListeners, initSignalCapture }` statement resolves — see Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed requestAnimationFrame deferral from scroll-reversal detection**
- **Found during:** Task 3 (`npx vitest run tests/signal.test.js -t "SIG-03"`)
- **Issue:** Implementing 02-RESEARCH.md's suggested rAF-coalescing wrapper verbatim made the SIG-03 "fires scroll_reversal..." test fail with `expected [] to have a length of 1 but got +0` — happy-dom's `requestAnimationFrame` runs via Node's `setImmediate` (an async macrotask), which had not fired by the time the test's synchronous `it()` body dispatched its two `scroll` events and asserted, since the test contains no `await`.
- **Fix:** Compute `checkScrollReversal(config)` synchronously inside the `scroll` listener instead of scheduling it via `requestAnimationFrame`. Listener remains `{ passive: true }`; correctness is unaffected (each `scroll` event still only costs two window property reads and a few comparisons).
- **Files modified:** src/signal.js
- **Verification:** `npx vitest run tests/signal.test.js -t "SIG-03"` — 2/2 pass
- **Committed in:** `1cdc1cb` (Task 3 commit)

**2. [Rule 1 - Bug] Reset scroll-tracking module state on every attachScrollReversal call**
- **Found during:** Task 3 full-file run (`npx vitest run tests/signal.test.js`)
- **Issue:** With `maxScrollY`/`thresholdCrossed` only initialized once at module load, `SIG-03`'s first test left `maxScrollY = 400` in module scope. Because Vitest shares one module instance across all `it()` blocks in a file, `SIG-05`'s later `scroll_reversal` payload test (starting from a freshly-defined `window.scrollY = 0`) could never re-cross the depth threshold — `400 > 400` and `340 > 400` are both false — so no `scroll_reversal` payload was ever published, and `Object.keys(undefined)` threw inside the test.
- **Fix:** `attachScrollReversal(config)` now resets `maxScrollY = 0; thresholdCrossed = false;` unconditionally at the top of every call, before the `scrollListenerAttached` early-return guard (which still correctly prevents a second `scroll` listener from being registered on repeat calls).
- **Files modified:** src/signal.js
- **Verification:** `npx vitest run tests/signal.test.js` — SIG-05's scroll_reversal sub-test passes; full run confirms only the 2 back_intent-related tests (out of this plan's scope) remain red
- **Committed in:** `1cdc1cb` (Task 3 commit)

**3. [Rule 3 - Blocking] Added a minimal initSignalCapture stub in Task 1**
- **Found during:** Task 1 (`npx vitest run tests/signal.test.js -t "SIG-05"`)
- **Issue:** `tests/signal.test.js` imports `{ attachListeners, initSignalCapture }` from `../src/signal.js` in a single statement. `02-02-PLAN.md`'s artifact list assigns `initSignalCapture` to Plan 02-03, but a named ES module import that doesn't resolve fails the entire file's module load (a `SyntaxError`-class failure, not a per-test failure) — without some export, none of SIG-01/02/03/05 could run at all, not just SIG-04's tests.
- **Fix:** Exported a thin `initSignalCapture(config)` wrapper around `attachListeners(config)` in Task 1, documented with a comment explaining it is a stub extended by Plan 02-03 (MutationObserver/popstate/WeakSet wiring) and that back_intent-related assertions remain intentionally RED until then.
- **Files modified:** src/signal.js
- **Verification:** `npx vitest run tests/signal.test.js` — module resolves cleanly; SIG-04 tests fail on assertion (0 back_intents received) rather than on import
- **Committed in:** `2fb40c1` (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All three were necessary to make the plan's own target test suites pass correctly and deterministically. No scope creep — back_intent/SPA re-attachment behavior itself was not implemented, only a stub export required for the shared test file to load.

## Issues Encountered
- 02-02-PLAN.md's `<verification>` section states "SIG-01/02/03/05... all green," but SIG-05's `back_intent` sub-test cannot pass without back-intent capture, which the plan's own `<objective>` explicitly excludes ("This plan does NOT implement back intent... Plan 02-03"). This is a pre-existing inconsistency between the plan's task list (3 tasks, no back-intent work) and its top-level verification claim, not something introduced this plan. Resolved by treating the plan's own scope boundary as authoritative: SIG-01/02/03 fully green, SIG-05's touch/blur/scroll sub-tests green, SIG-05's back_intent sub-test and all of SIG-04/SIG-06 left RED for Plan 02-03, exactly matching the plan's separate note "SIG-04 and SIG-06 remain RED (implemented in Plan 02-03) — expected mid-phase."

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/signal.js` now exports `buildPayload`, `resolveTargets`, `wireTouchHesitation`, `wireBlurIncomplete`, `attachScrollReversal`, `attachListeners`, and a stub `initSignalCapture` — Plan 02-03 extends the file in place (WeakSet idempotency, MutationObserver, cached `flowComplete` flag, popstate-driven back-intent handler, real `initSignalCapture`) and wires it into `src/index.js`.
- The `buildPayload` choke point and its D-07 allow-list shapes are already correct for `back_intent` (`{type, targetSelector: null, bbox: null, pathname, timestamp}`) — Plan 02-03 only needs to call it with the right `ctx`, no changes to `buildPayload` itself expected.
- `attachScrollReversal`'s reset-on-every-call behavior is intentionally re-entrant-safe for Plan 02-03's SPA re-attachment pass; no further changes anticipated there.
- No blockers. `test-harness/index.html`'s D-08 rewiring and `tests/e2e/harness.spec.js` remain out of scope for this plan, as documented in 02-RESEARCH.md's Recommended Project Structure.

---
*Phase: 02-signal-capture-layer*
*Completed: 2026-07-14*

## Self-Check: PASSED

`src/signal.js` found on disk; all three task commit hashes (2fb40c1, dbb27b3, 1cdc1cb) found in git log.
