---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
plan: 04
subsystem: inference
tags: [neural-network, backprop, gradient-descent, session-end-update, event-bus]

# Dependency graph
requires:
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 03
    provides: "src/inference.js's forwardPass ({probs,hidden,logits} return shape), CLASSES constant, activeWeights/lastInference module state this plan reads and mutates"
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 02
    provides: "tests/inference-endsession.test.js's RED suite -- the exact contract endSession must satisfy"
provides:
  - "src/inference.js exporting buildTarget, gradientStep, endSession -- the hand-written single-step session-end learning update"
  - "endSession(config, outcome): directly-callable, unit-testable session-end trigger (D-03) performing exactly one bounded gradient step per call"
affects: [03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "gradientStep is a second, independent hand-written numeric function (alongside forwardPass) with zero brain.js import -- mathematically equivalent to brain.js's trainPattern() but keeps brain.js confined to admin/generate-weights.mjs"
    - "gradientStep builds and returns a NEW {W1,b1,W2,b2} object rather than mutating its weights parameter in place -- endSession reassigns activeWeights = gradientStep(...) rather than relying on mutation"

key-files:
  created: []
  modified: [src/inference.js]

key-decisions:
  - "buildTarget implements 03-RESEARCH.md's Assumption A1 interpretation verbatim: one-hot reinforcement of the predicted class on outcome===false (abandoned), uniform [0.25,0.25,0.25,0.25] softening on outcome===true (completed) -- documented as this phase's interpretation, not literal spec text"
  - "endSession's learning rate is hard-coded to the literal 0.01 (INF-04's explicit requirement) -- the config parameter is reserved for a future config-driven override and is intentionally unused this phase"
  - "endSession does not reset lastInference after running, so a second call against the now-updated activeWeights produces a second, independent, non-zero delta (not a no-op) -- matches 03-RESEARCH.md's empirically-verified train() single-step semantics"

patterns-established:
  - "Two hand-written numeric functions now live in src/inference.js's import graph with zero brain.js import: forwardPass (plan 03-03) and gradientStep (this plan) -- keeps brain.js confined to admin/generate-weights.mjs per PROJECT.md's training/weight-export-only decision"

requirements-completed: [INF-04]

coverage:
  - id: D1
    description: "gradientStep performs one hand-written softmax+cross-entropy backprop step (genuine ReLU derivative at the hidden layer) with zero brain.js import, without mutating its weights parameter in place"
    requirement: "INF-04"
    verification:
      - kind: unit
        ref: "inline node -e verify script from 03-04-PLAN.md Task 1 -- gradientStep changes forwardPass's probs and leaves the original weights fixture's W1[0][0] unmutated"
        status: pass
      - kind: other
        ref: "grep -Ec \"from ['\\\"]brain\\.js['\\\"]\" src/inference.js -- returns 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildTarget(predictedIdx, false) returns a one-hot vector at predictedIdx; buildTarget(predictedIdx, true) returns [0.25,0.25,0.25,0.25]"
    requirement: "INF-04"
    verification:
      - kind: unit
        ref: "node -e probe from Task 1 verification -- buildTarget(2,false) -> [0,0,1,0], buildTarget(2,true) -> [0.25,0.25,0.25,0.25]"
        status: pass
    human_judgment: false
  - id: D3
    description: "endSession(config, outcome) mutates activeWeights exactly once per call, is a safe no-op before any signal has fired, and two consecutive calls produce two distinct non-zero weight deltas; signal:detected events alone never mutate weights"
    requirement: "INF-04"
    verification:
      - kind: unit
        ref: "tests/inference-endsession.test.js -- describe('INF-04') (2 tests, authored RED in plan 03-02)"
        status: pass
    human_judgment: false

duration: 2min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 4: Inference Layer Session-End Weight Update Summary

**Hand-written single-step gradient descent (`gradientStep`, `buildTarget`) and the directly-callable `endSession(config, outcome)` trigger in `src/inference.js`, closing INF-04 with zero brain.js runtime dependency**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-17T03:08:08Z
- **Completed:** 2026-07-17T03:10:13Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- `buildTarget(predictedIdx, outcome)` builds a 4-class training target from the session outcome: one-hot reinforcement of the predicted class on abandonment (`outcome === false`), uniform `[0.25, 0.25, 0.25, 0.25]` softening on completion (`outcome === true`) -- 03-RESEARCH.md Assumption A1's documented interpretation
- `gradientStep(input, target, weights, learningRate)` performs one hand-written softmax+cross-entropy backprop step (`deltaOutput[j] = probs[j] - target[j]`, genuine non-leaky ReLU derivative at the hidden layer) -- mathematically equivalent to brain.js's own single `trainPattern()` step but with zero brain.js import anywhere in `src/inference.js`; returns a new `{W1,b1,W2,b2}` object without mutating its `weights` parameter
- `endSession(config, outcome)` is the directly-callable, unit-testable session-end trigger (D-03): safe no-op when `lastInference` is `null`, otherwise reassigns `activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01)` -- learning rate hard-coded to `0.01` per INF-04
- `endSession` is never called from inside `initInference`'s `subscribe('signal:detected', ...)` handler -- confirmed via source grep, the only occurrence of `endSession(` in the file is its own declaration
- `endSession` does not reset `lastInference`, so a second call against the now-updated `activeWeights` produces a second, independent, non-zero delta
- `tests/inference-endsession.test.js` (authored RED in plan 03-02) is fully green: 2/2 tests pass; full suite (`npx vitest run`) stays green at 40/40

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement gradientStep and buildTarget (hand-written single backprop step)** - `ec18a13` (feat)
2. **Task 2: Implement endSession — the directly-callable session-end trigger (D-03, INF-04)** - `eb303f5` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: This plan's TDD tasks complete the GREEN step of a RED/GREEN cycle whose RED half (test commit `3909d39`) was authored in plan 03-02 — no additional test commits were needed here since `tests/inference-endsession.test.js` already existed and needed no modification, mirroring plan 03-03's precedent for the sibling suite._

## Files Created/Modified
- `src/inference.js` - Modified. Adds `buildTarget`, `gradientStep`, `endSession` exports; `reluDerivative` internal helper. No new imports.

## Decisions Made
- `buildTarget` implements 03-RESEARCH.md's Assumption A1 interpretation verbatim (reinforce-on-abandon, soften-on-complete) rather than deviating from the research's recommended default — flagged in-source as this phase's documented interpretation, not literal spec text, mirroring the already-accepted "most-proximal signal" credit-assignment gap STATE.md flags for Phase 5
- `endSession`'s `config` parameter is intentionally unused this phase (reserved for a future config-driven learning-rate override) — the plan's explicit instruction not to read a learning rate from `config` yet was followed literally

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Full-suite run (`npx vitest run`) confirms 40/40 tests pass across all 8 test files, including both previously-red `tests/inference-endsession.test.js` tests now green.

## TDD Gate Compliance

RED gate: `3909d39` (test(03-02): author RED suite for INF-04 session-end weight update) — authored in the prior plan (03-02), scoped to this exact test file.
GREEN gate: `ec18a13`, `eb303f5` (this plan) — `tests/inference-endsession.test.js` flips fully green (2/2).
No REFACTOR commit needed — no cleanup required after GREEN.

## Next Phase Readiness
- `src/inference.js` now exports the complete inference-layer public API this phase set out to build: `relu`, `softmax`, `forwardPass`, `initInference`, `buildTarget`, `gradientStep`, `endSession` — all with zero brain.js import.
- Plan 03-05's `dist/sdk.js` build-purity check (grep for brain.js internals in the built bundle) has a clean starting point: `grep -Ec "from ['\"]brain\.js['\"]" src/inference.js` returns 0.
- `endSession` is not yet wired to a real `flow_complete`/`flow_abandoned` trigger — that wiring is explicitly out of this phase's scope per D-03 and belongs to Phase 4.
- Full requirement set for this phase (INF-01 through INF-05) is now implemented in `src/inference.js`; plan 03-05 owns the phase-gate verification (dist/sdk.js build purity + canonical-input softmax margin inspection) before `/gsd-verify-work`.

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: 2026-07-17*
