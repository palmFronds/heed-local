---
phase: 02-signal-capture-layer
plan: 01
subsystem: testing
tags: [vitest, happy-dom, json-schema, tdd-red, dom-events]

# Dependency graph
requires:
  - phase: 01-config-layer-bus-standalone-test-harness
    provides: "src/bus.js publish/subscribe, src/config.js validateConfig/walk, config/schema.json + demo-platform.json, tests/fixtures/test-subscriber.js collectReceived helper"
provides:
  - "config/schema.json optional signals.{touchHesitation.thresholdMs, scrollReversal.{depthThresholdPct,minReversalDeltaPx}} fields, backward compatible (D-05)"
  - "config/demo-platform.json concrete signal-threshold defaults (800ms / 0.4 / 50px)"
  - "tests/signal.test.js — RED describe blocks SIG-01 through SIG-05 (touch hesitation, blur incomplete, scroll reversal, back intent, PII-safe payload allow-list)"
  - "tests/signal-spa.test.js — RED describe block SIG-06 (SPA re-attachment idempotency)"
affects: [02-02, 02-03, phase-3-inference]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional, non-required JSON-Schema properties for additive config surface (config.signals?.x?.y ?? default read style)"
    - "happy-dom ambient globals (TouchEvent, Touch, FocusEvent, PopStateEvent, MutationObserver) used directly in test files without an explicit happy-dom Window import"
    - "history.pushState() (not popstate dispatch) used to simulate SPA route swaps in tests — matches real SPA router behavior (pushState never fires popstate)"
    - "vi.useFakeTimers() isolated to signal.test.js only; signal-spa.test.js uses zero fake timers to avoid the happy-dom#2097 MutationObserver interaction"

key-files:
  created:
    - tests/signal.test.js
    - tests/signal-spa.test.js
  modified:
    - config/schema.json
    - config/demo-platform.json

key-decisions:
  - "Scroll-reversal RED tests stub window.innerHeight/scrollY via Object.defineProperty rather than window.scrollTo() — happy-dom has no real layout engine (02-RESEARCH.md Pitfall 5)"
  - "SIG-06 idempotency tests use blur_incomplete (synchronous, no timer) as the re-attachment probe instead of touch_hesitation, since touch_hesitation's 800ms real setTimeout would make idempotency assertions slow/flaky without fake timers, which are intentionally excluded from this file"

patterns-established:
  - "Centralized payload allow-list assertion style: Object.keys(payload).sort() deep-equality per signal type, run against explicit NO_PII_KEYS negative checks (value/text/id/class/amount)"

requirements-completed: []  # SIG-01..SIG-06 intentionally NOT marked complete — this Wave-0 plan only authors RED tests encoding them (Nyquist RED-first). They flip to GREEN and get marked in Plans 02/03, matching the Phase-1 precedent (CFG-01/CFG-02/BUS-01/TEST-01 were left unmarked after 01-01 for the same reason).

coverage:
  - id: D1
    description: "config/schema.json and config/demo-platform.json extended with an optional, backward-compatible signals threshold surface (D-05)"
    verification:
      - kind: unit
        ref: "tests/config.test.js#CFG-01/CFG-02 (all 6 assertions)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/signal.test.js authored with RED describe blocks SIG-01 through SIG-05, failing because src/signal.js does not exist (not a parse error)"
    verification:
      - kind: other
        ref: "npx vitest run tests/signal.test.js — asserted to fail via unresolved-import error, confirmed RED for the correct reason"
        status: pass
    human_judgment: false
  - id: D3
    description: "tests/signal-spa.test.js authored with a RED describe block SIG-06, failing because src/signal.js does not exist, with zero vi.useFakeTimers() usage in the file"
    verification:
      - kind: other
        ref: "npx vitest run tests/signal-spa.test.js — asserted to fail via unresolved-import error, confirmed RED for the correct reason"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-14
status: complete
---

# Phase 2 Plan 1: Signal Capture RED Tests + Config Surface Summary

**Authored RED unit test suites encoding all six SIG-01–SIG-06 signal-capture requirements against a non-existent `src/signal.js`, and extended `config/schema.json`/`demo-platform.json` with an optional, backward-compatible signal-threshold config surface (D-05).**

## Performance

