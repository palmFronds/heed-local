# Phase 5: Weight-Push Learning Loop - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 8 (2 new, 6 modified)
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `local-receiver/server.js` (new) | service (standalone Node HTTP server) | request-response + file I/O | No existing Node-server file in this repo — closest structural analog is `admin/generate-weights.mjs` / `admin/check-bundle-purity.mjs` (standalone `node admin/*.mjs` dev-tooling scripts with hard-fail-never-crash discipline) for style/comment conventions; validation shape comes from `src/inference.js`'s `validateWeightsShape()` | role-match (no direct role analog exists in-repo; pattern synthesized per RESEARCH.md Architecture Pattern 3) |
| `admin/soak-test-weights.mjs` (new) | utility / test script (batch, dev-only) | batch + request-response (POSTs through real receiver) | `admin/print-softmax-margins.mjs` | exact |
| `src/inference.js` (modify: `endSession` return) | service (core inference module) | CRUD-like (in-memory state mutation) | itself — additive one-line change, same file's own conventions | exact |
| `src/log.js` (modify: `finishSession`, add `pushWeights`) | service / event-driven (bus subscriber, session-lifecycle) | event-driven + request-response (fetch/sendBeacon) | itself — `writeLog()`'s single-choke-point discipline is the template for the new `pushWeights()` function | exact |
| `src/index.js` (modify: `initDemo` override param) | controller (SDK entry point / orchestrator) | request-response (sync init) | itself — additive optional-parameter change, same file's own conventions | exact |
| `test-harness/index.html` (modify: bootstrap script) | component (static harness page, inline script) | request-response (fetch before init) | itself — inline `<script>` block, same file's own conventions (D-08's `simulate*` functions show the harness's established real-event/async style) | exact |
| `config/schema.json` (modify: add `weightPushUrl`) | config (JSON Schema) | n/a | itself — mirrors existing optional-property pattern (e.g. `partnerOrigin`, `activeScreens`) | exact |
| `config/demo-platform.json` (modify: set `weightPushUrl`) | config (JSON data) | n/a | itself — sibling optional keys already set in same file | exact |
| `tests/local-receiver.test.js` (new) | test | request-response (unit, real Node `http`/`fetch` against a test-bound port) | `tests/inference-endsession.test.js` / `tests/log.test.js` (bus-mock + assertion style), but MUST use `// @vitest-environment node` override (not the project default `happy-dom`) per RESEARCH.md Pitfall 4 | role-match |

## Pattern Assignments

### `local-receiver/server.js` (new — service, request-response + file I/O)

**No direct in-repo analog for a Node HTTP server.** Closest stylistic analogs: `admin/generate-weights.mjs` (standalone dev script under `admin/`, run via `node admin/*.mjs`, never imported by `src/`) and `src/inference.js`'s `validateWeightsShape()` (the shape-validation discipline to mirror exactly, so anything that passes the receiver's GET also always passes the SDK's own validation).

**Validation shape to mirror** (`src/inference.js` lines 97-111):
```javascript
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
```
The receiver's `isValidWeights()` should mirror this exactly (same 4x4/4-element numeric-finite checks) but return a boolean rather than throw, since D-06 requires "never crash, keep last known-good" rather than hard-fail.

**Canonical weight shape** (`admin/weights.js`, full file — `[VERIFIED: codebase inspection]`):
```javascript
export default {
  "W1": [[0.27, 0.43, -0.05, -0.32], ...],
  "b1": [0.32, 0.22, 0.23, 0.51],
  "W2": [[0.46, -0.21, -0.38, -0.79], ...],
  "b2": [0.69, 0.00, 0.21, -0.17]
};
```
Note: `admin/weights.js` is an ES module (`export default {...}`); `local-receiver/weights.json` must be the raw JSON object only (no `export default` wrapper) — read via `fs.readFile` + `JSON.parse`, never `import`ed.

