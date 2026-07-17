---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
plan: 05
subsystem: inference
tags: [inference, esbuild, bundle-purity, softmax, cold-start, brain.js]

# Dependency graph
requires:
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 01
    provides: "admin/weights.js's committed {W1,b1,W2,b2} cold-start weights"
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 03
    provides: "src/inference.js's forwardPass/initInference"
  - phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
    plan: 04
    provides: "src/inference.js's endSession/gradientStep -- completed the file's full public API"
provides:
  - "src/index.js's init() wired end-to-end: validateConfig -> initSignalCapture -> initInference"
  - "admin/check-bundle-purity.mjs -- automated dist/sdk.js brain.js-leak gate"
  - "admin/print-softmax-margins.mjs -- automated Success Criterion 2 numeric margin gate"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-only .mjs verification scripts (check-bundle-purity, print-softmax-margins) live in admin/, never imported by src/, exit nonzero on gate failure -- same pattern as admin/generate-weights.mjs"
    - "CLASSES/SIGNAL_ORDER are module-scoped (not exported) constants in src/inference.js -- consumer scripts outside src/ re-declare the same literal values locally rather than widening inference.js's export surface"

key-files:
  created: [admin/check-bundle-purity.mjs, admin/print-softmax-margins.mjs]
  modified: [src/index.js]

key-decisions:
  - "admin/print-softmax-margins.mjs re-declares CLASSES/SIGNAL_ORDER locally instead of importing them from src/inference.js, because neither is exported there and widening inference.js's export surface was outside this task's declared file scope (admin/print-softmax-margins.mjs only)"

patterns-established: []

requirements-completed: [INF-01, INF-02, INF-03, INF-05]

coverage: []

# Metrics
duration: 6min (Tasks 1-3, including checkpoint resolution)
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 5: Inference Integration & Bundle Purity Summary

**init() now wires initInference end-to-end; dist/sdk.js confirmed brain.js-free (13.3kb, 13628 bytes); Success Criterion 2's 4 canonical softmax margins (0.25-0.29) and one 70/30 ambiguous input (0.11, genuinely uncertain) all pass an automated numeric gate; human-verify checkpoint (Task 3) approved — Phase 3 closed**

## Performance

- **Duration:** ~6 min (Tasks 1-3)
- **Started:** 2026-07-16T23:14:03-04:00 (first commit after prior plan)
- **Tasks:** 3 of 3 complete
- **Files modified:** 4 (2 modified — src/index.js, admin/weights.js regenerated during checkpoint verification; 2 new)

## Accomplishments
- `src/index.js`'s `init()` now calls `initInference(config)` immediately after `initSignalCapture(config)`, preserving hard-fail-first ordering (`validateConfig` throws first); return shape unchanged (`{ config, publish, subscribe }`)
- `admin/check-bundle-purity.mjs` built and passing: `npm run build` produces a 13.3kb `dist/sdk.js`, and the purity check confirms zero occurrences of `NeuralNetworkGPU`/`thaw` — brain.js is confirmed confined to `admin/generate-weights.mjs`, never reaching the shipped bundle
- `admin/print-softmax-margins.mjs` built and passing: all 4 canonical cold-start mappings classify to their correct domain-knowledge class with real margins, and the deliberately ambiguous 70/30 blended input (`[0.7, 0.3, 0, 0]`, per 03-RESEARCH.md Assumption A2) shows a distinct, non-collapsed margin — genuine uncertainty, not identical to any single canonical output
- Full test suite (`npx vitest run`) stays green at 40/40 across all task commits
- Human-verify checkpoint (Task 3) approved: operator re-ran `npm run generate-weights` (producing a fresh, non-reproducible-by-design weight set), re-ran `node admin/print-softmax-margins.mjs`, and ran `npm test` — all confirmed passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire initInference into src/index.js's init(); verify brain.js never reaches dist/sdk.js** - `f7d36b6` (feat)
2. **Task 2: Build admin/print-softmax-margins.mjs — Success Criterion 2's explicit margin-quality gate** - `9a98b2e` (feat)
3. **Task 3 (checkpoint:human-verify, gate="blocking"): APPROVED.** No files modified by the task's own action (pure verification gate); the human operator's `npm run generate-weights` run produced a regenerated `admin/weights.js`, committed alongside this finalized SUMMARY as part of closing the plan.

