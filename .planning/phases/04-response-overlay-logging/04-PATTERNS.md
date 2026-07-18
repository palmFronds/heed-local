# Phase 4: Response Overlay & Logging - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 8
**Analogs found:** 8 / 8

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/response.js` (NEW) | component/service (DOM overlay renderer) | event-driven (bus subscribe -> DOM render) | `src/inference.js` (`initInference`, its subscribe/publish + module-state pattern) | role-match (no existing DOM-rendering file; closest event-driven consumer/producer shape) |
| `src/log.js` (NEW) | service (structured logger + session-lifecycle wiring) | event-driven / pub-sub | `src/inference.js` (`endSession`, module-state guards) + `src/signal.js` (`checkFlowComplete`/`maybeReattach` live-read + reset-on-reinit pattern) | role-match (closest "single choke-point + module-state guard" service) |
| `src/signal.js` (MODIFY — add `flow:complete` publish in `checkFlowComplete`) | producer (bus publisher) | event-driven | itself (existing file — extend, don't restructure) | exact |
| `src/index.js` (MODIFY — wire `initResponse`/`initLogging`, generate `sessionId`) | orchestrator/config | request-response (init-time wiring) | itself (existing file — extend, don't restructure) | exact |
| `src/config.js` (MODIFY — fix array-type validation bug) | utility (schema interpreter) | transform | itself (existing file — extend `walk()`) | exact |
| `config/schema.json` (MODIFY — add `activeScreens`, `partnerOrigin`, optional `responses`) | config | n/a | itself | exact |
| `config/demo-platform.json` (MODIFY — add `activeScreens`, `partnerOrigin` values) | config | n/a | itself | exact |
| `tests/response.test.js` (NEW) | test | n/a | `tests/inference-endsession.test.js` (RED-suite header convention, synthetic bus dispatch, isolated concern) | role-match |
| `tests/log.test.js` (NEW) | test | n/a | `tests/inference-endsession.test.js` + `tests/signal-spa.test.js` (`history.pushState()` synthetic pathname pattern for `isActiveScreen`) | role-match |

## Pattern Assignments

### `src/response.js` (component, event-driven)

**Analogs:** `src/inference.js` (subscribe/publish + module-state shape), `src/bus.js` (publish/subscribe contract)

**Imports pattern** (mirror `src/inference.js` lines 1-11 and `src/signal.js` line 5):
```javascript
// Producer AND consumer here (subscribes to inference:result, publishes
// response:fired/response:dismissed) — unlike signal.js (producer-only) or
// log.js (consumer-only), response.js needs both bus.js exports.
import { publish, subscribe } from './bus.js';
```

**Core pattern — one-time init + module-scoped state, mirrored from `initInference`** (`src/inference.js` lines 228-246):
```javascript
// src/inference.js lines 228-246 — the exact shape to mirror in initResponse:
// reset per-call state EVERY call (config may change), but guard the
// subscription registration itself so repeat init() calls never stack a
// second signal:detected/inference:result handler.
export function initInference(config) {
  if (config.inference?.weights) validateWeightsShape(config.inference.weights);
  activeWeights = config.inference?.weights ?? coldStartWeights;
  activeConfig = config;
  lastInference = null;

  if (initialized) return; // never stack a second signal:detected subscription
  initialized = true;

  subscribe('signal:detected', (payload) => { /* ... */ });
}
```
Apply directly to `response.js`: `initResponse(config, sessionId)` resets `activeBubble`/current-timer state every call, guards the `subscribe('inference:result', ...)` registration with the same `initialized` boolean pattern, and inside the handler checks `payload.fires && isActiveScreen(config)` (D-06) before rendering — never gates the *subscription itself*.

**Single choke-point construction pattern** (mirror `src/signal.js` `buildPayload()`, lines 22-46 — the "one function builds every object passed to publish()" discipline):
```javascript
// src/signal.js lines 22-46 pattern to replicate for building bubble DOM +
// response:fired/response:dismissed payloads: ONE function is the sole
// place that assembles the shape, called from every trigger site (auto
// dismiss timer, manual X tap, CTA tap, "replaced" by a new bubble).
export function buildPayload(type, ctx) {
  const timestamp = Date.now();
  switch (type) {
    case 'touch_hesitation':
    case 'blur_incomplete': { /* ... */ }
    default:
      throw new Error(`[heed] unknown signal type: ${type}`);
  }
}
```
Apply as: a single `buildDismissPayload(responseType, dismissReason)` (or similar) choke point in `response.js`, called from the timeout handler, the `×` click handler, the CTA click handler, and the "replaced" path (D-05) — never four separate inline object literals.

**Anti-pattern reference (do NOT stack listeners):** `src/signal.js` lines 176-181, 323-331 (`scrollListenerAttached`/`initialized` guards) — `response.js`'s overlay container and its `inference:result` subscription must use the same one-time-registration guard shape, since `initResponse` may be called more than once (mirrors `initSignalCapture`/`initInference` re-entrancy safety).

**No direct analog for `clampToViewport()`/DOM overlay construction** — RESEARCH.md's Architecture Patterns 1/2/4 (Overlay Injection, clampToViewport, postMessage) are the primary source since no existing file does DOM rendering. Use RESEARCH.md's verbatim code examples (lines 270-396 of `04-RESEARCH.md`) as the concrete implementation, not a codebase analog.

---

### `src/log.js` (service, event-driven / pub-sub)

**Analogs:** `src/inference.js` `endSession` (non-idempotency contract) + `src/signal.js` `checkFlowComplete`/`maybeReattach` (live-read, reset-on-reinit)

**Imports pattern:**
```javascript
// log.js is consumer-only for signal:detected/inference:result/flow:complete/
// response:fired/response:dismissed, but also directly CALLS endSession —
// mirrors signal.js's producer-only shape inverted (subscribe, not publish,
// is log.js's primary bus verb), plus a direct cross-module function import
// (the one place in this codebase a module imports another module's
// exported function directly, not just via the bus).
import { subscribe } from './bus.js';
import { endSession } from './inference.js';
```

**Session-lifecycle guard pattern — directly mirrors `src/inference.js`'s `endSession` non-idempotency contract** (lines 281-304):
```javascript
// src/inference.js lines 297-304 — endSession is documented as NOT
// idempotent (a second call performs a second, distinct gradient step).
// log.js's sessionEnded guard (D-03) exists specifically to prevent this
// codebase's already-established "two independent single steps" behavior
// from being triggered twice by two competing lifecycle paths.
export function endSession(config, outcome) {
  if (!lastInference) return; // no signal fired this session — nothing to reinforce
  const target = buildTarget(lastInference.predictedIdx, outcome);
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
}
```

**Reset-on-reinit + live-read pattern — directly mirrors `src/signal.js`'s `checkFlowComplete`/`maybeReattach`** (lines 240-247, 297-305):
```javascript
// src/signal.js lines 297-305 — the exact "live read every call, never
// cache" discipline log.js's isActiveScreen(config) must replicate for
// window.location.pathname (RESEARCH.md Anti-Patterns explicitly calls
// this out — caching pathname at init would silently break a same-page
// SPA route swap).
export function maybeReattach(config) {
  const currentPathname = window.location.pathname;
  if (currentPathname !== lastPathname) {
    lastPathname = currentPathname;
    attachListeners(config);
  } else {
    checkFlowComplete(config);
  }
}
```
Apply directly: `isActiveScreen(config)` in `log.js` must call `window.location.pathname` fresh on every invocation (never memoized), exactly as `maybeReattach` does — do not hoist the read into `initLogging`'s outer scope.

**One-time-registration guard** — mirrors `src/inference.js` line 134/245 (`initialized` boolean) and `src/signal.js` line 312/330 (`initialized` boolean guarding the MutationObserver/popstate listener): `initLogging(config, sessionId)` must guard its `subscribe('flow:complete', ...)` and `window.addEventListener('pagehide', ...)` registrations the same way, resetting `sessionEnded = false` on every call (matching `lastInference = null` reset in `initInference`) but registering the actual listeners at most once.

**Log-entry choke-point** — mirrors `src/signal.js` `buildPayload()`'s "one function constructs every payload" discipline (lines 8-11 comment + lines 22-46 body): `log.js` must have exactly one `writeLog(config, sessionId, event, data)` function that is the SOLE caller of `console.log('[heed]', ...)` anywhere in the codebase (locked by UI-SPEC line 165), called from every one of the 6 event-type handlers — never an inline `console.log` at each subscribe site.

**RESEARCH.md Pattern 3 (Session-Lifecycle Wiring)** is the primary concrete code source (04-RESEARCH.md lines 330-376) — use its `initLogging`/`finishSession`/`isActiveScreen`/`writeLog` shapes verbatim as the starting skeleton, cross-checked against the two analogs above for idiom consistency (module-level `let` state, reset-on-reinit, one-time-registration guard, live pathname read).

---

### `src/signal.js` (MODIFY — extend `checkFlowComplete`)

**Analog:** itself, lines 240-247

**Exact extension point:**
```javascript
// src/signal.js lines 240-247 — current implementation:
function checkFlowComplete(config) {
  if (flowCompleteFlag) return; // once true, this function never clears it (D-06)
  const selector = config.selectors?.flowComplete ?? config.completionSelector;
  const el = document.querySelector(selector);
  if (el && getComputedStyle(el).display !== 'none') {
    flowCompleteFlag = true;
  }
}
```
D-01 requires exactly one added line: `publish('flow:complete', {})` (or similar) inside the `if (el && ...)` block, at the exact moment `flowCompleteFlag` transitions from `false` to `true` — i.e. inside the branch that sets `flowCompleteFlag = true`, not duplicated elsewhere. `publish` is already imported (line 5) — no new import needed. Do not restructure the guard-at-top-of-function shape (`if (flowCompleteFlag) return`) — this is what already guarantees "publish happens exactly once."

---

### `src/index.js` (MODIFY — wire `sessionId`, `initResponse`, `initLogging`)

**Analog:** itself, lines 20-34

**Exact extension shape:**
```javascript
// src/index.js lines 20-34 — current init(), the pattern to extend:
export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  initSignalCapture(config);
  initInference(config);
  return { config, publish, subscribe };
}
```
D-08 requires `const sessionId = crypto.randomUUID();` generated inside `init()`, then passed to two new calls following the exact same "validate first, then wire side-effecting modules in sequence" shape already established:
```javascript
export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  const sessionId = crypto.randomUUID(); // D-08 — once per page load
  initSignalCapture(config);
  initInference(config);
  initLogging(config, sessionId);   // NEW — log.js owns session-lifecycle wiring (RESEARCH A1)
  initResponse(config, sessionId);  // NEW
  return { config, publish, subscribe };
}
```
Add `import { initLogging } from './log.js';` and `import { initResponse } from './response.js';` alongside the existing imports (lines 4-9), matching the existing named-import convention exactly (no default exports — established Phase 1-3 rule, restated in RESEARCH.md line 149).

---

### `src/config.js` (MODIFY — fix array-type validation bug)

**Analog:** itself, lines 15-37 (`walk()`)

**Exact bug and fix location:**
```javascript
// src/config.js lines 15-23 — current walk(), the verified bug:
function walk(value, schemaNode, path, errors) {
  if (
    schemaNode.type &&
    typeof value !== schemaNode.type &&
    !(schemaNode.type === 'object' && value !== null && typeof value === 'object')
  ) {
    errors.push(`${path}: expected type "${schemaNode.type}", got "${typeof value}"`);
    return;
  }
  // ...
}
```
`typeof []` is `"object"`, never `"array"` — there is no special-case clause for `schemaNode.type === 'array'` the way there is for `'object'`. Fix by adding an `Array.isArray(value)` branch mirroring the existing object special-case structurally (same `if` shape, same early-return-on-type-mismatch discipline, same `errors.push` message format) — this is a required blocking fix before `activeScreens` can be declared `"type": "array"` in `config/schema.json` (RESEARCH.md Pitfall 1, verified via direct `node -e` reproduction).

---

### `config/schema.json` (MODIFY)

**Analog:** itself, lines 1-55 — follow the exact existing nesting/required-field convention (top-level `properties`, `required` arrays per object level, no `additionalProperties` enforcement — a documented pre-existing gap, out of scope per RESEARCH.md Open Question 2).

Add at the top level (sibling to `platformId`/`selectors`/`signals`/`inference`):
```json
"activeScreens": { "type": "array" },
"partnerOrigin": { "type": "string" }
```
Optionally (Claude's discretion, D-04):
```json
"responses": { "type": "object" }
```
`partnerOrigin` should likely be added to the top-level `required` array (line 4) since RESP-03's postMessage must never fall back to a wildcard origin (RESEARCH.md Security Domain: "must be a required, validated string... not left optional/undefined").

---

### `config/demo-platform.json` (MODIFY)

**Analog:** itself, lines 1-22 — same flat key-value convention as `platformId`/`completionSelector`.

Add:
```json
"activeScreens": ["/swap", "/confirm", "/success"],
"partnerOrigin": "http://localhost:3000"
```
Tag the `activeScreens` array as `[ASSUMED]` per RESEARCH.md Assumption A2/Pitfall 3 — the standalone test harness has no real routing; these are placeholder values pending Branch 1's real routes (Phase 6 will need to revisit, not this phase's gating logic itself).

---

### `tests/response.test.js` (NEW test)

**Analog:** `tests/inference-endsession.test.js` (RED-suite header convention, synthetic `publish()`/`subscribe()` bus dispatch, isolated single-concern file)

**Header/import convention to copy** (lines 1-13):
```javascript
// tests/inference-endsession.test.js lines 1-13 — copy this file-header
// convention (RED-suite comment explaining why the import fails pre-
// implementation) and the collectInferenceResults()-style bus-subscribe
// helper pattern for response.test.js's own inference:result -> bubble-
// rendered assertions.
import { describe, it, expect } from 'vitest';
import { initInference, endSession, forwardPass } from '../src/inference.js';
import { publish, subscribe } from '../src/bus.js';

