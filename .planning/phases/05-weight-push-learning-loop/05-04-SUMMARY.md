---
phase: 05-weight-push-learning-loop
plan: 04
subsystem: infra
tags: [fetch, promise-chaining, esbuild, playwright, test-harness]

# Dependency graph
requires:
  - phase: 05-weight-push-learning-loop (05-02)
    provides: local-receiver/server.js GET /weights endpoint at http://localhost:4310/weights
  - phase: 05-weight-push-learning-loop (05-03)
    provides: src/index.js initDemo(overrides) optional-parameter injection point
provides:
  - test-harness/index.html bootstrap that fetches persisted weights before init and injects via initDemo(overrides), with .catch/.finally cold-start fallback
  - dist/sdk.js rebuilt from 05-03's src graph (gitignored build artifact)
  - window.__heedReady test hook + updated tests/e2e/harness.spec.js beforeEach guard against the async-init race the fetch-before-init bootstrap introduces
affects: [05-05 (soak-test / SC2 GET-readback verification)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise .then/.catch/.finally chaining (not async/await) to match test-harness/index.html's existing ES5 var-only inline-script style"
    - "window.__heedReady test-only readiness flag pattern for synchronizing Playwright against an async bootstrap"

key-files:
  created: []
  modified:
    - test-harness/index.html
    - tests/e2e/harness.spec.js
    - dist/sdk.js (gitignored, rebuilt only)

key-decisions:
  - "Added a window.__heedReady test hook (set after initDemo(overrides) resolves) and updated harness.spec.js's beforeEach to wait for it — required because the plan's async fetch-before-init bootstrap made initDemo() reachable only after a promise settles, instead of synchronously during page parse, which raced Playwright's page.click() and silently dropped the first signal event on every test"

patterns-established:
  - "Async harness bootstrap synchronization: any future inline-script change that defers init() behind a Promise must expose a __heedReady-style flag for Playwright to wait on"

requirements-completed: [WEIGHT-01]

coverage:
  - id: D1
    description: "test-harness/index.html bootstrap fetches receiver GET /weights before init and injects the parsed body via initDemo(overrides), falling back to cold-start on any fetch/parse failure"
    requirement: "WEIGHT-01"
    verification:
      - kind: other
        ref: "node -e structural grep: fetch(...4310/weights...), initDemo(overrides), .finally(, .catch( all present"
        status: pass
      - kind: e2e
        ref: "npx playwright test tests/e2e/harness.spec.js (6/6 passed, receiver NOT running)"
        status: pass
    human_judgment: false
  - id: D2
    description: "dist/sdk.js rebuilt from 05-03's src graph; bundle-purity check confirms no receiver/dev-tooling leakage"
    requirement: "WEIGHT-01"
    verification:
      - kind: other
        ref: "npm run build (esbuild + postbuild admin/check-bundle-purity.mjs) exit 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC2 runtime cold-start-pickup mechanism (harness half) — deferred deterministic verification to Plan 05-05's soak-test GET-readback comparison, per this plan's own sc2_verification_decision"
    verification: []
    human_judgment: true
    rationale: "Plan 05-04 explicitly defers SC2's deterministic gate to Plan 05-05 (soak-test before/after GET-readback comparison against the live receiver); no live-receiver Playwright case exists in this plan by design (file:// opaque-origin CORS makes it flaky/heavyweight per RESEARCH.md Open Question #2)."

duration: 15min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 04: Harness Weight-Fetch Bootstrap + Bundle Rebuild Summary

**test-harness/index.html now fetches persisted weights from the receiver before init via Promise .then/.catch/.finally chaining, injects them through initDemo(overrides), and falls back to cold-start on any failure; dist/sdk.js rebuilt from 05-03's src graph.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-20T00:46:00Z
- **Completed:** 2026-07-20T00:58:00Z
- **Tasks:** 2
- **Files modified:** 3 (test-harness/index.html, tests/e2e/harness.spec.js, dist/sdk.js rebuilt)

## Accomplishments
- Replaced the bare `window.Heed.initDemo();` bootstrap call with a self-invoking function that fetches `http://localhost:4310/weights` (matching `config/demo-platform.json`'s `weightPushUrl`), injects the parsed body into `overrides.weights` on success, and always calls `initDemo(overrides)` inside `.finally()` — a fetch/parse failure omits `overrides.weights` entirely, letting the SDK's existing cold-start fallback take over unchanged.
- Rebuilt `dist/sdk.js` via `npm run build`; the esbuild bundle and `postbuild` bundle-purity check (`admin/check-bundle-purity.mjs`) both passed, confirming the receiver is never bundled and the shipped artifact reflects 05-03's `endSession` return / `pushWeights` transport split / `initDemo(overrides)` wiring.
- Found and fixed a real timing bug the async bootstrap introduced (see Deviations): added a `window.__heedReady` test hook and updated `tests/e2e/harness.spec.js`'s `beforeEach` to wait for it, restoring the plan's own explicit requirement that the existing e2e suite stays green with no receiver process running.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harness bootstrap — fetch persisted weights then inject via initDemo(overrides)** - `74d0798` (feat)
2. **Task 2: Rebuild dist/sdk.js from 05-03's src changes** - no commit (dist/sdk.js is gitignored; build + purity check verified instead)

**Deviation fix commit:** `833e9e7` (fix) — `window.__heedReady` readiness hook + `harness.spec.js` beforeEach guard, required to satisfy this plan's own e2e-stays-green verification requirement.

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `test-harness/index.html` - inline bootstrap now fetches the receiver's persisted weights before init, injects via `initDemo(overrides)`, degrades to cold-start on any failure, and sets `window.__heedReady = true` after init completes (test-only hook)
- `tests/e2e/harness.spec.js` - `beforeEach` now waits on `window.__heedReady` before dispatching any signal-simulating DOM event
- `dist/sdk.js` (gitignored) - rebuilt from 05-03's `src/index.js` → `src/log.js` → `src/inference.js` import graph; contains `initDemo`, passes bundle-purity check

## Decisions Made
- Used `.then/.catch/.finally` promise chaining (not `async/await`) in the bootstrap, matching `test-harness/index.html`'s existing ES5 `var`-only inline-script convention, per 05-PATTERNS.md's explicit style note.
- Added `window.__heedReady` as a test-only readiness flag rather than changing the bootstrap's control flow (e.g., synchronous XHR) — keeps the async fetch-before-init pattern intact (matches RESEARCH.md/PATTERNS.md's prescribed shape) while giving Playwright a deterministic signal to wait on. This flag is never read by `dist/sdk.js` or any partner-facing code; it lives only in the standalone dev harness page.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Async fetch-before-init bootstrap raced Playwright's page.click(), silently dropping the first signal event on all 6 existing e2e tests**
- **Found during:** Task 1 verification (running the plan's own required check: "Existing Playwright e2e suite stays green with NO receiver running")
- **Issue:** The old bootstrap called `window.Heed.initDemo()` synchronously during inline-script parse, guaranteeing signal.js's DOM listeners were attached before Playwright's `page.goto()` even resolved. The new fetch-before-init bootstrap defers `initDemo(overrides)` to a `.finally()` callback that only runs after the `fetch()` promise settles — inherently asynchronous, taking anywhere from ~50ms to 2.4s+ to fail on this machine when no receiver is listening (`net::ERR_CONNECTION_REFUSED`, empirically measured via isolated Playwright instrumentation). Since `page.click()` in each test fires essentially immediately after `page.goto()`, the very first `touchstart`/`focus`/`scroll`/`popstate` dispatch could occur before signal.js's listeners attached, and once missed, no amount of retrying the `#log` assertion could recover it — all 6 tests (`touch_hesitation`, `blur_incomplete`, `scroll_reversal`, `back_intent`, and both response-overlay tests) failed on the first `npx playwright test` run after Task 1's edit.
- **Fix:** Added a `window.__heedReady = true;` line inside the bootstrap's `.finally()` (after the `initDemo(overrides)` call) as a test-only synchronization hook, and updated `tests/e2e/harness.spec.js`'s `beforeEach` to `await page.waitForFunction(() => window.__heedReady === true);` before any test proceeds to click/interact. This restores deterministic ordering (listeners always attached before test interaction) without altering the bootstrap's actual fetch/inject/fallback behavior.
- **Files modified:** `test-harness/index.html`, `tests/e2e/harness.spec.js`
- **Verification:** Re-ran `npm run build && npx playwright test` — all 6 tests pass (previously 6/6 failed). Also re-ran `npm test` (Vitest) — 83/83 unit tests still pass, confirming no regression to the happy-dom test suite.
- **Committed in:** `833e9e7`

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug, directly caused by this plan's own Task 1 change)
**Impact on plan:** Necessary to satisfy the plan's own explicit `<verification>` requirement ("Existing Playwright e2e suite stays green with NO receiver running"). No scope creep beyond the two files directly implicated by the race; `tests/e2e/harness.spec.js` was not in the plan's `files_modified` list but the fix is scoped strictly to a `beforeEach` synchronization guard, not new test coverage or behavioral changes to the tests themselves.

## Issues Encountered
- Windows loopback connection-refusal timing to a non-listening local port (`localhost:4310`) is highly variable (observed ~50ms to 2.4s+ across repeated runs) rather than the near-instant failure the plan's verification narrative assumed — this variability is what surfaced the async-init race described above. Documented here since it may resurface if a future change adds another fetch-before-ready pattern to this harness.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 05-05 (soak-test / SC2 GET-readback verification) can proceed: the harness bootstrap's fetch mechanism and `initDemo(overrides)` injection point are both live and verified working end-to-end (unit + e2e green), and `dist/sdk.js` reflects the full weight-push + injection code path.
- No blockers. The `window.__heedReady` hook is available if Plan 05-05's soak-test needs to drive the harness page directly via Playwright (it currently uses the receiver's GET endpoint directly per the plan's `sc2_verification_decision`, so this is incidental, not required).

---
*Phase: 05-weight-push-learning-loop*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: test-harness/index.html
- FOUND: dist/sdk.js
- FOUND: .planning/phases/05-weight-push-learning-loop/05-04-SUMMARY.md
- FOUND commit: 74d0798
- FOUND commit: 833e9e7
- FOUND commit: 1554c26
