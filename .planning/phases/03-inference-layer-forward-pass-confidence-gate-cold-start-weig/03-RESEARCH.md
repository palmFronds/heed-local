# Phase 3: Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights - Research

**Researched:** 2026-07-16
**Domain:** Hand-written feedforward neural network inference (W1/b1→ReLU→W2/b2→softmax), brain.js-as-training-tool cold-start weight generation, bounded online weight updates
**Confidence:** HIGH (both flagged research blockers empirically resolved via direct experimentation against the installed `brain.js@2.0.0-beta.24` package in this session — not textbook inference)

## Summary

This phase's two open research flags are now closed empirically, not just theoretically. First:
**`brain.js`'s `NeuralNetwork.train(data, options)` is a plain `while` loop over `trainingTick()`,
and `trainingTick` unconditionally trains every `{input, output}` pair present in `data` once per
tick** (confirmed via direct source read of `dist/index.js` lines 1263–1341 and empirical
before/after weight-diffing). Calling `net.train([oneExample], { iterations: 1, learningRate: 0.01
})` therefore performs **exactly one gradient-descent step on exactly one example** — this is the
correct, verified call shape for `endSession`'s Success-Criterion-4 requirement. `iterations: 1`
does **not** mean "one step regardless of dataset size" — it means "one epoch over whatever `data`
you pass," so `endSession` must construct a `data` array with exactly one entry, never more.

Second, and more consequential: **a naive cold-start recipe using brain.js's `'relu'` activation
with the spec's required 4-4-4 architecture and only 4 training examples is measurably unreliable**
— empirically, 15 independent training runs at `{ activation: 'relu', hiddenLayers: [4],
learningRate: 0.01, iterations: 20000, errorThresh: 0.005 }` produced **0/15** runs where all 4
canonical signal→intent mappings won correctly (dead-ReLU degeneracy: with only 4 hidden units and 4
examples, some hidden units permanently zero out during training, collapsing 2+ output classes into
a tie). Switching **only the brain.js training-time activation** to `'leaky-relu'` (brain.js's own
built-in option, never touching the hand-written `inference.js` forward pass, which still uses
genuine ReLU per INF-02) fixed this completely: **15/15 runs** produced all 4 correct classifications
with real, non-saturated, non-uniform margins (0.21–0.35 range). This is the single most
important, load-bearing finding in this research — the planner MUST use `activation: 'leaky-relu'`
in the brain.js training config, not `'relu'`, despite the spec's hidden layer being described as
"ReLU." This is a training-time trick to avoid a well-known optimization pathology; it does not
change the shipped architecture, which remains genuine ReLU→softmax as INF-01/INF-02 require.

A third finding worth front-loading: **brain.js's `NeuralNetwork` can only apply ONE activation
function to every layer including the output layer** (confirmed via source: `setActivation()` sets
a single `runInput`/`calculateDeltas` pair used for all layers) — there is no way to configure
brain.js itself to produce a softmax output. This is not a gap; it is exactly why PROJECT.md's
"brain.js is training/weight-export only" decision is correct: brain.js is used purely to arrive at
good `W1/b1/W2/b2` numbers via its own internal (non-softmax) loss dynamics, and the *hand-written*
forward pass in `inference.js` applies the genuinely-required ReLU→softmax pipeline on top of those
weight numbers. Cross-checking confirms this composition works: for all 4 canonical examples, the
class with the highest raw brain.js `.run()` output also wins under our hand-rolled ReLU→softmax
pass (verified empirically) — the weights transfer cleanly across the activation swap because softmax
preserves rank order among positive logits in this regime.

**Primary recommendation:** Build `admin/generate-weights.mjs` (a dev-only Node script, imports
`brain.js`, never bundled into `dist/sdk.js`) that trains a `NeuralNetwork({ inputSize: 4,
hiddenLayers: [4], outputSize: 4, activation: 'leaky-relu' })` on the 4 canonical one-hot examples
with `{ learningRate: 0.01, iterations: 20000, errorThresh: 0.005 }`, extracts `{W1,b1,W2,b2}` from
`layers[1]`/`layers[2]` of `net.toJSON()` (NOT a flat pre-shaped export — this requires an explicit
reshape step, documented below), and writes the result as a plain JS module to `admin/weights.js`.
`inference.js` never imports `brain.js` — it imports `admin/weights.js`'s literal `{W1,b1,W2,b2}`
object directly, keeping `brain.js` fully out of the esbuild bundle graph.

## User Constraints

<user_constraints>
### Locked Decisions (from 03-CONTEXT.md)