**Full server implementation to copy from** — RESEARCH.md Architecture Pattern 3 (`.planning/phases/05-weight-push-learning-loop/05-RESEARCH.md` lines 244-320) contains a complete, ready-to-copy `http.createServer` implementation: CORS (`Access-Control-Allow-Origin: *`, no credentials — required for `file://` opaque-origin callers per Pitfall 5), OPTIONS preflight short-circuit, `GET /weights` with on-disk shape re-validation, `POST /weights` with byte-capped body accumulation (`MAX_BODY_BYTES = 64 * 1024`), content-type-agnostic `JSON.parse` (must work for both `fetch`'s `application/json` and `sendBeacon`'s `text/plain` — Pitfall 3), and temp-file-then-`fs.rename` atomic write. Use that block verbatim as the starting point; do not re-derive it.

**Dev-tooling comment-header convention to match** (`admin/generate-weights.mjs`-style, inferred from `admin/print-softmax-margins.mjs` lines 1-7):
```javascript
// admin/generate-weights.mjs -- dev-only, run via `node admin/generate-weights.mjs`, NEVER imported by src/.
```
Apply the equivalent framing to `local-receiver/server.js`'s header comment: dev/test-only, run via `npm run receiver`, never imported by `src/` or bundled into `dist/sdk.js`.

---

### `admin/soak-test-weights.mjs` (new — utility script, batch + request-response)

**Analog:** `admin/print-softmax-margins.mjs` (full file, 102 lines — read above in full, small file, no re-read needed)

