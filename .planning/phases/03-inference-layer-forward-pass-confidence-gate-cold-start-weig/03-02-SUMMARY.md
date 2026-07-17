---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
plan: 02
subsystem: inference
tags: [testing, tdd-wave-0, forward-pass, confidence-gate, session-end-update]

# Dependency graph
requires:
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 01
    provides: "admin/weights.js cold-start weights and config/schema.json's inference.* fields exist, but this plan's suites deliberately avoid importing either -- independence preserved per the plan's own constraint"
provides:
  - "tests/inference.test.js — RED suite encoding INF-01, INF-02, INF-03, INF-05 as executable assertions against src/inference.js's future forwardPass/relu/softmax/initInference exports"
  - "tests/inference-endsession.test.js — RED suite encoding INF-04's exactly-once-per-session bounded weight-update contract against future endSession/forwardPass exports"
affects: [03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-authored in-file weight fixtures (never importing admin/weights.js) for a Wave-0 RED suite, keeping test authorship independent of a sibling Wave-0 plan's generated artifact"
    - "INF-02's explicit-arithmetic assertion uses reference values computed OFFLINE via a one-off `node -e` script (transcript captured in this Summary) against the exact fixture weights, rather than a parallel in-test reference implementation -- proves forwardPass matches genuinely hand-verified numbers, not a self-consistent duplicate formula"
    - "Module-scoped bus/inference state ordering discipline: the one 'exactly one inference:result per signal:detected' (D-01) assertion is placed as the very FIRST test to call initInference() in the file, making it robust to whether the future implementation guards re-subscription across repeat initInference() calls or not"

key-files:
  created: [tests/inference.test.js, tests/inference-endsession.test.js]
  modified: []

key-decisions:
  - "INF-02's expected hidden/logits/probs values were computed via a standalone `node -e` script run against the exact INF02_WEIGHTS fixture (see transcript below), then hardcoded as literals in the test -- chosen over an inline parallel reference implementation to avoid the risk of two independently-written-but-subtly-matching formulas both being wrong the same way"
  - "All INF-03/INF-05/INF-04 tests read the LAST entry of their local `received` array (not `toHaveLength(1)`) to stay correct regardless of whether the future initInference() implementation guards against duplicate signal:detected subscriptions across repeat calls in the same test file -- only the dedicated D-01 shape test (which runs first, before any other initInference() call in the file) asserts an exact count"
  - "endSession's INF-04 test suite is written as two ordered it() blocks sharing sequential module state (no-op-before-any-signal, then the full changes-then-changes-again-then-stable flow) rather than resetting modules per test -- matches ESM module-singleton-per-test-file reality in Vitest and mirrors 03-RESEARCH.md's own empirical before/after weight-diffing methodology"

requirements-completed: []

coverage:
  - id: D1
    description: "tests/inference.test.js contains describe('INF-01'/'INF-02'/'INF-03'/'INF-05' blocks encoding forward-pass shape, explicit arithmetic, confidence gate, and cold-start/injected weight selection as executable assertions"
    requirement: "INF-01, INF-02, INF-03, INF-05"
    verification:
      - kind: unit
        ref: "npx vitest run tests/inference.test.js -- fails to resolve (../src/inference.js does not exist), confirmed RED"
        status: pass
      - kind: other
        ref: "grep -n \"describe(\" tests/inference.test.js -- confirms all 4 required describe blocks present"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/inference-endsession.test.js contains describe('INF-04') encoding the safe-no-op, single-step, second-independent-step, and no-mutation-without-endSession assertions"
    requirement: "INF-04"
    verification:
      - kind: unit
        ref: "npx vitest run tests/inference-endsession.test.js -- fails to resolve (../src/inference.js does not exist), confirmed RED"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither suite imports admin/weights.js -- independence from plan 03-01 preserved"
    requirement: "INF-01, INF-02, INF-03, INF-04, INF-05"
    verification:
      - kind: unit
        ref: "grep -n \"admin/weights\" tests/inference.test.js tests/inference-endsession.test.js -- zero matches (exit 1)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 2: Inference Layer Wave-0 RED Test Suites Summary

**Two RED unit-test files (`tests/inference.test.js`, `tests/inference-endsession.test.js`) that encode INF-01 through INF-05 as concrete, requirement-ID-keyed executable assertions against `src/inference.js`'s not-yet-existent API, using only hand-authored in-file weight fixtures**

## Performance

- **Duration:** 20 min
- **Completed:** 2026-07-17
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments
- `tests/inference.test.js` authored with `describe('INF-01' | 'INF-02' | 'INF-03' | 'INF-05', ...)` blocks, importing the not-yet-existent `forwardPass`, `relu`, `softmax`, `initInference` from `../src/inference.js`
- INF-01: property-based assertions (`probs.length === 4`, sum ≈ 1 within 1e-9, every entry in `[0,1]`) across 6 input vectors (four canonical one-hots, an all-zero vector, and a blended vector) against a hand-authored `GENERIC_WEIGHTS` fixture
- INF-02: exact-value assertions for `hidden`/`logits`/`probs` against a ReLU-nonlinearity-exercising fixture (`INF02_WEIGHTS`, two hidden units deliberately negative pre-activation), with expected values computed offline via a standalone `node -e` script (transcript below) rather than an in-test parallel formula
- INF-03: two tests using `LOW_CONFIDENCE_WEIGHTS` (all-zero → uniform 0.25 distribution, `fires: false`) and `HIGH_CONFIDENCE_WEIGHTS` (identity hidden layer + large output weight on class 0 → ~0.9999 confidence, `fires: true`)
- INF-05: one test asserting injected `config.inference.weights` drive the published probs (cross-checked against `forwardPass`'s own output for the same weights/input), one test asserting the no-weights-config path still yields a valid summing-to-1 distribution without importing `admin/weights.js`
- Also encodes D-01's bus-contract shape (every `signal:detected` yields exactly one `inference:result` carrying `intent`/`confidence`/`probs`/`fires`) as the deliberately-first test in the file, making the "exactly one" count assertion robust to implementation choices about subscription idempotency
- `tests/inference-endsession.test.js` authored with `describe('INF-04', ...)`, importing the not-yet-existent `initInference`, `endSession`, `forwardPass` from `../src/inference.js`; covers: safe no-op before any signal fires (`lastInference` null path), one genuine bounded weight update per `endSession(config, false)` call, a second independent step on a second call, and no weight mutation from repeated `signal:detected` publishes alone

## Task Commits

Each task was committed atomically:

1. **Task 1: Author tests/inference.test.js (RED) — INF-01, INF-02, INF-03, INF-05** - `e0f7057` (test)
2. **Task 2: Author tests/inference-endsession.test.js (RED) — INF-04** - `3909d39` (test)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `tests/inference.test.js` - New RED suite; `describe('INF-01'|'INF-02'|'INF-03'|'INF-05', ...)`, hand-authored fixture weights (`GENERIC_WEIGHTS`, `INF02_WEIGHTS`, `LOW_CONFIDENCE_WEIGHTS`, `HIGH_CONFIDENCE_WEIGHTS`), no `admin/weights.js` import
- `tests/inference-endsession.test.js` - New RED suite; `describe('INF-04', ...)`, hand-authored `WEIGHTS` fixture, no `admin/weights.js` import

## Offline Verification Transcript (INF-02 reference values)

Run via `node -e` against the exact `INF02_WEIGHTS` fixture and `input = [1,0,0,0]`, independently of `src/inference.js` (which does not exist yet):

```
{
  "probs": [0.8097759915236521, 0.04031637265264288, 0.10959126317106235, 0.04031637265264288],
  "hidden": [1.5, 0, 0.5, 0],
  "logits": [3, 0, 1, 0]
}
LOW (all-zero weights):  {"probs":[0.25,0.25,0.25,0.25],"hidden":[0,0,0,0],"logits":[0,0,0,0]}
HIGH (identity + large output weight): {"probs":[0.9998638187585689,0.00004539374714368891,0.00004539374714368891,0.00004539374714368891],"hidden":[1,0,0,0],"logits":[10,0,0,0]}
```

These values are hardcoded as literals in `tests/inference.test.js` (`toBeCloseTo(..., 9)` precision) and independently confirm: (a) the LOW/HIGH fixtures produce max-probability values on the expected sides of the 0.65 threshold (0.25 and 0.9999 respectively), and (b) the ReLU nonlinearity in `INF02_WEIGHTS` genuinely zeroes two hidden units (`hidden[1]` and `hidden[3]`).

## Decisions Made
- Computed INF-02's expected `hidden`/`logits`/`probs` values via a standalone `node -e` script rather than an inline parallel reference implementation inside the test file — avoids the risk of a duplicated formula in the test silently sharing the same bug as a future buggy `forwardPass` implementation; the hardcoded literals are a genuinely independent, offline-verified source of truth
- All tests that call `initInference()` more than once across the file (INF-03, INF-05, INF-04) read `received[received.length - 1]` rather than asserting an exact `received.length`, since the plan's own `03-PATTERNS.md` reference implementation doesn't specify whether `initInference` guards re-subscription across repeat calls within one module lifetime — only the dedicated D-01 "exactly one" test (placed first in `tests/inference.test.js`, before any other `initInference()` call in the file) makes a strict count assertion, where it is unconditionally true regardless of that implementation choice
- `tests/inference-endsession.test.js`'s INF-04 suite is two sequential, state-sharing `it()` blocks (not `vi.resetModules()`-isolated) — matches Vitest's real per-test-file ESM module singleton behavior and mirrors `03-RESEARCH.md`'s own empirical before/after weight-diffing verification methodology directly

## Deviations from Plan

None — plan executed exactly as written. Both files were authored per the plan's task instructions, verified RED via the plan's own `<verify>` commands, and confirmed independent of `admin/weights.js` via the plan's own grep-based acceptance criterion (an initial draft had explanatory comments containing the literal substring `admin/weights.js`, which was reworded to `the generated cold-start weights module` before committing, to satisfy the acceptance criterion's literal grep check — not a deviation from the plan's intent, just a wording correction caught during self-verification).

## Issues Encountered

None.

## Next Phase Readiness
- `tests/inference.test.js` and `tests/inference-endsession.test.js` are both RED and ready for Plan 03-03 (forward pass + confidence gate implementation) and Plan 03-04 (session-end weight update implementation) to flip GREEN by creating `src/inference.js` with the exact exports these suites already import (`forwardPass`, `relu`, `softmax`, `initInference`, `endSession`).
- The full existing suite (`npx vitest run`) remains green apart from these two new RED files: 29 pre-existing tests pass unchanged.
- INF-01 through INF-05 are intentionally left unmarked in `requirements-completed` — this Wave-0 plan only authors RED tests encoding them; they flip GREEN and get marked complete in Plans 03-03/03-04 (mirrors Phase 1/2 precedent).

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: tests/inference.test.js
- FOUND: tests/inference-endsession.test.js
- FOUND: e0f7057 (test(03-02): author RED suite for INF-01, INF-02, INF-03, INF-05)
- FOUND: 3909d39 (test(03-02): author RED suite for INF-04 session-end weight update)
