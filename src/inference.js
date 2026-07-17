// src/inference.js — the hand-written inference core (INF-01, INF-02). This
// file implements the ENTIRE runtime forward pass explicitly
// (W1/b1->ReLU->W2/b2->softmax) — no brain.js import anywhere in this file
// or reachable from it. brain.js is confined to admin/generate-weights.mjs
// (dev-only, build-time) per PROJECT.md's "training/weight-export only"
// decision (03-RESEARCH.md).

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