- **Duration:** 10 min
- **Started:** 2026-07-14T13:00:27Z
- **Completed:** 2026-07-14T13:10:29Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- `config/schema.json` gained an optional top-level `signals` object (`touchHesitation.thresholdMs`, `scrollReversal.{depthThresholdPct,minReversalDeltaPx}`) without touching the top-level `required` array — `tests/config.test.js`'s 6 existing assertions still pass unchanged.
- `config/demo-platform.json` gained a concrete `signals` block (800ms / 0.4 / 50px) proving the schema shape end-to-end and giving Plans 02/03 a real config surface to read.
- `tests/signal.test.js` encodes SIG-01 (800ms live-fire hold timer, no separate `<300ms` check), SIG-02 (blur-incomplete, D-03 final-value diff), SIG-03 (40% depth + ≥50px reversal hysteresis, D-05), SIG-04 (popstate + cached `flowComplete` flag, D-06), and SIG-05 (structural PII-safe payload allow-list for all four signal types) — all RED because `src/signal.js` does not exist yet.
- `tests/signal-spa.test.js` encodes SIG-06's SPA re-attachment idempotency (3+ consecutive navigations, WeakSet element-identity semantics, no double-listener accumulation) using a direct-function-call (`maybeReattach`) strategy, kept free of `vi.useFakeTimers()` per the happy-dom#2097 pitfall.
- Verified both RED suites fail for the correct reason (unresolved `../src/signal.js` import) rather than a parse/syntax error, and that the full existing suite (`bus`, `config`, `harness`, `index` — 11 tests) remains green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend config schema and demo config with optional signal-threshold fields (D-05)** - `450d257` (feat)
2. **Task 2: Author RED unit suites for SIG-01–SIG-05 in tests/signal.test.js** - `4559803` (test)
3. **Task 3: Author RED SPA re-attachment suite for SIG-06 in tests/signal-spa.test.js** - `021a0ef` (test)

**Plan metadata:** _pending_ (docs: complete plan)

## Files Created/Modified
- `config/schema.json` - added optional `signals.touchHesitation.thresholdMs` and `signals.scrollReversal.{depthThresholdPct,minReversalDeltaPx}`, not in any `required` array
- `config/demo-platform.json` - added concrete `signals` block (800, 0.4, 50) alongside the unchanged 7 selectors
- `tests/signal.test.js` - RED suites for SIG-01 through SIG-05, importing `attachListeners`/`initSignalCapture` from `../src/signal.js`
- `tests/signal-spa.test.js` - RED suite for SIG-06, importing `attachListeners`/`maybeReattach`/`initSignalCapture` from `../src/signal.js`

## Decisions Made
- Stubbed `window.innerHeight`/`window.scrollY` explicitly via `Object.defineProperty` in scroll-reversal tests rather than relying on `window.scrollTo()`, since happy-dom has no real layout engine (confirmed via a throwaway ambient-globals check during execution — `window.scrollTo()` was not exercised, direct property assignment was used instead, which is the safer of the two per 02-RESEARCH.md Pitfall 5).
- Used `history.pushState()` (never `popstate` dispatch) to simulate SPA route swaps in `signal-spa.test.js`, matching the documented real-world behavior that SPA routers like Next.js use `pushState` for forward navigation, which does not fire `popstate`.
- Chose `blur_incomplete` (not `touch_hesitation`) as the idempotency probe signal in all three SIG-06 test cases, since it fires synchronously with no timer dependency — keeps `signal-spa.test.js` genuinely free of any timer/async flakiness while still exercising the exact same WeakSet-based listener-attachment path `touch_hesitation` would use.
- Left `SIG-01` through `SIG-06` unmarked in `requirements-completed` and did not run `requirements mark-complete` for them — this Wave-0 plan only authors failing tests encoding these requirements (Nyquist RED-first); they are genuinely satisfied once Plans 02/03 implement `src/signal.js` and flip the suites GREEN. This mirrors the exact precedent recorded in STATE.md for Phase 1's Wave-0 plan (CFG-01/CFG-02/BUS-01/TEST-01).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired a broken local `node_modules` install before any test command could run**
- **Found during:** Task 1 verification (`npx vitest run tests/config.test.js`)
- **Issue:** `node_modules` was in an inconsistent state — `vitest` itself was not resolvable (`ERR_MODULE_NOT_FOUND`) even though `package.json`/`package-lock.json` correctly listed it as a devDependency; only scoped `@vitest/*` sub-packages were present, not the top-level `vitest` package.
- **Fix:** Ran `npm install` (no changes to `package.json`/`package-lock.json` — the lockfile was already correct; only the on-disk `node_modules` was stale/corrupted, likely from an unrelated Next.js scaffold hinted at by the untracked `.next/` directory in this working tree).
- **Files modified:** None (node_modules is gitignored; no package.json/package-lock.json diff resulted)
- **Verification:** `npx vitest run tests/config.test.js` passed cleanly afterward (6/6 tests)
- **Committed in:** N/A — no trackable file changes; environment-only fix

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to run any verification command; no scope creep, no code/config changes beyond the planned tasks.

## Issues Encountered
None beyond the node_modules repair documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All six SIG requirements have a failing, correctly-RED automated check on disk, ready for Plans 02/03 to implement `src/signal.js` against.
- The optional `signals` config surface is live in both `schema.json` and `demo-platform.json`, so `src/signal.js`'s `config.signals?.x?.y ?? default` reads (per 02-RESEARCH.md Code Examples) have real config to read from day one.
- No blockers. `tests/e2e/harness.spec.js` (Playwright, D-08 fidelity) and `test-harness/index.html`'s D-08 rewiring remain out of scope for this plan and are expected in a later Phase 2 plan per 02-RESEARCH.md's Recommended Project Structure.

---
*Phase: 02-signal-capture-layer*
*Completed: 2026-07-14*

## Self-Check: PASSED

All created/modified files found on disk; all four commit hashes (450d257, 4559803, 021a0ef, 0c2e5ed) found in git log.
