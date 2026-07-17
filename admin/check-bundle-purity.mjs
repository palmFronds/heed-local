// admin/check-bundle-purity.mjs -- dev-only, run via `node admin/check-bundle-purity.mjs`,
// NEVER imported by src/. Confirms the shipped dist/sdk.js (esbuild's bundled output) contains
// none of brain.js's characteristic internals -- brain.js is confined to
// admin/generate-weights.mjs (dev-only, build-time, D-04) and must NEVER leak into the
// partner-facing runtime bundle (03-RESEARCH.md Common Pitfall #4: importing brain.js anywhere
// reachable from src/index.js's import graph would pull its ~1MB+ unminified UMD bundle into
// dist/sdk.js).
import fs from 'node:fs';

const BUNDLE_PATH = new URL('../dist/sdk.js', import.meta.url);

// Characteristic brain.js internals -- present in its UMD bundle regardless of which class is
// used (NeuralNetwork, NeuralNetworkGPU, RNN, etc.), so a match here proves brain.js leaked into
// the build even if only a small corner of its API was reachable.
const FORBIDDEN_STRINGS = ['NeuralNetworkGPU', 'thaw'];

let bundle;
try {
  bundle = fs.readFileSync(BUNDLE_PATH, 'utf8');
} catch (err) {
  console.error(`[check-bundle-purity] Could not read dist/sdk.js -- run \`npm run build\` first.`);
  console.error(err.message);
  process.exit(1);
}

const found = FORBIDDEN_STRINGS.filter((needle) => bundle.includes(needle));

if (found.length > 0) {
  console.error(
    `[check-bundle-purity] FAIL -- dist/sdk.js contains brain.js internals: ${found.join(', ')}`,
  );
  console.error(
    '[check-bundle-purity] brain.js must remain confined to admin/generate-weights.mjs (dev-only) -- check src/index.js\'s import graph for an accidental brain.js import.',
  );
  process.exit(1);
}

console.log(
  `[check-bundle-purity] PASS -- dist/sdk.js is free of brain.js internals (${bundle.length} bytes).`,
);
process.exit(0);