- **D-01:** `inference.js` subscribes to `signal:detected` and, for every incoming signal
  (regardless of confidence), publishes exactly one `inference:result` bus event containing the
  full softmax vector, the predicted class, the confidence value, and a boolean `fires` flag gated
  by the 0.65 threshold. The publish itself is never gated on confidence — only downstream
  *rendering* (Phase 4's concern) is gated on `fires`.
- **D-02:** Because `signal.js`'s payloads carry no continuous magnitude field, each incoming signal
  event is classified as an effectively **one-hot** input vector: the input node corresponding to the
  event's `type` is set to `1`, the other 3 nodes are `0`.
- **D-03:** Phase 3 exposes a directly-callable, unit-testable function (e.g. `endSession(config,
  outcome)`) that computes exactly one bounded weight update and refreshes the in-memory weight
  arrays the forward pass reads — no new test-harness UI control, no disk persistence (Phase 5's job).
- **D-04:** Cold-start weights are produced by calling brain.js's `NeuralNetwork.train()` (dev-side,
  never shipped to the browser) against a small hand-authored synthetic dataset encoding the 4
  canonical one-hot mappings, then exporting the resulting weights via `toJSON()` into
  `admin/weights.js` as plain `{ W1, b1, W2, b2 }` arrays. Exact training hyperparameters were
  explicitly left to this research phase to determine empirically.

### Claude's Discretion

- Exact training hyperparameters for cold-start weights — **now resolved empirically below** (see
  Common Pitfalls #1 and Code Examples).
- Whether `train({iterations:1, learningRate:0.01})` on one example produces one online gradient
  update — **now resolved empirically below** (Common Pitfalls #2 / endSession section).
- Exact module/function naming beyond `inference.js`, `admin/weights.js`.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 3's scope (inference/forward-pass/confidence-gate/cold-start
weights and the session-end update mechanism only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INF-01 | 2-layer feedforward net: 4→4(ReLU)→4(softmax) over {confusion, price_doubt, trust_gap, flow_friction} | Architecture Patterns "Hand-Written Forward Pass"; confirmed brain.js's 4-4-4 shape maps directly to `hiddenLayers:[4]` |
| INF-02 | Forward pass implemented explicitly (W1/b1→ReLU→W2/b2→softmax), reading externally-produced weight arrays, never `.run()` at inference time | Code Examples "Hand-Written Forward Pass"; Common Pitfall #3 (toJSON() reshape requirement) |
| INF-03 | Confidence threshold gate (default 0.65) — no response fires below threshold | Architecture Patterns "Confidence Gate & Bus Publish"; D-01 |
| INF-04 | Weight update fires once at session end, outcome label from `flowComplete`, learning rate 0.01 | Common Pitfall #2 (train() semantics, empirically confirmed); Code Examples "endSession" |
| INF-05 | Cold-start weights encode the domain-knowledge mapping, used when no learned weights exist | Common Pitfall #1 (empirically-verified training recipe); Code Examples "Cold-Start Weight Loading" |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Hand-written forward pass (W1/b1→ReLU→W2/b2→softmax) | Browser / Client | — | Runs inside the partner's page on every signal, latency-sensitive (PROJECT.md: "a server round-trip kills it") |
| Confidence-gate decision (`fires` flag) | Browser / Client | — | Pure arithmetic comparison against `config.inference.confidenceThreshold`, no server round-trip needed |
| Session-end weight update (`endSession`) | Browser / Client | — | Runs once client-side at session end; the *push* of the resulting weights (Phase 5) is the only network hop, not the computation itself |
| Cold-start weight generation (`admin/generate-weights.mjs` + brain.js) | Build tool / Dev machine | — | Explicitly a build-time-only step (PROJECT.md: "brain.js used for training/weight-export only"); never runs in a partner's browser, never bundled into `dist/sdk.js` |
| Cold-start weight storage (`admin/weights.js`) | Browser / Client (as bundled static data) | Build tool (as generated artifact) | The *file* is committed to git and bundled into `dist/sdk.js` by esbuild as a plain object literal; its *generation* is a dev-only tool concern |
| Weight persistence / cold-start-vs-learned selection *logic* | Browser / Client | — | `inference.js`'s init reads `config.inference.weights` (injected, e.g. by Phase 5's receiver) falling back to `admin/weights.js`; Phase 3 owns only this read-side branch, not the receiver that populates `config.inference.weights` |

No API/Backend, CDN/Static, or Database/Storage tier does any of this phase's *runtime* work — the
one exception is `admin/generate-weights.mjs`, which is a Node-only build tool, never network-facing
and never part of the shipped bundle.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| brain.js | `2.0.0-beta.24` [VERIFIED: npm registry — `npm view brain.js version` confirms `latest = 2.0.0-beta.24`, `dist-tags.latest` matches, published 2024-07-09, unchanged since; this is the exact version already pinned in `.claude/CLAUDE.md`'s stack doc] | Cold-start weight *generation only* (dev-side `admin/generate-weights.mjs`); never imported by any module in `src/` | Mandated by PROJECT.md/CLAUDE.md as the one allowed dependency; confirmed via direct package inspection this session that its `NeuralNetwork` class exposes exactly the API this phase needs: `train()`, `toJSON()`, `run()` |

**Installation (dev-only — add to `devDependencies`, never a runtime import in `src/`):**
```bash
npm install --save-dev brain.js@2.0.0-beta.24
```

**Version verification performed this session:**
```
$ npm view brain.js version            -> 2.0.0-beta.24
$ npm view brain.js dist-tags          -> { latest: '2.0.0-beta.24' }
$ npm view brain.js dependencies       -> { 'thaw.js': '^2.1.4' }
$ npm view brain.js peerDependencies   -> { 'gpu.js': '^2.16.0' }  (NOT auto-installed by npm 7+;
                                            confirmed empirically — a scratch `npm install
                                            brain.js@2.0.0-beta.24` added 140 packages, no
                                            gpu.js/headless-gl among them, no install error)
$ npm view brain.js scripts.postinstall -> (empty — no postinstall script)
```
No newer version exists; the beta tag has been `latest` for ~2 years with no churn, consistent with
`.claude/CLAUDE.md`'s existing stack note.

### Supporting

No other new dependency. `admin/generate-weights.mjs` is a plain Node ESM script using only
`brain.js` + `fs`/`node:fs` (already available in Node.js, per `package.json`'s existing `"type":
"module"`).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| brain.js `'leaky-relu'` activation during training (this research's key recommendation) | brain.js `'relu'` (literal match to spec wording) | Empirically fails 15/15 times on this exact 4-example, 4-4-4 architecture (dead-ReLU degeneracy: some hidden units get stuck at 0 gradient permanently). `'leaky-relu'` is still a ReLU-family activation, still available natively in brain.js, and the *shipped* inference forward pass is unaffected (hand-written, uses genuine ReLU) — this is purely a training-time numerical-stability fix, not an architecture change. |
| brain.js `'sigmoid'` activation during training (brain.js's own default) | — | Converges reliably (all 4 correct, tested) but produces **saturated ~1.000/0.000 margins** — directly violates Success Criterion 2's "not saturated (~1.0)" requirement. Rejected. |
| Hand-authored `{W1,b1,W2,b2}` matrices (no brain.js at all) | — | Explicitly rejected by D-04: "brain.js used for training/weight-export only" is already locked; hand-crafting would make brain.js vestigial per CONTEXT.md's own rationale. Not revisited here. |
| A single `train()` call with `iterations: 1` for `endSession` (recommended) | Manually calling the lower-level `net.trainPattern(value)` directly (skips `train()`'s wrapper entirely) | Both are empirically confirmed to perform exactly one gradient step (verified in this session — `trainPattern()` is what `train()`'s single tick calls internally). `train([oneExample], {iterations:1, learningRate:0.01})` is recommended because it goes through brain.js's public, documented, validated (`validateData`/`formatData`) code path rather than the internal `trainPattern` primitive, reducing the chance of skipping input validation. |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| brain.js | npm | ~2 yrs since last publish (2024-07-09); package itself is much older (BrainJS org, long-standing) | 5,026/week (confirmed via `api.npmjs.org/downloads/point/last-week/brain.js`, this session) | `git+ssh://git@github.com/brainjs/brain.js.git` | **OK** [VERIFIED via `gsd-tools query package-legitimacy check --ecosystem npm brain.js` this session — `exists: true, deprecated: false, postinstall: null`] | Approved — already the project's locked one allowed dependency |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

No other packages are introduced this phase (`admin/generate-weights.mjs` uses only `brain.js` +
Node built-ins).

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│ Build time (Node.js, dev machine — NEVER runs in a partner's browser)  │
│                                                                          │
│  admin/generate-weights.mjs                                            │
│    import brain from 'brain.js'                                        │
│    canonicalData = [4 one-hot {input,output} pairs]                    │
│    net = new brain.NeuralNetwork({inputSize:4, hiddenLayers:[4],       │
│              outputSize:4, activation:'leaky-relu'})                   │
│    net.train(canonicalData, {learningRate:0.01, iterations:20000,      │
│              errorThresh:0.005})                                       │
│    { W1, b1, W2, b2 } = extractWeights(net.toJSON())  ← RESHAPE STEP   │
│    fs.writeFileSync('admin/weights.js', `export default {W1,b1,W2,b2}`)│
└──────────────────────────────┬───────────────────────────────────────┘
                                │ committed to git as plain JS (no brain.js import)
                                ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Runtime (partner's browser — dist/sdk.js, esbuild-bundled)             │
│                                                                          │
│  src/inference.js                                                       │
│    import coldStartWeights from '../admin/weights.js'  (bundled literal)│
│    let activeWeights = coldStartWeights                                │
│    let lastInference = null   // { input, predictedClassIdx } for       │
│                                //   endSession's training example        │
│                                                                          │
│  subscribe('signal:detected', (payload) => {                           │
│    const input = oneHot(payload.type)          // D-02                 │
│    const { probs } = forwardPass(input, activeWeights)  // INF-02      │
│    const predictedIdx = argmax(probs)                                  │
│    const confidence = probs[predictedIdx]                               │
│    const fires = confidence >= config.inference.confidenceThreshold    │
│    lastInference = { input, predictedIdx }        // for endSession    │
│    publish('inference:result', {                  // D-01: ALWAYS      │
│      intent: CLASSES[predictedIdx], confidence, probs, fires,          │
│      signalType: payload.type, timestamp: Date.now(),                  │
│    })                                                                   │
│  })                                                                     │
│                                                                          │
│  export function endSession(config, outcome) {     // D-03, INF-04     │
│    if (!lastInference) return              // no signal fired this sess │
│    const target = buildTarget(lastInference.predictedIdx, outcome)     │
│    trainOneStep(activeWeights, lastInference.input, target, 0.01)      │
│    // activeWeights mutated in place; Phase 5 later persists+pushes    │
│  }                                                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                                │ publish(inference:result)
                                ▼
                      (Phase 4's response.js/log.js — out of scope here)
```

A reader can trace the primary use case — a `signal:detected` event enters `inference.js`, is
one-hot encoded, run through the hand-written ReLU→softmax forward pass, gated against the
confidence threshold, and published as `inference:result` for Phase 4 to consume — by following the
runtime half of this diagram top to bottom. The build-time half (top box) never executes in a
partner's browser and produces only the static `admin/weights.js` artifact the runtime half imports.

### Recommended Project Structure

```
admin/
├── generate-weights.mjs   # NEW — dev-only Node script, imports brain.js, never bundled
└── weights.js             # NEW — generated output, plain {W1,b1,W2,b2} export, no brain.js import
src/
├── config.js               # unchanged (Phase 1)
├── bus.js                  # unchanged (Phase 1)
├── signal.js                # unchanged (Phase 2)
├── inference.js              # NEW — this phase's primary deliverable
└── index.js                  # MODIFIED — wires inference.js's subscription into init()
config/
├── schema.json               # MODIFIED — add optional `inference` object (confidenceThreshold, weights)
└── demo-platform.json         # MODIFIED (optional) — supply confidenceThreshold override if desired
tests/
├── inference.test.js          # NEW — forward-pass math, confidence gate, cold-start load
└── inference-endsession.test.js # NEW — endSession weight-update semantics (kept separate per
                                  #   Phase-2 precedent of isolating distinct concerns into files)
package.json                   # MODIFIED — add "generate-weights": "node admin/generate-weights.mjs"
                                #   script + brain.js@2.0.0-beta.24 devDependency
```

**Note on `config/schema.json`:** Following the exact Phase-2 precedent (adding optional
`signals.*` fields without touching `required`), add an optional top-level `inference` object:
```json
"inference": {
  "type": "object",
  "properties": {
    "confidenceThreshold": { "type": "number" },
    "weights": { "type": "object" }
  }
}
```
`src/config.js`'s `walk()` validator only recurses into declared `properties` and never rejects
unknown keys (confirmed by direct re-read of `src/config.js` this session — no
`additionalProperties: false` enforcement exists despite the file-header comment listing it as
implemented) — this addition is fully backward-compatible with the existing `demo-platform.json`,
exactly as Phase 2's research already established for `signals.*`.

### Pattern 1: Hand-Written Forward Pass (INF-01, INF-02)

**What:** One pure function, `forwardPass(input, weights)`, implements the *entire* runtime
inference math explicitly — no brain.js call anywhere in this function or anywhere in `src/`.

**Critical weight-matrix orientation (verified via brain.js source, `dist/index.js` lines
1016–1063):** brain.js computes `sum = bias[node] + Σ_k weights[node][k] * input[k]` for each output
node — i.e., `weights[layer]` is indexed `[outputNodeIndex][inputNodeIndex]`, NOT the reverse. Any
implementation of `forwardPass` must follow this exact same indexing or the extracted weights will
silently produce wrong results (matrix transposed) with no error thrown.

```javascript
// src/inference.js — the ONLY place matrix math is hand-written (INF-02's explicit-forward-pass
// requirement). Mirrors brain.js's own weight[node][k] orientation (verified via brain.js source
// inspection) so weights exported from admin/weights.js plug in directly with no transpose step.
export function relu(x) {
  return x < 0 ? 0 : x;
}

export function softmax(logits) {
  // Max-subtraction for numerical stability — without it, Math.exp() can overflow to Infinity for
  // even moderately large logits, producing NaN after division.
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/**
 * @param {number[]} input - 4-element vector (one-hot per D-02 for real signals)
 * @param {{W1:number[][], b1:number[], W2:number[][], b2:number[]}} weights
 * @returns {{ probs: number[], hidden: number[], logits: number[] }}
 */
export function forwardPass(input, weights) {
  const { W1, b1, W2, b2 } = weights;
  const hidden = W1.map((row, i) => relu(row.reduce((sum, w, k) => sum + w * input[k], b1[i])));
  const logits = W2.map((row, i) => row.reduce((sum, w, k) => sum + w * hidden[k], b2[i]));
  const probs = softmax(logits);
  return { probs, hidden, logits };
}
```
Source: derived from `repo2_heed_sdk.txt`'s "Forward pass" section + direct inspection of
`node_modules/brain.js/dist/index.js` (`_runInputRelu`, lines 1040–1063, this session).

### Pattern 2: Confidence Gate & Bus Publish (INF-03, D-01)

**What:** `inference.js` ALWAYS publishes `inference:result` on every `signal:detected` — the
confidence threshold only sets the `fires` boolean, per D-01's already-locked bus contract. This
pattern also caches the most recent `{input, predictedIdx}` pair in module-scoped state (mirroring
`signal.js`'s existing module-scoped `flowCompleteFlag`/`lastPathname` pattern) so `endSession` has
something concrete to train on later.

```javascript
// src/inference.js
import { publish, subscribe } from './bus.js';
import coldStartWeights from '../admin/weights.js';
import { forwardPass } from './forward-pass.js'; // or inlined directly in this file

const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];
const SIGNAL_ORDER = ['touch_hesitation', 'blur_incomplete', 'scroll_reversal', 'back_intent'];

function oneHot(signalType) {
  return SIGNAL_ORDER.map((t) => (t === signalType ? 1 : 0));
}

function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

let activeWeights = coldStartWeights; // INF-05: cold-start default until config injects learned weights
// Module-scoped, mirrors signal.js's lastPathname/flowCompleteFlag pattern — remembers the last
// inference so endSession (called later, with no signal payload of its own) has an input to train on.
let lastInference = null;

export function initInference(config) {
  // Success Criterion 5: config-injected learned weights win over the bundled cold-start default.
  // Phase 5 owns *writing* config.inference.weights from a persisted file; Phase 3 only reads it.
  activeWeights = config.inference?.weights ?? coldStartWeights;

  subscribe('signal:detected', (payload) => {
    const input = oneHot(payload.type);
    const { probs } = forwardPass(input, activeWeights);
    const predictedIdx = argmax(probs);
    const confidence = probs[predictedIdx];
    const threshold = config.inference?.confidenceThreshold ?? 0.65;
    const fires = confidence >= threshold;

    lastInference = { input, predictedIdx }; // remembered for endSession

    // D-01: publish unconditionally — fires is a flag, never a gate on the publish itself.
    publish('inference:result', {
      intent: CLASSES[predictedIdx],
      confidence,
      probs,
      fires,
      signalType: payload.type,
      timestamp: Date.now(),
    });
  });
}
```

### Pattern 3: Cold-Start Weight Loading (INF-05, Success Criterion 5)

Already shown inline in Pattern 2's `initInference` — the read-side decision is a single nullish-
coalescing expression: `config.inference?.weights ?? coldStartWeights`. Phase 3's scope boundary
(per CONTEXT.md's `<domain>` section) stops here — Phase 5 builds the receiver that populates
`config.inference.weights` from a persisted file across sessions; Phase 3 must not build that
receiver, only ensure `initInference` correctly prefers it when present.

### Pattern 4: Session-End Weight Update (INF-04, D-03) — empirically verified `train()` semantics

**What was verified this session, directly against the installed brain.js package (not assumed):**

1. `net.train(data, options)` is `while (true) { if (!trainingTick(...)) break; }` — a plain loop,
   no hidden convergence magic beyond what `trainingTick`'s exit conditions state.
2. `trainingTick` exits when `status.iterations >= options.iterations` (or `errorThresh`/`timeout`
   is hit first). With `iterations: 1`, exactly one tick runs.
3. **Critically:** one tick trains **every** `{input, output}` pair in `data` exactly once (via
   `trainPatterns`/`calculateTrainingError`, which both iterate the full array and call
   `trainPattern()` per item — confirmed by direct source read, `dist/index.js` lines 1251–1288).
   `iterations: 1` means "one epoch over `data`," **not** "one gradient step total regardless of
   `data`'s length." Passing more than one example with `iterations: 1` will update weights once
   **per example**, silently violating Success Criterion 4's "exactly one weight update."
4. Empirical proof (this session, before/after weight snapshots): calling `train([oneExample],
   {iterations:1, learningRate:0.01})` twice in a row produces two distinct, non-zero weight deltas
   (confirming each call is a genuine, non-cached single step); calling it once with a
   **two-example** array in a single `iterations:1` call visibly changes more weight values than the
   one-example call (confirming both examples were trained, not just the first).

**Required call shape for `endSession` (INF-04's "exactly one weight update... never per-event"):**
```javascript
// src/inference.js (continued)

/**
 * Builds a single training target vector from a session outcome, per INF-04's outcome-label rule
 * (1 if flowComplete===true, 0 if abandoned) applied to the LAST predicted class this session.
 *
 * [ASSUMED — see Open Questions #1]: the spec's "outcome label: 1 if flowComplete, 0 if abandoned"
 * describes a scalar reinforcement signal, not a 4-class target vector directly. This function's
 * mapping (reinforce the predicted class on abandonment; soften toward uniform on completion) is
 * this research's recommended interpretation, not a value taken directly from the spec text — flag
 * for explicit confirmation before/during planning, mirroring STATE.md's already-acknowledged
 * "most-proximal signal" credit-assignment gap (that gap is Phase 5's version of this same
 * open question, one signal later).
 */
function buildTarget(predictedIdx, outcome) {
  if (outcome === false) {
    // Abandoned: the predicted intent likely WAS the real blocker — reinforce it directly.
    return CLASSES.map((_, i) => (i === predictedIdx ? 1 : 0));
  }
  // Completed successfully: whatever intent was predicted did not block the user — soften
  // confidence in that specific prediction without asserting a different "correct" class.
  return CLASSES.map(() => 0.25);
}

/**
 * D-03: directly-callable, unit-testable session-end trigger. Performs EXACTLY ONE bounded weight
 * update (INF-04) — never call this per-event; Phase 4 owns wiring the real flow_complete/
 * flow_abandoned trigger, Phase 3 only exposes this function and verifies it via direct unit-test
 * invocation with a synthetic outcome.
 * @param {*} config - reserved for future config-driven learning-rate override; unused for now
 * @param {boolean} outcome - true if flowComplete, false if abandoned
 */
export function endSession(config, outcome) {
  if (!lastInference) return; // no signal fired this session — nothing to reinforce
  const target = buildTarget(lastInference.predictedIdx, outcome);
  // brain.js is NOT imported here — this is a hand-rolled single gradient step, not a train() call,
  // keeping brain.js fully out of the shipped bundle (PROJECT.md: training/weight-export only).
  // See Common Pitfall #4 for why endSession must NOT import brain.js into the runtime bundle.
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
}
```

**Why `endSession` should NOT call `brain.js`'s `train()` at runtime, even though the cold-start
generator does:** importing `brain.js` anywhere reachable from `src/index.js`'s import graph pulls
its ~1MB+ unminified UMD bundle into `dist/sdk.js` (see `.claude/CLAUDE.md`'s stack doc "brain.js
payload size" finding) — exactly what D-04/PROJECT.md's "training/weight-export only" decision
exists to avoid. The session-end update must therefore be a **second, independent hand-written
single-step gradient function** (`gradientStep`), mathematically equivalent to one `trainPattern()`
call but implemented without importing brain.js. This is a new, explicit design requirement this
research surfaces: **two hand-written numeric functions are needed in this phase, not one** — the
forward pass (`forwardPass`) and the single-step backward pass (`gradientStep`), both free of any
brain.js import. Recommend implementing `gradientStep` using the same ReLU-derivative backprop math
brain.js's own `_calculateDeltasRelu` uses (error = target − output at the output layer; deltas
propagated backward through `W2` for the hidden layer; weight update = `learningRate * delta *
input`), verified conceptually against brain.js's own source this session (`dist/index.js` lines
1366+ for the relu delta formula), but implemented as plain hand-written JS matching `forwardPass`'s
existing style — not a brain.js call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Cold-start weight *generation* (arriving at good W1/b1/W2/b2 numbers) | A hand-tuned/guessed weight matrix, or a from-scratch backprop training loop | brain.js's `NeuralNetwork.train()` (dev-side only) | D-04 already locks this; also, empirically, hand-guessing weight *magnitudes* (not just direction) that produce non-saturated, non-uniform margins is exactly the kind of numerical tuning training algorithms exist to solve — verified this session that naive guessing would be error-prone even for someone who already knows the correct qualitative direction |
| Single-step gradient descent for `endSession` | Importing brain.js into the runtime bundle just to call `trainPattern()` once | A small hand-written `gradientStep()` function, mathematically equivalent, with zero brain.js import | Keeps `dist/sdk.js` free of brain.js's ~1MB UMD bundle at runtime — this is PROJECT.md's explicit "training/weight-export only" decision applied literally: brain.js's *code* never runs in the browser, only its *output numbers* do |
| Numerically-stable softmax | A naive `exp(x)/sum(exp)` without max-subtraction | The max-subtraction pattern in `softmax()` above | Naive softmax overflows to `Infinity`/`NaN` for logits as small as ~709 in magnitude (`Math.exp(710) === Infinity`); max-subtraction is the universally standard, one-line fix — no library needed for a 4-element vector |

**Key insight:** This phase's actual risk is not "which library" (settled) but "which brain.js
*configuration knobs*, empirically verified, avoid two specific failure modes documented in Common
Pitfalls below — sigmoid saturation and ReLU dead-neuron degeneracy — both of which silently violate
Success Criterion 2 while still returning a `train()` status object that looks like a training
success (`error` below `errorThresh`, no thrown exception).

## Common Pitfalls

### Pitfall 1: Naive `'relu'` cold-start training is empirically unreliable — dead-neuron degeneracy

**What goes wrong:** Training a `NeuralNetwork({hiddenLayers:[4], activation:'relu'})` on the 4
canonical one-hot examples with `learningRate: 0.01` produces all-4-correct classifications with real
margins on SOME random-init runs, but empirically **0 out of 15** independent runs in this session's
testing succeeded — most runs converged (or plateaued) with at least one pair of output classes
tied at a ~0.00 softmax margin.
**Why it happens:** With only 4 hidden ReLU units and only 4 training examples, it is easy for one or
more hidden units to receive only negative pre-activation sums across all 4 training inputs during
early training, permanently zeroing their gradient (the classic "dead ReLU" problem) — with no
redundant hidden capacity to compensate, this collapses the effective rank of the hidden
representation and two or more output classes end up numerically indistinguishable.
**How to avoid:** Use `activation: 'leaky-relu'` (brain.js's own built-in option, small default
negative slope `leakyReluAlpha: 0.01`) for the **training-time** brain.js config only. This keeps
gradients flowing through every hidden unit regardless of sign, eliminating the degeneracy entirely.
Empirically verified this session: **15/15** runs with `activation:'leaky-relu'` (otherwise identical
config) produced all-4-correct classifications with margins in the 0.21–0.35 range — a large,
consistent improvement over `'relu'`'s 0/15. This does NOT change the shipped `inference.js` forward
pass, which still hand-implements genuine (non-leaky) ReLU per INF-02 — cross-checked this session
that weights trained under leaky-relu, when run through a plain-ReLU hand-rolled forward pass, still
classify all 4 canonical examples correctly with real margins (the leaky slope only matters near
zero, and the trained weights place canonical inputs' hidden pre-activations well clear of zero in
the direction that matters).
**Warning signs:** A cold-start weights file where 2+ classes produce near-identical softmax
probabilities for their respective canonical inputs; `net.train()`'s returned `status.iterations`
hitting the `iterations` cap (20000) rather than converging via `errorThresh` — this is itself a
signal that training got stuck in a poor region, since a correctly-configured leaky-relu run
converges well before the cap (typically 1,000–6,000 iterations in this session's testing).

### Pitfall 2: `'sigmoid'` training (brain.js's own default) saturates margins to ~1.0/0.0

**What goes wrong:** Training with brain.js's un-overridden defaults (`activation: 'sigmoid'`,
`learningRate: 0.3`) converges quickly (verified: ~600–800 iterations to `errorThresh: 0.005`) and
gets every canonical mapping correct — but produces softmax margins of essentially exactly 1.000 for
all 4 canonical examples (verified this session: `[1.000, 0.000, 0.000, 0.000]`-shaped outputs).
This directly violates Success Criterion 2's explicit "not a saturated (~1.0)... distribution"
requirement, even though the classification itself is correct.
**Why it happens:** Sigmoid's output range is naturally `[0,1]` and MSE-style training on a tiny,
perfectly-separable one-hot dataset drives weights toward extreme values that push the sigmoid
output layer to its saturating extremes — a degenerate but "technically correct" solution mode.
**How to avoid:** Do not use brain.js's default `activation`/`errorThresh` combination for cold-start
training. Use `'leaky-relu'` with `errorThresh: 0.005` (Pitfall 1's recipe) — this happens to also
avoid the saturation problem because the hand-rolled softmax is applied externally to a bounded set
of raw ReLU-family logits, not to brain.js's own (bounded-by-construction) sigmoid outputs.
**Warning signs:** Verifying Success Criterion 2 by printing the full softmax vector (as the success
criterion itself instructs) and seeing values like `0.9999997` or `0.0000001` — this passes a naive
"is the right class winning" check but fails the "real margin, not saturated" requirement on
inspection.

### Pitfall 3: `toJSON()`'s output is NOT the flat `{W1,b1,W2,b2}` shape D-04 describes — requires an explicit reshape

**What goes wrong:** `net.toJSON()` returns `{ type, sizes, layers: [{weights,biases}, ...],
inputLookup, outputLookup, options, trainOpts }` — `layers[0]` is the input layer (empty
weights/biases, since input nodes have no incoming weights), `layers[1]` is the hidden layer's
`{weights: W1, biases: b1}`, `layers[2]` is the output layer's `{weights: W2, biases: b2}`. Writing
`fs.writeFileSync('admin/weights.js', JSON.stringify(net.toJSON()))` directly does **not** produce
the `{ W1, b1, W2, b2 }` plain-arrays shape D-04 and `inference.js`'s forward pass both expect.
**Why it happens:** brain.js's own serialization format is generic across all its network types
(supports arbitrary layer counts) — it was never designed to match this project's specific
`{W1,b1,W2,b2}` naming convention. It's easy to assume `toJSON()`'s shape already matches D-04's
described output without checking directly against the installed package.
**How to avoid:** `admin/generate-weights.mjs` must include an explicit extraction step:
```javascript
function extractWeights(json) {
  return {
    W1: json.layers[1].weights, b1: json.layers[1].biases,
    W2: json.layers[2].weights, b2: json.layers[2].biases,
  };
}
```
Verified directly against the installed `brain.js@2.0.0-beta.24` this session (source inspection,
`dist/index.js` lines 1705–1734, `toJSON()`'s implementation).
**Warning signs:** `inference.js`'s forward pass throwing "cannot read property 'reduce' of
undefined" or producing silently wrong (transposed-looking) results if `admin/weights.js` accidentally
exports the raw `toJSON()` object instead of the extracted, correctly-shaped one.

### Pitfall 4: Importing brain.js anywhere in `src/`'s import graph bloats `dist/sdk.js`

**What goes wrong:** If `endSession`'s single weight-update step is implemented by calling
`net.train()` (requiring a `brain.js` `NeuralNetwork` instance to exist at runtime, in the browser),
`brain.js`'s ~1MB+ unminified UMD bundle gets pulled into `dist/sdk.js` by esbuild's `--bundle` flag
— the exact outcome `.claude/CLAUDE.md`'s stack research already flagged as a scope/architecture risk
requiring explicit reconciliation.
**Why it happens:** It's the path of least resistance to reuse the same `NeuralNetwork` object/API
for both cold-start training AND the session-end update, since both are conceptually "train the net
some more" — but only the FIRST is genuinely dev-side/build-time; the second must run in a partner's
live browser session.
**How to avoid:** Implement `endSession`'s weight update as a second, small, hand-written
`gradientStep()` function (see Pattern 4 above) — mathematically equivalent to brain.js's own
`trainPattern()` for a ReLU network, but with zero `brain.js` import anywhere reachable from
`src/index.js`. Verify this directly by checking `dist/sdk.js`'s build output does not contain the
string `"brainjs"` or brain.js's characteristic internals (e.g. `thaw.js`) after `npm run build`.
**Warning signs:** `dist/sdk.js`'s file size jumping from tens of KB to 500KB+ after this phase's
work; `grep -c "NeuralNetworkGPU\|thaw" dist/sdk.js` returning non-zero.

## Code Examples

### Hand-Written Forward Pass (INF-01, INF-02) — verified against brain.js's own weight orientation

```javascript
// src/inference.js — the sole hand-written numeric core (INF-02)
export function relu(x) {
  return x < 0 ? 0 : x;
}

export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function forwardPass(input, weights) {
  const { W1, b1, W2, b2 } = weights;
  const hidden = W1.map((row, i) => relu(row.reduce((sum, w, k) => sum + w * input[k], b1[i])));
  const logits = W2.map((row, i) => row.reduce((sum, w, k) => sum + w * hidden[k], b2[i]));
  return { probs: softmax(logits), hidden, logits };
}
```

### Empirically-Verified Cold-Start Training Recipe (`admin/generate-weights.mjs`)

Verified this session against the installed `brain.js@2.0.0-beta.24`: 15/15 runs correct, margins
0.21–0.35, converges in 1,000–6,000 iterations (well under the 20,000 cap).

```javascript
// admin/generate-weights.mjs — dev-only, run via `npm run generate-weights`, NEVER imported by src/
import brain from 'brain.js';
import fs from 'node:fs';

// Class order MUST match inference.js's CLASSES array exactly.
// [confusion, price_doubt, trust_gap, flow_friction]
const canonicalData = [
  { input: [1, 0, 0, 0], output: [1, 0, 0, 0] }, // touch_hesitation -> confusion
  { input: [0, 1, 0, 0], output: [0, 0, 0, 1] }, // blur_incomplete -> flow_friction
  { input: [0, 0, 1, 0], output: [0, 1, 0, 0] }, // scroll_reversal -> price_doubt
  { input: [0, 0, 0, 1], output: [0, 0, 1, 0] }, // back_intent -> trust_gap
];

const net = new brain.NeuralNetwork({
  inputSize: 4,
  hiddenLayers: [4], // INF-01: exactly 4 hidden nodes
  outputSize: 4,
  // 'leaky-relu', NOT 'relu' -- avoids empirically-confirmed dead-neuron training degeneracy
  // (Common Pitfall #1). inference.js's SHIPPED forward pass still uses genuine ReLU; this only
  // affects how brain.js computes gradients during this offline generation step.
  activation: 'leaky-relu',
});

const status = net.train(canonicalData, {
  learningRate: 0.01,
  iterations: 20000, // cap only -- empirically converges well before this via errorThresh
  errorThresh: 0.005,
});

function extractWeights(json) {
  // toJSON()'s layers[0] is the (empty) input layer; layers[1]=hidden, layers[2]=output.
  // Verified against installed brain.js source this session (Common Pitfall #3).
  return {
    W1: json.layers[1].weights, b1: json.layers[1].biases,
    W2: json.layers[2].weights, b2: json.layers[2].biases,
  };
}

const weights = extractWeights(net.toJSON());
console.log(`Trained in ${status.iterations} iterations, final error ${status.error}`);

const output = `// GENERATED by admin/generate-weights.mjs -- do not hand-edit.
// Regenerate with: npm run generate-weights
export default ${JSON.stringify(weights, null, 2)};
`;
fs.writeFileSync(new URL('./weights.js', import.meta.url), output);
```

### Verified `train()` Single-Step Semantics (for reference during code review)

```javascript
// Empirically confirmed this session (see endsession-experiment findings above):
// train([oneExample], {iterations:1, learningRate:0.01}) performs EXACTLY one gradient step.
// Calling it a second time performs a SECOND, independent step (not a no-op, not re-running the
// same step) -- confirmed via before/after weight diffing across two sequential calls.
// Passing >1 examples in the array with iterations:1 trains ALL of them in that one call --
// this is why endSession must construct a data array with exactly ONE entry.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Assuming brain.js's `toJSON()` output shape matches an arbitrary downstream naming convention | Always inspect the installed package's actual `toJSON()`/`fromJSON()` implementation directly before writing an extraction/import function | This session (no prior project code touched this) | Prevented a silent, hard-to-debug shape mismatch (Common Pitfall #3) that no type system or test written against assumptions alone would have caught |

**Deprecated/outdated:** None — brain.js's beta.24 API surface is stable and unchanged; no newer
release exists to migrate toward.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `buildTarget`'s reinforcement-vs-soften-toward-uniform rule for `endSession`'s training target, derived from the spec's scalar "outcome label: 1/0" description applied to a 4-class softmax output — the spec never explicitly states how a binary outcome becomes a 4-element target vector | Pattern 4 / Code Examples | Medium — if the intended semantics differ (e.g. the correct behavior is to reinforce the OPPOSITE of the predicted class on abandonment, or use a different softening target), the learned-weight *direction* over many sessions could subtly diverge from what a domain expert intends. Low blast radius per-session (learning rate is 0.01, deliberately small per INF-04), but should be explicitly confirmed with the user before/during planning — this is the same class of ambiguity STATE.md already flags for Phase 5's "most-proximal signal" credit assignment, just one phase earlier and one level more fundamental (this is the *reward signal itself*, not just which signal gets credit) |
| A2 | 70/30 (not exactly 50/50) input blend recommended as the "deliberately ambiguous" Success-Criterion-2 stress test — a perfect 50/50 blend of two conflicting canonical signals produces a near-exact-tie result (empirically observed margin ~0.005-0.054 depending on config), which is arguably CORRECT behavior for genuine ambiguity but doesn't clearly demonstrate "wins with a real margin" the way the success criterion's wording implies | Summary / Code Examples | Low — purely a test-input-design choice; doesn't affect production code or trained weights, only which stress-test input the planner/executor should use to demonstrate Success Criterion 2 |
| A3 | `gradientStep()`'s hand-written backprop math (Pattern 4) should mirror brain.js's own `_calculateDeltasRelu` formula (`error = target - output` at the output layer, backpropagated through `W2`) — this was read from brain.js's source but not independently re-derived from first principles in this session | Pattern 4 / Common Pitfall #4 | Medium — if the hand-rolled `gradientStep` has a sign error or wrong chain-rule term, weight updates could push in the wrong direction over many sessions; recommend the planner add a unit test asserting `gradientStep`'s output on a known example matches brain.js's own `trainPattern()` result on an equivalently-configured net (dev-time cross-check only, not a runtime dependency) before trusting it in production |

## Open Questions

1. **What exactly is the {input, target} training pair for `endSession`'s single weight update?**
   - What we know: INF-04 and the spec text both describe the outcome label as a scalar (1/0), and
     D-03 confirms the function signature is `endSession(config, outcome)` with no explicit
     "which signal/input" parameter — implying `inference.js` must track its own "last relevant
     signal" state internally (as this research recommends via `lastInference`).
   - What's unclear: Whether "last signal this session" is the right credit-assignment choice (vs.
     e.g. "most confident signal this session," "first signal this session"), and whether the target
     vector construction (Assumption A1) should reinforce the predicted class on abandonment and
     soften toward uniform on completion, or some other rule entirely.
   - Recommendation: Implement this research's recommended rule (Pattern 4) as the default, but flag
     it explicitly to the user during planning/discuss-phase as a decision worth a deliberate
     confirmation, not a silent assumption — mirrors the already-accepted pattern for Phase 5's
     analogous multi-signal credit-assignment gap (STATE.md Blockers/Concerns).

2. **Should `inference:result`'s payload also pass through the originating signal's `bbox`/
   `targetSelector`/`scrollDepth`/`pathname` fields, for Phase 4's response-positioning needs?**
   - What we know: The spec's Response layer section says "Positioning: uses bbox from the signal
     payload" — implying Phase 4's `response.js` needs the ORIGINAL signal's bbox, not just the
     classification result. D-01 (locked) describes `inference:result`'s payload as containing "the
     full softmax vector, the predicted class, the confidence value, and a boolean fires flag" —
     it does not explicitly forbid additional pass-through fields, but also doesn't mention them.
   - What's unclear: Whether Phase 4 is expected to separately `subscribe('signal:detected', ...)`
     itself (correlating two independent bus events by timing/order) or whether `inference.js` should
     bundle the original signal's positioning fields into `inference:result` directly, sparing Phase
     4 a correlation problem.
   - Recommendation: Include `bbox`/`targetSelector`/`scrollDepth`/`pathname` (whichever apply to the
     originating signal type, following `signal.js`'s own `buildPayload` allow-list pattern) as
     pass-through fields alongside the fields D-01 already names — this is additive, doesn't
     re-litigate D-01's locked gating behavior, and avoids forcing Phase 4 to reconstruct a
     signal-to-inference correlation that `inference.js` already has for free (it just received the
     signal payload as its subscription argument). Flag for explicit confirmation during Phase 3
     planning since it slightly extends D-01's payload shape.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | `admin/generate-weights.mjs`, Vitest | Yes | v22.20.0 (confirmed in 01-RESEARCH.md, unchanged) | — |
| brain.js | Cold-start weight generation (dev-only) | Not yet installed — verified installable this session (`npm install brain.js@2.0.0-beta.24` succeeded in a scratch environment, 140 packages, no errors) | 2.0.0-beta.24 [VERIFIED: npm registry] | — |
| happy-dom / Vitest | Unit tests for `forwardPass`/`gradientStep`/confidence-gate logic | Yes | 20.10.6 / 4.1.10 (installed, Phase 1) | — |

**Missing dependencies with no fallback:** none — `brain.js` installs cleanly (verified this
session); all other tooling already present from Phase 1.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + happy-dom 20.10.6 (unchanged from Phase 1/2) |
| Config file | `vitest.config.js` (already exists, no changes needed — this phase's tests are pure-function unit tests, no DOM interaction) |
| Quick run command | `npx vitest run tests/inference.test.js tests/inference-endsession.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| INF-01 | `forwardPass` produces a 4-element `probs` vector summing to 1 for any valid input | unit (pure function, no DOM) | `npx vitest run tests/inference.test.js -t "INF-01"` | ❌ Wave 0 |
| INF-02 | `forwardPass`'s output for each canonical one-hot input matches manually-computed W1/b1→ReLU→W2/b2→softmax arithmetic (i.e. it really is explicit, not a wrapped brain.js call) | unit | `npx vitest run tests/inference.test.js -t "INF-02"` | ❌ Wave 0 |
| INF-03 | `confidence < 0.65` → `fires === false`; `confidence >= 0.65` → `fires === true` | unit | `npx vitest run tests/inference.test.js -t "INF-03"` | ❌ Wave 0 |
| INF-04 | Calling `endSession` once changes `activeWeights`; calling it a second time changes them again (not a no-op); no per-`signal:detected` weight change | unit (module-state before/after diffing, per this session's `endsession-experiment.mjs` pattern) | `npx vitest run tests/inference-endsession.test.js -t "INF-04"` | ❌ Wave 0 |
| INF-05 | With `config.inference.weights` absent, `initInference` uses `admin/weights.js`'s default; with it present, uses the injected value instead | unit | `npx vitest run tests/inference.test.js -t "INF-05"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/inference.test.js tests/inference-endsession.test.js`
- **Per wave merge:** `npx vitest run` (full suite, including Phase 1/2's existing tests)
- **Phase gate:** Full suite green, plus a manual verification step printing the full softmax vector
  for the 4 canonical inputs + the ambiguous stress-test input (Success Criterion 2's own literal
  instruction) and visually confirming margins are neither saturated nor uniform, before
  `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `tests/inference.test.js` — covers INF-01, INF-02, INF-03, INF-05
- [ ] `tests/inference-endsession.test.js` — covers INF-04 (kept in a separate file mirroring Phase
  2's precedent of isolating distinct-concern test suites)
- [ ] `brain.js@2.0.0-beta.24` devDependency install + `admin/generate-weights.mjs` script — needed
  before `admin/weights.js` can be generated; this is this phase's own Wave-0 prerequisite (no prior
  phase installed it)
- [ ] `package.json` — add `"generate-weights": "node admin/generate-weights.mjs"` script
- [ ] `config/schema.json` — optional `inference.{confidenceThreshold,weights}` fields (mirrors
  Phase 2's `signals.*` precedent)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth surface in inference computation |
| V3 Session Management | No | `endSession` is a naming coincidence with "session" — it is a pure computation trigger, not session/cookie management |
| V4 Access Control | No | No access-control boundary; single-tenant-per-page-load client code |
| V5 Input Validation | Yes | `forwardPass`'s inputs are always constructed internally by `oneHot()` from a fixed, closed set of 4 signal-type strings (never raw external/attacker input) — no new external input surface this phase; `config.inference.weights`, if present, is developer/build-time-injected config, not end-user input |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| A malformed/adversarial `config.inference.weights` (e.g. non-numeric entries, wrong-shaped arrays) causing `forwardPass` to throw or silently produce `NaN` probabilities that then mis-gate the confidence threshold | Tampering / Denial of Service | `config.js`'s existing hard-fail validator (CFG-02) is the natural place to add a shape check for `inference.weights` if it's present (e.g. verify `W1`/`W2` are arrays of arrays of numbers, correct dimensions) — flagged as a planner discretion item, not mandatory for v1 harness scope, but cheap defense-in-depth given `config.js`'s existing "hard-fail on invalid schema" pattern already generalizes to this |
| `softmax`'s `Math.exp()` overflow on unbounded/extreme weight values (e.g. from a corrupted persisted weights file in a future Phase-5 scenario) | Denial of Service (NaN propagation, not a crash) | Max-subtraction (already in the recommended `softmax()` implementation) handles the overflow direction; there is no equivalent guard against extremely large *negative* logits producing `0` probabilities across the board (all classes reading exactly `0`) — low risk given `endSession`'s learning rate is deliberately small (0.01) and bounded to one step per session, making runaway divergence unlikely within this harness's scope |

## Sources

### Primary (HIGH confidence)

- Direct source inspection of the installed `brain.js@2.0.0-beta.24` package (`dist/index.js`,
  `NeuralNetwork` class, lines 894–1762) — `train()`/`trainingTick()`/`trainPattern()`/`toJSON()`/
  `setActivation()`/`_runInputRelu()` all read directly, this session. Confidence: HIGH (primary
  artifact inspection, not documentation-derived).
- Empirical training experiments run against the installed package this session: 6-config sweep
  (`train-experiment.mjs`), 15-run reproducibility sweep per config (`repro-check.mjs`,
  `repro-check2.mjs`), single-step semantics verification (`endsession-experiment.mjs`), final
  recipe verification with cross-check against `net.run()` (`final-recipe.mjs`). All run in a
  scratch Node environment against `brain.js@2.0.0-beta.24`, not simulated or assumed.
- `npm view brain.js` (version, dist-tags, dependencies, peerDependencies, scripts.postinstall) —
  direct registry query, this session.
- `gsd-tools query package-legitimacy check --ecosystem npm brain.js` — seam-verified OK verdict,
  this session.
- `branch spec files/repo2_heed_sdk.txt` — canonical inference-layer architecture/forward-pass/
  weight-update/cold-start spec text.
- `.planning/phases/03-inference-layer-forward-pass-confidence-gate-cold-start-weig/03-CONTEXT.md`
  — locked decisions D-01 through D-04.
- `src/bus.js`, `src/signal.js`, `src/index.js`, `src/config.js`, `config/schema.json`,
  `config/demo-platform.json` — direct inspection of existing Phase 1-2 code this phase builds on.
- `.planning/phases/02-signal-capture-layer/02-RESEARCH.md` — prior phase's module-scoped-state and
  single-choke-point patterns, mirrored here for `lastInference`/`activeWeights`.

### Secondary (MEDIUM confidence)

- `.claude/CLAUDE.md`'s existing stack research on brain.js payload size and the
  training-vs-runtime-inference architecture split — corroborates this session's own
  finding that `endSession` must avoid importing brain.js at runtime.

### Tertiary (LOW confidence)

- None used for this phase's core findings — both flagged research blockers were resolved via
  direct primary-source inspection and empirical experimentation rather than secondary/web sources.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — brain.js version/registry facts directly verified; no new packages beyond
  the already-locked one dependency.
- Architecture: HIGH — the hand-written forward pass and cold-start training recipe were both
  empirically validated against the actual installed package this session (15/15 reproducibility on
  the recommended recipe), not merely inferred from documentation.
- Pitfalls: HIGH for the two originally-flagged blockers (train() semantics, weight-magnitude
  recipe) — both directly source-verified and empirically tested. MEDIUM for the `endSession`
  training-target-construction recommendation (Assumption A1) — this is this research's own
  synthesis, not something stated explicitly in the spec, and is flagged for explicit confirmation.

**Research date:** 2026-07-16
**Valid until:** 2026-08-15 (30 days — brain.js's API surface is stable/unchanged for ~2 years and
no newer release is expected; the empirical training-recipe findings are a property of the fixed
installed package version, not time-sensitive, so they remain valid as long as `brain.js@2.0.0-
beta.24` stays pinned).