**Header/framing pattern** (lines 1-7):
```javascript
// admin/print-softmax-margins.mjs -- dev-only, run via `node admin/print-softmax-margins.mjs`,
// NEVER imported by src/. Success Criterion 2's explicit, numerically-gated verification: prints
// the full softmax vector for each of the 4 canonical cold-start mappings ...
import { forwardPass } from '../src/inference.js';
import weights from './weights.js';

const CLASSES = ['confusion', 'price_doubt', 'trust_gap', 'flow_friction'];
const SIGNAL_ORDER = ['touch_hesitation', 'blur_incomplete', 'scroll_reversal', 'back_intent'];
```
For the soak-test script, import `{ forwardPass, endSession, initInference }` (or equivalent) from `../src/inference.js` directly and re-declare the same `CLASSES`/`SIGNAL_ORDER` constants (module-scoped, not exported, per the comment at RESEARCH.md/`src/inference.js` lines 58-64 — order MUST match `admin/generate-weights.mjs`'s canonicalData order).

**Margin/gate helper pattern** (lines 33-55):
```javascript
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
  console.log(`  probs:  [${probs.map((p) => p.toFixed(4)).join(', ')}]`);
  console.log(`  margin: ${m.toFixed(4)}`);
  return { probs, winningClass, topProb: probs[winningIdx], margin: m };
}
```
Reuse this print/margin helper verbatim; call it once before the soak loop (cold-start weights) and once after (weights persisted via the real receiver, per D-08).

**Gate + exit-code pattern** (lines 61-101):
```javascript
let allPass = true;
for (const vector of CANONICAL_VECTORS) {
  const result = printVector(vector);
  const notSaturated = result.topProb < 0.98;
  const realMargin = result.margin >= 0.05;
  if (!notSaturated) { console.error(`  GATE FAIL: ...`); allPass = false; }
  if (!realMargin) { console.error(`  GATE FAIL: ...`); allPass = false; }
}
if (allPass) { console.log('PASS -- ...'); process.exit(0); }
else { console.error('FAIL -- ...'); process.exit(1); }
```
Adapt the gate thresholds for the soak test's specific claim (SC3: doesn't collapse toward uniform ~0.25-each, doesn't saturate toward ~1.0) — same `process.exit(0/1)` script-gate discipline, same `console.log`/`console.error` framing, no test framework.

**Real-receiver POST wiring** — new for this script, since `print-softmax-margins.mjs` has no network call: use Node's global `fetch` (confirmed available, Node v22.20.0) to `POST http://localhost:<PORT>/weights` after each simulated session's `endSession()` call, mirroring `src/log.js`'s `pushWeights()` fetch branch (see below) but synchronous/awaited rather than fire-and-forget, since the soak test needs to confirm persistence round-tripped before printing the "after" margins.

---

### `src/inference.js` — `endSession()` (modify, additive return statement only)

**Analog:** itself, current implementation (lines 297-304)

**Current code:**
```javascript
export function endSession(config, outcome) {
  if (!lastInference) return; // no signal fired this session — nothing to reinforce

  const target = buildTarget(lastInference.predictedIdx, outcome);
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
}
```

**Required change** — add exactly one line, nothing else (per CONTEXT.md D-07 / RESEARCH.md Pitfall 1 and Pattern 2):
```javascript
export function endSession(config, outcome) {
  if (!lastInference) return; // no signal fired this session — nothing to reinforce

  const target = buildTarget(lastInference.predictedIdx, outcome);
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
  return activeWeights; // NEW — src/log.js needs this to POST
}
```
Do not touch `buildTarget`, `gradientStep`, `forwardPass`, or the confidence-gate/threshold logic — phase boundary is explicit (CONTEXT.md `<domain>`).

---

### `src/log.js` — `finishSession()` + new `pushWeights()` (modify)

**Analog:** itself — `writeLog()`'s single-choke-point discipline (lines 51-67) is the template for the new function; `finishSession()` (lines 69-82) is the integration point.

**Current `finishSession()`:**
```javascript
function finishSession(outcome, event) {
  if (sessionEnded) return; // D-03: whichever path arrives first wins, the other is a no-op
  sessionEnded = true;
  writeLog(activeConfig, activeSessionId, event, {});
  endSession(activeConfig, outcome);
}
```

**Required change** — capture `endSession`'s new return value and add a single-choke-point `pushWeights()` function, following `writeLog()`'s own "the sole choke point that does X" comment-header convention (line 51-57):
```javascript
function finishSession(outcome, event) {
  if (sessionEnded) return;
  sessionEnded = true;
  writeLog(activeConfig, activeSessionId, event, {});
  const updatedWeights = endSession(activeConfig, outcome);
  if (updatedWeights && activeConfig.weightPushUrl) {
    pushWeights(activeConfig.weightPushUrl, updatedWeights, event === 'flow_abandoned');
  }
}

// Single choke-point for the transport split (D-03) — mirrors writeLog()'s
// single-responsibility-function discipline (line 51-57 above). A failed
// push must never break the host page (no-crash discipline, matches this
// module's No-PII-firewall framing at the top of the file).
function pushWeights(url, weights, useBeacon) {
  const body = JSON.stringify(weights);
  if (useBeacon) {
    navigator.sendBeacon(url, body); // string payload -> text/plain -> no CORS preflight (D-03)
  } else {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {}); // best-effort — never throw into the host page
  }
}
```
`weightPushUrl` is read off `activeConfig` (module-level state already re-resolved every `initLogging()` call — same pattern as `activeConfig`/`activeSessionId` at lines 24-29), so no new module-state variable is needed.

**Import addition:** `endSession` is already imported (line 17: `import { endSession } from './inference.js';`) — no new import needed there. `fetch`/`navigator` are ambient browser globals, no import needed (same as `window.addEventListener` already used at line 127).

---

### `src/index.js` — `initDemo()` (modify, additive optional-parameter)

**Analog:** itself, current implementation (lines 51-58)

**Current code:**
```javascript
/**
 * Convenience entry point for the standalone test harness — inits against the
 * bundled demo-platform config so the harness needs no backend/fetch to run.
 * @returns {{ config: object, publish: Function, subscribe: Function }}
 */
export function initDemo() {
  return init(demoConfig);
}
```

**Required change** — additive optional-parameter override (per D-01/D-02, RESEARCH.md Pattern 1), matching this file's existing JSDoc-comment convention (compare `init()`'s own doc block at lines 15-21):
```javascript
/**
 * Convenience entry point for the standalone test harness — inits against the
 * bundled demo-platform config. Optionally accepts an `overrides.weights`
 * object (fetched by the harness's own bootstrap script, D-01) to inject
 * learned weights into config.inference.weights before init() runs — the
 * harness still needs no backend/fetch inside the SDK bundle itself, since
 * this override is supplied by the caller, not fetched here.
 * @param {{weights?: object}} [overrides]
 * @returns {{ config: object, publish: Function, subscribe: Function }}
 */
export function initDemo(overrides) {
  const config = overrides?.weights
    ? { ...demoConfig, inference: { ...demoConfig.inference, weights: overrides.weights } }
    : demoConfig;
  return init(config);
}
```
Zero-argument call signature (`initDemo()`) must remain byte-identical in behavior — Playwright's existing suite calls it bare (RESEARCH.md Pitfall 2 warning).

