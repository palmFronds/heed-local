// src/inference.js — the hand-written inference core (INF-01, INF-02). This
// file implements the ENTIRE runtime forward pass explicitly
// (W1/b1->ReLU->W2/b2->softmax) — no brain.js import anywhere in this file
// or reachable from it. brain.js is confined to admin/generate-weights.mjs
// (dev-only, build-time) per PROJECT.md's "training/weight-export only"
// decision (03-RESEARCH.md). Also wires initInference: subscribes to
// signal:detected, runs the forward pass, gates a `fires` flag on the 0.65
// confidence threshold (INF-03), and always publishes inference:result
// (D-01) — the confidence gate is never a gate on the publish itself.
import { publish, subscribe } from './bus.js';
import coldStartWeights from '../admin/weights.js';

/**
 * Rectified linear unit. Zeroes negative inputs, passes non-negative inputs
 * through unchanged.
 * @param {number} x
 * @returns {number}
 */
export function relu(x) {
  return x < 0 ? 0 : x;
}

/**
 * Numerically-stable softmax. Subtracts the max logit before exponentiating
 * (max-subtraction) so Math.exp() cannot overflow to Infinity for large
 * logits, which would otherwise produce NaN after normalization (T-03-03).
 * @param {number[]} logits
 * @returns {number[]} a probability distribution summing to 1
 */
export function softmax(logits) {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

/**
 * The explicit, hand-written forward pass (INF-01, INF-02) — never a wrapped
 * brain.js `.run()` call. Follows brain.js's own verified weight orientation
 * exactly: `weights[node][k]` is indexed [outputNodeIndex][inputNodeIndex],
 * so weights extracted from admin/weights.js (produced by
 * admin/generate-weights.mjs from brain.js's toJSON()) plug in directly with
 * no transpose step (03-RESEARCH.md Pattern 1).
 * @param {number[]} input - 4-element vector (one-hot per D-02 for real signals)
 * @param {{W1:number[][], b1:number[], W2:number[][], b2:number[]}} weights
 * @returns {{ probs: number[], hidden: number[], logits: number[] }} hidden
 *   and logits are returned (not just probs) because plan 03-04's
 *   gradientStep needs them for backprop.
 */
export function forwardPass(input, weights) {
  const { W1, b1, W2, b2 } = weights;
  const hidden = W1.map((row, i) => relu(row.reduce((sum, w, k) => sum + w * input[k], b1[i])));
  const logits = W2.map((row, i) => row.reduce((sum, w, k) => sum + w * hidden[k], b2[i]));
  const probs = softmax(logits);
  return { probs, hidden, logits };
}

// Canonical output-class order — MUST match admin/generate-weights.mjs's
// canonicalData output-vector order exactly, or the classification mapping
// silently breaks with no error (03-RESEARCH.md Pattern 2).
const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];
// Canonical input order — MUST match admin/generate-weights.mjs's
// canonicalData input-vector order exactly (same reasoning as CLASSES above).
const SIGNAL_ORDER = ['touch_hesitation', 'blur_incomplete', 'scroll_reversal', 'back_intent'];

/**
 * D-02: signal.js's payloads carry no continuous magnitude field, so each
 * incoming signal is classified as a one-hot vector — the node matching
 * signalType is 1, the other 3 are 0.
 * @param {string} signalType
 * @returns {number[]} 4-element one-hot vector
 */
function oneHot(signalType) {
  return SIGNAL_ORDER.map((t) => (t === signalType ? 1 : 0));
}

/**
 * @param {number[]} arr
 * @returns {number} index of the largest element
 */
function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

/**
 * Hard-fail shape validation for an externally (config-)injected weights
 * object — mirrors CFG-02's "hard-fail, never partial/silent" philosophy
 * (code review WR-01). Without this, a malformed injected weights object
 * would silently produce NaN through forwardPass, which argmax always
 * resolves to index 0 for — a silent, consistent misclassification instead
 * of a loud, immediate error. Never called against the bundled
 * admin/weights.js default, which is trusted/generated internally.
 * @param {*} weights
 */
function validateWeightsShape(weights) {
  const isMatrix = (m, rows, cols) =>
    Array.isArray(m) &&
    m.length === rows &&
    m.every((row) => Array.isArray(row) && row.length === cols && row.every((w) => typeof w === 'number' && Number.isFinite(w)));
  const isVector = (v, len) => Array.isArray(v) && v.length === len && v.every((x) => typeof x === 'number' && Number.isFinite(x));

  if (!weights || typeof weights !== 'object') {
    throw new Error('[heed] config.inference.weights must be an object with W1/b1/W2/b2');
  }
  if (!isMatrix(weights.W1, 4, 4)) throw new Error('[heed] config.inference.weights.W1 must be a 4x4 numeric array');
  if (!isVector(weights.b1, 4)) throw new Error('[heed] config.inference.weights.b1 must be a 4-element numeric array');
  if (!isMatrix(weights.W2, 4, 4)) throw new Error('[heed] config.inference.weights.W2 must be a 4x4 numeric array');
  if (!isVector(weights.b2, 4)) throw new Error('[heed] config.inference.weights.b2 must be a 4-element numeric array');
}

