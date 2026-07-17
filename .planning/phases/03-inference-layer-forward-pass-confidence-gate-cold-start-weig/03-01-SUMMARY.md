---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
plan: 01
subsystem: inference
tags: [brain.js, neural-network, cold-start, config-schema, leaky-relu]

# Dependency graph
requires:
  - phase: 02-signal-capture-layer
    provides: signal.js's buildPayload allow-list pattern and config/schema.json's additive `signals.*` precedent this plan mirrors for `inference.*`
provides:
  - admin/weights.js — committed { W1, b1, W2, b2 } cold-start weights for the 4-4-4 inference net
  - admin/generate-weights.mjs — reproducible dev-only regeneration script
  - config/schema.json inference object (confidenceThreshold, weights) — optional, additive
  - package.json generate-weights script + pinned brain.js@2.0.0-beta.24 devDependency
affects: [03-02, 03-03, 03-04, 03-05]

# Tech tracking
tech-stack:
  added: ["brain.js@2.0.0-beta.24 (devDependency only, training/weight-export)"]
  patterns:
    - "Cold-start weights generated offline by a dev-only .mjs script, extracted from brain.js's toJSON().layers[1]/[2] (not the raw toJSON object), and committed as a plain JS module with zero brain.js import"
    - "leaky-relu used only during training (brain.js gradient computation) to avoid dead-neuron degeneracy; the shipped forward pass in src/inference.js still uses genuine ReLU"

key-files:
  created: [admin/generate-weights.mjs, admin/weights.js]
  modified: [package.json, package-lock.json, config/schema.json]

key-decisions:
  - "brain.js pinned to exact 2.0.0-beta.24 (no caret range) per D-04 and .claude/CLAUDE.md stack guidance — npm install initially wrote a caret range, corrected by hand-editing package.json"
  - "Regenerated admin/weights.js one extra time as part of running the plan's full <verification> block (npm run generate-weights is nondeterministic across runs due to random weight init); re-verified the resulting weights classify all 4 canonical inputs correctly with real softmax margins (0.23-0.33) before committing the final version"

patterns-established:
  - "Pattern: any future re-run of npm run generate-weights will change admin/weights.js's numeric contents (different random init) — this is expected and does not indicate a bug; correctness is verified by margin/shape checks, not byte-for-byte stability"

requirements-completed: [INF-05]

coverage:
  - id: D1
    description: "brain.js installed as a pinned (exact, non-caret) dev-only dependency; generate-weights npm script wired to admin/generate-weights.mjs"
    requirement: "INF-05"
    verification:
      - kind: unit
        ref: "npm ls brain.js && node -e schema/package.json assertion script (plan Task 1 <verify> block)"
        status: pass
    human_judgment: false
  - id: D2
    description: "config/schema.json accepts an optional inference.{confidenceThreshold,weights} object without breaking existing configs"
    requirement: "INF-05"
    verification:
      - kind: unit
        ref: "tests/config.test.js (npx vitest run) — 6/6 passed"
        status: pass
    human_judgment: false
  - id: D3
    description: "admin/generate-weights.mjs trains a 4-4-4 leaky-relu net on the 4 canonical signal->intent mappings and writes admin/weights.js as a plain {W1,b1,W2,b2} object with no brain.js import"
    requirement: "INF-05"
    verification:
      - kind: unit
        ref: "npm run generate-weights + node shape/finite-value assertion script (plan Task 2 <verify> block); grep -c brain admin/weights.js == 0"
        status: pass
      - kind: other
        ref: "manual cross-check: hand-written ReLU forwardPass(canonicalInput, weights) against all 4 canonical inputs, all 4 classify correctly with margins 0.23-0.33"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-17
status: complete
---

# Phase 3 Plan 1: Inference Wave-0 Prerequisites Summary

**Pinned brain.js@2.0.0-beta.24 devDependency, additive `inference` config schema, and a leaky-relu-trained cold-start weight generator producing a correctly-shaped, brain.js-free `admin/weights.js`**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-07-17T02:43:19Z
- **Tasks:** 2
- **Files modified:** 6 (package.json, package-lock.json, config/schema.json, admin/generate-weights.mjs, admin/weights.js, plus this SUMMARY)

