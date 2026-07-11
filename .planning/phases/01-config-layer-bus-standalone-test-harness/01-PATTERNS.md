# Phase 1: Config Layer, Bus & Standalone Test Harness - Pattern Map

**Mapped:** 2026-07-11
**Files analyzed:** 9
**Analogs found:** 0 / 9 (fully greenfield repo — no in-repo analogs exist)

## Repo State

This branch (`feat/heed-sdk`) currently contains no application source code — `git ls-files` shows only planning docs (`.planning/**`), spec text files (`branch spec files/*.txt`), and root docs (`CLAUDE.md`, `CONTRACT.md`, `README.md`). There is no `package.json`, no `src/`, no `config/`, no `test-harness/`, no `tests/`. Every file in this phase's scope is a brand-new file with zero existing sibling files to pattern-match against in this repo.

Because there is nothing to copy from locally, this PATTERNS.md instead pins each file to the **specific, concrete code block in `01-RESEARCH.md`** that the planner/executor should treat as the canonical starting point — RESEARCH.md's "Code Examples" and "Architecture Patterns" sections already contain complete, ready-to-adapt implementations (not just descriptions), so they function as this phase's analogs in lieu of real codebase files.

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|-----------------|----------------|
| `package.json` | config | — | none (greenfield) | no analog |
| `vitest.config.js` | config | — | none (greenfield) | no analog |
| `config/schema.json` | config | transform (declarative contract, read by validator) | none (greenfield) | no analog — use RESEARCH.md Pattern 1 excerpt |
| `config/demo-platform.json` | config | transform (concrete values consumed at init) | none (greenfield) | no analog — must target the 7 CONTRACT.md `data-heed` selectors verbatim |
| `src/config.js` | utility (validator module) | transform (input → validated object or throw) | none (greenfield) | no analog — use RESEARCH.md Pattern 1 `validateConfig`/`walk` excerpt |
| `src/bus.js` | utility (pub/sub) | event-driven | none (greenfield) | no analog — use RESEARCH.md Pattern 2 excerpt |
| `src/index.js` | service (init orchestrator) | request-response (single `init(config)` call) | none (greenfield) | no analog — use RESEARCH.md "Wiring init() to hard-fail" excerpt |
| `test-harness/index.html` | component (static harness) | event-driven (debug-panel buttons publish synthetic bus events) | none (greenfield) | no analog — use RESEARCH.md Pattern 3 description + Architecture Diagram |
| `tests/config.test.js` | test | request-response (assert throw/pass) | none (greenfield) | no analog — CFG-01/CFG-02 requirements table gives exact assertion targets |
| `tests/bus.test.js` | test | event-driven | none (greenfield) | no analog — use RESEARCH.md "Proving zero direct import" excerpt (test-emitter/test-subscriber fixtures + bus.test.js), verbatim structure |

## Pattern Assignments

### `src/config.js` (utility, transform)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 170-199 (Pattern 1).

**Core pattern — generic schema-subset interpreter** (RESEARCH.md lines 172-199):
```javascript
export function validateConfig(config, schema) {
  const errors = [];
  walk(config, schema, '$', errors);
  if (errors.length > 0) {
    throw new Error(`[heed] Invalid config — refusing to initialize:\n${errors.join('\n')}`);
  }
  return config; // valid — caller may now proceed to build the bus/signal layer
}

function walk(value, schemaNode, path, errors) {
  if (schemaNode.type && typeof value !== schemaNode.type &&
      !(schemaNode.type === 'object' && value !== null && typeof value === 'object')) {
    errors.push(`${path}: expected type "${schemaNode.type}", got "${typeof value}"`);
    return; // don't recurse into a value whose base type is already wrong
  }
  if (schemaNode.type === 'object' && schemaNode.properties) {
    for (const key of schemaNode.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key}: required field missing`);
    }
    for (const [key, subSchema] of Object.entries(schemaNode.properties)) {
      if (key in value) walk(value[key], subSchema, `${path}.${key}`, errors);
    }
  }
  if (schemaNode.enum && !schemaNode.enum.includes(value)) {
    errors.push(`${path}: value "${value}" not in allowed enum [${schemaNode.enum.join(', ')}]`);
  }
}
```

**Error handling pattern:** Always `throw`, never `console.warn` + return (CFG-02 hard-fail requirement; see Anti-Pattern / Pitfall 1 in RESEARCH.md). No try/catch swallowing in this module.

**Keyword scope:** Only implement `type`, `required`, `properties`, `enum`, `additionalProperties` — do not build a general JSON-Schema engine (RESEARCH.md "Don't Hand-Roll" table).

---

### `config/schema.json` (config, transform)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 200-224 (Pattern 1 excerpt).

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
      "required": ["amountInput", "feeRow", "minReceivedRow", "proceedCta", "confirmCta", "backBtn", "flowComplete"],
      "properties": {
        "amountInput": { "type": "string" },
        "feeRow": { "type": "string" },
        "minReceivedRow": { "type": "string" },
        "proceedCta": { "type": "string" },
        "confirmCta": { "type": "string" },
        "backBtn": { "type": "string" },
        "flowComplete": { "type": "string" }
      }
    }
  }
}
```