**Also update the stale comment** at line 1-3's block and the doc-comment noting "the harness needs no backend/fetch to run" — this becomes inaccurate after D-01 adds the harness-side fetch; update wording per CONTEXT.md's explicit note (canonical_refs, `src/index.js` entry).

---

### `test-harness/index.html` — bootstrap `<script>` (modify)

**Analog:** itself — the existing inline bootstrap block (lines 156-159) and the file's established inline-`<script>` async/DOM-event style (D-08's `simulate*` functions, lines 194-242, especially the `setTimeout`-based async pattern at 199-209).

**Current bootstrap (lines 156-159):**
```javascript
<script>
  // Init against the bundled demo config — no backend, no fetch.
  window.Heed.initDemo();

  var logEl = document.getElementById('log');
  ...
```

**Required change** — replace with an async IIFE that fetches before calling `initDemo()`, per D-01/D-06 (RESEARCH.md Pattern 1's HTML block, verified against this file's own `var`-based ES5-compatible style, not `const`/`let`, matching the rest of this inline script which uses `var` throughout, e.g. lines 160, 199-200):
```javascript
<script>
  (function boot() {
    var overrides = {};
    fetch('http://localhost:4310/weights')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (weights) {
        if (weights) overrides.weights = weights; // shape validated receiver-side; D-06 belt-and-suspenders
      })
      .catch(function () {
        // network error / bad JSON — omit weights, cold-start fallback takes over (D-06/D-07)
      })
      .finally(function () {
        window.Heed.initDemo(overrides);
      });
  })();
  ...
```
Note: prefer `.then/.catch/.finally` promise chaining over `async/await` IIFE to match this file's existing ES5 `var`-only convention (no other `async function`/`await` appears anywhere in this file's current script block) — confirm this stylistic call at plan time; RESEARCH.md's own example used `async function boot()`, which is also acceptable (ES2017+ target per stack doc) but is a slight style deviation from this specific file's current all-`var` inline script.

---

### `config/schema.json` (modify — add `weightPushUrl`)

**Analog:** itself — existing optional top-level string property pattern, e.g. `partnerOrigin` (required) and `activeScreens`/`responses` (optional, not in the `required` array).

**Current top-level shape (lines 1-10):**
```json
{
  "type": "object",
  "required": ["platformId", "selectors", "completionSelector", "partnerOrigin"],
  "properties": {
    "platformId": { "type": "string" },
    "completionSelector": { "type": "string" },
    "activeScreens": { "type": "array" },
    "partnerOrigin": { "type": "string" },
    "responses": { "type": "object" },
```

