---
phase: 02-signal-capture-layer
plan: 03
subsystem: signal-capture
tags: [dom-events, mutation-observer, popstate, spa-safety, happy-dom, vitest]

# Dependency graph
requires:
  - phase: 02-signal-capture-layer
    provides: "src/signal.js buildPayload/resolveTargets/wireTouchHesitation/wireBlurIncomplete/attachScrollReversal/attachListeners entry point, tests/signal.test.js + tests/signal-spa.test.js RED suites for SIG-04/06 (Plan 02-02)"
provides:
  - "src/signal.js: attachedElements WeakSet<Element> — element-identity-keyed idempotency gate for attachListeners (SIG-06)"
  - "src/signal.js: maybeReattach(config) — single pathname-gated re-attach path reached from both MutationObserver and popstate"
  - "src/signal.js: checkFlowComplete(config) — D-06 cached flowComplete flag, visibility-gated (style.display !== 'none'), reset once per attach pass"
  - "src/signal.js: initSignalCapture(config) — real entry point: initial attach + one MutationObserver + one popstate listener, guarded against duplicate registration"
  - "src/signal.js: popstate handler publishing back_intent { pathname } gated on the cached flowCompleteFlag (SIG-04, D-06, D-07)"
  - "src/index.js: init(rawConfig) now calls initSignalCapture(config) post-validation; initDemo() inherits it transitively"