// INF-05: cold-start default until config injects learned weights. Reset on
// every initInference() call (config-injected wins over the bundled
// default), mirroring signal.js's existing per-call state-reset precedent
// (attachListeners resets flowCompleteFlag every call).
let activeWeights = coldStartWeights;
// Whole config object, reassigned on every initInference() call — read by
// the signal:detected handler below instead of closing over the `config`
// parameter directly, so confidenceThreshold (not just activeWeights)
// actually updates on repeat calls (code review CR-01 fix).
let activeConfig = null;
// Remembers the last prediction so plan 03-04's endSession (called later,
// with no signal payload of its own) has an input to train on — mirrors
// signal.js's lastPathname/flowCompleteFlag module-state pattern. Reset on
// every initInference() call (code review WR-03 fix) so a later re-init
// starts with a genuinely clean "no signal fired yet this session" state —
// otherwise a stale prior-session lastInference could feed the NEXT
// session's endSession() before any new signal has fired.
let lastInference = null;
// Guards the one-time signal:detected subscription (mirrors
// initSignalCapture's observer/popstate double-registration guard) — repeat
// initInference() calls must never accumulate duplicate subscribe handlers.
let initialized = false;

/**
 * Genuine (non-leaky) ReLU derivative — 1 where the post-activation hidden
 * value is positive, 0 otherwise (h > 0 iff the pre-activation sum was > 0,
 * since relu(x) = max(0, x)). Matches forwardPass's genuine ReLU (INF-02);
 * never the leaky-relu slope used only in admin/generate-weights.mjs's
 * training-time config (03-RESEARCH.md Pitfall #1) — leaky-relu is a
 * training-time trick confined to the build-time generator and must never
 * appear in this runtime backward pass.
 * @param {number} h - the POST-activation hidden value (relu(x))
 * @returns {number}
 */
function reluDerivative(h) {
  return h > 0 ? 1 : 0;
}

/**
 * Builds a single training target vector from a session outcome, applied to
 * the last predicted class this session. This is this phase's documented
 * interpretation of the spec's scalar outcome label (1/0) applied to a
 * 4-class softmax target (03-RESEARCH.md Assumption A1) — a recommended
 * default, not literal spec text, mirroring the already-accepted
 * "most-proximal signal" credit-assignment gap STATE.md flags for Phase 5.
 * @param {number} predictedIdx
 * @param {boolean} outcome - true if session completed (flowComplete),
 *   false if abandoned
 * @returns {number[]} 4-element target vector
 */
export function buildTarget(predictedIdx, outcome) {
  // Hard-fail on an unrecognized outcome rather than silently treating it as
  // "completed successfully" (code review WR-02) — matches this codebase's
  // established CFG-02 "hard-fail, never partial/silent" philosophy.
  if (typeof outcome !== 'boolean') {
    throw new TypeError('[heed] buildTarget: outcome must be a boolean (true = completed, false = abandoned)');
  }
  if (outcome === false) {
    // Abandoned: the predicted intent likely WAS the real blocker — reinforce it directly.
    return CLASSES.map((_, i) => (i === predictedIdx ? 1 : 0));
  }
  // Completed successfully: whatever intent was predicted did not block the user — soften
  // confidence in that specific prediction without asserting a different "correct" class.
  return CLASSES.map(() => 0.25);
}

/**
 * ONE hand-written backprop step, mathematically equivalent to brain.js's
 * own single trainPattern() step for a ReLU network, but with ZERO brain.js
 * import anywhere in this file (03-RESEARCH.md Common Pitfall #4 —
 * importing brain.js anywhere reachable from src/index.js's graph would
 * pull its ~1MB+ unminified UMD bundle into dist/sdk.js, defeating D-04's
 * "training/weight-export only" decision). Does NOT mutate the `weights`
 * parameter in place — returns a NEW {W1,b1,W2,b2} object in the same
 * shape forwardPass consumes, so it can be assigned straight back to
 * activeWeights.
 * @param {number[]} input
 * @param {number[]} target
 * @param {{W1:number[][], b1:number[], W2:number[][], b2:number[]}} weights
 * @param {number} learningRate
 * @returns {{W1:number[][], b1:number[], W2:number[][], b2:number[]}}
 */
