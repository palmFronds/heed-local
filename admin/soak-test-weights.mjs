// admin/soak-test-weights.mjs -- dev-only, run via `node admin/soak-test-weights.mjs`
// (npm run soak-test), NEVER imported by src/. Requires `npm run receiver` running
// (local-receiver/server.js) on http://localhost:4310 -- this is D-08's soak-test
// methodology: drives 10-20 synthetic sessions through the REAL learning loop
// (endSession() -> POST -> receiver atomic write -> GET readback -> initInference
// with those weights -> next session), proving SC3 (softmax margins stay real, no
// collapse/saturation, across many updates) and SC2 (persisted weights ARE what a
// cold-start restart would load -- the deterministic GET-readback gate below).
import { forwardPass, initInference, endSession } from '../src/inference.js';
import { publish } from '../src/bus.js';
import coldStartWeights from './weights.js';
// Reused (not re-implemented) for the SC2 GET-readback shape check below --
// isValidWeights is a boolean-returning, never-throwing validator (D-06's
// receiver-side posture); importing local-receiver/server.js is safe here
// since its .listen() call is guarded behind an isMain check (only runs when
// invoked directly as `node local-receiver/server.js`), so this import never
// binds a port.
import { isValidWeights } from '../local-receiver/server.js';

// CLASSES and SIGNAL_ORDER are module-scoped (not exported) constants in
// src/inference.js, so both are re-declared here matching that file's values
// exactly (mirrors admin/print-softmax-margins.mjs's precedent) -- order MUST
// match admin/generate-weights.mjs's canonicalData input/output order or
// classification silently breaks.
const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];
const SIGNAL_ORDER = ['touch_hesitation', 'blur_incomplete', 'scroll_reversal', 'back_intent'];

// The 4 canonical one-signal-active input vectors -- same recipe
// admin/print-softmax-margins.mjs verifies at cold start.
const CANONICAL_VECTORS = [
  { label: 'touch_hesitation', input: [1, 0, 0, 0] },
  { label: 'blur_incomplete', input: [0, 1, 0, 0] },
  { label: 'scroll_reversal', input: [0, 0, 1, 0] },
  { label: 'back_intent', input: [0, 0, 0, 1] },
];

// Matches config/demo-platform.json's weightPushUrl and local-receiver/server.js's
// default listen port (D-04/D-05 discretion, kept consistent across the phase).
const RECEIVER_URL = 'http://localhost:4310/weights';
const SESSION_COUNT = 16; // within D-08's 10-20 session range

function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

function margin(probs) {
  const sorted = [...probs].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
}

// Code review WR-04: normalizes {W1,b1,W2,b2} key order explicitly before
// stringifying, so this comparison is correct regardless of the incidental
// key order either object was constructed with -- JSON.stringify's output
// is key-order-dependent, and relying on that incidentally (both objects
// here happen to always be built with the same {W1,b1,W2,b2} order today)
// would silently produce a false "differs"/"identical" result the day any
// future code constructs a weights object with keys in a different order.
function stableWeightsKey(w) {
  return JSON.stringify({ W1: w.W1, b1: w.b1, W2: w.W2, b2: w.b2 });
}

// Generalized over admin/print-softmax-margins.mjs's printVector: accepts an
// explicit `weights` argument so it can print cold-start ("before") and
// persisted/post-soak ("after") vectors from the same helper.
function printVector({ label, input }, weights) {
  const { probs } = forwardPass(input, weights);
  const winningIdx = argmax(probs);
  const winningClass = CLASSES[winningIdx];
  const m = margin(probs);
  console.log(`\n${label}`);
  console.log(`  input:  [${input.join(', ')}]`);
  console.log(`  probs:  [${probs.map((p) => p.toFixed(4)).join(', ')}]`);
  console.log(`  winner: ${winningClass} (top prob ${probs[winningIdx].toFixed(4)})`);
  console.log(`  margin: ${m.toFixed(4)}`);
  return { probs, winningClass, topProb: probs[winningIdx], margin: m };
}

// Seeds lastInference by publishing a synthetic signal:detected on the same bus
// src/inference.js subscribes to -- mirrors tests/inference-endsession.test.js's
// seeding pattern, so endSession() has a prediction to reinforce. bbox/timestamp
// only, no field values/identity (CLAUDE.md No-PII).
function seedSignal(signalType) {
  publish('signal:detected', {
    type: signalType,
    targetSelector: '[data-heed="proceed-cta"]',
    bbox: { x: 0, y: 0, width: 10, height: 10 },
    timestamp: Date.now(),
  });
}

let allPass = true;

console.log('=== Phase 5 soak test: weight-push learning loop (SC3 + SC2) ===');
console.log(`Sessions: ${SESSION_COUNT}, receiver: ${RECEIVER_URL}`);
console.log(`SIGNAL_ORDER: [${SIGNAL_ORDER.join(', ')}]`);
console.log(`CLASSES:      [${CLASSES.join(', ')}]`);

console.log('\n--- BEFORE (cold-start weights) ---');
for (const vector of CANONICAL_VECTORS) printVector(vector, coldStartWeights);

let currentWeights = coldStartWeights;

