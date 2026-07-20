---
phase: 05-weight-push-learning-loop
plan: 05
subsystem: infra
tags: [soak-test, dev-tooling, softmax-margin-gate, sc2-verification, sc3-verification]

# Dependency graph
requires:
  - phase: 05-weight-push-learning-loop (05-02)
    provides: local-receiver/server.js GET/POST /weights endpoints at http://localhost:4310/weights, isValidWeights export
  - phase: 05-weight-push-learning-loop (05-03)
    provides: src/inference.js endSession() returning updated {W1,b1,W2,b2} weights
provides:
  - admin/soak-test-weights.mjs -- standalone Node script (npm run soak-test) that drives N synthetic sessions through the real learning loop and gates SC3 + SC2 with process.exit(0/1)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Node global fetch (awaited, not fire-and-forget) driving a real local receiver process from a standalone dev script -- no mocking, no npm dependency"
    - "printVector() generalized to accept an explicit weights argument so one helper serves both cold-start (before) and persisted (after) comparisons"
    - "Dev-tooling script reuse across admin/ and local-receiver/ (importing local-receiver/server.js's isValidWeights rather than re-implementing shape validation) -- safe because .listen() is guarded behind an isMain check"

key-files:
  created:
    - admin/soak-test-weights.mjs
  modified: []

key-decisions:
  - "SESSION_COUNT fixed at 16 (within D-08's 10-20 range), varying signal type round-robin across the 4 SIGNAL_ORDER types and outcome alternating true/false session-to-session, to exercise both buildTarget branches (reinforce on abandon, soften-to-uniform on completion) across all 4 canonical signals during the soak"
  - "SC2 verified via GET-readback comparison against the receiver's real GET /weights endpoint (05-RESEARCH.md Open Question #2's recommended resolution, already locked in by 05-04's sc2_verification_decision) rather than a live-receiver Playwright e2e -- deterministic, no browser, no file:// opaque-origin CORS flakiness"
  - "SC2's round-trip-lossless check reuses the SAME afterResults computed for the SC3 gate (forwardPass against currentWeights) rather than recomputing margins from scratch -- one canonical 'after' value per signal, compared against both the in-memory weights and the GET-readback persisted weights"

patterns-established:
  - "A dev script may import a sibling dev-tooling module's exported pure function (isValidWeights) across admin/ and local-receiver/ without re-implementing it, as long as importing the module carries no side effect (the receiver's .listen() call stays behind its isMain guard)"

requirements-completed: [WEIGHT-01]

coverage:
  - id: D1
    description: "admin/soak-test-weights.mjs runs 16 synthetic sessions through endSession(), POSTing each session's updated weights through the real local receiver, and prints before/after softmax margins for the 4 canonical signals"
    requirement: "WEIGHT-01"
    verification:
      - kind: other
        ref: "node local-receiver/server.js (background) && node admin/soak-test-weights.mjs -- exit 0, PASS printed"
        status: pass
      - kind: other
        ref: "grep -nE \"require\\(|from ['\\\"](express|node-fetch|axios)\" admin/soak-test-weights.mjs -- no match (D-04 zero new deps)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SC3 gate: after the soak, no canonical signal's softmax collapses toward uniform (margin < 0.02) or saturates (topProb >= 0.98)"
    requirement: "WEIGHT-01"
    verification:
      - kind: other
        ref: "node admin/soak-test-weights.mjs -- all 4 canonical signals GATE PASS, margins 0.22-0.34 post-soak (up from 0.25-0.29 cold-start), no saturation"
        status: pass
    human_judgment: false
  - id: D3
    description: "SC2 gate: GET-readback through the receiver's real endpoint proves persisted weights differ from cold-start and losslessly reproduce the in-memory post-soak margins (deterministic restart-loads-learned-weights verification)"
    requirement: "WEIGHT-01"
    verification:
      - kind: other
        ref: "node admin/soak-test-weights.mjs -- GATE PASS: persisted weights differ from cold-start defaults; GATE PASS: forwardPass against persisted weights losslessly reproduces the in-memory after margins"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 05: Soak-Test Weight-Push Learning Loop Summary

**admin/soak-test-weights.mjs drives 16 synthetic sessions through the real endSession()/receiver POST/GET round-trip, printing before/after canonical-signal softmax margins and gating both SC3 (no collapse/saturation across many updates) and SC2 (GET-readback proves persisted weights are learned and losslessly round-tripped) with process.exit(0/1).**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-20T01:00:00Z
- **Completed:** 2026-07-20T01:20:00Z
- **Tasks:** 2
- **Files modified:** 1 (admin/soak-test-weights.mjs, new)

