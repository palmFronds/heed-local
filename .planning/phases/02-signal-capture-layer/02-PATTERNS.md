# Phase 2: Signal Capture Layer - Pattern Map

**Mapped:** 2026-07-14
**Files analyzed:** 8 (new/modified)
**Analogs found:** 8 / 8 (all resolve to Phase 1 code — this is the second phase of the project, no prior signal-layer code exists)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|-----------------|----------------|
| `src/signal.js` | service/utility (event-listener orchestrator) | event-driven | `src/bus.js` + `src/config.js` (combined: choke-point + config-shape reading) | role-match (no prior event-capture file exists; `bus.js` is closest for "single choke point" discipline, `config.js` for "walk a config object defensively") |
| `src/index.js` (modified) | provider/orchestrator | request-response (init call) | `src/index.js` itself (Phase 1, pre-modification) | exact (extending existing orchestrator, not creating new) |
| `config/schema.json` (modified) | config | CRUD (schema-validated additive fields) | `config/schema.json` itself (Phase 1, pre-modification) | exact |
| `config/demo-platform.json` (optional modified) | config | CRUD | `config/demo-platform.json` itself (Phase 1) | exact |
| `test-harness/index.html` (modified) | component/test-fixture | event-driven (DOM dispatch) | `test-harness/index.html` itself (Phase 1, pre-modification, `<script>` block) | exact |
| `tests/signal.test.js` | test | event-driven / unit | `tests/bus.test.js` | role-match (same describe/it/expect + fixture style, new domain) |
| `tests/signal-spa.test.js` | test | event-driven / unit | `tests/harness.test.js` (happy-dom `Window`/`document.write` usage) + `tests/bus.test.js` (assertion style) | role-match |
| `tests/e2e/harness.spec.js` | test | request-response (real-browser E2E) | none in repo — first Playwright test in the project | no analog (new territory, use RESEARCH.md Playwright split guidance) |

## Pattern Assignments

### `src/signal.js` (service/utility, event-driven)

**Analogs:** `src/bus.js` (choke-point discipline, JSDoc style, "why" comments) and `src/config.js` (defensive property-walking style, hard-fail-never-soft-fail philosophy)

**Imports pattern** — from `src/index.js` lines 1-7, showing this project's plain relative-ESM-import convention (no path aliases, no barrel files):
```javascript
import { validateConfig } from './config.js';
import { publish, subscribe } from './bus.js';
import schema from '../config/schema.json';
import demoConfig from '../config/demo-platform.json';
```
`signal.js` should mirror this: `import { publish } from './bus.js';` — it needs `publish` only, never `subscribe` (it is a producer, not a consumer, of bus events).

**"Single choke point" architectural comment style** — copy directly from `src/bus.js` lines 1-9 (this is the established pattern for documenting *why* a function is the sole place something happens, which is exactly RESEARCH.md's Pattern 3 `buildPayload()` requirement):
```javascript
// Private module-scoped event bus. Never bind to any host-page global object
// — that would let host-page scripts observe internal signal:*/inference:*
// traffic via addEventListener (see 01-RESEARCH.md Pattern 2 / Pitfall 2).
const target = new EventTarget();

/**
 * Publish a payload on the bus. This is the sole place in the codebase that
 * constructs a CustomEvent — the payload MUST be wrapped in { detail },
 * otherwise subscribers silently receive undefined (Pitfall 3).
 * @param {string} type
 * @param {*} detail
 */
export function publish(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}
```
For `signal.js`'s `buildPayload(type, ctx)`, use the identical comment shape: state what the function is the sole place for, and what breaks if that invariant is violated (here: PII leakage, not `undefined` payloads).

**Defensive property-walk / hard-fail style** — from `src/config.js` lines 1-13, the project convention for "read something optional off an object without assuming its shape exists, but never silently coerce an error into a no-op":
```javascript
// src/config.js — generic interpreter over a restricted JSON-Schema-draft-07 subset.
// Implements only: type, required, properties, enum, additionalProperties.
// Never soft-fail-and-return; always throws on any violation (CFG-02 hard-fail).
// Selector strings never live here — only in config/demo-platform.json.

export function validateConfig(config, schema) {
  const errors = [];
  walk(config, schema, '$', errors);
  if (errors.length > 0) {
    throw new Error(`[heed] Invalid config — refusing to initialize:\n${errors.join('\n')}`);
  }
  return config;
}
```
`signal.js` should use the same `config.signals?.scrollReversal?.minReversalDeltaPx ?? 50` optional-chaining-with-default style (already shown in RESEARCH.md's Code Examples) — this matches the project's existing tolerance for optional, non-`required` config fields established by `config.js`'s `walk()` (it only enforces keys present in a node's `required` array).

**Error-message prefix convention** — note `[heed]` prefix used in `src/config.js` line 10's thrown error. Any new hard-fail thrown by `signal.js` (e.g. `buildPayload`'s `default: throw new Error(...)` case from RESEARCH.md Pattern 3) MUST use the same `[heed]` prefix:
```javascript
throw new Error(`[heed] unknown signal type: ${type}`);
```

