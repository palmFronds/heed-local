# Phase 3: Inference Layer — Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 8
**Analogs found:** 6 / 8 (2 files — `admin/generate-weights.mjs`, `admin/weights.js` — have no
existing analog in `src/`; RESEARCH.md's Code Examples section is their primary source instead)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/inference.js` | service (pure compute + bus producer/consumer) | event-driven | `src/signal.js` | exact (choke-point payload builder + bus wiring) |
| `admin/generate-weights.mjs` | utility (build-time script) | batch/transform | none in `src/` — closest structural analog is `src/config.js`'s "pure function, throws on failure, returns validated shape" discipline, but role/environment differ (Node CLI script, not browser module) | no-analog |
| `admin/weights.js` | config/data (generated static module) | n/a (static export) | `config/demo-platform.json` (generated-config-as-committed-file precedent, though that one is hand-written not generated) | partial (role-match only) |
| `src/index.js` (modified) | orchestrator/wiring | request-response (init) | itself, prior version | exact — extend existing pattern in place |
| `config/schema.json` (modified) | config schema | CRUD (validation) | itself, prior version — extend `signals.*` precedent | exact |
| `tests/inference.test.js` | test | request-response (pure-function assertions) | `tests/signal.test.js` | exact (describe/it per requirement ID, fixture-based) |
| `tests/inference-endsession.test.js` | test | event-driven (state-mutation assertions) | `tests/signal.test.js` (touch-hesitation timer test's before/after state-diffing style) | role-match |
| `package.json` (modified) | config | n/a | itself, prior version | exact |

## Pattern Assignments

### `src/inference.js` (service, event-driven)

**Analog:** `src/signal.js` (choke-point + module-scoped state + bus wiring), `src/bus.js` (publish/subscribe contract)

**Imports pattern** — mirror `src/signal.js` lines 1-5, but this file is BOTH producer and consumer
(unlike `signal.js`, which only imports `publish`):
```javascript
import { publish, subscribe } from './bus.js';
import coldStartWeights from '../admin/weights.js';
```

**Choke-point payload-builder pattern** — mirror `src/signal.js` lines 7-46 (`buildPayload`'s
single-function-constructs-every-published-object discipline, with a why-comment explaining what
invariant is enforced structurally). Apply the same discipline to `inference:result`'s construction:
one function/block builds the full payload object, so the D-01 "always publish, gate only `fires`"
rule and the (RESEARCH.md Open Question #2) pass-through-fields decision have a single place to
audit.

**Module-scoped state pattern** — mirror `src/signal.js` lines 134-141, 199-217 (`maxScrollY`,
`thresholdCrossed`, `attachedElements`, `lastPathname`, `flowCompleteFlag` — all module-scoped
`let`/`const` with a why-comment on each explaining what it remembers and why it's safe as
module-level state for a single page-load lifetime). `inference.js` needs the same shape for
`activeWeights` and `lastInference`:
```javascript
let activeWeights = coldStartWeights; // INF-05: cold-start default until config injects learned weights
// Module-scoped, mirrors signal.js's lastPathname/flowCompleteFlag pattern — remembers the last
// inference so endSession (called later, with no signal payload of its own) has an input to train on.
let lastInference = null;
```

**Bus subscription pattern** — mirror `src/signal.js`'s `initSignalCapture` idempotency-guard shape
(lines 307-353, the `initialized` boolean guard against double-registration) for `initInference`'s
`subscribe('signal:detected', ...)` call — subscribe exactly once per init, never accumulate
duplicate handlers across repeat calls.

**Core forward-pass / gate pattern** — see RESEARCH.md Code Examples "Hand-Written Forward Pass" and
"Confidence Gate & Bus Publish" (lines 283-373 of 03-RESEARCH.md) — this is the primary source
since no prior phase has a numeric-computation analog; the `oneHot`/`argmax`/`forwardPass` trio
follows `signal.js`'s "small named pure helper functions, no classes" convention (confirmed via
`relu`/`softmax` shape matching `resolveTargets`/`checkScrollReversal`'s style).

**Error handling** — no analog needed: `src/signal.js` has no try/catch (DOM listeners don't throw
in normal operation); `src/config.js` is the codebase's only throw-on-invalid precedent
(`validateConfig`, hard-fail, never soft-fail). `inference.js`'s `forwardPass`/`gradientStep` are
pure math with no user-facing invalid-input path in Phase 3 scope — RESEARCH.md's Security Domain
section explicitly defers `config.inference.weights` shape validation to `config.js`'s existing
CFG-02 hard-fail pattern as a discretionary addition, not a Phase 3 requirement.

---

### `admin/generate-weights.mjs` (utility, batch/transform) — NO CODEBASE ANALOG

No file in `src/`, `admin/`, or `config/` performs a build-time/Node-only transform — this is a new
role for the codebase. Use RESEARCH.md's Code Examples "Empirically-Verified Cold-Start Training
Recipe" (03-RESEARCH.md lines 605-652) verbatim as the primary source; it is already a complete,
tested recipe (15/15 empirical reproducibility). Structural convention to preserve from `src/`:
plain named functions (`extractWeights`), no classes, ESM `import`/`export` (matches
`package.json`'s existing `"type": "module"`).

---

### `admin/weights.js` (config/data, static) — NO CODEBASE ANALOG (generated)

**Closest structural precedent:** `config/demo-platform.json` — a committed, statically-shaped data
file that `src/index.js` imports directly (`import demoConfig from '../config/demo-platform.json'`,
`src/index.js` line 8). `admin/weights.js` follows the same "import a plain data object, no logic"
shape, but as a `.js` module (`export default {...}`) rather than `.json`, since it's
esbuild-bundled into `dist/sdk.js` alongside `src/inference.js`'s import of it. Use RESEARCH.md's
exact output-file template (03-RESEARCH.md lines 647-651):
```javascript
// GENERATED by admin/generate-weights.mjs -- do not hand-edit.
// Regenerate with: npm run generate-weights
export default { W1: [...], b1: [...], W2: [...], b2: [...] };
```

---

### `src/index.js` (modified — orchestrator/wiring)

**Analog:** itself (prior version, Phase 1/2 wiring of `initSignalCapture`)

**Full existing file** (`src/index.js`, all 38 lines, read above) is the pattern: `init()` calls
`validateConfig` first (hard-fail, no try/catch), then wires the signal layer, then returns
`{ config, publish, subscribe }`. Extend this exact shape:
```javascript
import { initSignalCapture } from './signal.js';
import { initInference } from './inference.js'; // NEW

export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  initSignalCapture(config);
  initInference(config); // NEW — wired after signal capture, same hard-fail-first ordering
  return { config, publish, subscribe };
}
```
**Why-comment convention to preserve:** the existing file's comment on line 21-23 ("Signal listeners
attach only AFTER hard-fail validation passes...") should get a parallel comment for
`initInference(config)` explaining it's wired the same way — never against an unvalidated config.

---

### `config/schema.json` (modified — config schema)

**Analog:** itself (prior version) — specifically the `signals` object added in Phase 2 (lines
29-46), which is the exact precedent RESEARCH.md's Recommended Project Structure section already
cites verbatim: "Following the exact Phase-2 precedent of adding optional `signals.*` fields
without touching `required`." Add a new top-level `inference` object sibling to `signals`, same
shape convention (optional object, optional numeric/object sub-properties, never added to the
top-level `required` array):
```json
"inference": {
  "type": "object",
  "properties": {
    "confidenceThreshold": { "type": "number" },
    "weights": { "type": "object" }
  }
}
```
**Validator compatibility note:** `src/config.js`'s `walk()` function (read above, lines 15-37) has
no `additionalProperties: false` enforcement — confirmed directly — so this addition is fully
backward-compatible with `config/demo-platform.json` needing no changes, exactly as the Phase-2
`signals.*` addition was.

---

### `tests/inference.test.js` / `tests/inference-endsession.test.js` (test, request-response / event-driven)

**Analog:** `tests/signal.test.js`

**File-header RED-suite convention** (mirror lines 1-5): a comment stating which requirement IDs
this file covers and why it doesn't exist/resolve yet at Wave 0.

**Fixture + describe/it-per-requirement-ID convention** (mirror lines 42-60): `describe('INF-01', ...)`
blocks, one per requirement ID, matching RESEARCH.md's Phase Requirements → Test Map table exactly
(`INF-01` through `INF-05` in `inference.test.js`; `INF-04` in the separate
`inference-endsession.test.js`, per RESEARCH.md's explicit "kept in a separate file mirroring Phase
2's precedent of isolating distinct-concern test suites").

**Bus-subscriber test-fixture pattern:** `tests/signal.test.js` imports `collectReceived` from
`./fixtures/test-subscriber.js` (line 8) to capture published bus events — `inference.test.js`
should use the same fixture/helper to assert on `inference:result` payloads, subscribing before
calling `initInference`/publishing a synthetic `signal:detected` event, mirroring
`tests/signal.test.js`'s `attachListeners(demoConfig); const received = []; collectReceived(...)`
sequence (lines 53-55).

**State-diffing convention for `endSession`:** no direct analog exists in `tests/signal.test.js`
for before/after module-state diffing, but RESEARCH.md's own empirical methodology (Pattern 4,
"Empirical proof... before/after weight snapshots") is the direct source: call `endSession` once,
snapshot `activeWeights`-derived output (e.g. re-run `forwardPass` on a fixed input and diff probs),
call it again, assert a second distinct change — never a no-op or per-signal mutation.

---

### `package.json` (modified — config)

**Analog:** itself (prior version)

Add to `devDependencies` (alphabetical, matching existing sort order: `@playwright/test`, `esbuild`,
`happy-dom`, `vitest` → insert `brain.js` between `@playwright/test` and `esbuild`):
```json
"brain.js": "2.0.0-beta.24",
```
Add to `scripts` (matching existing `"test"`/`"build"` key style, no trailing comment needed since
none of the existing scripts have one):
```json
"generate-weights": "node admin/generate-weights.mjs"
```

## Shared Patterns

### Bus publish/subscribe contract
**Source:** `src/bus.js` (full file, 28 lines)
**Apply to:** `src/inference.js`
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
Never construct a `CustomEvent` directly outside `bus.js` — always go through `publish()`.

### Choke-point payload construction with why-comments
**Source:** `src/signal.js` `buildPayload()` (lines 7-21 comment + 22-46 body)
**Apply to:** `src/inference.js`'s `inference:result` payload construction
A single function/block builds every object handed to `publish()`; the comment above it states,
structurally, what invariant that choke point enforces (for `signal.js` it's the No-PII firewall;
for `inference.js` it should state which fields D-01 requires vs. which are RESEARCH.md-recommended
pass-through additions).

### Module-scoped state, no classes
**Source:** `src/signal.js` (`maxScrollY`, `thresholdCrossed`, `attachedElements`, `lastPathname`,
`flowCompleteFlag`, `initialized` — all top-level `let`/`const`)
**Apply to:** `src/inference.js` (`activeWeights`, `lastInference`)
Every piece of state gets its own why-comment explaining what it remembers, why module scope is
safe (single page-load lifetime), and which single function is allowed to mutate it.

### Hard-fail config validation, no soft defaults inside validateConfig
**Source:** `src/config.js` (full file, 38 lines) — `walk()`/`validateConfig()`
**Apply to:** `config/schema.json` extension (already covered above) — no changes needed to
`src/config.js` itself this phase; `inference.js`'s own `config.inference?.weights ?? coldStartWeights`
and `config.inference?.confidenceThreshold ?? 0.65` nullish-coalescing defaults happen in
`inference.js`, not in the schema validator, exactly mirroring how `config.signals?.touchHesitation
?.thresholdMs ?? 800` defaults are read in `src/signal.js` line 81 (not in `config.js`).

### Test file structure: RED-suite header + describe-per-requirement-ID
**Source:** `tests/signal.test.js` (lines 1-9 header, lines 42-60 describe/it shape)
**Apply to:** `tests/inference.test.js`, `tests/inference-endsession.test.js`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `admin/generate-weights.mjs` | utility | batch/transform | No build-time/Node-only script exists anywhere in the codebase yet; RESEARCH.md's Code Examples section (already empirically verified, 15/15 reproducibility) is the primary and sufficient source instead of a codebase analog. |
| `admin/weights.js` | config/data | n/a | No generated (as opposed to hand-written) data file precedent exists; `config/demo-platform.json` is the closest structural sibling (plain imported data object) but is hand-authored, not generated — noted as partial match above. |

## Metadata

**Analog search scope:** `src/` (all 4 existing modules: `bus.js`, `signal.js`, `index.js`,
`config.js`), `config/` (`schema.json`, `demo-platform.json`), `tests/` (`signal.test.js` inspected
directly; `bus.test.js`, `config.test.js`, `index.test.js`, `signal-spa.test.js`, `harness.test.js`
identified via Glob but not individually re-read — `signal.test.js` alone was sufficient to
establish the shared test-file convention), `package.json`.
**Files scanned:** 6 read in full, 5 test files identified by name only (early-stopping — one
representative test file was enough to confirm the shared convention).
**Pattern extraction date:** 2026-07-16