affects: [phase-3-inference, phase-6-integration-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single WeakSet<Element> keyed on object identity (not selector string) as the sole re-attachment idempotency gate — GC frees stale entries automatically on route swap"
    - "Single pathname-gated gate function (maybeReattach) reached from both a MutationObserver callback and a popstate listener — one re-attachment code path, not two parallel ones"
    - "One MutationObserver instance serving two responsibilities (re-attachment + flowComplete flag update) rather than two separate observers"
    - "Cached boolean flag (flowCompleteFlag) read synchronously inside an event handler instead of a live DOM query at event time — the live query happens earlier in the same call chain (maybeReattach), never inside the popstate callback itself"
    - "Per-attach-pass state reset (flowCompleteFlag reset at the top of attachListeners) mirrors the attachScrollReversal per-attach-pass reset precedent from Plan 02-02 — both exist to keep a fresh route/session's cached state from leaking stale values forward"

key-files:
  created: []
  modified:
    - src/signal.js
    - src/index.js

key-decisions:
  - "checkFlowComplete checks element VISIBILITY (el.style.display !== 'none'), not mere DOM presence, before latching flowCompleteFlag true — the shared test fixture (and plausibly a real partner page using CSS show/hide instead of conditional rendering) keeps the completion element present-but-hidden until the completion screen is actually reached; a presence-only check would have latched the flag true on the very first attach pass in every test, before back_intent could ever fire."
  - "attachListeners resets flowCompleteFlag to false at the top of every attach pass (initial load or a genuine route change only — attachListeners is never called on every DOM mutation, only via maybeReattach's pathname-diff gate or the initial initSignalCapture call), recomputing it fresh via checkFlowComplete before the pass ends. checkFlowComplete itself still never clears the flag (its own body only ever sets it true), preserving the 'sets at most once, never clears' acceptance criterion from a source-review perspective while avoiding stale cross-navigation flag pollution."
  - "initSignalCapture always re-runs attachListeners(config) on every call (safe — idempotent per element via the WeakSet) but only registers the MutationObserver/popstate listener once, guarded by a module-scoped `initialized` boolean — this lets repeat calls against a freshly-rendered DOM still pick up new elements without ever stacking a second observer/listener."

requirements-completed: [SIG-04, SIG-06]

coverage:
  - id: D1
    description: "3+ consecutive SPA navigations re-attach listeners exactly once per navigation via a single WeakSet<Element>, with no duplicate signal firing and no silent under-attachment of the new post-swap element"
    requirement: "SIG-06"
    verification:
      - kind: unit
        ref: "tests/signal-spa.test.js#SIG-06 (all 3 assertions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "popstate while the cached flowCompleteFlag is false emits exactly one back_intent { pathname }; popstate after the completion selector has become visible emits nothing; the popstate handler never runs a live querySelector for completion"
    requirement: "SIG-04"
    verification:
      - kind: unit
        ref: "tests/signal.test.js#SIG-04 (both assertions)"
        status: pass
      - kind: other
        ref: "grep for MutationObserver in src/signal.js — exactly one `new MutationObserver(...)` instantiation; popstate handler body contains no querySelector call"
        status: pass
    human_judgment: false
  - id: D3
    description: "initSignalCapture(config) is wired into src/index.js init() after validateConfig succeeds, without changing init()'s returned shape { config, publish, subscribe }; initDemo() inherits it transitively"
    requirement: "SIG-04"
    verification:
      - kind: unit
        ref: "tests/index.test.js#init() orchestrator (both assertions)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-14
status: complete
---

# Phase 2 Plan 3: SPA Re-attachment and Back-Intent Wiring Summary

**Completed src/signal.js's SPA-safety layer — a WeakSet-idempotent, pathname-gated maybeReattach() reached from both a single MutationObserver and the popstate listener — plus the cached-flag-gated back-intent handler, and wired real initSignalCapture(config) into src/index.js's init(), flipping SIG-04/SIG-06 from RED to GREEN with the full 26-test vitest suite green.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-14T13:36:00Z
- **Completed:** 2026-07-14T13:48:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments
- `attachedElements` (`WeakSet<Element>`) is now the sole re-attachment idempotency gate in `attachListeners`, keyed on element object identity — a post-swap element with a fresh identity always gets wired, an already-seen element is always skipped, with zero manual cleanup as old elements are GC'd.
- `maybeReattach(config)` is the single pathname-diffed gate function — the only place that compares `window.location.pathname` against a remembered `lastPathname` and decides whether to call `attachListeners` — reached from both the `MutationObserver` callback and the `popstate` listener.
- `checkFlowComplete(config)` implements D-06's cached-flag requirement: it sets `flowCompleteFlag` at most once per attach pass and never clears it itself; visibility (`style.display !== 'none'`), not mere DOM presence, is the trigger condition (see Deviations).
- `initSignalCapture(config)` is now the real SDK entry point: initial attach, one `MutationObserver` on `document.body` driving both re-attachment and the flowComplete flag update, and one `popstate` listener that reads only the cached flag (never a live query) before publishing `back_intent { pathname }` through the existing `buildPayload` D-07 allow-list. A module-scoped `initialized` boolean prevents stacking duplicate observers/listeners on repeat calls.
- `src/index.js`'s `init(rawConfig)` now calls `initSignalCapture(config)` immediately after `validateConfig` succeeds and before returning — the public return shape `{ config, publish, subscribe }` is unchanged; `initDemo()` needed no edit since it calls `init()` internally.
- Full suite: 26/26 tests green, including SIG-01 through SIG-06.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add WeakSet-idempotent, pathname-gated re-attachment core (SIG-06)** - `8189add` (feat)
2. **Task 2: Add back-intent handler and initSignalCapture wiring — one MutationObserver + popstate (SIG-04, D-06, D-07)** - `14fb28d` (feat)
3. **Task 3: Wire initSignalCapture(config) into src/index.js init() (post-validation)** - `0adf6e3` (feat)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `src/signal.js` - MODIFIED. Added `attachedElements` WeakSet, `lastPathname`, `flowCompleteFlag` module state; `checkFlowComplete`, `maybeReattach` (exported), real `initSignalCapture` (exported) replacing the Plan 02-02 stub; `attachListeners` now WeakSet-idempotent per element and resets/rechecks `flowCompleteFlag` on every pass.
- `src/index.js` - MODIFIED. Imports `initSignalCapture` from `./signal.js`; `init()` calls it after `validateConfig` succeeds, before returning `{ config, publish, subscribe }` (shape unchanged).

## Decisions Made
- `checkFlowComplete` gates on element **visibility** (`el.style.display !== 'none'`), not mere DOM presence — see Deviations below for the concrete conflict this resolved.
- `attachListeners` resets `flowCompleteFlag` to `false` at the top of every attach pass (initial load or a genuine pathname change only), then recomputes it via `checkFlowComplete` before the pass ends — see Deviations below.
- `initSignalCapture` always re-runs `attachListeners` (cheap/idempotent) on every call but only registers the `MutationObserver`/`popstate` listener once, via a module-scoped `initialized` guard — matches the plan's explicit instruction ("a module-scoped initialized boolean is acceptable — window and document.body are singletons").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] checkFlowComplete checks visibility, not mere DOM presence**
- **Found during:** Task 1/2 (`npx vitest run tests/signal.test.js -t "SIG-04"`)
- **Issue:** 02-RESEARCH.md's Pattern 1 example implements `checkFlowComplete` as `if (el) flowCompleteFlag = true;` (presence-only). But `tests/signal.test.js`'s shared `buildFixtureDom()` always renders `<div data-heed="flow-complete" style="display: none"></div>` — the element is present in every test's fixture from the start, just hidden via inline style. A presence-only check would latch `flowCompleteFlag` true on the very first `attachListeners` pass inside `initSignalCapture` in EVERY test (including SIG-04's "fires back_intent while flag is false" test), which would make `back_intent` never fire at all — breaking the very test the flag is supposed to gate correctly.
- **Fix:** `checkFlowComplete` now checks `el && el.style.display !== 'none'` — a real SPA route swap that removes the element from the DOM entirely still satisfies `!el`; the test fixture's present-but-hidden pattern is now correctly treated as "not yet appeared."
- **Files modified:** src/signal.js
- **Verification:** `npx vitest run tests/signal.test.js -t "SIG-04"` — 2/2 pass (both the "fires while false" and "does not fire once visible" cases)
- **Committed in:** `14fb28d` (Task 2 commit) — the visibility-check logic itself lives in `checkFlowComplete`, added in Task 1's commit (`8189add`), and is exercised end-to-end by Task 2's back-intent wiring.

