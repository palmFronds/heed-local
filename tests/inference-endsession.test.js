// tests/inference-endsession.test.js — RED (Wave 0) unit suite for INF-04.
// Imports src/inference.js, which does not exist yet -- this whole file
// fails to resolve until Plan 03-04 creates endSession/gradientStep (mirrors
// tests/signal.test.js's RED-suite header convention). Kept in a separate
// file from tests/inference.test.js per 03-RESEARCH.md's explicit
// "isolate distinct-concern test suites" precedent (Phase 2's
// signal.test.js / signal-spa.test.js split).
//
// Outcomes are passed as synthetic booleans (true=flowComplete,
// false=abandoned) directly to endSession -- no live flow, no DOM (D-03).
import { describe, it, expect } from 'vitest';
import { initInference, endSession, forwardPass } from '../src/inference.js';
import { publish, subscribe } from '../src/bus.js';

// A generic, hand-authored weight fixture mixing positive/negative values --
// not imported from the generated cold-start weights module, keeping this
// suite independent of Plan 03-01's generated cold-start weights.
const WEIGHTS = {
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

function touchHesitationSignal() {
  return {
    type: 'touch_hesitation',
    targetSelector: '[data-heed="proceed-cta"]',
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    timestamp: Date.now(),
  };
}

// Subscribes to 'inference:result' and returns the array it appends received
// payloads to -- see tests/inference.test.js for the identical helper; not
// shared/imported across the two files so each RED suite stays
// self-contained and independently readable.
function collectInferenceResults() {
  const received = [];
  subscribe('inference:result', (payload) => received.push(payload));
  return received;
}

describe('INF-04', () => {
  it('endSession before any signal has fired this session is a safe no-op (lastInference null path)', () => {
    // First initInference() call in this file -- module state starts clean.
    const config = { inference: { weights: WEIGHTS, confidenceThreshold: 0.65 } };
    initInference(config);

    // No signal:detected has been published yet -- lastInference is null.
    expect(() => endSession(config, false)).not.toThrow();

    // Probe: a signal published AFTER the no-op endSession call should still
    // classify using the untouched initial weights (the same numbers
    // forwardPass produces directly against WEIGHTS) -- proving endSession
    // did not mutate activeWeights when there was nothing to train on.
    const received = collectInferenceResults();
    publish('signal:detected', touchHesitationSignal());
    const result = received[received.length - 1];
    const expected = forwardPass([1, 0, 0, 0], WEIGHTS);

    expect(result.probs[0]).toBeCloseTo(expected.probs[0], 9);
  });

  it('each endSession call performs a genuine, independent weight update; plain signal:detected events alone never mutate weights', () => {
    const config = { inference: { weights: WEIGHTS, confidenceThreshold: 0.65 } };
    initInference(config);
    const received = collectInferenceResults();

    // Baseline: publish the SAME signal twice with no endSession call in
    // between -- probs must be IDENTICAL both times (INF-04's core
    // guarantee: forward-pass-only traffic never mutates weights; the
    // update fires at session end only, never per-event).
    publish('signal:detected', touchHesitationSignal());
    const probsBefore = received[received.length - 1].probs;
    publish('signal:detected', touchHesitationSignal());
    const probsStillBefore = received[received.length - 1].probs;
    expect(probsStillBefore).toEqual(probsBefore);

    // One endSession call (session outcome: abandoned) must perform exactly
    // one bounded gradient step, observably changing the weights the
    // forward pass reads.
    endSession(config, false);
    publish('signal:detected', touchHesitationSignal());
    const probsAfterFirstEndSession = received[received.length - 1].probs;
    expect(probsAfterFirstEndSession).not.toEqual(probsBefore);

    // A second endSession call must be a genuine SECOND independent step
    // (not a cached/no-op repeat of the first) -- probs must change AGAIN,
    // not settle back to probsBefore or stay pinned at
    // probsAfterFirstEndSession.
    endSession(config, false);
    publish('signal:detected', touchHesitationSignal());
    const probsAfterSecondEndSession = received[received.length - 1].probs;
    expect(probsAfterSecondEndSession).not.toEqual(probsAfterFirstEndSession);
  });
});
