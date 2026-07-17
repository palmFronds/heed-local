// admin/print-softmax-margins.mjs -- dev-only, run via `node admin/print-softmax-margins.mjs`,
// NEVER imported by src/. Success Criterion 2's explicit, numerically-gated verification: prints
// the full softmax vector for each of the 4 canonical cold-start mappings plus one deliberately
// ambiguous blended input, and asserts the winning class + margin are "real" (not saturated
// toward ~1.0, not collapsed toward the uniform ~0.25-each distribution) -- 03-RESEARCH.md's
// empirically observed 0.21-0.35 margin range for the canonical recipe operationalized as a
// concrete, script-enforced gate rather than an implicit assertion buried in a unit test.
import { forwardPass } from '../src/inference.js';
import weights from './weights.js';

// CLASSES and SIGNAL_ORDER are module-scoped (not exported) constants in src/inference.js, so
// both are re-declared here matching that file's values exactly (03-RESEARCH.md Pattern 2 --
// order MUST match admin/generate-weights.mjs's canonicalData input/output order or
// classification silently breaks).
const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];
const SIGNAL_ORDER = ['touch_hesitation', 'blur_incomplete', 'scroll_reversal', 'back_intent'];

// Domain-knowledge mapping this cold-start recipe encodes (PROJECT.md Active Requirements):
// touch_hesitation -> confusion, blur_incomplete -> flow_friction,
// scroll_reversal -> price_doubt, back_intent -> trust_gap.
const CANONICAL_VECTORS = [
  { label: 'touch_hesitation', input: [1, 0, 0, 0], expectedClass: 'confusion' },
  { label: 'blur_incomplete', input: [0, 1, 0, 0], expectedClass: 'flow_friction' },
  { label: 'scroll_reversal', input: [0, 0, 1, 0], expectedClass: 'price_doubt' },
  { label: 'back_intent', input: [0, 0, 0, 1], expectedClass: 'trust_gap' },
];

// 70/30 blend (NOT exactly 50/50, which produces a near-exact tie that doesn't clearly
// demonstrate a real margin -- 03-RESEARCH.md Assumption A2) of two conflicting canonical
// signals: mostly touch_hesitation, some blur_incomplete.
const AMBIGUOUS_VECTOR = { label: 'ambiguous (70% touch_hesitation / 30% blur_incomplete)', input: [0.7, 0.3, 0, 0] };

function argmax(arr) {
  let best = 0;
  for (let i = 1; i < arr.length; i++) if (arr[i] > arr[best]) best = i;
  return best;
}

function margin(probs) {
  const sorted = [...probs].sort((a, b) => b - a);
  return sorted[0] - sorted[1];
}

function printVector({ label, input }) {
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

console.log('=== Success Criterion 2: softmax margin quality ===');
console.log(`SIGNAL_ORDER: [${SIGNAL_ORDER.join(', ')}]`);
console.log(`CLASSES:      [${CLASSES.join(', ')}]`);

let allPass = true;

for (const vector of CANONICAL_VECTORS) {
  const result = printVector(vector);

  const classCorrect = result.winningClass === vector.expectedClass;
  const notSaturated = result.topProb < 0.98;
  const realMargin = result.margin >= 0.05;

  if (!classCorrect) {
    console.error(
      `  GATE FAIL: expected winning class "${vector.expectedClass}", got "${result.winningClass}"`,
    );
    allPass = false;
  }
  if (!notSaturated) {
    console.error(`  GATE FAIL: top probability ${result.topProb.toFixed(4)} is >= 0.98 (saturated)`);
    allPass = false;
  }
  if (!realMargin) {
    console.error(`  GATE FAIL: margin ${result.margin.toFixed(4)} is < 0.05 (collapsed toward uniform)`);
    allPass = false;
  }
  if (classCorrect && notSaturated && realMargin) {
    console.log('  GATE PASS');
  }
}

// The ambiguous input is printed for human inspection only -- genuine ambiguity (no single
// canonical class dominating with a large margin) is expected here, not a bug, so it is NOT
// gated to a specific winning class.
printVector(AMBIGUOUS_VECTOR);

console.log('\n=== Summary ===');
if (allPass) {
  console.log('PASS -- all 4 canonical mappings classify correctly with a real, non-saturated, non-uniform margin.');
  process.exit(0);
} else {
  console.error('FAIL -- one or more canonical mappings failed the margin-quality gate. See GATE FAIL lines above.');
  process.exit(1);
}
