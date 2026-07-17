---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
plan: 03
subsystem: inference
tags: [neural-network, forward-pass, softmax, confidence-gate, cold-start, event-bus]

# Dependency graph
requires:
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 01
    provides: "admin/weights.js's committed {W1,b1,W2,b2} cold-start weights, imported directly as initInference's default weight source"
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 02
    provides: "tests/inference.test.js's RED suite -- the exact forwardPass/relu/softmax/initInference contract this plan satisfies"
provides:
  - "src/inference.js exporting relu, softmax, forwardPass, initInference -- the hand-written W1/b1->ReLU->W2/b2->softmax forward pass and confidence-gated inference:result bus wiring"
  - "Module-scoped activeWeights/lastInference state that plan 03-04's endSession/gradientStep will read and mutate"
affects: [03-04, 03-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-written forward pass returns {probs, hidden, logits} (not just probs) so a later plan's backprop step has the intermediate values it needs without recomputing them"
    - "initInference re-resolves activeWeights on EVERY call (config-injected wins over cold-start default) but guards the signal:detected subscription with a one-time initialized flag -- mirrors signal.js's attachListeners per-call state reset + initSignalCapture's one-time observer/popstate registration split"
    - "publish('inference:result', ...) is called unconditionally per signal:detected -- fires is a payload flag, never a gate on the publish call itself (D-01)"

key-files:
  created: [src/inference.js]
  modified: []

key-decisions:
  - "inference:result payload extended with additive pass-through positioning fields (bbox/targetSelector/scrollDepth/pathname, ?? null) per 03-RESEARCH.md's Open Question #2 recommendation -- spares Phase 4's response layer a signal-to-inference correlation problem; does not alter D-01's locked always-publish semantics"

patterns-established:
  - "Two hand-written numeric functions live in src/inference.js's import graph with zero brain.js import: forwardPass (this plan) and gradientStep (plan 03-04) -- keeps brain.js confined to admin/generate-weights.mjs per PROJECT.md's training/weight-export-only decision"

requirements-completed: [INF-01, INF-02, INF-03, INF-05]

coverage:
  - id: D1
    description: "forwardPass(input, weights) implements the explicit W1/b1->ReLU->W2/b2->softmax arithmetic, returning a length-4 probs vector summing to ~1 for any valid input, with max-subtraction in softmax for numerical stability"
    requirement: "INF-01, INF-02"
    verification:
      - kind: unit
        ref: "tests/inference.test.js -- describe('INF-01')/describe('INF-02') (5 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "initInference wires signal:detected -> forward pass -> confidence gate -> inference:result, publishing unconditionally (D-01) with fires gated at the 0.65 threshold (config-overridable)"
    requirement: "INF-03"
    verification:
      - kind: unit
        ref: "tests/inference.test.js -- describe('INF-03') (2 tests) and the D-01 shape test in describe('INF-01')"
        status: pass
    human_judgment: false
  - id: D3
    description: "initInference prefers config.inference.weights when present, falling back to admin/weights.js's bundled cold-start default when absent"
    requirement: "INF-05"
    verification:
      - kind: unit
        ref: "tests/inference.test.js -- describe('INF-05') (2 tests)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 3: Inference Layer Forward Pass & Confidence Gate Summary

**Hand-written W1/b1→ReLU→W2/b2→softmax forward pass in `src/inference.js`, wired to `signal:detected`/`inference:result` with a config-overridable 0.65 confidence gate and cold-start-vs-injected weight selection — zero brain.js import**

## Performance

- **Duration:** 6 min
- **Completed:** 2026-07-17T03:04:06Z
- **Tasks:** 2
- **Files modified:** 1 (new)

## Accomplishments
- `relu`, `softmax` (max-subtraction stabilized), and `forwardPass` implement the entire runtime inference math explicitly — no brain.js call anywhere in `src/inference.js`, following brain.js's own verified `weights[node][k]` orientation so `admin/weights.js`'s exported arrays plug in with no transpose
- `forwardPass` returns `{ probs, hidden, logits }` (not just `probs`) so plan 03-04's backprop step has the intermediate values it needs
- `initInference(config)` wires `signal:detected` → one-hot encode → `forwardPass` → confidence gate → `inference:result`, publishing unconditionally on every signal regardless of confidence (D-01) — `fires` is a payload flag, never a gate on the publish call
- `activeWeights` is re-resolved every `initInference` call (`config.inference?.weights ?? coldStartWeights`, INF-05), while the `signal:detected` subscription is registered at most once via an `initialized` guard, mirroring `signal.js`'s existing per-call-reset-vs-one-time-registration split
- `SIGNAL_ORDER` cross-checked byte-identical to `admin/generate-weights.mjs`'s `canonicalData` input order (`touch_hesitation, blur_incomplete, scroll_reversal, back_intent`)
- `inference:result` payload includes additive pass-through positioning fields (`bbox`, `targetSelector`, `scrollDepth`, `pathname`) from the originating signal, sparing Phase 4 a correlation problem
- `tests/inference.test.js` (authored RED in plan 03-02) is fully green: 9/9 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement the explicit forward pass — relu, softmax, forwardPass** - `78263ea` (feat)
2. **Task 2: Implement initInference — cold-start loading, confidence gate, bus wiring** - `b36ac7a` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: This plan's TDD tasks complete the GREEN step of a RED/GREEN cycle whose RED half (test commits `e0f7057`) was authored in plan 03-02 — no additional test commits were needed here since the target test files already existed and needed no modification._

## Files Created/Modified
- `src/inference.js` - New file. Exports `relu`, `softmax`, `forwardPass`, `initInference`. Module-scoped `CLASSES`/`SIGNAL_ORDER` constants, `activeWeights`/`lastInference`/`initialized` state.

## Decisions Made
- Included `bbox`/`targetSelector`/`scrollDepth`/`pathname` as additive pass-through fields on `inference:result` (03-RESEARCH.md Open Question #2's recommended resolution) — additive only, does not alter D-01's locked payload shape or gating semantics.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed the plan's `<action>` instructions verbatim (weight orientation, softmax max-subtraction, `initInference`'s per-call weight re-resolution vs. one-time subscription guard, unconditional publish).

## Issues Encountered

None. `tests/inference-endsession.test.js` (INF-04, `endSession`) remains RED after this plan's commits — that is plan 03-04's scope, explicitly out of this plan's `files_modified` list, and was RED before this plan started (authored in 03-02, unaffected by this plan's changes). Full-suite run (`npx vitest run`) confirms: 38/40 non-inference.test.js tests pass, `tests/inference.test.js` is 9/9 green, and only `tests/inference-endsession.test.js`'s 2 pre-existing RED tests remain red, unchanged by this plan.

## TDD Gate Compliance

RED gate: `e0f7057` (test(03-02): author RED suite for INF-01, INF-02, INF-03, INF-05) — authored in the prior plan (03-02), scoped to this exact test file.
GREEN gate: `78263ea`, `b36ac7a` (this plan) — `tests/inference.test.js` flips fully green (9/9).
No REFACTOR commit needed — no cleanup required after GREEN.

## Next Phase Readiness
- `src/inference.js`'s `forwardPass`, `activeWeights`, and `lastInference` are ready for plan 03-04 to add `gradientStep`/`endSession` (INF-04) — `lastInference = { input, predictedIdx }` is already populated on every `signal:detected` handling, exactly the shape 03-RESEARCH.md's Pattern 4 expects `endSession` to read.
- `src/inference.js` still has zero brain.js import — plan 03-05's `dist/sdk.js` build-purity check (grep for brain.js internals) has a clean starting point from this plan's work.
- `initInference` is not yet wired into `src/index.js`'s `init()` orchestrator — that wiring (if in scope) belongs to a later plan in this phase; this plan's scope was strictly `src/inference.js` per its `files_modified` frontmatter.

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/inference.js
- FOUND: 78263ea (feat(03-03): implement explicit forward pass (relu, softmax, forwardPass))
- FOUND: b36ac7a (feat(03-03): implement initInference cold-start loading, confidence gate, bus wiring)
