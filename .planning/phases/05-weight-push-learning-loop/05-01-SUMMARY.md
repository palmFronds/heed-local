---
phase: 05-weight-push-learning-loop
plan: 01
subsystem: testing
tags: [vitest, node-http, tdd-red, weight-push]

requires:
  - phase: 03-inference-engine
    provides: forwardPass/endSession/initInference and the {W1,b1,W2,b2} weight shape this plan's fixtures mirror
  - phase: 01-config-layer-bus-harness
    provides: init()/initDemo() orchestrator and demo-platform.json config this plan extends test coverage against
provides:
  - RED unit suite (tests/local-receiver.test.js) pinning WEIGHT-01 SC1 (receiver persist) and SC4 (malformed POST / corrupt file) against a not-yet-built local-receiver/server.js
  - RED case pinning endSession()'s missing return value (05-RESEARCH.md Pitfall 1)
  - RED cases pinning initDemo(overrides)'s missing injection path and cold-start fallback guard (05-RESEARCH.md Pitfall 2)
affects: [05-02, 05-03, weight-push-learning-loop implementation waves]

tech-stack:
  added: []
  patterns:
    - "Per-file Vitest environment override (`// @vitest-environment node`) for suites needing real Node http/fs semantics instead of the project-default happy-dom"
    - "Ephemeral-port (`listen(0)` + `server.address().port`) test-local HTTP server pattern, no hard-coded host/port"

key-files:
  created:
    - tests/local-receiver.test.js
  modified:
    - tests/inference-endsession.test.js
    - tests/index.test.js

key-decisions:
  - "Receiver RED suite constructs the server via a not-yet-existing createReceiver({weightsPath}) factory taking an injectable path, so each test uses a fresh os.tmpdir() file and never touches the real local-receiver/weights.json"
  - "Corrupt-file test tolerates either a non-200 status or a last-known-good JSON body on GET (both satisfy SC4's 'does not crash, does not serve garbage' requirement), deferring the exact fallback shape to the implementation plan"

patterns-established:
  - "New test files for Phase 5 network-touching suites must mock or isolate real I/O: local-receiver.test.js uses a real ephemeral-port server (acceptable — it IS the receiver under test), while any future happy-dom suite touching fetch/sendBeacon must vi.stubGlobal per 05-RESEARCH.md Pitfall 4"

requirements-completed: []

coverage:
  - id: D1
    description: "RED suite tests/local-receiver.test.js exists, fails to resolve import of ../local-receiver/server.js, and encodes SC1 (POST persists) + SC4 (malformed POST, corrupt file) cases"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: "npx vitest run tests/local-receiver.test.js"
        status: fail
    human_judgment: false
  - id: D2
    description: "RED case in tests/inference-endsession.test.js asserting endSession() returns the updated {W1,b1,W2,b2} weights instead of undefined"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: 'npx vitest run tests/inference-endsession.test.js -t "returns"'
        status: fail
    human_judgment: false
  - id: D3
    description: "RED/green cases in tests/index.test.js: 'initDemo override' (RED, pins Pitfall 2 gap) and 'cold-start fallback' (already green, regression guard)"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: 'npx vitest run tests/index.test.js -t "initDemo override"'
        status: fail
      - kind: unit
        ref: 'npx vitest run tests/index.test.js -t "cold-start fallback"'
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 1: Wave-0 RED Test Scaffolding Summary

**RED unit suites pinning WEIGHT-01's four success criteria (receiver persist, malformed/corrupt handling, endSession() return value, initDemo(overrides) injection) before any implementation lands**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T20:48:00Z (approx, git commit timestamps)
- **Completed:** 2026-07-19T20:51:03Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 extended)

## Accomplishments
- New `tests/local-receiver.test.js` (Node-environment override, ephemeral-port server) with `POST persists`, `malformed POST`, and `corrupt file` cases — RED because `local-receiver/server.js` does not exist yet
- New `returns` case in `tests/inference-endsession.test.js` pinning the fact that `endSession()` currently discards the weights it computes (returns `undefined`) — RED until the additive `return activeWeights;` lands
- New `initDemo override` and `cold-start fallback` cases in `tests/index.test.js` pinning `initDemo(overrides)`'s missing injection path — `initDemo override` is RED (current `initDemo()` ignores its argument); `cold-start fallback` is already green (existing no-arg behavior already satisfies it) and now guards against regression

## Task Commits

Each task was committed atomically:

1. **Task 1: RED receiver unit suite (SC1 + SC4 receiver-side)** - `3841fe8` (test)
2. **Task 2: RED case — endSession() returns updated weights (Pitfall 1)** - `b8ae8dd` (test)
3. **Task 3: RED cases — initDemo(overrides) injection + cold-start fallback (Pitfall 2)** - `02cf2dc` (test — see Deviations below for why this hash/message differs from convention)

**Plan metadata:** (this commit)

_Note: All three tasks are pure test-authorship (RED); no production code was added or modified this plan._

