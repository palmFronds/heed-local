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

// INF-05: cold-start default until config injects learned weights. Reset on
// every initInference() call (config-injected wins over the bundled
// default), mirroring signal.js's existing per-call state-reset precedent
// (attachListeners resets flowCompleteFlag every call).
let activeWeights = coldStartWeights;
// Remembers the last prediction so plan 03-04's endSession (called later,
// with no signal payload of its own) has an input to train on — mirrors
// signal.js's lastPathname/flowCompleteFlag module-state pattern.
let lastInference = null;
// Guards the one-time signal:detected subscription (mirrors
// initSignalCapture's observer/popstate double-registration guard) — repeat
// initInference() calls must never accumulate duplicate subscribe handlers.
let initialized = false;

/**
 * SDK entry point for the inference layer: loads cold-start (or
 * config-injected) weights and wires signal:detected -> forward pass ->
 * confidence gate -> inference:result. Safe to call repeatedly — weights are
 * re-resolved every call (INF-05), but the bus subscription is registered at
 * most once.
 * @param {*} config
 */
export function initInference(config) {
  // INF-05: config-injected learned weights win over the bundled cold-start
  // default. Phase 5 owns *writing* config.inference.weights from a
  // persisted file; this phase only reads it. Re-evaluated EVERY call (not
  // just the first) so a later initInference(config) with fresh weights
  // takes effect immediately.
  activeWeights = config.inference?.weights ?? coldStartWeights;

  if (initialized) return; // never stack a second signal:detected subscription
  initialized = true;

  subscribe('signal:detected', (payload) => {
    const input = oneHot(payload.type);
    const { probs } = forwardPass(input, activeWeights);
    const predictedIdx = argmax(probs);
    const confidence = probs[predictedIdx];
    const threshold = config.inference?.confidenceThreshold ?? 0.65;
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