**Fresh re-verification run (this continuation, post-approval), confirming current disk state independent of the prior partial run's cached numbers:**
- `npm run build` — succeeds, `dist/sdk.js` is 13.3kb
- `node admin/check-bundle-purity.mjs` — PASS, 13628 bytes, zero brain.js internals
- `node admin/print-softmax-margins.mjs` — PASS, all 4 canonical gates pass:
  - touch_hesitation → confusion, top prob 0.4569, margin 0.2707
  - blur_incomplete → flow_friction, top prob 0.4952, margin 0.2921
  - scroll_reversal → price_doubt, top prob 0.4410, margin 0.2535
  - back_intent → trust_gap, top prob 0.4979, margin 0.2919
  - ambiguous (70/30 touch_hesitation/blur_incomplete) → confusion, top prob 0.3712, margin 0.1095 (not gated, printed for human inspection — genuinely non-collapsed uncertainty, distinct from any single canonical output)
- `npx vitest run` — 40/40 tests passing across 8 test files

## Files Created/Modified
- `src/index.js` - Modified. Imports and calls `initInference(config)` inside `init()`, after `initSignalCapture(config)`.
- `admin/check-bundle-purity.mjs` - New. Dev-only Node ESM script; reads `dist/sdk.js`, exits 1 if it contains brain.js internals (`NeuralNetworkGPU`, `thaw`), exits 0 with byte size otherwise.
- `admin/print-softmax-margins.mjs` - New. Dev-only Node ESM script; prints and numerically gates the 5 softmax-margin stress vectors (4 canonical + 1 ambiguous) required by Success Criterion 2.
- `admin/weights.js` - Modified. Regenerated by the human operator during Task 3's checkpoint verification (`npm run generate-weights`); non-deterministic by design (brain.js training uses random init) but re-verified correct via the margin gate above before committing.

## Decisions Made
- `CLASSES`/`SIGNAL_ORDER` are not exported from `src/inference.js` (contrary to this plan's `read_first` assumption that they were). Rather than widen `src/inference.js`'s export surface — outside this task's declared `<files>` scope (`admin/print-softmax-margins.mjs` only) — the same literal values are re-declared locally in the verification script, matching `src/inference.js`'s module-scoped constants exactly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-declared CLASSES/SIGNAL_ORDER locally in admin/print-softmax-margins.mjs instead of importing them**
- **Found during:** Task 2 (building admin/print-softmax-margins.mjs)
- **Issue:** The plan's `<read_first>` and `<action>` describe importing `CLASSES`/`SIGNAL_ORDER`/`forwardPass` from `src/inference.js`, but only `relu`, `softmax`, `forwardPass`, `buildTarget`, `gradientStep`, `initInference`, and `endSession` are actually exported there — `CLASSES` and `SIGNAL_ORDER` are module-scoped `const`s. Importing them as written would throw at module load (`undefined` destructure, not a hard SyntaxError, but the script would immediately misbehave — `CLASSES[argmax(probs)]` would throw on `undefined[i]`).
- **Fix:** Re-declared `CLASSES` and `SIGNAL_ORDER` as local constants in `admin/print-softmax-margins.mjs`, with the exact same literal values as `src/inference.js`, with a comment explaining why (values must match `admin/generate-weights.mjs`'s `canonicalData` order or classification silently breaks, per 03-RESEARCH.md Pattern 2). Did not modify `src/inference.js`'s export surface since that file was outside this task's declared `<files>` scope.
- **Files modified:** admin/print-softmax-margins.mjs
- **Verification:** `node admin/print-softmax-margins.mjs` exits 0, prints correct `CLASSES`/`SIGNAL_ORDER` values matching `src/inference.js`'s internal constants.
- **Committed in:** `9a98b2e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary to make Task 2's script actually runnable as specified; no scope creep — kept the fix scoped to the one file this task owns rather than touching `src/inference.js`.

## Issues Encountered
None beyond the deviation documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness

**This plan is complete.** Task 3's `checkpoint:human-verify` gate (`gate="blocking"`) was approved by the human operator, who ran `npm run generate-weights` + `node admin/print-softmax-margins.mjs` + `npm test`, confirmed all 4 canonical mappings win with a real (non-saturated, non-uniform) margin, confirmed the ambiguous input shows genuine non-collapsed uncertainty, and confirmed the full test suite is green. This continuation agent independently re-ran the same verification commands fresh against current disk state (not relying on cached numbers) and confirmed identical PASS results (see "Fresh re-verification run" above).

Phase 3 (Inference Layer — Forward Pass, Confidence Gate, Cold-Start Weights) is now fully executed and closed. INF-01, INF-02, INF-03, and INF-05 are complete (INF-04 was completed in plan 03-04). The next phase in the roadmap can begin.

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: src/index.js (modified)
- FOUND: admin/check-bundle-purity.mjs
- FOUND: admin/print-softmax-margins.mjs
- FOUND: admin/weights.js (regenerated during checkpoint verification)
- FOUND: f7d36b6 (feat(03-05): wire initInference into init() and verify bundle purity)
- FOUND: 9a98b2e (feat(03-05): build print-softmax-margins.mjs -- Success Criterion 2 gate)