## Files Created/Modified
- `tests/local-receiver.test.js` - New Node-environment RED suite for the local weight-push receiver (SC1 persist, SC4 malformed POST, SC4 corrupt on-disk file)
- `tests/inference-endsession.test.js` - Added one RED case asserting `endSession()` returns the updated weights object
- `tests/index.test.js` - Added `initDemo(overrides)` describe block with an injection case (RED) and a cold-start-fallback regression guard (green)

## Decisions Made
- The receiver RED suite assumes a `createReceiver({ weightsPath })` factory export (not a bare `server.listen()` side effect at import time), so tests can bind an injectable temp file path and an ephemeral port per test, matching the plan's `read_first` guidance and D-04/D-05's discretion.
- Corrupt-file GET assertion accepts either a non-200 response or a last-known-good JSON body, deliberately not over-specifying the exact fallback shape — that choice belongs to the implementation plan (05-RESEARCH.md D-06 leaves the precise mechanism open as long as garbage is never served).

## Deviations from Plan

### Auto-fixed Issues

None — all three tasks matched the plan's `<action>` and `<acceptance_criteria>` exactly; no Rule 1-4 fixes were needed.

### Process Anomaly (not a deviation from plan content)

**Concurrent commit swept Task 3's changes into an externally-authored commit.** While staging Task 3 (`tests/index.test.js`), a commit authored by the repository's human git user (`Dheeraj`, commit `02cf2dc`, message "got through phase 3") landed on the branch between my Task 2 commit and my attempt to commit Task 3. That commit's diff is byte-identical to the Task 3 changes this plan intended to make to `tests/index.test.js`, but it also swept in two files this executor was explicitly instructed not to touch (`.planning/STATE.md`, `.planning/config.json`) that were already modified in the working tree before this plan's execution began (visible in `git status --short` at session start).

- **What happened:** `git commit` for Task 3 returned "nothing to commit, working tree clean" because the external commit had already captured the exact same file content.
- **Why no destructive action was taken:** Per the git safety protocol, this executor never runs `reset`/rebase/history-rewriting commands, and especially never on a commit it did not author itself concurrently with another live git actor. Splitting or reverting `02cf2dc` risked destroying the human user's own concurrent work.
- **Verification performed:** Diffed `02cf2dc`'s `tests/index.test.js` hunk against the intended Task 3 content — confirmed identical. Re-ran the full Task 3 verification commands (`npx vitest run tests/index.test.js -t "initDemo override"`) against the resulting HEAD and confirmed the expected RED result.
- **Net effect on this plan's deliverables:** None — all three test files exist with the exact intended content, and the full-suite state matches this plan's `<verification>` section exactly (see below). The only irregularity is that Task 3's commit carries a non-conventional message and two unrelated `.planning/` file changes that were not authored by this execution.
- **Recommendation for the orchestrator:** Treat commit `02cf2dc` as covering Task 3's file changes. No further action needed on `tests/index.test.js` itself. The `.planning/STATE.md`/`.planning/config.json` changes bundled into that commit predate this plan's execution and were not made by this executor.

---

**Total deviations:** 0 plan-content deviations; 1 process anomaly (concurrent human commit), documented above, with no impact on deliverable correctness.

## Issues Encountered
None beyond the process anomaly documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Full-suite state after this plan matches the plan's `<verification>` section exactly:
- `npx vitest run tests/local-receiver.test.js` — RED (missing `../local-receiver/server.js` module)
- `npx vitest run tests/inference-endsession.test.js -t "returns"` — RED (endSession returns undefined)
- `npx vitest run tests/index.test.js -t "initDemo override"` — RED (initDemo ignores its argument)
- `npm test` (full suite) — 3 test files failed / 8 passed (11 total), 2 tests failed / 78 passed (80 total) — only the newly-added RED cases fail; every previously-green case (including the new `cold-start fallback` case) remains green.

Waves 1-2 (implementation plans 05-02/05-03) can now build `local-receiver/server.js`, the `endSession()` return statement, and the `initDemo(overrides)` parameter against these pre-authored failing assertions with no risk of an untested implementation landing.

No blockers for the next plan. The Open Question in 05-RESEARCH.md about STATE.md's stale Phase-3 credit-assignment research flag remains unresolved and out of this plan's scope (test-authorship only) — flagged for whichever plan closes out Phase 5's STATE.md bookkeeping.

---
*Phase: 05-weight-push-learning-loop*
*Completed: 2026-07-20*

## Self-Check: PASSED

- FOUND: tests/local-receiver.test.js
- FOUND: tests/inference-endsession.test.js
- FOUND: tests/index.test.js
- FOUND: .planning/phases/05-weight-push-learning-loop/05-01-SUMMARY.md
- FOUND commit: 3841fe8
- FOUND commit: b8ae8dd
- FOUND commit: 02cf2dc
- FOUND commit: 31c9d98
