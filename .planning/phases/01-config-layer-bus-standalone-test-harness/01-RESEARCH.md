# Phase 1: Config Layer, Bus & Standalone Test Harness - Research

**Researched:** 2026-07-11
**Domain:** Zero-dependency vanilla-JS config validation, native pub/sub event bus, standalone SDK test harness
**Confidence:** MEDIUM-HIGH

## Summary

This phase builds the foundational plumbing three later phases depend on, and it is a genuinely greenfield build — no `package.json`, no `src/`, nothing exists on this branch yet except planning docs. The three deliverables (config validation, event bus, test harness) are all well-documented, convergent patterns with no exotic tooling decisions required, which is why the project-level research already flagged this phase as "standard patterns, skip research-phase." This document exists to answer the specific implementation-shape questions the phase description raised: how to validate config with zero runtime dependencies, which bus primitive to use, and how the test harness should be structured so it survives unmodified through Phases 2-5.

The recommended approach: (1) `config/schema.json` is authored in real (documented) JSON-Schema-draft-07 syntax restricted to a small keyword subset (`type`, `required`, `properties`, `enum`, `additionalProperties`), and `config.js`'s runtime validator is a tiny (~50-line) generic interpreter over exactly those keywords — not a hand-rolled field-by-field checklist and not a bundled library (Ajv/Zod/jjv all either ship a runtime dependency or require an extra build step disproportionate to one small file, and CLAUDE.md's "no dependencies except brain.js" rule forbids shipping a validator library in `sdk.js`). This keeps the documented schema and the enforced schema mechanically identical — there is no way for them to drift apart, because the validator literally reads `schema.json`'s declared keywords rather than encoding independent hardcoded knowledge of the config shape. (2) `bus.js` wraps a private, module-scoped `new EventTarget()` instance (never `document`/`window`, which would let host-page scripts eavesdrop on internal signals) with `publish()`/`subscribe()` helpers around `CustomEvent`'s `detail` field — this is the converged, zero-dependency pattern for decoupled module communication in vanilla JS and is already documented in this project's `ARCHITECTURE.md` (Pattern 1). (3) `test-harness/index.html` is a single static file containing the 7 real `data-heed` elements (so future phases' `signal.js` can attach real listeners against real markup) plus a debug panel of trigger buttons — one per signal type — that call `bus.publish('signal:detected', ...)` with synthetic-but-realistic payloads (using `getBoundingClientRect()` on the real target element for `bbox`), loading the build output via a single `<script src="../dist/sdk.js"></script>` tag so it never needs to change shape as later phases add real signal-capture logic underneath.