**Core event-driven pattern** — no prior analog exists in this codebase (this is the first DOM-event-capture file). Use RESEARCH.md's Patterns 1–3 verbatim (WeakSet re-attachment, single-timer touch-hesitation, centralized `buildPayload`) — they are already written in this project's own style (JSDoc-light, small named functions, no classes) matching `bus.js`/`config.js`'s conventions.

**Naming convention observed across `bus.js`/`config.js`/`index.js`:** plain exported functions (`publish`, `subscribe`, `validateConfig`, `init`, `initDemo`) — no default exports, no classes, no factory objects. `signal.js` should export a single function matching this: `export function attachListeners(config) { ... }` or `initSignalCapture(config)` per RESEARCH.md, not a class or object.

---

### `src/index.js` (modified) (provider/orchestrator, request-response)

**Analog:** itself, pre-modification (full file already read above, 31 lines)

**Current full pattern to extend:**
```javascript
import { validateConfig } from './config.js';
import { publish, subscribe } from './bus.js';
import schema from '../config/schema.json';
import demoConfig from '../config/demo-platform.json';

export { publish, subscribe };

export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  return { config, publish, subscribe };
}

export function initDemo() {
  return init(demoConfig);
}
```
**Wiring point:** add `import { attachListeners } from './signal.js';` (or `initSignalCapture`) and call it inside `init()` immediately after `validateConfig` succeeds, before `return`, mirroring the existing comment style ("No try/catch around validateConfig — an invalid config must stop initialization entirely (CFG-02) rather than fall back to defaults or partial exposure.") — i.e. document *why* signal-attachment happens only after hard-fail validation succeeds, not before.

**Return-shape discipline:** the existing `init()` returns exactly `{ config, publish, subscribe }`. RESEARCH.md's Recommended Project Structure does not require adding anything new to this return shape (signal capture is side-effecting, not a returned value) — do not add a `signal` key to the returned object unless CONTEXT.md's boundary changes; keep the public API surface identical to Phase 1's contract.

---

### `config/schema.json` (modified) (config, CRUD)

**Analog:** itself, pre-modification

**Current full pattern:**
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["platformId", "selectors", "completionSelector"],
  "properties": {
    "platformId": { "type": "string" },
    "completionSelector": { "type": "string" },
    "selectors": {
      "type": "object",
      "required": [ "amountInput", "feeRow", "minReceivedRow", "proceedCta", "confirmCta", "backBtn", "flowComplete" ],
      "properties": { "...": "..." }
    }
  }
}
```
**Extension pattern:** add an optional (non-`required`) top-level `signals` object property, following the exact same nested-object shape as `selectors` above but WITHOUT adding its key to the top-level `required` array (per RESEARCH.md Open Question 1 and `src/config.js`'s `walk()` behavior — only keys in a node's own `required` array are enforced):
```json
"signals": {
  "type": "object",
  "properties": {
    "touchHesitation": {
      "type": "object",
      "properties": { "thresholdMs": { "type": "number" } }
    },
    "scrollReversal": {
      "type": "object",
      "properties": {
        "depthThresholdPct": { "type": "number" },
        "minReversalDeltaPx": { "type": "number" }
      }
    }
  }
}
```
Do not add `"signals"` to the outer `required` array — this preserves backward compatibility with `config/demo-platform.json` exactly as `src/config.js`'s `walk()` already tolerates (verified in RESEARCH.md).

---

### `test-harness/index.html` (modified) (component/test-fixture, event-driven)

**Analog:** itself, pre-modification (`<script>` block, lines 130-168 above)

**Current debug-panel pattern (to be REPLACED per D-08):**
```javascript
window.Heed.subscribe('signal:detected', function (detail) {
  appendLog(detail);
});