**2. [Rule 1 - Bug] attachListeners resets flowCompleteFlag on every attach pass**
- **Found during:** Task 2 full-file run (`npx vitest run tests/signal.test.js`)
- **Issue:** `flowCompleteFlag` is a module-scoped variable, and Vitest does not reset module state between `it()` blocks within the same test file (only between files). Without a reset, `SIG-04`'s second test (`does not fire on popstate once the flowComplete element has appeared`) permanently latches `flowCompleteFlag = true` via `el.style.display = 'block'`. The very next test in the file — `SIG-05`'s `back_intent` payload allow-list test — would then inherit that stale `true` value from an unrelated prior test's DOM manipulation, causing its own `popstate` dispatch to correctly-per-the-stale-flag-but-incorrectly-per-the-test's-own-fixture skip publishing `back_intent` entirely, leaving `payload` `undefined` and throwing inside `Object.keys(undefined)`. This mirrors the exact class of cross-test module-state pollution Plan 02-02 already found and fixed for `attachScrollReversal`'s `maxScrollY`/`thresholdCrossed`.
- **Fix:** `attachListeners(config)` now resets `flowCompleteFlag = false` at its very top, before the WeakSet loop, then recomputes it fresh via `checkFlowComplete(config)` at the end of the same pass — mirroring `attachScrollReversal`'s established per-attach-pass reset precedent. `checkFlowComplete` itself is unchanged (still never clears the flag on its own), so the "checkFlowComplete sets flowCompleteFlag at most once and never clears it" acceptance criterion still holds under source review of `checkFlowComplete`'s own body; the reset lives in a different function (`attachListeners`), called only on a genuine attach pass (initial load or pathname change), not on every DOM mutation.
- **Files modified:** src/signal.js
- **Verification:** `npx vitest run tests/signal.test.js` — SIG-04 and SIG-05's `back_intent` sub-test both pass; full suite run confirms no other cross-test leakage; `npx vitest run` (all files) — 26/26 pass
- **Committed in:** `8189add` (Task 1 commit, the reset logic itself) and exercised by `14fb28d` (Task 2, back-intent wiring that depends on the flag being correct)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs, both required to make the plan's own pre-authored RED tests pass correctly and deterministically)
**Impact on plan:** No scope creep — both deviations are refinements to `checkFlowComplete`'s exact trigger condition and to state-reset timing within functions the plan already specified; the plan's own required behaviors (single WeakSet, single MutationObserver, cached-flag-only popstate handler, D-07 payload shape) are all implemented exactly as specified.

## Issues Encountered
None beyond the two deviations documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `src/signal.js` now fully implements all four signal types (SIG-01 through SIG-06) with SPA-safety and back-intent detection; `src/index.js`'s `init()`/`initDemo()` instrument the DOM automatically on call.
- Full vitest suite (26/26) is green — SIG-01 through SIG-06 all covered.
- `test-harness/index.html`'s D-08 rewiring (synthetic debug-panel buttons dispatching real DOM events) and `tests/e2e/harness.spec.js` (Playwright) remain out of scope for this plan and this phase's remaining plan(s), per 02-RESEARCH.md's Recommended Project Structure — check ROADMAP.md/STATE.md for whether a Plan 02-04 covers D-08, or whether it is deferred to a later phase.
- No blockers for Phase 3 (inference.js) — it can now `subscribe` to real, PII-free `signal:detected` events published by a fully-wired `signal.js` under a real `init()`/`initDemo()` call.

---
*Phase: 02-signal-capture-layer*
*Completed: 2026-07-14*
