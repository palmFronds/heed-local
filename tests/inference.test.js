// tests/inference.test.js — RED (Wave 0) unit suite for INF-01, INF-02,
// INF-03, INF-05. Imports src/inference.js, which does not exist yet -- this
// whole file fails to resolve until Plan 03-03/03-04 create it (mirrors
// tests/signal.test.js's RED-suite header + describe-per-requirement-ID
// convention, 03-PATTERNS.md).
//
// Fixture weights are defined IN this file (never imported from the
// generated cold-start weights module) so this suite stays fully
// independent of Plan 03-01's cold-start weight generator -- it locks the
// forwardPass/initInference CONTRACT, not any particular trained weight
// values.
import { describe, it, expect } from 'vitest';
import { forwardPass, relu, softmax, initInference } from '../src/inference.js';
import { publish, subscribe } from '../src/bus.js';

// Canonical class order (repo2_heed_sdk.txt / 03-RESEARCH.md Pattern 2) --
// used only for readability/assertions in this file, never imported from
// src/inference.js (CLASSES is internal, not part of the exported API).
const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// A generic, hand-authored weight fixture mixing positive/negative values --
// used for INF-01's shape/property assertions (sum-to-1, all entries in
// [0,1]) where exact numeric output doesn't matter, only that forwardPass
// produces a valid probability distribution for ANY input.
const GENERIC_WEIGHTS = {
  W1: [
    [0.5, -0.3, 0.2, 0.1],
    [-0.4, 0.6, -0.1, 0.3],
    [0.2, 0.1, -0.5, 0.4],
    [-0.1, 0.2, 0.3, -0.6],
  ],
  b1: [0.1, -0.2, 0.05, 0.0],
  W2: [
    [0.3, -0.2, 0.5, 0.1],
    [-0.1, 0.4, 0.2, -0.3],
    [0.2, 0.1, -0.4, 0.5],
    [0.4, -0.3, 0.1, 0.2],
  ],
  b2: [0.0, 0.1, -0.1, 0.05],
};

// A hand-authored fixture specifically designed to exercise the ReLU
// nonlinearity (hidden units 2 and 4 have negative pre-activation sums and
// must be zeroed). INF-02 checks forwardPass's output against values
// computed offline (via `node -e`, transcript in 03-02-SUMMARY.md) from this
// EXACT W1/b1->ReLU->W2/b2->softmax arithmetic, proving the forward pass is
// genuinely explicit rather than a wrapped brain.js .run() call (a brain.js
// call would not expose matching intermediate hidden/logits values, and
// brain.js has no softmax output layer at all -- 03-RESEARCH.md).
const INF02_WEIGHTS = {
  W1: [
    [1, -1, 0, 0],
    [-1, 1, 0, 0],
    [0, 0, 1, -1],
    [0, 0, -1, 1],
  ],
  b1: [0.5, -0.5, 0.5, -0.5],
  W2: [
    [2, 0, 0, 0],
    [0, 2, 0, 0],
    [0, 0, 2, 0],
    [0, 0, 0, 2],
  ],
  b2: [0, 0, 0, 0],
};