var triggerButtons = document.querySelectorAll('.debug-panel button[data-signal]');
triggerButtons.forEach(function (btn) {
  btn.addEventListener('click', function () {
    var signalType = btn.getAttribute('data-signal');
    var targetHeedName = btn.getAttribute('data-target');
    var targetEl = document.querySelector('[data-heed="' + targetHeedName + '"]');
    var rect = targetEl.getBoundingClientRect();
    var payload = { type: signalType, targetSelector: '...', bbox: {...}, timestamp: Date.now() };
    window.Heed.publish('signal:detected', payload); // <-- D-08 replaces THIS with real dispatchEvent calls
  });
});
```
**Keep:** the `appendLog`/`#log` subscriber wiring (`window.Heed.subscribe('signal:detected', ...)`) unchanged — it already correctly proves receipt via the bus, decoupled from trigger buttons. Only the button click handlers' bodies change, per RESEARCH.md's "Debug-Panel Rewiring to Dispatch Real Events" code example (`simulateHold`, `simulateBlurIncomplete`, `simulateScrollReversal`, `simulateBackIntent`).

**Also required (Pitfall 7):** add filler height/spacer content so `document.documentElement.scrollHeight > window.innerHeight * 1.5`, verified concretely per RESEARCH.md.

**Comment-style convention to preserve:** the existing header comment on the debug panel (lines 102-105) explains *why* the panel exists and what it does NOT prove — update this comment to reflect D-08's new fidelity (real dispatched events, not direct `bus.publish()` calls) rather than deleting it; this project consistently documents "what this section proves vs. does not prove" (see also RESEARCH.md's fidelity note on `isTrusted: false`).

---

### `tests/signal.test.js` (test, unit/event-driven)

**Analog:** `tests/bus.test.js`