Note (RESEARCH.md Assumption A1): exact key naming (`amountInput` vs alternatives) is a free planning-time choice — not locked by any source doc. Only the seven `data-heed` selector *values* referenced from `config/demo-platform.json` are locked by CONTRACT.md.

---

### `config/demo-platform.json` (config, transform)

**Analog:** none in-repo. Must supply concrete `[data-heed="..."]` selector strings for all 7 locked CONTRACT.md selectors:
```
[data-heed="amount-input"]
[data-heed="fee-row"]
[data-heed="min-received-row"]
[data-heed="proceed-cta"]
[data-heed="confirm-cta"]
[data-heed="back-btn"]
[data-heed="flow-complete"]
```
Anti-pattern: never hardcode these literal strings inside `src/config.js` or `src/bus.js` — they belong only in this file (RESEARCH.md Anti-Patterns section).

---

### `src/bus.js` (utility, event-driven)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 232-246 (Pattern 2).

```javascript
// bus.js
const target = new EventTarget(); // private — never exported

export function publish(type, detail) {
  target.dispatchEvent(new CustomEvent(type, { detail }));
}

export function subscribe(type, handler) {
  const wrapped = (e) => handler(e.detail);
  target.addEventListener(type, wrapped);
  return () => target.removeEventListener(type, wrapped); // always return an unsubscribe fn
}
```

**Hard rule:** Never bind to `document`/`window` (Pitfall 2 — eavesdropping surface). Never construct `CustomEvent` anywhere outside this file (Pitfall 3 — payload must always be wrapped in `{ detail }`).

---

### `src/index.js` (service, request-response)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 304-317 ("Wiring init() to hard-fail before anything else runs").

```javascript
// index.js
import { validateConfig } from './config.js';
import { publish, subscribe } from './bus.js';
import schema from '../config/schema.json' assert { type: 'json' };

export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema); // throws synchronously on any violation
  // Only reachable if config is fully valid — nothing below this line
  // ever runs against a partially-valid config object.
  return { config, publish, subscribe };
}
```

**Error handling pattern:** No try/catch around `validateConfig` inside `init()` — let the throw propagate so SDK init stops entirely on invalid config (Pitfall 1).

---

### `test-harness/index.html` (component, event-driven)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 96-143 (System Architecture Diagram) and lines 248-252 (Pattern 3).

**Structure to follow:**
- Real, visible (not `display:none`) DOM elements carrying all 7 `data-heed` attributes from CONTRACT.md, loosely arranged to mirror Branch 1's screens (amount input, fee row, proceed/confirm/back buttons, completion marker).
- A debug panel of trigger buttons — one per signal type — each calling `bus.publish('signal:detected', {...})` with a synthetic-but-real payload: `targetSelector` read from the element's actual `data-heed` attribute, `bbox` from `getBoundingClientRect()` on the real element, `timestamp` from `Date.now()`. Never read `element.value`/`textContent` (No-PII rule).
- Single `<script src="../dist/sdk.js"></script>` tag — the same build artifact loaded unmodified in later phases.
- Explicit labeling per Pitfall 4: panel should be labeled as a plumbing/smoke-test surface (e.g., "Bus/Config Smoke Test — synthetic signals, not real touch/scroll detection"), not implied to be real signal-detection coverage.

---

### `tests/bus.test.js` (test, event-driven)

**Analog:** none in-repo. Canonical source: `01-RESEARCH.md` lines 319-350 ("Proving zero direct import between publisher and subscriber").