**Primary recommendation:** Hand-write a minimal generic JSON-Schema-subset interpreter (not a bundled validator library) driven directly by `schema.json`; use a private `EventTarget` instance as the bus; build the test harness as static markup + a synthetic-signal debug panel that stays structurally unchanged for the rest of the branch.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Config schema validation (hard-fail) | Browser / Client | — | Runs synchronously inside `sdk.js` at `init()`, before any DOM listener attaches; no server exists in this branch to validate config server-side |
| Internal pub/sub event bus | Browser / Client | — | In-memory, in-page communication channel; explicitly never touches the network (BUS-01) |
| Standalone test harness | Browser / Client | — | Static HTML file, no backend, no build step to view — this is the entire point of TEST-01 (decouples this branch from Branch 1's server/build status) |

No API/Backend, CDN/Static, or Database/Storage tier is involved in this phase — those only appear starting Phase 5 (local weight-push receiver).

## User Constraints

No `CONTEXT.md` exists for this phase (discuss-phase has not been run). This research proceeds directly from `PROJECT.md`, `REQUIREMENTS.md`, `CONTRACT.md`, and the phase description provided by the orchestrator. Constraints below are pulled from `CLAUDE.md` and `PROJECT.md` and function as locked decisions until a discuss-phase session overrides them.

## Project Constraints (from CLAUDE.md)

- **No PII ever.** Signal payloads are bbox + timestamp only. This phase's test-harness debug panel must construct synthetic payloads the same way — never read `element.value`, `element.textContent`, or any field content when building a trigger button's synthetic signal.
- **No external API calls during a session.** `bus.js` and `config.js` must never perform network I/O. The only outbound call in the whole SDK is the session-end weight push (Phase 5) — not applicable to this phase's deliverables at all.
- **No framework dependencies in the SDK. Vanilla JavaScript only.** No React/Vue/bundler dependency shipped to the partner; brain.js is the one allowed runtime dependency (not used in this phase). This directly rules out bundling Ajv/Zod/any schema-validation library into `sdk.js`.
- **No cross-branch contamination.** This branch (`feat/heed-sdk`) has its own `node_modules`/`package.json`/`.planning/`; nothing is imported from Branch 1 or Branch 3.
- **No scope expansion.** No dashboard, backend API, or CDN deploy work belongs in this phase.
- **The contract (CONTRACT.md) is locked.** The 7 `data-heed` selectors must be consumed exactly as named — `config/demo-platform.json` and `test-harness/index.html` reference them verbatim, never rename or add new ones without a CONTRACT.md update.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | `config/schema.json` (documented schema) + `config/demo-platform.json` target the 7 locked `data-heed` selectors from CONTRACT.md | Schema/config shape recommendation below (Code Examples); validator design ties `schema.json` directly to enforcement so the two files cannot silently drift apart |
| CFG-02 | Config validation hard-fails on invalid schema | Pitfall 1 below (soft-fail anti-pattern) + validator design throws synchronously before `init()` proceeds |
| BUS-01 | Internal event bus carries signals from `signal.js` to `inference.js` with no direct import and no signal leaving the browser | Pattern 1 (EventTarget-based bus) + Pitfall 2 below (never bind the bus to `document`/`window`) |
| TEST-01 | Standalone local test harness exposes all 7 `data-heed` selectors; every signal type can be manually triggered with no running Branch 1 and no backend | Test harness structure section + Open Question 1 (what "manually triggered" means before `signal.js` exists) |

## Standard Stack

### Core

No new runtime dependency is introduced in this phase — `config.js`, `bus.js`, and `index.js` are pure vanilla JS with zero imports beyond each other. This is a hard constraint (CLAUDE.md), not just a default.

### Supporting (dev-only, needed to satisfy this phase's testable exit criteria)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.10 [VERIFIED: npm registry] | Unit test runner for `config.js`/`bus.js` logic (hard-fail assertions, publish/subscribe round-trip) | Already selected at project level (`STACK.md`); confirmed current via `npm view vitest version` during this research session |
| happy-dom | 20.10.6 [VERIFIED: npm registry] | DOM/`EventTarget`/`CustomEvent` environment for Vitest | Already selected at project level over jsdom specifically because jsdom has known `TouchEvent` gaps (needed in Phase 2) and happy-dom natively supports `CustomEvent`/`dispatchEvent`, avoiding a documented jsdom pitfall (`window.CustomEvent` vs bare `CustomEvent` construction errors) [CITED: github.com/vitest-dev/vitest/issues/791] |
| esbuild | 0.28.1 [VERIFIED: npm registry] | Dev-only build step producing the flat `dist/sdk.js` the test harness loads via one `<script>` tag | Already selected at project level; not required to *exercise* this phase's logic in tests, but required to produce the artifact `test-harness/index.html` loads per TEST-01's "later load the same `sdk.js` unmodified" requirement |
| @playwright/test | 1.61.1 [VERIFIED: npm registry] | Optional smoke test that opens `test-harness/index.html` and asserts all 7 selectors resolve + a trigger button produces a bus event | Already selected at project level for browser-real integration tests; this phase is the first place it could run against real markup |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written generic schema-subset interpreter in `config.js` | Ajv (with `ajv-cli compile` to generate a standalone validation function at build time) | Removes the Ajv *runtime* dependency from the shipped bundle, but still requires an extra `ajv-cli` build step and produces generated code with residual references to Ajv's runtime folder unless run through a second bundler pass [CITED: ajv.js.org/standalone.html] — disproportionate tooling for one small, stable config shape; not recommended for v1 |
| Hand-written generic schema-subset interpreter | Zod / jjv (zero-dependency validator libraries) | Genuinely zero-dependency at the library level, but still an added *file* shipped in `sdk.js` for functionality a ~50-line hand-written interpreter covers completely for this project's flat, shallow config shape; violates the spirit of "no dependencies except brain.js" even though technically dependency-free at the npm level |
| Private `new EventTarget()` instance for the bus | Hand-rolled `Map<eventName, Set<callback>>` pub/sub class | Both are valid zero-dependency options; `EventTarget` is recommended because it reuses browser-native, battle-tested dispatch/listener bookkeeping (no need to hand-write add/remove/dispatch logic) [CITED: css-tricks.com/lets-create-a-lightweight-native-event-bus-in-javascript] — a hand-rolled `Map`-based bus is an acceptable fallback only if `CustomEvent`'s `detail`-wrapping is found to be awkward for the typed payload shapes Phase 3 introduces |

**Installation:**
```bash
npm init -y
npm install -D vitest@4.1.10 happy-dom@20.10.6 esbuild@0.28.1 @playwright/test@1.61.1
```

**Version verification:** Confirmed live against the npm registry during this research session (2026-07-11) — all four versions match the project-level `STACK.md` findings from 2026-07-10, no drift.
```
npm view vitest version       # 4.1.10
npm view happy-dom version    # 20.10.6
npm view esbuild version      # 0.28.1
```

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|--------------|---------|-------------|
| vitest | npm | Published 2026-07-06 (5 days before this research) | 75,033,961/wk | github.com/vitest-dev/vitest | SUS ("too-new") | Flagged by the automated age heuristic on **latest version publish date**, not package legitimacy — 75M weekly downloads and an active, well-known GitHub org make this a false positive. No `checkpoint:human-verify` needed; documented here for audit-trail completeness per protocol. |
| happy-dom | npm | Published 2026-06-17 | 11,278,600/wk | github.com/capricorn86/happy-dom | SUS ("too-new") | Same false-positive pattern — high download volume, established repo, already independently verified in project-level `STACK.md` via npm registry + version-pairing check with Vitest 4.x. |
| esbuild | npm | Published 2026-06-11 | 250,680,368/wk | github.com/evanw/esbuild | SUS ("too-new") | Same pattern. `postinstall: node install.js` is esbuild's well-documented platform-binary downloader (fetches its own prebuilt binary from the npm registry, not an arbitrary external endpoint) — not a suspicious script in the sense the gate is designed to catch. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** vitest, happy-dom, esbuild — all three flagged solely by the "too-new" (recent latest-version-publish) heuristic, not by low-downloads/no-repo/no-source signals. Given each has tens-to-hundreds of millions of weekly downloads and a public, well-known source repo, and each was already cross-verified via direct npm registry query in the project-level `STACK.md` research (2026-07-10) and again in this session (2026-07-11), the planner may treat these as effectively `[VERIFIED: npm registry]` for planning purposes rather than inserting a blocking `checkpoint:human-verify` — but per protocol, document this reasoning explicitly rather than silently overriding the gate.

*No packages in this phase were discovered via WebSearch/training-data package-name guessing — all four were already pinned in the project-level `STACK.md` (itself npm-registry-verified) and re-confirmed live in this session.*

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  test-harness/index.html (static, no build step to open)         │
│                                                                   │
│  [data-heed="amount-input"]   [data-heed="fee-row"]              │
│  [data-heed="min-received-row"]  [data-heed="proceed-cta"]       │
│  [data-heed="confirm-cta"]    [data-heed="back-btn"]             │
│  [data-heed="flow-complete"]                                     │
│                                                                   │
│  Debug panel: [Trigger touch_hesitation] [Trigger blur_incomplete]│
│               [Trigger scroll_reversal]  [Trigger back_intent]   │
│                                                                   │
│  <script src="../dist/sdk.js"></script>  ← same artifact Phase 2+ │
│                                             loads unmodified      │
└───────────────────────────┬───────────────────────────────────────┘
                             │ index.js: init(config)
                             ▼
              ┌──────────────────────────────┐
              │ config.js                     │
              │  load demo-platform.json       │
              │  validate against schema.json  │
              │  → throws on ANY violation      │  ← CFG-02: hard-fail,
              │    (init() never proceeds       │     no partial init
              │     past this point on failure) │
              └──────────────┬────────────────┘
                             │ validated config object (read-only)
                             ▼
              ┌──────────────────────────────┐
              │ bus.js                        │
              │  private new EventTarget()     │  ← never document/window
              │  publish(type, detail)         │
              │  subscribe(type, handler)      │
              └───┬────────────────────────┬───┘
                  │ publish                │ subscribe
                  ▼                        ▼
     ┌────────────────────┐   ┌────────────────────────┐
     │ debug-panel trigger │   │ debug-panel log/subscriber│
     │ button click        │   │ panel (proves receipt,    │
     │ (Phase 1 stand-in   │   │ zero import from the      │
     │ for real signal.js) │   │ trigger module)           │
     └────────────────────┘   └────────────────────────┘
```

A reader can trace the primary use case (open the harness, click a trigger button, see it logged) entirely through this diagram: DOM → `index.js` init → config validation (hard gate) → bus → decoupled subscriber, with the debug panel standing in for `signal.js`/`inference.js` until Phases 2-3 land underneath it without changing this shape.

### Recommended Project Structure

```
heed-sdk/
├── src/
│   ├── config.js           # schema.json loader + generic keyword-subset validator (throws on invalid)
│   ├── bus.js               # private EventTarget wrapper: publish()/subscribe()
│   └── index.js             # init() orchestrator: load+validate config → build bus → (Phase 2+ wires signal.js here)
├── config/
│   ├── schema.json          # documented JSON-Schema-draft-07-shaped contract (CFG-01)
│   └── demo-platform.json   # concrete values targeting the 7 CONTRACT.md selectors (CFG-01)
├── test-harness/
│   └── index.html            # static harness: real data-heed markup + synthetic-signal debug panel (TEST-01)
├── tests/
│   ├── config.test.js         # CFG-01/CFG-02 unit tests
│   └── bus.test.js            # BUS-01 unit test (decoupled emitter/subscriber fixtures)
├── package.json
└── vitest.config.js           # environment: 'happy-dom'
```

### Pattern 1: Schema-Driven Generic Validator (not field-specific hand-rolled checks)

**What:** Write `schema.json` in real JSON-Schema-draft-07 syntax, restricted to a small keyword subset the hand-written interpreter actually implements: `type`, `required`, `properties`, `enum`, `additionalProperties`. `config.js`'s `validateConfig(config, schema)` walks `schema.properties` generically — for each declared property, check `type` matches, check membership in `required`, check `enum` membership if declared — rather than writing one hardcoded `if (!config.selectors.amountInput) throw ...` per field. This keeps the *documented* schema (CFG-01) and the *enforced* schema (CFG-02) mechanically identical: there is no second, independent set of hardcoded field checks that could silently drift from what `schema.json` documents.
**When to use:** Any small, flat-to-one-level-nested config contract where a full JSON Schema library would be disproportionate overhead, but a purely hand-rolled per-field checklist risks documentation/enforcement drift.
**Example:**
```javascript
// config.js — generic interpreter over a restricted JSON-Schema-draft-07 subset
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
```json
// config/schema.json (excerpt) — documented, draft-07-shaped, and literally what the validator above executes
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
The seven `selectors.*` keys above map 1:1 to CONTRACT.md's seven `data-heed` values (each string value is expected to literally be `[data-heed="..."]`, matched at attach time by `document.querySelector`). Exact key naming (`amountInput` vs `amount_input` vs a differently-shaped nesting) is a planning-time decision, not locked by any source document — see Assumption A1.

### Pattern 2: Private EventTarget Bus, Never `document`/`window`

**What:** `bus.js` creates its own `new EventTarget()` instance, module-scoped and never exported directly — only `publish`/`subscribe` wrapper functions are exported. Binding the bus to `document` or `window` instead (a shortcut sometimes seen in quick EventTarget-bus tutorials) would technically work for internal wiring, but means *any* script on the host page could call `document.addEventListener('signal:detected', ...)` and observe internal Heed signal traffic — a violation of this SDK's "generic, host-DOM-untouched" design goal even though it's not a PII leak per se (payloads are already bbox/timestamp-only). A private instance makes eavesdropping structurally impossible, not just discouraged.
**When to use:** Always, for this SDK — this is the only bus wiring compatible with BUS-01's "no signal leaving the browser" framing extended to its logical conclusion (no signal leaving the *module*, either).
**Example:**
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
[CITED: css-tricks.com/lets-create-a-lightweight-native-event-bus-in-javascript]

### Pattern 3: Test Harness as Static Markup + Synthetic-Signal Debug Panel

**What:** `test-harness/index.html` serves two distinct purposes that should not be conflated: (a) it is the *real DOM* future phases' `signal.js` will attach real listeners to — so the 7 `data-heed` elements must be genuine, positioned, visible elements (not `display:none` stubs), ideally arranged to loosely mirror Branch 1's screens (an amount input, a fee row below it, a proceed button, etc.) so scroll-based and touch-based signals are meaningfully testable later; (b) for *this* phase, before `signal.js` exists, it also needs a debug panel whose buttons directly call `bus.publish('signal:detected', {type, targetSelector, bbox, timestamp})` with synthetic-but-real data (`targetSelector` read from the element's actual `data-heed` attribute, `bbox` from `getBoundingClientRect()` on the real element, `timestamp` from `Date.now()`) — proving the config-load → bus → subscriber pipeline works end-to-end without requiring real touch/scroll/blur/popstate detection logic. Both purposes share the same file and the same script tag (`<script src="../dist/sdk.js"></script>`), so nothing about the harness's structure needs to change when Phase 2 adds real signal detection underneath — the harness's DOM and debug panel remain valid regardless of whether a click is real or synthetic.
**When to use:** Any phase-1-style "prove the plumbing" harness that must remain stable while real logic is added in later phases without requiring the test surface to be rebuilt.
**Trade-offs:** The debug panel's synthetic triggers are not a substitute for Phase 2's real interaction tests (touch-hold timing, scroll-reversal depth, etc.) — they only prove the bus/config plumbing, not signal-detection correctness. See Open Question 1 below for how to make this scope boundary explicit in the harness UI itself (e.g., labeling the panel "Bus/Config Smoke Test" rather than implying it exercises real signal-detection logic).

### Anti-Patterns to Avoid

- **Hardcoding `data-heed` selector strings inside `config.js`'s validator or `bus.js`:** Selector values belong exclusively in `config/demo-platform.json`; the schema documents *which keys* are required, never the literal selector strings themselves (those come from CONTRACT.md via the concrete config file, not the schema). [Reaffirms `ARCHITECTURE.md` Anti-Pattern 1.]
- **Binding the bus to `document`/`window` instead of a private `EventTarget`:** See Pattern 2 — this is an eavesdropping surface, not just a style choice.
- **Writing a fully generic JSON-Schema-2020-12-compliant interpreter:** Overengineering for a flat, shallow, single-file config contract — implement only the keyword subset `schema.json` actually uses (Pattern 1), not a general-purpose validation engine.
- **Catching the validation error and `console.warn`-ing instead of throwing:** Directly violates CFG-02 and the phase's success criterion 2 ("hard-fail at init — not silently degrade or fall back to defaults"). See Pitfall 1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Full JSON Schema spec compliance (`$ref`, `allOf`/`oneOf`, format validators, etc.) | A general-purpose JSON Schema engine | The restricted keyword-subset interpreter in Pattern 1 (`type`/`required`/`properties`/`enum`) | This config file is flat and small; a general engine is disproportionate complexity and itself becomes an untested surface for a config-validation phase whose entire point is reliability |
| Event dispatch/listener bookkeeping (add/remove/fire, once-semantics, error isolation between handlers) | A hand-rolled `Map<eventName, Set<callback>>` pub/sub class from scratch | Native `EventTarget` (Pattern 2) | Browser-native, already handles multiple listeners per event type, listener removal, and per-handler error isolation (an uncaught exception in one `EventTarget` listener does not stop other listeners from firing) — reimplementing this is pure risk for zero benefit at zero dependency cost either way |

**Key insight:** Everything in this phase has a correct, zero-dependency, browser-native or trivially-hand-writable answer — the risk here isn't missing tooling, it's over-building (a full schema engine) or under-building (soft-fail validation, a bus bound to `document`) relative to what the phase's success criteria actually require.

## Common Pitfalls

### Pitfall 1: Config validation implemented as a warning instead of a hard fail

**What goes wrong:** `validateConfig()` logs `console.warn('[heed] config issue: ...')` and returns the config anyway (possibly merged with defaults), so `init()` proceeds with a partially-invalid config — e.g., a missing `selectors.confirmCta` key silently means that signal never attaches, with no visible error anywhere.
**Why it happens:** Warn-and-continue feels "more robust" during early development (nothing ever crashes), and it's the default instinct when writing a validator before the hard-fail requirement is top of mind.
**How to avoid:** `validateConfig()` must `throw` (not `console.warn` + return) on any violation; `index.js`'s `init()` must never call `try/catch` around this specific call in a way that swallows the error and continues — let it propagate and stop SDK initialization entirely. This is a stated project-level pitfall already (see `.planning/research/PITFALLS.md`, Security Mistakes table).
**Warning signs:** Any code path where `validateConfig` returns a value on the invalid branch instead of throwing; any `try { validateConfig(...) } catch { /* fall back to defaults */ }` in `index.js`.

### Pitfall 2: Bus bound to `document`/`window` instead of a private instance

**What goes wrong:** `bus.js` does `export const bus = document;` or dispatches `CustomEvent`s on `window` for convenience (auto-completion, easier debugging in DevTools' Event Listeners panel). This makes every internal signal observable by any other script running on the host page via `addEventListener`.
**Why it happens:** Tutorials on "lightweight native event bus" patterns sometimes use `document` directly because it's already globally available and needs no `new EventTarget()` line — the shortcut looks harmless since `EventTarget`'s API surface is identical either way.
**How to avoid:** Always instantiate a private `new EventTarget()` inside `bus.js` and never export the raw instance — only the `publish`/`subscribe` wrapper functions (Pattern 2).
**Warning signs:** Any `dispatchEvent`/`addEventListener` call in the codebase targeting `document` or `window` for internal `signal:*`/`inference:*` event types.

### Pitfall 3: `CustomEvent` constructed without wrapping the payload in `detail`

**What goes wrong:** `new CustomEvent(type, payload)` instead of `new CustomEvent(type, { detail: payload })` — the payload silently disappears (subscribers receive `event.detail === undefined`) because `CustomEvent`'s second argument is an `EventInit`-shaped options object, not the payload itself.
**Why it happens:** Easy to conflate with the plain `Event` constructor or with `dispatchEvent`'s simpler mental model; the mistake produces no error, just silently-empty payloads on every subscriber.
**How to avoid:** Centralize `CustomEvent` construction inside `bus.js`'s `publish()` function only (Pattern 2's example) — no other module should ever construct a `CustomEvent` directly, eliminating the chance of this mistake recurring at each call site.
**Warning signs:** Subscriber handlers receiving `undefined` where a payload object was expected; unit test in `tests/bus.test.js` should explicitly assert `event.detail` deep-equals the published payload, not just that the handler fired.

### Pitfall 4: `test-harness/index.html`'s debug panel is mistaken for real signal-detection coverage

**What goes wrong:** Because the debug panel's trigger buttons *look* like they exercise "touch hesitation," "scroll reversal," etc., it's easy to treat Phase 1's harness as having already validated those signal types, and skip or under-scope the real DOM-interaction tests Phase 2 needs (press-and-hold timing, movement-displacement cancellation, scroll-depth-then-reversal, etc.).
**Why it happens:** The button labels and the actual signal *names* (`touch_hesitation`, `scroll_reversal`, ...) are identical between the synthetic Phase-1 trigger and the real Phase-2 detection logic, even though what's being tested is completely different (bus plumbing vs. real event-timing logic).
**How to avoid:** Label the debug panel explicitly as a plumbing/smoke-test surface (e.g. "Bus Smoke Test — synthetic signals, not real touch/scroll detection") and do not treat any Phase 1 exit criterion as substituting for Phase 2's own signal-quality acceptance criteria (already specified in `.planning/research/PITFALLS.md` Pitfall 1 and the "Looks Done But Isn't" checklist).
**Warning signs:** Phase 2 planning treating "the test harness already has touch_hesitation" as done; no distinct Phase 2 exit criterion for real touch-timing/movement-cancellation logic.

## Code Examples

### Wiring init() to hard-fail before anything else runs

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
Source: derived directly from CFG-02's "hard-fail at init — not silently degrade" requirement plus Pattern 1/2 above.

### Proving zero direct import between publisher and subscriber (BUS-01's decoupling test)

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
This structure is what makes BUS-01's "no direct import between them" requirement mechanically verifiable, not just asserted by convention — `test-emitter.js` and `test-subscriber.js` each have exactly one import (`bus.js`), and static analysis (or simple code review) of those two files alone proves the decoupling.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `config/demo-platform.json`'s internal key naming (e.g. `selectors.amountInput`, `completionSelector`) — no source document locks these names, only the `data-heed` selector *values* are locked by CONTRACT.md | Standard Stack / Code Examples | Low — this is an internal implementation detail the planner/executor can freely choose; renaming later only touches this branch's own config/validator files, never CONTRACT.md or the other two branches |
| A2 | The Phase 1 test harness's "manually triggered" signal buttons publish *synthetic* bus events (not real DOM-interaction-triggered signals, since `signal.js` doesn't exist until Phase 2) | Architecture Patterns (Pattern 3), Open Question 1 | Medium — if the phase's actual intent is that TEST-01 requires real interaction-based triggering (e.g. an actual press-and-hold), this phase would need to pull forward some of Phase 2's signal-detection logic, materially changing scope; should be confirmed with the project owner or via discuss-phase before planning locks this in |
| A3 | Validator collects and reports *all* violations before throwing once (vs. throwing on the first violation found) | Pattern 1 | Low — either satisfies CFG-02's hard-fail requirement; collecting all violations is better DX (one error message lists everything wrong) but is a planning-time implementation choice, not a correctness requirement |

## Open Questions (RESOLVED)

1. **Does TEST-01's "every signal type can be manually triggered" mean synthetic bus-level triggering (Phase 1 scope) or real DOM-interaction triggering (which requires Phase 2's `signal.js`)?**
   - What we know: The phase depends on nothing and is explicitly designed to be testable before Phase 2 exists (per `STATE.md`'s recorded decision: "Standalone local static-HTML test harness (Phase 1) decouples Phases 1-5 from live Branch 1's build status"). `signal.js` — the module that would implement real touch/blur/scroll/popstate detection — is scoped entirely to Phase 2 (`SIG-01` through `SIG-06`).
   - What's unclear: Whether "manually triggered" in TEST-01's phrasing means a human physically performs the gesture (requiring real detection logic to exist) or a human clicks a debug button that synthesizes the signal event (requiring only the bus to exist).
   - **RESOLVED:** Confirmed directly with the project owner before planning — Phase 1's test harness is synthetic-trigger-only (Assumption A2, Pattern 3). The debug panel calls `bus.publish()` directly with synthetic, PII-free signal payloads (e.g. a "Simulate touch_hesitation" button); it does not implement real touchstart/blur/scroll/popstate detection. Real signal-capture logic (`signal.js`) remains entirely Phase 2's scope. This is the reading consistent with "Depends on: Nothing" and Phase 2 owning all real signal-detection logic. Reflected in plans `01-04` and `01-05`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Node.js | Running `npm install`, Vitest, esbuild build step | Yes | v22.20.0 | — |
| npm | Package installation | Yes | 10.9.3 | — |
| git | Version control (repo already initialized) | Yes | 2.50.1 | — |
| A modern browser (any, for opening `test-harness/index.html`) | TEST-01's manual verification | Assumed available on developer machine | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — this phase has no external service dependencies (no database, no running Branch 1, no network calls per CLAUDE.md).

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + happy-dom 20.10.6 (project-level selection; not yet installed — greenfield repo) |
| Config file | none yet — Wave 0 gap (`vitest.config.js` with `environment: 'happy-dom'` must be created) |
| Quick run command | `npx vitest run tests/config.test.js tests/bus.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| CFG-01 | `demo-platform.json` validates cleanly + resolves all 7 CONTRACT.md selectors | unit | `npx vitest run tests/config.test.js -t "CFG-01"` | ❌ Wave 0 |
| CFG-02 | Invalid/missing-field config hard-fails at init (throws, no fallback) | unit | `npx vitest run tests/config.test.js -t "CFG-02"` | ❌ Wave 0 |
| BUS-01 | Signal published by one module received by a separate subscriber module, zero direct import | unit | `npx vitest run tests/bus.test.js -t "BUS-01"` | ❌ Wave 0 |
| TEST-01 | Opening `test-harness/index.html` exposes all 7 selectors + every signal type triggerable | smoke (Playwright) or manual | `npx playwright test tests/e2e/harness.spec.js` (optional automation) or manual browser check | ❌ Wave 0 (manual is acceptable minimum; Playwright smoke test is a nice-to-have given the stack is already selected) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/config.test.js tests/bus.test.js`
- **Per wave merge:** `npx vitest run` (full suite — trivial cost at this project size)
- **Phase gate:** Full suite green, plus a manual open of `test-harness/index.html` confirming all 7 selectors resolve (`document.querySelectorAll('[data-heed]').length === 7` in DevTools) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `package.json` — does not exist yet (fully greenfield repo)
- [ ] `vitest.config.js` — `environment: 'happy-dom'`
- [ ] `tests/config.test.js` — covers CFG-01, CFG-02
- [ ] `tests/bus.test.js` — covers BUS-01 (with the decoupled-fixture pattern from Code Examples)
- [ ] Framework install: `npm install -D vitest@4.1.10 happy-dom@20.10.6 esbuild@0.28.1 @playwright/test@1.61.1`
- [ ] `test-harness/index.html` itself does not exist yet — TEST-01's deliverable

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | This phase has no auth surface — no users, no sessions in the auth sense |
| V3 Session Management | No | Not applicable to config/bus/harness plumbing |
| V4 Access Control | No | No access-control boundary exists in a client-only, single-tenant-per-page-load SDK |
| V5 Input Validation | Yes | The hand-written schema-subset validator (Pattern 1) *is* this phase's V5 control — config is the only external input this phase processes, and it must be rejected outright (hard-fail, CFG-02) rather than sanitized/coerced |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/malicious config causes wrong-selector targeting (e.g. a config value pointing at an unintended host-page element) | Tampering | Hard-fail schema validation (CFG-02) — the SDK must refuse to run rather than silently attach listeners based on unvalidated selector strings |
| Internal bus traffic observable by host-page scripts if bound to `document`/`window` | Information Disclosure | Private `EventTarget` instance (Pitfall 2 / Pattern 2) — structurally prevents any script outside `bus.js`'s module scope from observing internal signal traffic |
| `config/schema.json` loaded via a JSON import without validating it's actually the expected schema shape (e.g. schema.json itself corrupted) | Tampering | Out of scope for a v1 hard-fail gate on *config*, but worth noting: if `schema.json` itself is malformed, the validator's `walk()` will likely throw a JS error naturally (e.g. `Cannot read properties of undefined`) rather than silently passing everything — acceptable behavior for this phase, since `schema.json` is authored by the same team, not attacker-controlled input |

## State of the Art

No stale/deprecated patterns apply here — `EventTarget`, `CustomEvent`, and hand-written JSON Schema subset validation are all long-stable, unchanged browser/JS primitives with no recent breaking changes or newer recommended replacements.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `CONTRACT.md`, `CLAUDE.md` (this repo) — authoritative spec and constraints all research validates against
- `.planning/research/ARCHITECTURE.md`, `.planning/research/STACK.md`, `.planning/research/PITFALLS.md`, `.planning/research/SUMMARY.md` (this repo, project-level research, 2026-07-10) — Pattern 1 (bus) and the Config Layer anti-pattern are directly reaffirmed and extended here, not re-derived from scratch
- npm registry direct queries (`npm view vitest/happy-dom/esbuild version`) — 2026-07-11, this session — confirms no drift from the 2026-07-10 project-level `STACK.md` findings

### Secondary (MEDIUM confidence)
- [Let's Create a Lightweight Native Event Bus in JavaScript — CSS-Tricks](https://css-tricks.com/lets-create-a-lightweight-native-event-bus-in-javascript/) — private `EventTarget` pub/sub pattern
- [Ajv — Standalone validation code](https://ajv.js.org/standalone.html) — confirms standalone-generated Ajv validators still reference the Ajv runtime folder without an additional bundler pass
- [W3C testharness.js documentation](https://web-platform-tests.org/writing-tests/testharness.html) — convention reference for standalone browser-based test harness pages
- [MDN — Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API) — confirms `pushState()` does not itself fire `popstate` (relevant to future SPA-navigation test-harness additions in later phases)
- [vitest-dev/vitest Issue #791 — dispatchEvent with jsdom](https://github.com/vitest-dev/vitest/issues/791) — corroborates the project's existing happy-dom-over-jsdom choice

### Tertiary (LOW confidence)
- General WebSearch results on JSON Schema validator library comparisons (Zod/jjv/JSV) — used only to confirm the hand-written-validator recommendation is reasonable relative to alternatives, not as a basis for any specific implementation detail

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency introduced; existing dev-tooling versions re-verified live against npm registry this session, zero drift from prior research
- Architecture: MEDIUM-HIGH — patterns are convergent, well-documented browser-native practice (`EventTarget`, hand-written validators); no canonical single source for "the" pattern, but no ambiguity in the recommendation either
- Pitfalls: MEDIUM — cross-referenced against multiple sources plus this project's own prior pitfalls research; the `document`/`window`-as-bus pitfall is inferred from this project's own PII/no-network constraints applied to the bus, not found verbatim in any external source

**Research date:** 2026-07-11
**Valid until:** 2026-08-10 (30 days — all findings are stable, unchanging browser/JS primitives and already-pinned dependency versions, low volatility)