export function gradientStep(input, target, weights, learningRate) {
  const { W1, b1, W2, b2 } = weights;
  const { probs, hidden } = forwardPass(input, weights);

  // Output-layer delta: the standard, exact softmax+cross-entropy gradient with respect to the
  // logits (matches brain.js's own "error = target - output at the output layer" framing when
  // probs is treated as that output).
  const deltaOutput = probs.map((p, j) => p - target[j]);

  // Hidden-layer delta: backpropagate deltaOutput through W2, then apply the GENUINE (non-leaky)
  // ReLU derivative — consistent with forwardPass's genuine ReLU (INF-02).
  const deltaHidden = hidden.map((h, i) => {
    const sum = deltaOutput.reduce((acc, dOut, j) => acc + W2[j][i] * dOut, 0);
    return sum * reluDerivative(h);
  });

  const newW2 = W2.map((row, j) => row.map((w, i) => w - learningRate * deltaOutput[j] * hidden[i]));
  const newB2 = b2.map((b, j) => b - learningRate * deltaOutput[j]);
  const newW1 = W1.map((row, i) => row.map((w, k) => w - learningRate * deltaHidden[i] * input[k]));
  const newB1 = b1.map((b, i) => b - learningRate * deltaHidden[i]);

  return { W1: newW1, b1: newB1, W2: newW2, b2: newB2 };
}

/**
 * SDK entry point for the inference layer: loads cold-start (or
 * config-injected) weights and wires signal:detected -> forward pass ->
 * confidence gate -> inference:result. Safe to call repeatedly — weights,
 * the confidence threshold, and the last-inference session state are all
 * re-resolved/reset every call (INF-05; code review CR-01/WR-03 fixes), but
 * the bus subscription itself is registered at most once.
 * @param {*} config
 */
export function initInference(config) {
  // INF-05: config-injected learned weights win over the bundled cold-start
  // default. Phase 5 owns *writing* config.inference.weights from a
  // persisted file; this phase only reads it. Re-evaluated EVERY call (not
  // just the first) so a later initInference(config) with fresh weights
  // takes effect immediately.
  if (config.inference?.weights) validateWeightsShape(config.inference.weights); // WR-01
  activeWeights = config.inference?.weights ?? coldStartWeights;
  // CR-01 fix: reassigned every call so the signal:detected handler below
  // (registered only once) reads a live confidenceThreshold instead of a
  // value frozen from whichever call first registered the subscription.
  activeConfig = config;
  // WR-03 fix: a fresh (re-)init starts with no "signal fired yet this
  // session" state — otherwise a stale prior session's lastInference could
  // silently feed the NEW session's first endSession() call.
  lastInference = null;

  if (initialized) return; // never stack a second signal:detected subscription
  initialized = true;

  subscribe('signal:detected', (payload) => {
    const input = oneHot(payload.type);
    const { probs } = forwardPass(input, activeWeights);
    const predictedIdx = argmax(probs);
    const confidence = probs[predictedIdx];
    const threshold = activeConfig.inference?.confidenceThreshold ?? 0.65;
    const fires = confidence >= threshold;

    lastInference = { input, predictedIdx }; // remembered for plan 03-04's endSession

    // D-01: publish UNCONDITIONALLY — fires is a flag on the payload, never
    // a gate on the publish call itself. Positioning fields (bbox/
    // targetSelector/scrollDepth/pathname) are additive pass-through from
    // the originating signal payload (03-RESEARCH.md Open Question #2) —
    // whichever exist on payload, null otherwise — sparing Phase 4's
    // response layer a signal-to-inference correlation problem. These
    // fields already passed signal.js's SIG-05 No-PII firewall before ever
    // reaching this module (T-03-06).
    publish('inference:result', {
      intent: CLASSES[predictedIdx],
      confidence,
      probs,
      fires,
      signalType: payload.type,
      timestamp: Date.now(),
      bbox: payload.bbox ?? null,
      targetSelector: payload.targetSelector ?? null,
      scrollDepth: payload.scrollDepth ?? null,
      pathname: payload.pathname ?? null,
    });
  });
}

/**
 * D-03: directly-callable, unit-testable session-end trigger. Performs
 * EXACTLY ONE bounded weight update (INF-04) — never call this per-event;
 * Phase 4 owns wiring the real flow_complete/flow_abandoned trigger, this
 * phase only exposes this function and verifies it via direct unit-test
 * invocation with a synthetic outcome. Safe no-op if no signal has fired
 * this session (lastInference is null). Does NOT reset lastInference after
 * running — a second endSession call with the same lastInference against
 * the now-updated activeWeights is expected to produce a second, distinct,
 * non-zero delta (03-RESEARCH.md's empirically-verified "two independent
 * single steps" train() semantics), not a no-op.
 * @param {*} config - reserved for a future config-driven learning-rate
 *   override; unused this phase (learning rate is hard-coded to 0.01 per
 *   INF-04's explicit requirement)
 * @param {boolean} outcome - true if flowComplete, false if abandoned
 */
export function endSession(config, outcome) {
  if (!lastInference) return; // no signal fired this session — nothing to reinforce

  const target = buildTarget(lastInference.predictedIdx, outcome);
  // Hand-rolled single gradient step — brain.js is NOT imported here, keeping it fully out of
  // the shipped bundle (PROJECT.md: training/weight-export only; 03-RESEARCH.md Pitfall #4).
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
}