```javascript
// tests/fixtures/test-emitter.js — only imports bus.js
import { publish } from '../../src/bus.js';
export function emitSynthetic() {
  publish('signal:detected', { type: 'touch_hesitation', targetSelector: 'confirm-cta', bbox: {}, timestamp: Date.now() });
}
```
```javascript
// tests/fixtures/test-subscriber.js — only imports bus.js, never test-emitter.js
import { subscribe } from '../../src/bus.js';
export function collectReceived(onReceive) {
  return subscribe('signal:detected', onReceive);
}
```
```javascript
// tests/bus.test.js — wires the two together from the outside; neither fixture imports the other
import { describe, it, expect, vi } from 'vitest';
import { emitSynthetic } from './fixtures/test-emitter.js';
import { collectReceived } from './fixtures/test-subscriber.js';

describe('BUS-01: decoupled publish/subscribe', () => {
  it('delivers a published signal to a subscriber with no direct import between them', () => {
    const handler = vi.fn();
    collectReceived(handler);
    emitSynthetic();
    expect(handler).toHaveBeenCalledOnce();
    expect(handler.mock.calls[0][0]).toMatchObject({ type: 'touch_hesitation' });
  });
});
```
Additionally assert `event.detail` deep-equals the published payload (Pitfall 3 warning sign — don't just assert the handler fired).

---

### `tests/config.test.js` (test, request-response)

**Analog:** none in-repo. Use the CFG-01/CFG-02 rows of RESEARCH.md's "Phase Requirements → Test Map" (lines 393-398) as the assertion targets:
- CFG-01: `demo-platform.json` validates cleanly against `schema.json` and resolves all 7 CONTRACT.md selectors.
- CFG-02: an invalid/missing-field config object causes `validateConfig()` to `throw` (not warn-and-return) — assert with `expect(() => validateConfig(badConfig, schema)).toThrow()`.

---

### `package.json` / `vitest.config.js` (config)

**Analog:** none in-repo. Dependencies and versions per RESEARCH.md "Standard Stack":
```bash
npm init -y
npm install -D vitest@4.1.10 happy-dom@20.10.6 esbuild@0.28.1 @playwright/test@1.61.1
```
`vitest.config.js` must set `environment: 'happy-dom'` (not jsdom — RESEARCH.md cites a documented jsdom `CustomEvent` construction gap, github.com/vitest-dev/vitest/issues/791).

## Shared Patterns

### Hard-fail validation (no soft-fail/warn-and-continue)
**Source:** RESEARCH.md Pitfall 1
**Apply to:** `src/config.js`, `src/index.js`, `tests/config.test.js`
Never `console.warn` + return on invalid config; always `throw`. `init()` must not wrap `validateConfig()` in a try/catch that swallows the error.

### Private EventTarget only — never `document`/`window`
**Source:** RESEARCH.md Pattern 2 / Pitfall 2
**Apply to:** `src/bus.js`, `test-harness/index.html`, `tests/bus.test.js`
All internal `signal:*`/`inference:*` events must dispatch/listen against the module-private `EventTarget` instance in `bus.js`, never on `document`/`window`.

### CustomEvent payload always wrapped in `{ detail }`
**Source:** RESEARCH.md Pitfall 3
**Apply to:** `src/bus.js` (sole place `CustomEvent` is constructed), `test-harness/index.html` debug panel (must call `bus.publish`, never construct `CustomEvent` directly)

### No PII in payloads
**Source:** CLAUDE.md hard rules; RESEARCH.md "Project Constraints"
**Apply to:** `test-harness/index.html` debug panel, `tests/bus.test.js` fixtures — signal payloads are bbox + timestamp only, never `element.value`/`textContent`/cookies/localStorage.

### Selector strings live only in config files
**Source:** RESEARCH.md Anti-Patterns
**Apply to:** `config/demo-platform.json` (owns literal `[data-heed="..."]` strings), never hardcoded in `src/config.js` or `src/bus.js`.

## No Analog Found

All 9 files in this phase's scope have no existing analog in this repo — this is expected and correct for a first-phase greenfield build on a branch that (per `git ls-files`) contains only planning docs and spec text files. The planner should treat the code excerpts embedded above (sourced from `01-RESEARCH.md`'s Code Examples and Architecture Patterns sections) as this phase's de facto analogs.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `package.json` | config | — | Greenfield repo, no existing package.json anywhere on this branch |
| `vitest.config.js` | config | — | Greenfield repo, no existing test config |
| `config/schema.json` | config | transform | Greenfield repo, no existing config directory |
| `config/demo-platform.json` | config | transform | Greenfield repo, no existing config directory |
| `src/config.js` | utility | transform | Greenfield repo, no existing src directory |
| `src/bus.js` | utility | event-driven | Greenfield repo, no existing src directory |
| `src/index.js` | service | request-response | Greenfield repo, no existing src directory |
| `test-harness/index.html` | component | event-driven | Greenfield repo, no existing test-harness directory |
| `tests/config.test.js` | test | request-response | Greenfield repo, no existing tests directory |
| `tests/bus.test.js` | test | event-driven | Greenfield repo, no existing tests directory |

## Metadata

**Analog search scope:** Full repo (`git ls-files`) — 34 tracked files, all planning/docs/spec text, zero application source code.
**Files scanned:** 34 (git-tracked); 0 relevant application-code analogs found.
**Pattern extraction date:** 2026-07-11
</content>
</invoke>
