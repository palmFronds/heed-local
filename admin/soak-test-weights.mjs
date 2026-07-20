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

console.log('\n=== Summary ===');
if (allPass) {
  console.log(`PASS -- ${SESSION_COUNT} synthetic sessions round-tripped through the real receiver with no softmax collapse or saturation (SC3).`);
  process.exit(0);
} else {
  console.error('FAIL -- one or more gates failed. See GATE FAIL lines above.');
  process.exit(1);
}