**Full existing test-file pattern to follow:**
```javascript
import { describe, it, expect, vi } from 'vitest';
import { emitSynthetic } from './fixtures/test-emitter.js';
import { collectReceived } from './fixtures/test-subscriber.js';

describe('BUS-01', () => {
  it('delivers a published signal to a subscriber with no direct import between them', () => {
    const handler = vi.fn();
    collectReceived(handler);
    emitSynthetic();
    expect(handler).toHaveBeenCalledOnce();
  });

  it('passes the full published payload through detail — not just that it fired', () => {
    const handler = vi.fn();
    collectReceived(handler);
    emitSynthetic();
    expect(handler.mock.calls[0][0]).toEqual({
      type: 'touch_hesitation',
      targetSelector: 'confirm-cta',
      bbox: {},
      timestamp: expect.any(Number),
    });
  });
});
```
**Conventions to copy:** `describe()` block named after the requirement ID (`SIG-01`, `SIG-02`, etc. — not a generic file/module name), `it()` descriptions phrased as full sentences describing the observable behavior, subscribe-then-act-then-assert structure, `expect.any(Number)` for `timestamp` fields, `toEqual` for exact payload-shape assertions (directly usable for SIG-05's allow-list structural test: `expect(Object.keys(payload).sort()).toEqual([...])`).

**Fixture pattern to mirror** — from `tests/fixtures/test-emitter.js` and `test-subscriber.js` (both import directly from `src/bus.js`, no mocking):
```javascript
import { publish } from '../../src/bus.js';
export function emitSynthetic() {
  publish('signal:detected', { type: 'touch_hesitation', targetSelector: 'confirm-cta', bbox: {}, timestamp: Date.now() });
}
```
`signal.test.js` does not need new fixture files (it should dispatch real `TouchEvent`/`FocusEvent`/etc. directly onto happy-dom elements per RESEARCH.md, then assert on `bus.subscribe` receipts using the existing `collectReceived`-style helper or an inline `subscribe` call) — reuse `tests/fixtures/test-subscriber.js`'s `collectReceived` pattern rather than writing a new one.

**vi.useFakeTimers() note (Pitfall 3):** no existing test in this repo uses fake timers yet — this will be new to the codebase but is a standard Vitest API; keep it isolated to `signal.test.js` (touch-hesitation timer tests) and never combine with the MutationObserver-dependent tests, which belong in `signal-spa.test.js` per RESEARCH.md.

---

### `tests/signal-spa.test.js` (test, unit/event-driven)

**Analogs:** `tests/harness.test.js` (happy-dom `Window` + `document.write` construction pattern) and `tests/bus.test.js` (assertion/describe style)

**happy-dom `Window` construction pattern** — from `tests/harness.test.js` lines 1-19:
```javascript
import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';

describe('TEST-01', () => {
  it('exposes exactly the 7 locked data-heed selectors from CONTRACT.md', () => {
    const window = new Window();
    const document = window.document;
    document.write(html);
    const elements = document.querySelectorAll('[data-heed]');
    expect(elements.length).toBe(7);
  });
});
```
Note: `vitest.config.js` already sets `environment: 'happy-dom'` globally, so most tests can use the ambient `document`/`window` globals directly rather than constructing a `new Window()` explicitly — `harness.test.js` constructs its own `Window` only because it's parsing a raw HTML string via `document.write`. For `signal-spa.test.js`, prefer building fixture DOM via the ambient global `document.body.innerHTML = '...'` (simpler, matches the "detached DOM fixture" recommendation in RESEARCH.md) unless multiple isolated `Window` instances are needed to simulate distinct SPA "pages."

**Direct-function-call testing strategy (Pitfall 3):** per RESEARCH.md, call `maybeReattach(config)` directly in tests rather than relying on async `MutationObserver` callback delivery — this requires `signal.js` to export (or otherwise expose for testing) its internal re-attachment function, which is a design decision to flag to the planner: either export `maybeReattach`/`attachListeners` explicitly for test-only use, or structure `signal-spa.test.js` to mutate the DOM and manually invoke the exported public entry point synchronously.

---

### `tests/e2e/harness.spec.js` (test, request-response/real-browser)

**No analog** — this is the first Playwright test in the project. `@playwright/test` is already a devDependency (`package.json` line 23) but no `playwright.config.js` exists yet and no `tests/e2e/` directory exists.

**Action needed beyond the test file itself:** the planner should account for creating a minimal `playwright.config.js` (pointing at `test-harness/index.html` via a local static server or `file://` URL) as part of this file's plan, since there is no existing Playwright scaffolding to copy from. Use RESEARCH.md's "happy-dom vs. Playwright Test Split" section as the primary source of truth for this file's structure (build `dist/sdk.js` first via `npm run build`, open the real harness HTML, click rewired debug-panel buttons, assert `#log` panel content).

## Shared Patterns

### Bus publish (event-driven core)
**Source:** `src/bus.js` lines 13-15
**Apply to:** `src/signal.js` — the only cross-cutting dependency; every one of the four signal handlers eventually calls the same imported `publish('signal:detected', payload)`.
```javascript
export function publish(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}
```

### `[heed]` error-prefix convention
**Source:** `src/config.js` line 10
**Apply to:** any new thrown error in `src/signal.js` (e.g. `buildPayload`'s unknown-type branch) — must use the `[heed]` prefix for consistency with the existing hard-fail convention.

### Comment style: "why," not "what"
**Source:** `src/bus.js` lines 1-3, 6-9; `src/config.js` lines 1-4, `src/index.js` lines 1-3
**Apply to:** all new code in `signal.js` — every non-obvious function should carry a 1-3 line comment explaining the risk it guards against (referencing the relevant SIG-xx/D-xx ID or a specific pitfall), matching this project's established documentation density. Example from `src/index.js`:
```javascript
// No try/catch around validateConfig — an invalid config must stop initialization
// entirely (CFG-02) rather than fall back to defaults or partial exposure.
```

### Config optional-field tolerance
**Source:** `src/config.js`'s `walk()` (lines 15-37) — only enforces keys present in a schema node's own `required` array; unknown/undeclared properties are never rejected.
**Apply to:** `config/schema.json`'s new `signals.*` fields and `src/signal.js`'s `config.signals?.x?.y ?? default` reads — both rely on this existing tolerant-validator behavior, already verified compatible in RESEARCH.md.

### Plain function exports, no classes/factories
**Source:** `src/bus.js`, `src/config.js`, `src/index.js` — every module exports plain named functions (`publish`, `subscribe`, `validateConfig`, `init`, `initDemo`), never a class or default export.
**Apply to:** `src/signal.js`'s public entry point (`attachListeners`/`initSignalCapture`) and any internal helpers.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/e2e/harness.spec.js` | test | request-response (real-browser E2E) | First Playwright test in the project — no `playwright.config.js` or `tests/e2e/` precedent exists yet. Planner should use RESEARCH.md's Playwright section and treat `playwright.config.js` creation as an implicit prerequisite task. |
| `src/signal.js`'s core event-capture logic (touch/blur/scroll/popstate handlers) | service/utility | event-driven | No prior DOM-event-capture code exists in this codebase (Phase 1 was config/bus/harness-scaffolding only). Use RESEARCH.md's Patterns 1-3 code examples directly — they are the primary source, written in a style already consistent with this project's conventions (verified above). |

## Metadata

**Analog search scope:** `src/`, `tests/`, `config/`, `test-harness/`, `package.json`, `vitest.config.js` (entire repo — small codebase, Phase 1 output only)
**Files scanned:** `src/bus.js`, `src/config.js`, `src/index.js`, `config/schema.json`, `config/demo-platform.json`, `test-harness/index.html`, `tests/bus.test.js`, `tests/config.test.js` (not detailed above but same style as `bus.test.js`), `tests/index.test.js`, `tests/harness.test.js`, `tests/fixtures/test-emitter.js`, `tests/fixtures/test-subscriber.js`, `vitest.config.js`, `package.json`
**Pattern extraction date:** 2026-07-14