// All-zero weights -- every hidden/logit value is exactly 0, so softmax
// necessarily produces a perfectly uniform [0.25,0.25,0.25,0.25]
// distribution: max probability 0.25, well below the 0.65 default
// confidenceThreshold (INF-03's below-threshold case).
const LOW_CONFIDENCE_WEIGHTS = {
  W1: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  b1: [0, 0, 0, 0],
  W2: [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  b2: [0, 0, 0, 0],
};

// Identity hidden layer + a large output weight on class 0 -- for a
// touch_hesitation input ([1,0,0,0]), this drives logits to [10,0,0,0],
// producing an unambiguous (probability ~0.9999) softmax winner, well above
// the 0.65 threshold (INF-03's above-threshold case; also reused by INF-05
// as the "injected weights win" fixture).
const HIGH_CONFIDENCE_WEIGHTS = {
  W1: [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ],
  b1: [0, 0, 0, 0],
  W2: [
    [10, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  b2: [0, 0, 0, 0],
};

function touchHesitationSignal() {
  return {
    type: 'touch_hesitation',
    targetSelector: '[data-heed="proceed-cta"]',
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    timestamp: Date.now(),
  };
}

// Subscribes to 'inference:result' and returns the array it appends received
// payloads to -- mirrors tests/fixtures/test-subscriber.js's
// collectReceived() shape, but for inference:result rather than
// signal:detected. inference.js CONSUMES signal:detected and PRODUCES
// inference:result -- the inverse of what test-subscriber.js's fixture
// (built to capture signal.js's own output) subscribes to -- so it cannot be
// reused verbatim here.
function collectInferenceResults() {
  const received = [];
  subscribe('inference:result', (payload) => received.push(payload));
  return received;
}

describe('INF-01', () => {
  // Deliberately the FIRST call to initInference() anywhere in this file:
  // exactly one signal:detected subscription can exist inside inference.js
  // at this point regardless of whether initInference guards re-subscription
  // across repeat calls (03-PATTERNS.md's "subscribe exactly once per init"
  // recommendation) -- making the "exactly one" count assertion below robust
  // to either implementation choice.
  it('D-01: every signal:detected yields exactly one inference:result carrying intent, confidence, probs, and fires', () => {
    const received = collectInferenceResults();
    initInference({ inference: { weights: GENERIC_WEIGHTS, confidenceThreshold: 0.65 } });

    publish('signal:detected', touchHesitationSignal());

    expect(received).toHaveLength(1);
    const [result] = received;
    expect(typeof result.intent).toBe('string');
    expect(CLASSES).toContain(result.intent);
    expect(typeof result.confidence).toBe('number');
    expect(Array.isArray(result.probs)).toBe(true);
    expect(result.probs).toHaveLength(4);
    expect(typeof result.fires).toBe('boolean');
  });

  it('forwardPass returns a probs array of length 4 summing to ~1, all entries in [0,1], for any valid input vector', () => {
    const inputs = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
      [0, 0, 0, 0],
      [0.5, 0.5, 0, 0],
    ];

    for (const input of inputs) {
      const { probs } = forwardPass(input, GENERIC_WEIGHTS);
      expect(probs).toHaveLength(4);
      expect(Math.abs(sum(probs) - 1)).toBeLessThan(1e-9);
      for (const p of probs) {
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('INF-02', () => {
  it('relu zeroes negative inputs and passes through non-negative inputs unchanged', () => {
    expect(relu(-5)).toBe(0);
    expect(relu(0)).toBe(0);
    expect(relu(3.5)).toBe(3.5);
  });

  it('softmax of an all-zero logit vector is exactly uniform (a direct, no-nonlinearity sanity check)', () => {
    expect(softmax([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });

  it("forwardPass's hidden/logits/probs match values computed offline from the exact W1/b1->ReLU->W2/b2->softmax arithmetic -- proving the forward pass is genuinely explicit, not a wrapped brain.js call", () => {
    // Reference values computed offline via `node -e` against this EXACT
    // INF02_WEIGHTS fixture and input (transcript in 03-02-SUMMARY.md) --
    // not derived by calling forwardPass/relu/softmax themselves.
    const input = [1, 0, 0, 0];
    const result = forwardPass(input, INF02_WEIGHTS);

    expect(result.hidden).toEqual([1.5, 0, 0.5, 0]);
    expect(result.logits).toEqual([3, 0, 1, 0]);
    expect(result.probs[0]).toBeCloseTo(0.8097759915236521, 9);
    expect(result.probs[1]).toBeCloseTo(0.04031637265264288, 9);
    expect(result.probs[2]).toBeCloseTo(0.10959126317106235, 9);
    expect(result.probs[3]).toBeCloseTo(0.04031637265264288, 9);
  });
});

describe('INF-03', () => {
  it('publishes fires: false when the max softmax probability is below the 0.65 confidenceThreshold', () => {
    const received = collectInferenceResults();
    initInference({ inference: { weights: LOW_CONFIDENCE_WEIGHTS, confidenceThreshold: 0.65 } });

    publish('signal:detected', touchHesitationSignal());

    const result = received[received.length - 1];
    expect(result).toBeDefined();
    expect(Math.max(...result.probs)).toBeLessThan(0.65);
    expect(result.fires).toBe(false);
  });

  it('publishes fires: true when the max softmax probability is at or above the 0.65 confidenceThreshold', () => {
    const received = collectInferenceResults();
    initInference({ inference: { weights: HIGH_CONFIDENCE_WEIGHTS, confidenceThreshold: 0.65 } });

    publish('signal:detected', touchHesitationSignal());

    const result = received[received.length - 1];
    expect(result).toBeDefined();
    expect(Math.max(...result.probs)).toBeGreaterThanOrEqual(0.65);
    expect(result.fires).toBe(true);
  });
});

describe('INF-05', () => {
  it('initInference uses config.inference.weights when present -- a signal produces the probs those injected weights imply', () => {
    const received = collectInferenceResults();
    initInference({ inference: { weights: HIGH_CONFIDENCE_WEIGHTS, confidenceThreshold: 0.65 } });

    publish('signal:detected', touchHesitationSignal());

    // touch_hesitation is the first entry in the canonical signal-type order
    // (03-RESEARCH.md Pattern 2's SIGNAL_ORDER), so its one-hot input is
    // [1,0,0,0]. forwardPass is the exported source of truth for what
    // HIGH_CONFIDENCE_WEIGHTS implies for that input (INF-02 already proves
    // forwardPass's arithmetic is correct independently).
    const expected = forwardPass([1, 0, 0, 0], HIGH_CONFIDENCE_WEIGHTS);
    const result = received[received.length - 1];
    expect(result).toBeDefined();
    expect(result.probs[0]).toBeCloseTo(expected.probs[0], 9);
  });

  it('initInference with no config.inference.weights still yields a valid distribution summing to 1 (the bundled cold-start default)', () => {
    // No import of the generated cold-start weights module anywhere in this
    // file -- this asserts the SHAPE of the fallback (a valid distribution),
    // not its specific numeric values, keeping this suite independent of
    // Plan 03-01's generated weights (which are non-reproducible
    // byte-for-byte across regenerations, per 03-01-SUMMARY.md).
    const received = collectInferenceResults();
    initInference({});

    publish('signal:detected', touchHesitationSignal());

    const result = received[received.length - 1];
    expect(result).toBeDefined();
    expect(result.probs).toHaveLength(4);
    expect(Math.abs(sum(result.probs) - 1)).toBeLessThan(1e-6);
  });
});
