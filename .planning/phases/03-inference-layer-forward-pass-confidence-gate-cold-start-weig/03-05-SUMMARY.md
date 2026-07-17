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

requirements-completed: []

coverage: []

# Metrics
duration: 4min (Tasks 1-2 only; Task 3 checkpoint pending)
completed: PENDING (checkpoint not yet resolved)
status: checkpoint_pending
---

# Phase 3 Plan 5: Inference Integration & Bundle Purity Summary (PARTIAL — checkpoint pending)

**init() now wires initInference end-to-end; dist/sdk.js confirmed brain.js-free (13.3kb); Success Criterion 2's 4 canonical softmax margins (0.23-0.33) and one 70/30 ambiguous input (0.12, genuinely uncertain) all pass an automated numeric gate — human-verify checkpoint (Task 3) not yet resolved**

## Performance

- **Duration:** ~4 min (Tasks 1-2)
- **Started:** 2026-07-16T23:14:03-04:00 (first commit after prior plan)
- **Tasks:** 2 of 3 complete (Task 3 is a blocking human-verify checkpoint, not yet reached/resolved)
- **Files modified:** 3 (1 modified, 2 new)

## Accomplishments
- `src/index.js`'s `init()` now calls `initInference(config)` immediately after `initSignalCapture(config)`, preserving hard-fail-first ordering (`validateConfig` throws first); return shape unchanged (`{ config, publish, subscribe }`)
- `admin/check-bundle-purity.mjs` built and passing: `npm run build` produces a 13.3kb `dist/sdk.js`, and the purity check confirms zero occurrences of `NeuralNetworkGPU`/`thaw` — brain.js is confirmed confined to `admin/generate-weights.mjs`, never reaching the shipped bundle
- `admin/print-softmax-margins.mjs` built and passing: all 4 canonical cold-start mappings classify to their correct domain-knowledge class with real margins (0.2344-0.3327, all >= the 0.05 gate, all top-probs < 0.98 non-saturated), and the deliberately ambiguous 70/30 blended input (`[0.7, 0.3, 0, 0]`, per 03-RESEARCH.md Assumption A2) shows a distinct, non-collapsed margin of 0.1222 — genuine uncertainty, not identical to any single canonical output
- Full test suite (`npx vitest run`) stays green at 40/40 across both task commits

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire initInference into src/index.js's init(); verify brain.js never reaches dist/sdk.js** - `f7d36b6` (feat)
2. **Task 2: Build admin/print-softmax-margins.mjs — Success Criterion 2's explicit margin-quality gate** - `9a98b2e` (feat)

**Task 3 (checkpoint:human-verify, gate="blocking"): NOT YET REACHED/RESOLVED.** This plan stops here per its `autonomous: false` frontmatter and the explicit checkpoint protocol — a human must run `npm run generate-weights` + `node admin/print-softmax-margins.mjs`, visually confirm the printed vectors, and run `npm test` before this plan (and Phase 3) can close.

**Plan metadata:** not yet committed (deferred until Task 3 resolves and the plan fully completes)

## Files Created/Modified
- `src/index.js` - Modified. Imports and calls `initInference(config)` inside `init()`, after `initSignalCapture(config)`.
- `admin/check-bundle-purity.mjs` - New. Dev-only Node ESM script; reads `dist/sdk.js`, exits 1 if it contains brain.js internals (`NeuralNetworkGPU`, `thaw`), exits 0 with byte size otherwise.
- `admin/print-softmax-margins.mjs` - New. Dev-only Node ESM script; prints and numerically gates the 5 softmax-margin stress vectors (4 canonical + 1 ambiguous) required by Success Criterion 2.

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

**This plan is NOT complete.** Task 3 is a blocking `checkpoint:human-verify` gate (`gate="blocking"`) that closes both this plan and Phase 3. Per this session's explicit execution instructions, the checkpoint was not auto-approved or fabricated — it is being returned to the orchestrator as a structured checkpoint for a real human to resolve.

**What the human needs to do (Task 3's `<how-to-verify>`):**
1. Run `npm run generate-weights` followed by `node admin/print-softmax-margins.mjs` and read the printed output for all 5 vectors.
2. Confirm each of the 4 canonical softmax vectors shows the correct class winning with a visually real margin (roughly 0.15-0.40 range) — not saturated (~1.0/0.0) and not uniform (~0.25 each).
3. Confirm the ambiguous 70/30 blended input's output looks like genuine, non-collapsed uncertainty (not identical to any single canonical vector's output).
4. Run `npm test` (full suite) and confirm every test passes, including `tests/inference.test.js` and `tests/inference-endsession.test.js`.

**Note on `npm run generate-weights` non-determinism:** re-running it (as the checkpoint instructs) will produce numerically different (but expected-to-be-equally-correct) weights than the ones already committed and verified in this session (0.2344-0.3327 canonical margins, 0.1222 ambiguous margin) — per 03-01-SUMMARY.md's established precedent, this is expected, not a bug; correctness is judged by shape/margin/classification checks, not byte-for-byte stability.

Once a human types "approved" (or describes issues to fix), a continuation agent should resume at Task 3, complete the checkpoint, run the final `<verification>` block, and only then finalize this SUMMARY.md's frontmatter (`status: complete`, `completed:` date, `requirements-completed:` — INF-01/02/03/05 are already marked complete in REQUIREMENTS.md from plan 03-03, so no further requirement-marking action is needed here), commit the plan metadata, and close Phase 3.

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: PENDING — checkpoint:human-verify (Task 3) awaiting resolution*

## Self-Check: PASSED

- FOUND: src/index.js (modified)
- FOUND: admin/check-bundle-purity.mjs
- FOUND: admin/print-softmax-margins.mjs
- FOUND: f7d36b6 (feat(03-05): wire initInference into init() and verify bundle purity)
- FOUND: 9a98b2e (feat(03-05): build print-softmax-margins.mjs -- Success Criterion 2 gate)