**Required change** — add `"weightPushUrl": { "type": "string" }` as a sibling property, NOT added to the `required` array (per RESEARCH.md Assumption A3 — optional field, `src/log.js`'s `pushWeights()` call is already guarded by `if (updatedWeights && activeConfig.weightPushUrl)`, so absence must no-op gracefully, matching `activeScreens`'/`responses`' existing optional-property precedent).

---

### `config/demo-platform.json` (modify — set concrete `weightPushUrl` value)

**Analog:** itself — sibling keys already set in this file (not read in full above, but referenced by `src/index.js`'s static import at line 11 and `config/schema.json`'s property list). Add `"weightPushUrl": "http://localhost:4310/weights"` (or whatever port `local-receiver/server.js` binds — Claude's discretion per D-04, keep consistent with the receiver's actual listen port and the harness bootstrap's fetch URL).

---

### `tests/local-receiver.test.js` (new — unit test)

**Analog:** `tests/inference-endsession.test.js` / `tests/log.test.js` for assertion style and bus/module-state reset conventions — but CRITICAL deviation required: this file MUST include a per-file environment override comment at the very top:
```javascript
// @vitest-environment node
```
This avoids RESEARCH.md Pitfall 4 (happy-dom's `fetch`/`sendBeacon` perform real network I/O under the project's default `environment: 'happy-dom'`) and gives this test Node's real `http`/`fs` semantics needed to spin up `local-receiver/server.js` on a test-bound port and issue real `http.request`/`fetch` calls against it directly.

## Shared Patterns

### Single choke-point + why-comment discipline
**Source:** `src/log.js` `writeLog()` (lines 51-67), `src/bus.js` `publish()` (referenced in CONTEXT.md, not modified this phase)
**Apply to:** `local-receiver/server.js`'s file-write/file-read functions, `src/log.js`'s new `pushWeights()`, and `test-harness/index.html`'s config-injection point — each should be exactly one named function with a header comment explaining *why*, not just *what*, matching this codebase's established convention throughout `src/inference.js`, `src/log.js`, `src/signal.js`.

### Config-injected value wins over bundled default
**Source:** `src/inference.js` line 235: `activeWeights = config.inference?.weights ?? coldStartWeights;`
**Apply to:** No new code needed here — D-01's harness-injected learned weights flow through this exact existing mechanism unchanged. Any new code (harness bootstrap, `initDemo()` override) must preserve this fallback chain rather than duplicating or shadowing it.

### Hard-fail / never-crash validation split
**Source:** `src/inference.js` `validateWeightsShape()` (throws, hard-fail — used for SDK-side config validation) vs. RESEARCH.md's `isValidWeights()` (returns boolean, never throws — used receiver-side per D-06's "never crash, keep last known-good" requirement)
**Apply to:** `local-receiver/server.js` must use the boolean-returning style; `src/inference.js`/`src/config.js`'s existing CFG-02 "hard-fail, never partial/silent" convention must NOT be copied into the receiver — these are two deliberately different validation postures for two deliberately different failure-tolerance requirements (SDK: hard-fail on bad injected config; receiver: degrade to last-known-good, never crash).

### Reset-on-reinit module state pattern
**Source:** `src/inference.js` `activeWeights`/`activeConfig`/`lastInference` (lines 113-134), `src/log.js` `activeConfig`/`activeSessionId`/`sessionEnded` (lines 24-33)
**Apply to:** No new module-state needed for this phase's `src/log.js` change (weightPushUrl is read live off the already-existing `activeConfig`) — flagged here only so implementers recognize the existing pattern and don't introduce a redundant new module-level variable.

### Dev-tooling script conventions (`admin/*.mjs`)
**Source:** `admin/print-softmax-margins.mjs` full file, `package.json`'s `generate-weights` script (line 11: `"node admin/generate-weights.mjs && node admin/print-softmax-margins.mjs"`)
**Apply to:** `admin/soak-test-weights.mjs` and `local-receiver/server.js`'s `package.json` script wiring — add `"receiver": "node local-receiver/server.js"` and `"soak-test": "node admin/soak-test-weights.mjs"` entries to `package.json`'s existing `"scripts"` block (currently `test`, `build`, `postbuild`, `generate-weights` at lines 8-11), matching the existing `node admin/*.mjs` invocation style exactly.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `local-receiver/server.js` | service (HTTP server) | request-response + file I/O | No Node HTTP server exists anywhere in this repo yet — this is the project's first server process. RESEARCH.md's Architecture Pattern 3 (already a complete, synthesized, ready-to-copy implementation, cross-checked against Node/MDN docs) is the closest thing to an analog and should be used directly rather than re-derived from an unrelated in-repo file. |

## Metadata

**Analog search scope:** `src/`, `admin/`, `test-harness/`, `config/`, `tests/`, `package.json` (full repo except `dist/`, `node_modules/`)
**Files scanned:** `src/inference.js`, `src/log.js`, `src/index.js`, `admin/print-softmax-margins.mjs`, `admin/weights.js` (referenced), `test-harness/index.html`, `config/schema.json`, `package.json`
**Pattern extraction date:** 2026-07-19