## Accomplishments
- brain.js installed and pinned to the exact `2.0.0-beta.24` version (dev-only, per D-04 — never imported from `src/`)
- `config/schema.json` extended with an optional, additive `inference.{confidenceThreshold,weights}` object, mirroring Phase 2's `signals.*` precedent — existing `demo-platform.json` still validates
- `admin/generate-weights.mjs` implements the empirically-verified leaky-relu cold-start recipe from 03-RESEARCH.md verbatim, training a 4-4-4 `brain.NeuralNetwork` on the 4 canonical `{input, output}` signal->intent pairs
- `admin/weights.js` generated and committed: plain `{ W1, b1, W2, b2 }` object, 4x4 weight matrices, length-4 biases, all finite, zero brain.js import
- Cross-checked the generated weights against a hand-written genuine-ReLU forward pass (the shape `src/inference.js` will use in a later plan): all 4 canonical inputs classify to their expected intent class with real softmax margins (0.23-0.33)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pinned brain.js devDependency, add generate-weights script, extend config schema** - `d617b8f` (feat)
2. **Task 2: Build admin/generate-weights.mjs (leaky-relu recipe) and generate admin/weights.js** - `9eb3a93` (feat)
3. **Post-verification regeneration: admin/weights.js from final verification pass** - `5b3c285` (chore)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `admin/generate-weights.mjs` - Dev-only Node ESM script; trains the 4-4-4 leaky-relu net and writes admin/weights.js
- `admin/weights.js` - Generated cold-start weights, `export default { W1, b1, W2, b2 }`, no brain.js import
- `package.json` - Added pinned `brain.js` devDependency (exact `2.0.0-beta.24`) and `generate-weights` script
- `package-lock.json` - Lockfile update from brain.js install
- `config/schema.json` - Added optional top-level `inference` object (`confidenceThreshold`, `weights`), not in `required`

## Decisions Made
- Corrected `npm install`'s default caret-range pin (`^2.0.0-beta.24`) to an exact pin (`2.0.0-beta.24`) by hand-editing `package.json` after install, per the plan's explicit "no `^` range" requirement (D-04)
- Re-ran `npm run generate-weights` as the final step of the plan's `<verification>` block (as the plan itself specifies); since brain.js's training uses random weight initialization, this produced a numerically different (but equally correct) `admin/weights.js` than Task 2's first run — verified shape/finite/classification correctness again and committed this final version rather than leaving an uncommitted diff on disk

## Deviations from Plan

None — plan executed exactly as written. The `package.json` caret-range correction and the post-verification weights regeneration are both explicitly anticipated by the plan's own task instructions (exact-pin requirement; `<verification>` block re-running `npm run generate-weights`), not unplanned scope.

## Issues Encountered
- `npm install --save-dev brain.js@2.0.0-beta.24` defaulted to writing `^2.0.0-beta.24` into `package.json` (npm's standard behavior for exact-version installs without `--save-exact`) — corrected by hand-edit to the literal `2.0.0-beta.24` string per the plan's exact-pin requirement; re-verified via the plan's own automated check.
- `admin/weights.js`'s numeric contents are non-reproducible byte-for-byte across `npm run generate-weights` invocations (brain.js's `NeuralNetwork` uses random weight initialization) — this is expected per 03-RESEARCH.md's "15/15 runs correct, margins 0.21-0.35" framing and does not indicate a defect; correctness was re-verified after the final regeneration.

## Next Phase Readiness
- `admin/weights.js` is ready for `src/inference.js` (a later plan in this phase) to import directly as the cold-start weight source — its `{W1,b1,W2,b2}` shape matches the hand-written `forwardPass` orientation verified in 03-RESEARCH.md's code example.
- `config/schema.json`'s `inference` object is ready to carry a partner's optional `confidenceThreshold` override and (later) a live-reloaded `weights` object from Phase 5's weight-push receiver.
- brain.js remains strictly confined to `admin/generate-weights.mjs` — no import exists anywhere reachable from `src/index.js`, so the Phase-3-later `dist/sdk.js` build purity check (plan 03-05) has a clean starting point.

---
*Phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig*
*Completed: 2026-07-17*

## Self-Check: PASSED

- FOUND: admin/generate-weights.mjs
- FOUND: admin/weights.js
- FOUND: d617b8f (feat(03-01): install pinned brain.js devDependency and extend config schema)
- FOUND: 9eb3a93 (feat(03-01): build cold-start weight generator and generate admin/weights.js)
- FOUND: 5b3c285 (chore(03-01): regenerate admin/weights.js from final verification pass)