for (let i = 0; i < SESSION_COUNT; i++) {
  const signalType = SIGNAL_ORDER[i % SIGNAL_ORDER.length]; // varied signal, round-robin
  const outcome = i % 2 === 0; // varied outcome, alternating flowComplete/abandoned

  const config = { inference: { weights: currentWeights, confidenceThreshold: 0.4 } };
  initInference(config);
  seedSignal(signalType);
  const updated = endSession(config, outcome);

  let response;
  try {
    // Awaited, not fire-and-forget (05-RESEARCH.md D-08 note) -- persistence must
    // round-trip through the real receiver before the next session's "before" state
    // (and the final "after"/GET-readback comparison) is trustworthy.
    response = await fetch(RECEIVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  } catch (err) {
    console.error(`\nFATAL: could not reach the receiver at ${RECEIVER_URL} -- is \`npm run receiver\` running?`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
  if (!response.ok) {
    console.error(`\nFATAL: receiver rejected session ${i + 1}'s POST (status ${response.status})`);
    process.exit(1);
  }

  currentWeights = updated; // feed learned weights forward into the next session
}

console.log(`\n--- AFTER (${SESSION_COUNT} sessions later) ---`);
const afterResults = CANONICAL_VECTORS.map((vector) => ({ vector, result: printVector(vector, currentWeights) }));

console.log('\n--- SC3 gate: no softmax collapse or saturation after the soak ---');
for (const { vector, result } of afterResults) {
  const notSaturated = result.topProb < 0.98;
  const notCollapsed = result.margin >= 0.02;
  if (!notSaturated) {
    console.error(`  GATE FAIL (${vector.label}): top probability ${result.topProb.toFixed(4)} is >= 0.98 (saturated)`);
    allPass = false;
  }
  if (!notCollapsed) {
    console.error(`  GATE FAIL (${vector.label}): margin ${result.margin.toFixed(4)} is < 0.02 (collapsed toward uniform)`);
    allPass = false;
  }
  if (notSaturated && notCollapsed) {
    console.log(`  GATE PASS (${vector.label})`);
  }
}

// SC2 -- the deterministic verification of "restarting the harness loads learned,
// not cold-start, weights" (05-RESEARCH.md Open Question #2 resolution). Reads the
// persisted weights back through the receiver's GET /weights endpoint -- the SAME
// endpoint the 05-04 harness bootstrap fetches before init() -- and proves (a) the
// response is a valid {W1,b1,W2,b2} shape, (b) it DIFFERS from cold-start defaults
// (a restart would not silently reload admin/weights.js), and (c) it losslessly
// reproduces the in-memory "after" margins computed above (the persistence
// round-trip did not lose or corrupt anything). Does NOT re-run the soak loop --
// only reads back and asserts against the state Task 1's loop already produced.
console.log('\n--- SC2 gate: persisted weights are what a cold-start restart would load ---');
let getResponse;
try {
  getResponse = await fetch(RECEIVER_URL);
} catch (err) {
  console.error(`\nFATAL: GET readback failed -- could not reach the receiver at ${RECEIVER_URL}`);
  console.error(`  ${err.message}`);
  process.exit(1);
}

if (!getResponse.ok) {
  console.error(`  GATE FAIL: GET ${RECEIVER_URL} returned status ${getResponse.status}`);
  allPass = false;
} else {
  const persisted = await getResponse.json();

  if (!isValidWeights(persisted)) {
    console.error('  GATE FAIL: persisted weights returned by GET /weights are not a valid {W1,b1,W2,b2} shape');
    allPass = false;
  } else {
    const differsFromColdStart = stableWeightsKey(persisted) !== stableWeightsKey(coldStartWeights);
    if (!differsFromColdStart) {
      console.error('  GATE FAIL: persisted weights are byte-identical to cold-start defaults -- a restart would NOT load learned weights');
      allPass = false;
    } else {
      console.log('  GATE PASS: persisted weights differ from cold-start defaults');
    }

    let roundTripLossless = true;
    const TOLERANCE = 1e-9;
    for (const { vector, result } of afterResults) {
      const persistedProbs = forwardPass(vector.input, persisted).probs;
      const persistedTopProb = persistedProbs[argmax(persistedProbs)];
      const persistedMargin = margin(persistedProbs);
      const topProbDiff = Math.abs(persistedTopProb - result.topProb);
      const marginDiff = Math.abs(persistedMargin - result.margin);
      if (topProbDiff > TOLERANCE || marginDiff > TOLERANCE) {
        console.error(
          `  GATE FAIL (${vector.label}): forwardPass against persisted weights diverges from the in-memory "after" result (topProb diff ${topProbDiff}, margin diff ${marginDiff})`,
        );
        roundTripLossless = false;
        allPass = false;
      }
    }
    if (roundTripLossless) {
      console.log('  GATE PASS: forwardPass against persisted weights losslessly reproduces the in-memory "after" margins');
    }
  }
}

console.log('\n=== Summary ===');
if (allPass) {
  console.log(`PASS -- ${SESSION_COUNT} synthetic sessions round-tripped through the real receiver with no softmax collapse or saturation (SC3), and the GET-readback proves persisted weights are learned + losslessly round-tripped (SC2).`);
  process.exit(0);
} else {
  console.error('FAIL -- one or more gates failed. See GATE FAIL lines above.');
  process.exit(1);
}