function collectInferenceResults() {
  const received = [];
  subscribe('inference:result', (payload) => received.push(payload));
  return received;
}
```
Apply as: `import { initResponse } from '../src/response.js'; import { publish } from '../src/bus.js';`, publish synthetic `inference:result` payloads with `fires: true` and varying `bbox`/`intent` to drive `clampToViewport()`'s both paths (RESEARCH.md Pitfall 5 — never rely on `getBoundingClientRect()` in happy-dom; stub `window.innerWidth`/`innerHeight` via `Object.defineProperty`, per RESEARCH.md Code Examples).

**Keep auto-dismiss-timer tests in this file separate from any file touching `initSignalCapture`/MutationObserver** (RESEARCH.md Pitfall 4 — `vi.useFakeTimers()` + MutationObserver interaction risk) — mirrors the existing `signal.test.js`/`signal-spa.test.js` split precedent.

---

### `tests/log.test.js` (NEW test)

**Analogs:** `tests/inference-endsession.test.js` (synthetic dispatch + sessionEnded-guard-style assertions) + `tests/signal-spa.test.js` (`history.pushState()` synthetic pathname pattern)

Use the `inference-endsession.test.js` "call twice, assert exactly-once behavior" style (lines 75-106) directly for D-03's `sessionEnded` guard: publish both `flow:complete` and dispatch `pagehide` (in either order) and assert `endSession`/`writeLog`'s `flow_complete`/`flow_abandoned` combined call count is exactly 1, not 2.

For D-06/D-07's `isActiveScreen` gating, follow `tests/signal-spa.test.js`'s established `history.pushState({}, '', '/some-path')` technique (already verified working in this codebase for `maybeReattach`) rather than attempting real multi-route navigation — mirrors RESEARCH.md Pitfall 3's explicit recommendation.

---

## Shared Patterns

### Bus publish/subscribe contract
**Source:** `src/bus.js` lines 1-27 (entire file — small enough to use verbatim)
**Apply to:** `response.js`, `log.js`, and the modified `signal.js`
```javascript
export function publish(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}
export function subscribe(type, handler) {
  const wrapped = (e) => handler(e.detail);
  target.addEventListener(type, wrapped);
  return () => target.removeEventListener(type, wrapped);
}
```
New event names this phase introduces onto this same bus: `flow:complete` (published by `signal.js`), `response:fired`, `response:dismissed` (published by `response.js`, consumed by `log.js`). All must use `publish(type, detail)` — never construct a `CustomEvent` directly anywhere else (bus.js's own header comment, line 7-9, is explicit that this is the sole choke point).

### Single choke-point + why-comment discipline
**Source:** `src/signal.js` `buildPayload()` (lines 6-21 comment + 22-46 body), `src/inference.js`'s payload construction inside `initInference` (lines 258-277)
**Apply to:** `log.js`'s `writeLog()` entry-construction function, `response.js`'s dismiss-payload construction function — one function builds the shape, called from every handler, with a why-comment explaining the discipline (matches this codebase's dense inline-comment convention throughout).

### Plain named-function exports only — no classes, no default exports
**Source:** every existing `src/*.js` file (verified: `bus.js`, `signal.js`, `inference.js`, `config.js`, `index.js` all use `export function ...`, zero `class`/`export default`)
**Apply to:** `response.js`, `log.js` in full.

### Per-call state reset on re-init, one-time listener-registration guard
**Source:** `src/signal.js` (`flowCompleteFlag` reset in `attachListeners` line 269, `initialized` guard line 312/330), `src/inference.js` (`activeWeights`/`lastInference` reset lines 235-243, `initialized` guard line 134/245)
**Apply to:** `initResponse(config, sessionId)` and `initLogging(config, sessionId)` both need this exact two-part shape: reset mutable module state every call, but guard the actual `subscribe`/`addEventListener` registration calls with a boolean so repeat `init()` calls (however unlikely in the current test harness) never stack duplicate handlers.

### Hard-fail config validation (CFG-02)
**Source:** `src/config.js` (`validateConfig`/`walk`, entire file), `src/inference.js`'s `validateWeightsShape` (lines 87-111, same hard-fail-never-silent philosophy applied to a non-schema-driven shape check)
**Apply to:** the `config.js` array-type fix must preserve this "throw, never silently coerce or skip" philosophy — an invalid `activeScreens` (e.g. a string instead of an array) must produce a thrown `Error` at `init()` time via `validateConfig`, exactly like every other schema violation already does.

### No PII firewall
**Source:** `src/signal.js` lines 6-21 (`buildPayload`'s doc comment establishing the firewall discipline)
**Apply to:** `response.js`/`log.js` must never read `el.value`/`.textContent`/`.innerHTML`/`localStorage`/`document.cookie` anywhere — both modules only ever consume already-PII-filtered bus payloads (`inference:result`, `signal:detected`). Restate this as a header comment in both new files, matching `signal.js`'s convention of stating the firewall rule explicitly at the point it could be violated.

## No Analog Found

| File/Concern | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Overlay DOM injection / `clampToViewport()` math | component | transform | No existing file does DOM rendering — Phases 1-3 are pure signal-capture/inference (no visual output). Use `04-RESEARCH.md` Architecture Patterns 1/2 (lines 264-328) as the primary concrete source instead of a codebase analog. |
| `postMessage` cross-window signaling | event-driven | n/a | No existing file communicates outside the bus/DOM. Use `04-RESEARCH.md` Pattern 4 (lines 378-396) and `04-UI-SPEC.md`'s locked payload shape (lines 121-134) directly. |
| `safeAreaInset()` CSS `env()` probe | utility | transform | No prior CSS-environment-variable reading anywhere in the codebase. Use `04-RESEARCH.md`'s verbatim `safeAreaInset()` implementation (lines 317-327). |

## Metadata

**Analog search scope:** `src/*.js` (all 5 existing files read in full), `config/*.json` (both files read in full), `tests/*.test.js` (glob'd; `inference-endsession.test.js` and `signal-spa.test.js` referenced by name per RESEARCH.md's own citations)
**Files scanned:** 8 source/config files, 1 test file read in full, 1 test file referenced by established convention (not re-read, already characterized in RESEARCH.md)
**Pattern extraction date:** 2026-07-18