## Accomplishments
- Created `admin/soak-test-weights.mjs`, structurally mirroring `admin/print-softmax-margins.mjs`'s header framing, `argmax()`/`margin()` helpers, and `process.exit(0/1)` gate discipline, generalized so `printVector()` accepts an explicit `weights` argument for before/after comparisons.
- The script runs 16 synthetic sessions (round-robin across all 4 `SIGNAL_ORDER` types, alternating `flowComplete`/abandoned outcomes) directly against `initInference`/`endSession`, seeding each session's prediction by publishing a real `signal:detected` event on the bus (mirroring `tests/inference-endsession.test.js`'s seeding pattern) — no mocked forward pass, no stubbed gradient step.
- Each session's `endSession()`-updated weights are `await`ed through a real `POST http://localhost:4310/weights` to the actual `local-receiver/server.js` process (started separately via `npm run receiver`), and the result feeds forward as the next session's starting weights — exercising the exact `endSession() -> POST -> receiver atomic write` path the browser SDK uses at runtime.
- SC3 gate: after the soak, all 4 canonical signals' post-soak margins (0.22-0.34) remained well above the 0.02 collapse threshold and top probabilities (0.42-0.53) stayed far below the 0.98 saturation threshold — confirmed via a live `node local-receiver/server.js` + `node admin/soak-test-weights.mjs` run, exit 0.
- SC2 gate: extended the script's AFTER phase to `GET http://localhost:4310/weights` (the same endpoint 05-04's harness bootstrap fetches at cold start), reusing `local-receiver/server.js`'s exported `isValidWeights()` for shape validation (not re-implemented), asserting the persisted weights differ from `admin/weights.js`'s cold-start defaults, and asserting `forwardPass()` against the persisted weights reproduces the in-memory post-soak margins within a `1e-9` tolerance — proving the persistence round-trip is lossless. Verified live: both SC2 sub-gates passed.
- `npm test` (Vitest, 83/83) confirmed no regression — this plan touches no `src/` files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Soak-test core — synthetic sessions, POST through real receiver, before/after SC3 margin gate** - `76c16e7` (feat)
2. **Task 2: SC2 GET-readback assertion — persisted weights are what a restart loads** - `66cdbe8` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `admin/soak-test-weights.mjs` (new) - dev-only Node script (`npm run soak-test`, already wired in 05-02's `package.json`). Imports `forwardPass`/`initInference`/`endSession` from `../src/inference.js`, `publish` from `../src/bus.js`, cold-start weights from `./weights.js`, and `isValidWeights` from `../local-receiver/server.js`. Runs 16 synthetic sessions through the real receiver, prints before/after canonical-signal softmax margins, and gates SC3 + SC2 with `process.exit(0/1)`. Zero new npm dependencies (Node global `fetch` only).

## Decisions Made
- Fixed `SESSION_COUNT = 16` (mid-range of D-08's 10-20 window) rather than a random count, so soak-test runs are reproducible in structure (though not in exact weight values, since floating-point accumulation across 16 real gradient steps is deterministic given the same starting weights and signal/outcome sequence).
- Reused `local-receiver/server.js`'s exported `isValidWeights()` for the SC2 shape check instead of duplicating the matrix/vector validator a third time (it already exists in both `src/inference.js`'s hard-fail `validateWeightsShape()` and the receiver's boolean-returning `isValidWeights()`) — importing the receiver module is safe because its `.listen()` call is guarded behind an `isMain` check that only evaluates true when the file is run directly.
- SC2's "matches after margins" check compares against the SAME `afterResults` array computed for the SC3 gate (not a fresh recomputation), keeping the "in-memory last update" and "GET-readback persisted" comparison anchored to one canonical set of post-soak values per canonical signal.

## Deviations from Plan

None — plan executed exactly as written. Both tasks matched their `<action>`/`<acceptance_criteria>` blocks; no bugs, missing functionality, blocking issues, or architectural changes were encountered.

## Issues Encountered

None.

## User Setup Required

None — `npm run receiver` (background) + `node admin/soak-test-weights.mjs` (or `npm run soak-test`) is the full manual verification sequence, already documented in the plan and 05-RESEARCH.md.

## Next Phase Readiness

- This was the last plan in Phase 5 (weight-push-learning-loop). All 4 success criteria (SC1-SC4) now have concrete, verified evidence:
  - SC1 (session-end POST persisted): 05-02/05-03.
  - SC2 (restart loads learned weights): this plan's GET-readback gate, deterministically verified.
  - SC3 (soak stability, no collapse/saturation): this plan's before/after margin gate, deterministically verified.
  - SC4 (malformed weight file handling): 05-02's receiver-side + 05-04's harness-side validation.
- Phase 6 (Integration Verification) remains externally blocked on Branch 1 (heed-demo-platform) reaching its own gate-pass, per STATE.md's existing blocker note — unrelated to this plan's completion.
- STATE.md's Phase 5 research-flag note (multi-signal session credit assignment) was already resolved as a stale Phase 3 carry-over per 05-RESEARCH.md Open Question #1 — no action needed from this plan.

---
*Phase: 05-weight-push-learning-loop*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: admin/soak-test-weights.mjs
- FOUND: .planning/phases/05-weight-push-learning-loop/05-05-SUMMARY.md
- FOUND commit: 76c16e7
- FOUND commit: 66cdbe8
