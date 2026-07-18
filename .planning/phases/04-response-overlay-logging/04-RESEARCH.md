# Phase 4: Response Overlay & Logging - Research

**Researched:** 2026-07-18
**Domain:** Client-side DOM overlay rendering + structured console logging + session-lifecycle wiring, vanilla JS, no framework
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `signal.js`'s existing `checkFlowComplete()` (D-06, already visibility-checked and
  correct) is extended to `publish('flow:complete')` the moment `flowCompleteFlag` transitions from
  false to true — a new bus event, not a new detection mechanism. Whatever module owns
  session-lifecycle wiring this phase (likely `log.js` or `index.js`) subscribes to `flow:complete`,
  logs the `flow_complete` event, and calls `endSession(config, true)`. **Rationale:** reuses
  Phase 2's already-correct, already-tested completion detection instead of building a second,
  possibly-disagreeing DOM-watching path.
- **D-02:** `flow_abandoned` is detected via a `window.addEventListener('pagehide', ...)` listener
  — not `beforeunload` (unreliable on iOS Safari) and not `back_intent` alone (pressing back doesn't
  guarantee the user has actually left). At `pagehide`, if `flowCompleteFlag` is false, log
  `flow_abandoned` and call `endSession(config, false)`.
- **D-03:** An explicit once-per-session guard (a module-level `sessionEnded` boolean) ensures
  `endSession()` fires **exactly once** regardless of which path (`flow:complete` vs `pagehide`)
  reaches it first — the other path short-circuits. **Rationale:** `endSession()` is documented as
  non-idempotent — a second call against already-updated weights produces a second, distinct delta —
  so an unguarded double-call would double-count the session's learning signal.
- **D-04:** Response copy and the intent→response-type mapping are **hardcoded** in `response.js`
  per `04-UI-SPEC.md`'s exact strings — not read from a `config.responses.*` structure this phase.
  `config/schema.json` may declare an optional `responses` field for future per-partner overrides,
  but `demo-platform.json` does not set it in this phase.
- **D-05:** Only one response bubble is visible at a time. If a new above-threshold
  `inference:result` arrives while a bubble is already showing, the existing bubble is dismissed
  and the new one renders immediately in its place. **This requires adding a 4th `dismissReason`
  value** (`"replaced"`) beyond UI-SPEC's existing `"manual" | "cta" | "timeout"` enum — planner/
  executor should add `"replaced"` to that enum in `log.js`'s `response_dismissed` payload shape and
  flag the addition back to `04-UI-SPEC.md`.
- **D-06:** `activeScreens` gates **only** the logging layer and the response layer —
  `inference.js`'s `publish('inference:result', ...)` behavior is completely unchanged by this phase.
  Concretely: `log.js` checks `activeScreens` before writing any of the 6 log lines; `response.js`
  checks it before rendering a bubble, even when `fires === true`.
- **D-07:** `demo-platform.json`'s `activeScreens` value should list **every screen/route in the
  demo flow except the entry screen** ("Screen 1"). Exact pathname list is Claude's discretion at
  planning time.
- **D-08:** `sessionId` is generated via `crypto.randomUUID()` once per page load, inside
  `index.js`'s `init()`/`initDemo()`, stored in module state, and reused by every log entry and the
  `discount_offer` `postMessage` payload for that page load.
- **D-09:** `partnerId` is sourced directly from the existing `config.platformId` field — no new
  config field needed.

### Claude's Discretion

- Exact module/file boundary for session-lifecycle wiring (D-01/D-02/D-03) — whether the
  `flow:complete`/`pagehide` subscriptions and the `sessionEnded` guard live in `log.js`, `index.js`,
  or a new small module.
- Exact `demo-platform.json` `activeScreens` pathname list (D-07) — derive from the actual
  test-harness route structure during planning/research.
- Whether `config/schema.json`'s optional `responses` field (D-04) is added this phase as an unused
  placeholder or deferred entirely until a phase actually needs it.

### Deferred Ideas (OUT OF SCOPE)

- Fully config-driven `responses.*` copy/type mapping (per-partner customization) — deferred to a
  future phase/v2 per D-04.
- A separate `config.partnerId` field distinct from `platformId` — deferred per D-09.

None of the discussion strayed outside Phase 4's scope (response rendering + logging + session-end
trigger wiring only; weight persistence/push remains Phase 5, live Branch 1 integration remains
Phase 6).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RESP-01 | Single fixed full-viewport div injected at init, `pointer-events: none` on the container, `pointer-events: auto` on rendered response elements, host DOM untouched | See Architecture Patterns "Overlay Injection" and Code Examples — exact CSS string and DOM-injection pattern verified against `repo2_heed_sdk.txt` and 04-UI-SPEC.md |
| RESP-02 | `clampToViewport()` keeps responses within iOS safe-area insets on a 390px viewport | See Architecture Patterns "clampToViewport" and Common Pitfall "bbox is null for 2 of 4 response types" — the null-bbox fallback path is not an edge case, it is the ONLY path for 2 of 4 response types |
| RESP-03 | All 4 response types implemented: tooltip, nudge_copy, discount_offer (fires `postMessage`, does not fulfill the offer itself), social_proof | See Architecture Patterns "Response Types" and Code Examples "postMessage payload" — `partnerOrigin` config field recommended and verified against `repo0_overview.txt`'s `localhost:3000` runtime map |
| LOG-01 | Every entry `{ ts, sessionId, partnerId, event, data }`, 6 event types, `console.log('[heed]', JSON.stringify(entry))` | See Architecture Patterns "Session-Lifecycle Wiring" and Common Pitfalls — `activeScreens` gating and the config.js array-validation bug directly affect this requirement's implementation |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No PII ever.** Signal payloads (already enforced upstream) carry bbox + timestamp only. This
  phase must not introduce any new PII-adjacent field — `sessionId` is a random UUID (not derived
  from user data), `partnerId` is a static platform identifier, both PII-safe.
- **No external API calls during a session.** The `discount_offer` `postMessage` is NOT an API call
  — it's same-process cross-window messaging to the parent frame, explicitly permitted by
  `repo2_heed_sdk.txt`. Do not add any `fetch()`/`XHR` in `response.js` or `log.js`.
- **No framework dependencies in the SDK.** `response.js`/`log.js` must be vanilla JS, plain named
  exports, no classes — matches the established Phase 1-3 convention (`bus.js`, `signal.js`,
  `inference.js` all use plain functions, no classes, no default exports).
- **No cross-branch contamination.** This phase touches only Branch 2 (`heed-sdk`) files.
- **No scope expansion.** No dashboard, no config-driven copy system yet (per D-04), no real weight
  push (Phase 5), no live Branch 1 (Phase 6).

## Summary

Phase 4 is comparatively mechanical relative to Phase 3's inference core (per PROJECT.md's explicit
framing), but this research surfaced three concrete implementation risks that are NOT mechanical and
must be planned for explicitly: (1) `config/schema.json`'s generic schema interpreter
(`src/config.js`) has a **verified bug** where declaring `"type": "array"` on the new `activeScreens`
field will hard-fail every valid config, because `typeof [] === 'object'` in JavaScript, not
`'array'` — this must be fixed in `config.js` as part of this phase, not worked around by omitting
the type constraint; (2) two of the four response types (`discount_offer`, `social_proof`) are
triggered by signals (`scroll_reversal`, `back_intent`) that **never** carry a `bbox` — this is not
an occasional edge case for `clampToViewport()`'s "missing bbox" fallback path, it is the *only* path
those two response types will ever take, so the fallback path needs the same test rigor as the
"happy path"; (3) the standalone test harness is a single static HTML page with **no real routing**
and **no Screen-1 section at all** — `activeScreens`' pathname list is inherently speculative until
Branch 1 (not yet built) defines real routes, so this phase's concrete pathname values must be
tagged `[ASSUMED]` and the gating logic itself must be verified via synthetic `history.pushState()`
pathname swaps at the unit level (an already-established pattern from Phase 2's SIG-06 tests), not
via the E2E harness (which has exactly one real pathname).

Architecturally, this phase adds exactly two new files (`src/response.js`, `src/log.js`), extends
one existing function (`signal.js`'s `checkFlowComplete`) with one new `publish()` call, and wires
both new modules into `src/index.js`'s `init()`. The session-lifecycle wiring (D-01/D-02/D-03)
belongs in `log.js`, not `index.js` or a new module — `log.js` already must subscribe to
`flow:complete` to log the event, so co-locating the `endSession()` call and the `sessionEnded`
guard there avoids a second subscription to the same event and keeps `index.js` a thin orchestrator
(consistent with its current ~30-line, no-business-logic shape).

**Primary recommendation:** Build `response.js` and `log.js` as two new plain-function modules,
fix `src/config.js`'s array-type validation gap before adding `activeScreens` to the schema, give
`log.js` sole ownership of session-lifecycle wiring (flow:complete + pagehide + sessionEnded guard +
calling `endSession`), and design `clampToViewport()`'s null-bbox fallback path as a first-class,
heavily-tested path rather than a rare edge case.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Response overlay rendering (RESP-01/02/03) | Browser / Client | — | Pure DOM manipulation inside the partner's page; no server exists in this project |
| `clampToViewport()` positioning math | Browser / Client | — | Reads live `window.innerWidth/innerHeight`/safe-area env vars; must run synchronously in the browser |
| `discount_offer` postMessage | Browser / Client | Host page (external boundary) | Heed's side only *sends*; the host page (out of this branch's scope) owns receiving/fulfilling |
| Structured logging (LOG-01) | Browser / Client | — | `console.log` only, no transport, no backend in this project |
| Session-lifecycle wiring (flow:complete/pagehide/endSession trigger) | Browser / Client | — | Pure bus + DOM-event wiring; `endSession` itself (Phase 3) already lives in the same tier |
| `activeScreens` gating | Browser / Client | — | Reads `window.location.pathname` live, same tier as the modules it gates |
| Config schema validation (`activeScreens`, `responses` additions) | Browser / Client | — | `validateConfig` runs synchronously at `init()` time, in-browser (also exercised in Node via Vitest) |

There is no API/backend tier in this project (per PROJECT.md/CLAUDE.md — no dashboard, no backend,
no database). Every capability in this phase is Browser/Client-tier code that ships inside the same
`dist/sdk.js` bundle.

## Standard Stack

No new runtime dependencies. This phase is 100% vanilla JS using only APIs already available in the
existing stack (`brain.js` is not imported by this phase's files — `response.js`/`log.js` have no
inference-layer concerns).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — vanilla JS only) | n/a | DOM injection, `console.log`, `postMessage`, `crypto.randomUUID` | All native browser APIs; CLAUDE.md forbids any new dependency in the SDK |

### Supporting
Already installed, no version changes needed this phase:

| Library | Version (verified in package.json) | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.10 | Unit tests for `clampToViewport()`, `log.js`'s entry-builder, activeScreens gating, sessionEnded guard | Fast feedback loop; already the project's test runner |
| happy-dom | ^20.10.6 | DOM environment for Vitest — **confirmed** (see Common Pitfalls) supports `pagehide`/`PageTransitionEvent` dispatch and `window.postMessage` synchronously | Required for testing the new `pagehide` listener and `postMessage` call without a real browser |
| @playwright/test | ^1.61.1 | E2E harness test additions for response rendering + `discount_offer` postMessage capture | Already the project's E2E layer (`tests/e2e/harness.spec.js`) |
| esbuild | ^0.28.1 | Bundles the two new files into `dist/sdk.js` automatically via the existing `src/index.js` import graph | No config change needed — `npm run build` already globs from `src/index.js` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline `element.style.cssText` (UI-SPEC's locked choice) | A `<style>` tag with class selectors | Rejected by UI-SPEC — vulnerable to host-page CSS cascade collisions without Shadow DOM, which REQUIREMENTS.md explicitly rules out for v1 |
| `console.log('[heed]', ...)` (locked, LOG-01) | A structured logging library (pino, winston-browser build) | Rejected — adds a dependency for a one-line format the project already fully specifies; CLAUDE.md's "no framework dependencies" spirit extends to unnecessary logging libraries too |

**Installation:** None required — no `npm install` needed this phase.

**Version verification:** All four supporting tools' versions were read directly from
`package.json` in this repo (not re-fetched from the registry) since they are already installed and
pinned; no version bump is needed or recommended for this phase.

## Package Legitimacy Audit

**No new packages are installed in this phase.** `response.js` and `log.js` are hand-written vanilla
JS files using only native browser APIs (`document.createElement`, `console.log`,
`window.postMessage`, `crypto.randomUUID`, `window.addEventListener('pagehide', ...)`). The Package
Legitimacy Gate does not apply — there is nothing to run `npm view`/`package-legitimacy check`
against.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │              Host page (unknown DOM)         │
                    │  ┌─────────────────────────────────────┐    │
                    │  │  data-heed elements (Phase 1 contract)│   │
                    │  └──────────────┬────────────────────────┘   │
                    │                 │ touch/blur/scroll/popstate │
                    │                 ▼                            │
                    │        signal.js (Phase 2, extended)         │
                    │   publishes: signal:detected, flow:complete  │
                    │        (new: publish('flow:complete')        │
                    │         on flowCompleteFlag false→true)       │
                    │                 │                            │
                    │                 ▼                            │
                    │        inference.js (Phase 3, unchanged)     │
                    │   publishes: inference:result (always,       │
                    │   fires flag gated on confidence threshold)   │
                    │                 │                            │
                    │        ┌────────┴────────┐                   │
                    │        ▼                 ▼                   │
                    │  response.js (NEW)   log.js (NEW)             │
                    │  subscribes:         subscribes:               │
                    │  - inference:result  - signal:detected         │
                    │  checks:             - inference:result        │
                    │  - fires === true    - response:fired (new)    │
                    │  - activeScreens gate - response:dismissed(new)│
                    │  renders ONE bubble  - flow:complete           │
                    │  into the fixed      registers:                │
                    │  full-viewport div   - window pagehide listener│
                    │  (RESP-01/02/03)     owns:                     │
                    │        │             - sessionEnded guard      │
                    │        │             - endSession() call       │
                    │        │             checks:                   │
                    │        │             - activeScreens gate       │
                    │        │             writes:                    │
                    │        │             - console.log('[heed]',…) │
                    │        │               (LOG-01, only from here)│
                    │        └──────publish('response:fired'/        │
                    │               'response:dismissed')──────────►│
                    │                                                │
                    │  discount_offer only:                          │
                    │  window.parent.postMessage(payload,             │
                    │    config.partnerOrigin)  ──────────────────────┼──► Host page's own
                    └─────────────────────────────────────────────────┘    postMessage listener
                                                                            (out of this branch's
                                                                             scope — RESP-03 only
                                                                             requires Heed signal
                                                                             the moment exists)
```

A reader can trace the primary use case: a raw DOM event enters `signal.js` → published on the bus
as `signal:detected` → consumed by `inference.js`, which always publishes `inference:result` →
consumed independently by both `response.js` (renders a bubble if `fires && activeScreens`) and
`log.js` (writes a log line if `activeScreens`, regardless of `fires`) → `response.js` publishes its
own `response:fired`/`response:dismissed` events which `log.js` also consumes, so `log.js` remains
the SOLE caller of `console.log('[heed]', ...)` anywhere in the codebase (locked by UI-SPEC).

### Recommended Project Structure
```
src/
├── bus.js          # unchanged
├── config.js       # MODIFIED — add array-type support to walk() (see Common Pitfalls)
├── signal.js       # MODIFIED — checkFlowComplete() gains one new publish('flow:complete') call
├── inference.js    # unchanged — endSession(config, outcome) already exists (Phase 3)
├── response.js     # NEW — overlay injection, clampToViewport, 4 response types, postMessage
├── log.js          # NEW — log-entry builder, activeScreens gate, session-lifecycle wiring
└── index.js        # MODIFIED — generates sessionId, calls initResponse()/initLogging()
config/
├── schema.json     # MODIFIED — add activeScreens (array), partnerOrigin (string), optional responses (object)
└── demo-platform.json  # MODIFIED — add activeScreens value, partnerOrigin: "http://localhost:3000"
```

### Pattern 1: Overlay Injection (RESP-01)
**What:** One fixed full-viewport div injected into `document.body` at init, container has
`pointer-events: none`, every rendered response element gets `pointer-events: auto`.
**When to use:** Once, at `initResponse(config, sessionId)` call time (mirrors `initSignalCapture`/
`initInference`'s one-time-registration guard pattern already established in this codebase).
**Example:**
```javascript
// Source: repo2_heed_sdk.txt "Response layer (response.js)" section, verbatim CSS values,
// + 04-UI-SPEC.md's "Styling mechanism" section for the inline-style rule.
function createOverlayContainer() {
  const container = document.createElement('div');
  container.setAttribute('data-heed-overlay', ''); // internal marker, NOT one of the 7 locked selectors
  container.style.cssText =
    'position: fixed; top: 0; left: 0; width: 100%; height: 100%; ' +
    'pointer-events: none; z-index: 2147483647; overflow: hidden; box-sizing: border-box;';
  document.body.appendChild(container);
  return container;
}
```

### Pattern 2: clampToViewport (RESP-02)
**What:** Positions a response bubble within safe-area-aware viewport bounds, using `bbox` when
available and falling back to a bottom-clamp placement when it is not.
**When to use:** Every time a response bubble is about to be rendered, before it's appended to the
overlay container.
**Example:**
```javascript
// Source: 04-UI-SPEC.md "Positioning & clamping (RESP-02)" — prescriptive (default) contract.
// bbox may be null (scroll_reversal / back_intent signals never carry one — see Common Pitfalls).
function clampToViewport(bbox, bubbleWidth, bubbleHeight) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const EDGE = 16;
  const GAP = 8;
  const safeTop = EDGE + safeAreaInset('top');
  const safeBottom = vh - EDGE - safeAreaInset('bottom');

  const left = bbox
    ? Math.min(Math.max(EDGE, bbox.x), vw - bubbleWidth - EDGE)
    : EDGE; // no anchor — left-align at the safe edge

  let top;
  if (bbox) {
    const below = bbox.y + bbox.height + GAP;
    top = below + bubbleHeight <= safeBottom ? below : bbox.y - GAP - bubbleHeight;
  } else {
    top = safeBottom - bubbleHeight; // no anchor at all — last-resort bottom clamp (UI-SPEC's documented fallback, NOT rare: this is the ONLY path for discount_offer/social_proof)
  }
  top = Math.max(safeTop, Math.min(top, safeBottom - bubbleHeight));

  return { left, top };
}

function safeAreaInset(side) {
  // env() is CSS-only; reading it in JS requires a computed-style probe.
  // A 0px fallback element read (or a hardcoded 0 in non-iOS test envs) is required —
  // never let this resolve to NaN (04-UI-SPEC.md's explicit requirement).
  const probe = document.createElement('div');
  probe.style.cssText = `position: fixed; padding-${side}: env(safe-area-inset-${side}, 0px);`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
  probe.remove();
  return value;
}
```

### Pattern 3: Session-Lifecycle Wiring (D-01/D-02/D-03) — owned by `log.js`
**What:** `log.js` subscribes to `flow:complete`, registers a `pagehide` listener, and guards
`endSession()` with a single module-level `sessionEnded` boolean so it's called exactly once.
**When to use:** Inside `log.js`'s own `initLogging(config, sessionId)` entry point, called once
from `index.js`.
**Example:**
```javascript
// Source: 04-CONTEXT.md D-01/D-02/D-03, synthesized into one module per this research's
// recommended module-boundary resolution (see Assumptions Log A1).
import { subscribe } from './bus.js';
import { endSession } from './inference.js';

let sessionEnded = false; // module-level guard, D-03

export function initLogging(config, sessionId) {
  sessionEnded = false; // reset-on-reinit, matches signal.js/inference.js precedent

  function finishSession(outcome, event) {
    if (sessionEnded) return; // D-03: whichever path arrives first wins, the other is a no-op
    sessionEnded = true;
    writeLog(config, sessionId, event, {});
    endSession(config, outcome);
  }

  subscribe('flow:complete', () => finishSession(true, 'flow_complete'));

  window.addEventListener('pagehide', () => {
    if (!sessionEnded) finishSession(false, 'flow_abandoned');
  });

  // ... additional subscriptions for signal_detected / inference_run /
  // response_fired / response_dismissed, each gated on isActiveScreen(config)
  // before calling writeLog (D-06) ...
}

export function isActiveScreen(config) {
  const list = config.activeScreens;
  if (!Array.isArray(list) || list.length === 0) return true; // no gate configured — permissive default
  return list.includes(window.location.pathname); // LIVE read, never cached (mirrors signal.js's maybeReattach convention)
}

function writeLog(config, sessionId, event, data) {
  if (!isActiveScreen(config)) return; // D-06
  const entry = { ts: Date.now(), sessionId, partnerId: config.platformId, event, data };
  console.log('[heed]', JSON.stringify(entry));
}
```

### Pattern 4: discount_offer postMessage (RESP-03)
**What:** `window.parent.postMessage(payload, config.partnerOrigin)` — explicit target origin, never
`'*'`.
**When to use:** The moment a `discount_offer` bubble renders (not on CTA tap — the offer *window*
existing is the signal, per spec: "Heed only signals that the window exists").
**Example:**
```javascript
// Source: 04-UI-SPEC.md "discount_offer postMessage shape (RESP-03)" — payload shape locked.
function fireDiscountOfferMessage(config, sessionId, intent) {
  const payload = {
    type: 'heed:discount_offer',
    sessionId,
    partnerId: config.platformId,
    intent,
    timestamp: Date.now(),
  };
  window.parent.postMessage(payload, config.partnerOrigin); // never '*' — explicit origin required
}
```

### Anti-Patterns to Avoid
- **Caching `window.location.pathname` at init time for the `activeScreens` gate:** `signal.js`'s
  own `maybeReattach` never caches pathname across calls — it live-reads on every check. `log.js`/
  `response.js` must do the same, or a same-page pathname change (SPA route swap) will silently gate
  against a stale route.
- **Declaring `activeScreens` as `"type": "array"` in `config/schema.json` without first patching
  `src/config.js`'s `walk()` function:** see Common Pitfalls — this is a **verified hard failure**,
  not a theoretical risk.
  the "no bbox" case as `if (!bbox) throw` or silently skip rendering — 2 of 4 response types will
  hit this path on every single render, not occasionally.
- **A second `MutationObserver` or a second raw `window.addEventListener('popstate', ...)`:**
  `repo2_heed_sdk.txt`'s own SPA-safety section and `02-RESEARCH.md`'s Anti-Patterns explicitly warn
  against stacking a second observer/listener — this phase adds a `pagehide` listener (a genuinely
  new event type, not already covered), which is fine, but must not duplicate the existing
  MutationObserver/popstate wiring already in `signal.js`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation for `sessionId` | A custom random-string generator | `crypto.randomUUID()` (native, verified available in this project's Chromium/Playwright test environment even over `file://`, see Common Pitfalls) | Native API, zero bytes added to the bundle, cryptographically-strong randomness with zero PII risk (not derived from any user data) |
| Safe-area inset reading | Hardcoded pixel constants per device | `env(safe-area-inset-*, 0px)` read via a computed-style probe element | The only cross-device-correct way to read iOS safe-area insets from JS; hardcoding breaks on any device with a different notch/home-indicator geometry |
| JSON Schema validation | A full JSON-Schema library (ajv, etc.) | The project's existing hand-rolled `src/config.js` `walk()` interpreter — but FIX its array-type gap first | CLAUDE.md forbids new dependencies in the SDK; the existing interpreter is already the established pattern, just incomplete for array types |

**Key insight:** This phase's "don't hand-roll" list is short because almost everything it builds
(overlay DOM, clamping math, postMessage, console logging) IS the hand-rolled implementation by
design — CLAUDE.md's constraints leave no room for pulling in a library for any of it. The one real
risk is silently hand-rolling something that already has a native browser primitive (UUIDs, safe-area
insets) instead of using it.

## Common Pitfalls

### Pitfall 1: `config/schema.json`'s array-type validation is verifiably broken
**What goes wrong:** Declaring `"activeScreens": { "type": "array" }` in `config/schema.json` causes
`validateConfig()` to hard-fail on every valid config, including the correct `demo-platform.json`
value.
**Why it happens:** `src/config.js`'s `walk()` function checks `typeof value !== schemaNode.type`.
In JavaScript, `typeof []` evaluates to `"object"`, never `"array"` — there is no special-case for
arrays in the current implementation (only `"object"` gets a bespoke exception clause, and it's
written specifically to match plain objects, not arrays).
**Verified directly** (this research session):
```
$ node -e "import('./src/config.js').then(({validateConfig}) => {
    validateConfig({ activeScreens: ['/swap','/confirm'] },
      { type:'object', required:['activeScreens'],
        properties: { activeScreens: { type: 'array' } } });
  })"
THREW: [heed] Invalid config — refusing to initialize:
$.activeScreens: expected type "array", got "object"
```
**How to avoid:** Add explicit array support to `walk()` before adding `activeScreens` to the schema:
check `Array.isArray(value)` when `schemaNode.type === 'array'`, and (optionally) validate each
element against an `items` sub-schema if declared. This is a small, well-scoped change to
`src/config.js` and should be its own task in the plan — not a workaround (e.g., omitting the
`type` key entirely) that leaves the interpreter's array gap unaddressed for future config fields.
**Warning signs:** `init()`/`initDemo()` throwing `"Invalid config"` immediately after this phase's
schema changes land, even though `demo-platform.json`'s new value is a syntactically valid array.

### Pitfall 2: `bbox` is `null` for the two signals that map to `discount_offer` and `social_proof`
**What goes wrong:** Treating `clampToViewport()`'s "no bbox" fallback as a rare edge case, tested
once and otherwise ignored.
**Why it happens:** Phase 2's `buildPayload()` (D-07, `signal.js`) deliberately sets `bbox: null` for
`scroll_reversal` and `back_intent` (they carry `scrollDepth`/`pathname` instead — there is no single
element to report a bbox for a scroll gesture or a back-navigation event). Phase 3's cold-start
mapping sends `scroll_reversal → price_doubt` and `back_intent → trust_gap`. 04-UI-SPEC.md's own
intent→response-type table sends `price_doubt → discount_offer` and `trust_gap → social_proof`.
Chained together: **`discount_offer` and `social_proof` will NEVER receive a bbox** under the
current signal/intent/response-type mapping — not "sometimes," always.
**How to avoid:** Design and test `clampToViewport()`'s null-bbox fallback path (bottom-clamp
placement, per UI-SPEC's "Error state equivalent" framing) as the PRIMARY path for those 2 response
types, with equal test coverage to the anchored path used by `tooltip`/`nudge_copy`.
**Warning signs:** A test suite that only exercises `clampToViewport(bbox, ...)` with a non-null
bbox — such a suite would pass while silently never having exercised the code path that 50% of
response types will always use in production.

### Pitfall 3: The standalone test harness has no real routing and no Screen-1 section
**What goes wrong:** Assuming `activeScreens`' concrete pathname values can be derived by inspecting
routes in `test-harness/index.html`.
**Why it happens:** `test-harness/index.html` is a single static page rendering "Screen 2" (Amount
Entry), "Screen 3" (Confirm), and "Screen 4" (Success) simultaneously in one DOM, with **no Screen 1
(Wallet Overview) section at all** and no client-side routing — `window.location.pathname` is
whatever the page's own URL is (a `file://...` path in the E2E suite) and never changes during a
single page load. The real per-screen routes only exist in Branch 1 (`heed-demo-platform`), a
Next.js App Router app that is not yet built (STATE.md: "mid-Phase-1, not yet gate-passed").
**How to avoid:**
1. Treat `demo-platform.json`'s `activeScreens` pathname values as `[ASSUMED]` (see Assumptions Log)
   — a best-effort guess inferred from existing code comments (`test-harness/index.html`'s "mirrors
   Branch 1's swap screen" / "mirrors Branch 1's confirm screen" comments suggest `/swap` and
   `/confirm` as the likely real route names; the entry screen is plausibly `/`).
2. Verify the GATING LOGIC ITSELF (not the specific pathname strings) via `history.pushState()`
   synthetic pathname swaps in Vitest — this is already an established, working pattern from Phase
   2's `tests/signal-spa.test.js` (`history.pushState({}, '', '/screen-2')` before calling
   `maybeReattach`). The same technique lets `log.js`/`response.js`'s `isActiveScreen()` gate be
   fully unit-tested without a real multi-route app.
3. Do NOT expect the Playwright E2E harness test to meaningfully exercise multi-screen gating — it
   only has one real pathname available. Flag re-verification against real routes as a Phase 6 item
   (this already aligns with INTEG-01's "no logs fire on Screen 1" acceptance criterion, which is
   explicitly a Phase 6, live-Branch-1 check).
**Warning signs:** A plan or task that treats `activeScreens`' exact pathname list as if it were a
locked, verified value rather than a placeholder pending Branch 1's real routes.

### Pitfall 4: happy-dom + Vitest fake timers + MutationObserver
**What goes wrong:** Combining `vi.useFakeTimers()` with MutationObserver-driven code in the same
test file can produce flaky/incorrect timer behavior.
**Why it happens:** Already documented by Phase 2's research as a known happy-dom issue
(`capricorn86/happy-dom#2097`) — carried forward here because `response.js`'s auto-dismiss timers
(6000ms per UI-SPEC) are new timer usage in this phase, and if any test file also touches
`signal.js`'s MutationObserver-based re-attachment, the two can interact badly.
**How to avoid:** Keep `response.js`'s auto-dismiss-timer tests in their own file, separate from any
file that also drives `initSignalCapture`/MutationObserver behavior — mirrors the established
`signal.test.js` / `signal-spa.test.js` split.
**Warning signs:** Auto-dismiss tests that pass in isolation but fail/hang when run alongside SPA
re-attachment tests in the same file.

### Pitfall 5: `getBoundingClientRect()` returns zeroed rects in happy-dom
**What goes wrong:** Unit tests for `clampToViewport()` that rely on a real DOM element's computed
size/position via `getBoundingClientRect()` will get all-zero values — happy-dom has no real layout
engine (carried forward from 02-RESEARCH.md Pitfall 5, already worked around in Phase 2 via
`Object.defineProperty` stubs on `window.innerHeight`/`scrollY`).
**How to avoid:** Test `clampToViewport()` as a pure function taking an explicit `{x,y,width,height}`
bbox argument (or `null`) plus explicit `bubbleWidth`/`bubbleHeight` numbers — never rely on a real
element's `getBoundingClientRect()` inside a happy-dom unit test. Stub `window.innerWidth`/
`innerHeight` via `Object.defineProperty` the same way Phase 2 did for scroll tests.
**Warning signs:** `clampToViewport()` tests that create a real DOM element and read its
`getBoundingClientRect()` inside happy-dom — these will silently pass with meaningless (0,0,0,0)
values.

## Code Examples

### Verified: `crypto.randomUUID()` works in this project's actual E2E test environment
```javascript
// Verified this research session via a live Playwright/Chromium check against
// the exact file:// URL tests/e2e/harness.spec.js already uses:
// { isSecureContext: true, hasRandomUUID: true, uuid: "3b01b51e-..." }
// Chromium treats file:// origins as secure contexts, so D-08's
// crypto.randomUUID() call needs NO fallback/polyfill for this project's test
// harness or Playwright suite. (This would need re-verification if a real
// partner's staging page were served over plain HTTP, not HTTPS — file:// and
// localhost are both "potentially trustworthy" origins; arbitrary http:// is not.)
const sessionId = crypto.randomUUID();
```

### Verified: happy-dom supports `pagehide` dispatch and `postMessage` synchronously
```javascript
// Verified this research session directly against the installed happy-dom@20.10.6:
import { Window } from 'happy-dom';
const win = new Window({ url: 'http://localhost/' });
win.addEventListener('pagehide', () => { /* fires */ });
win.dispatchEvent(new win.Event('pagehide'));       // fires the listener — confirmed
new win.PageTransitionEvent('pagehide', { persisted: false }); // also instantiable
win.postMessage({ foo: 1 }, '*');                    // resolves synchronously, no throw
```
This confirms both D-02's `pagehide` listener and RESP-03's `postMessage` call are fully unit-
testable in Vitest without a real browser. For Playwright/E2E coverage of `pagehide`, dispatch it
synthetically via `page.evaluate(() => window.dispatchEvent(new Event('pagehide')))` — mirroring
this project's own established D-08 precedent (`test-harness/index.html`'s debug panel dispatches
synthetic-but-real DOM events onto real listeners) — rather than relying on real page-teardown
timing, which races against Playwright's console-capture and is not a reliable test signal (see Open
Questions).

## State of the Art

Not applicable in the traditional sense — this phase implements a fixed, spec-locked feature set
(`repo2_heed_sdk.txt`, `04-UI-SPEC.md`) using stable, years-old browser primitives
(`postMessage`, `pagehide`, `crypto.randomUUID`, `env(safe-area-inset-*)`). No deprecated/outdated
approach exists to contrast against for this specific scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Session-lifecycle wiring (D-01/D-02/D-03) should live in `log.js` (not `index.js` or a new module), exposed as `initLogging(config, sessionId)` | Architecture Patterns Pattern 3, Summary | Low — this is an internal module-boundary choice with no external contract; if wrong, a code-review pass can relocate the ~15 lines without touching the bus event names or log shape |
| A2 | `demo-platform.json`'s `activeScreens` value should be `["/swap", "/confirm", "/success"]` (everything except the entry screen `"/"`), inferred from `test-harness/index.html`'s code comments referencing Branch 1's screen names | Pitfall 3, Summary | Medium — these are placeholder pathnames until Branch 1's real Next.js routes exist; if the real routes differ, Phase 6 (live-Branch-1 integration) will need to update `demo-platform.json`'s `activeScreens` value, not the gating logic itself |
| A3 | The new `partnerOrigin` config field (RESP-03's `discount_offer` postMessage target) should be named `config.partnerOrigin` and set to `"http://localhost:3000"` in `demo-platform.json`, matching Repo 1's documented runtime port (`repo0_overview.txt`: "Repo 1 runs on localhost:3000") | Architecture Patterns Pattern 4, Code Examples | Low — the field name is an implementation detail per CONTEXT.md/UI-SPEC; the localhost:3000 value is directly sourced from `repo0_overview.txt`'s runtime connection map, so this is well-grounded, not a guess |
| A4 | `response:fired`/`response:dismissed` should be new bus events published BY `response.js` and consumed BY `log.js`, rather than `response.js` calling a shared log-writing function directly | Architecture Patterns diagram, Pattern 3 | Low — this preserves UI-SPEC's locked "only log.js calls console.log" rule via the bus (already the codebase's established producer/consumer pattern) instead of a direct cross-module function call; either approach satisfies the requirement, this one is more consistent with existing conventions |
| A5 | `isActiveScreen(config)` should be a single shared function (recommended: exported from `log.js`, imported by `response.js`) rather than independently duplicated gating logic in each module | Pattern 3 | Low — avoids the two gates silently drifting apart over time; if the planner prefers duplication to keep files fully independent, that's a defensible alternative given the project's small per-file scope |

**Risk summary:** No HIGH-risk assumptions. A2 (activeScreens pathnames) is the only one with
external dependency (Branch 1's not-yet-built routes) and is already flagged as needing Phase 6
re-verification regardless of this phase's guess.

## Open Questions

1. **Should Playwright E2E coverage attempt to trigger `pagehide` via real page navigation/close, or
   only via synthetic `page.evaluate()` dispatch?**
   - What we know: happy-dom unit tests can reliably dispatch synthetic `pagehide` events and assert
     the listener's guarded behavior (verified this session). Real browser `pagehide` does fire on
     navigation-away/tab-close, but Playwright's `page.close()`/`page.goto()` timing races against
     `page.on('console')` capture — the page context may tear down before the log line's console
     event is delivered to the test process.
   - What's unclear: whether a real-navigation E2E test would be reliably green in this project's
     CI-less, local-only test setup, or would be an intermittently-flaky addition.
   - Recommendation: rely on synthetic `page.evaluate(() => window.dispatchEvent(new
     Event('pagehide')))` for E2E coverage (matches the project's own D-08 precedent of "real listener,
     synthetic trigger"), and treat true end-of-page-lifecycle `pagehide` firing as an accepted gap
     covered only by manual verification, consistent with this project's existing acceptance of
     Phase 6's real-device manual testing sequence for other real-browser-only behaviors.

2. **Does `config/schema.json` need an `additionalProperties: false` enforcement pass while this
   phase is touching the schema anyway?**
   - What we know: `src/config.js`'s header comment claims `additionalProperties` is implemented,
     but the actual `walk()` function never checks it — this is a pre-existing gap from Phase 1, not
     introduced by this phase.
   - What's unclear: whether fixing this is in scope for Phase 4 (which is already touching
     `config.js` for the array-type bug) or should be deferred as a separate cleanup item.
   - Recommendation: fix the array-type bug (required, blocks `activeScreens`) but treat
     `additionalProperties` enforcement as an out-of-scope pre-existing gap unless the planner
     decides bundling both fixes into the same `config.js` task is cheap enough to do together.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `crypto.randomUUID()` (browser API) | D-08 sessionId generation | ✓ (verified in this session's Chromium/Playwright check, including over `file://`) | Native, Chromium (Playwright's bundled browser) | — |
| `window.postMessage` | RESP-03 discount_offer | ✓ (verified in happy-dom unit-test environment; native in all real browsers) | Native | — |
| `pagehide` event / `PageTransitionEvent` | D-02 | ✓ (verified dispatchable in happy-dom@20.10.6; standard in all evergreen browsers) | Native | — |
| `env(safe-area-inset-*)` CSS env variables | RESP-02 clampToViewport | ✓ assumed available in Playwright's Chromium (standard since iOS 11 / all modern Chromium) — not independently verified this session (CSS `env()` is not directly probeable via `node -e` the way JS APIs are) | — | Explicit `0px` fallback already mandated by UI-SPEC for non-iOS/no-notch environments |
| Vitest / happy-dom / Playwright | All new tests this phase | ✓ (already installed, versions read from package.json) | 4.1.10 / 20.10.6 / 1.61.1 | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — `env(safe-area-inset-*)`'s `0px` fallback is already
part of the locked UI-SPEC contract, not a gap this research needs to patch.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.10 (unit) + @playwright/test ^1.61.1 (E2E) |
| Config file | `vitest.config.js` (environment: happy-dom, excludes `tests/e2e/**`) / `playwright.config.js` (testDir: `./tests/e2e`, 390px viewport, `hasTouch: true`) |
| Quick run command | `npx vitest run tests/response.test.js tests/log.test.js` |
| Full suite command | `npm test` (Vitest) + `npx playwright test` (E2E, requires `npm run build` first per existing `harness.spec.js` convention) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RESP-01 | Overlay container has `pointer-events: none`; rendered elements have `pointer-events: auto`; host DOM outside the overlay is untouched | unit | `npx vitest run tests/response.test.js -t "RESP-01"` | ❌ Wave 0 |
| RESP-02 | `clampToViewport()` clamps to safe-area-aware bounds for both bbox-present AND bbox-null (fallback) inputs | unit | `npx vitest run tests/response.test.js -t "RESP-02"` | ❌ Wave 0 |
| RESP-03 | All 4 response types render correct copy for their mapped intent; `discount_offer` calls `postMessage` with explicit origin, never `'*'`, and performs no fulfillment logic | unit | `npx vitest run tests/response.test.js -t "RESP-03"` | ❌ Wave 0 |
| RESP-01/02/03 (real-browser proof) | Overlay renders above host UI without blocking interaction, on a real 390px mobile-emulated Chromium | e2e | `npx playwright test tests/e2e/harness.spec.js -g "response"` | ❌ Wave 0 |
| LOG-01 | Every one of the 6 event types produces exactly one `console.log('[heed]', ...)` line with the exact `{ts,sessionId,partnerId,event,data}` shape, gated by `activeScreens` | unit | `npx vitest run tests/log.test.js -t "LOG-01"` | ❌ Wave 0 |
| D-01/D-02/D-03 (session-end wiring) | `flow:complete` and `pagehide` both call `endSession` exactly once combined (not once each); `sessionEnded` guard verified via synthetic dispatch of both paths in either order | unit | `npx vitest run tests/log.test.js -t "session-lifecycle"` | ❌ Wave 0 |
| D-06/D-07 (activeScreens gating) | Gate correctly allows/blocks logging and response rendering based on `history.pushState`-simulated pathname, mirroring Phase 2's SIG-06 pattern | unit | `npx vitest run tests/log.test.js -t "activeScreens"` | ❌ Wave 0 |
| D-05 (single-bubble-at-a-time + "replaced" dismissReason) | A second above-threshold `inference:result` while a bubble is showing dismisses the old one with `dismissReason: "replaced"` before rendering the new one | unit | `npx vitest run tests/response.test.js -t "D-05"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/response.test.js tests/log.test.js`
- **Per wave merge:** `npm test` (full Vitest suite) + `npx playwright test` (full E2E suite, after `npm run build`)
- **Phase gate:** Full suite green (Vitest + Playwright) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/response.test.js` — covers RESP-01, RESP-02, RESP-03, D-05
- [ ] `tests/log.test.js` — covers LOG-01, D-01/D-02/D-03, D-06/D-07
- [ ] `tests/e2e/harness.spec.js` additions — extend the existing file with response-rendering and postMessage-capture assertions (no new E2E file needed; existing file already covers this harness)
- [ ] `test-harness/index.html` may need a `window.addEventListener('message', ...)` debug listener added to visibly confirm `discount_offer`'s postMessage in manual testing (not required for automated coverage, but useful for the same kind of manual-verification precedent Phase 1/2 established with the debug panel)
- [ ] `src/config.js` — no new test FILE needed, but `tests/config.test.js` (existing, Phase 1) needs new cases added for array-type schema fields, since this is a genuine regression-risk fix, not just new-feature coverage

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No authentication surface in this phase |
| V3 Session Management | Partial | `sessionId` (crypto.randomUUID, D-08) is a correlation identifier only, not an auth session token — no session-fixation/hijacking risk since it grants no privilege and carries no server-side state |
| V4 Access Control | No | No access-control surface — `postMessage` is a broadcast-style signal, not a privileged action |
| V5 Input Validation | Yes | `src/config.js`'s `validateConfig()` (hard-fail per CFG-02) — extended this phase for `activeScreens`/`partnerOrigin`; the array-type bug (Common Pitfalls) is itself an input-validation correctness issue that must be fixed, not just a functional bug |
| V6 Cryptography | Partial | `crypto.randomUUID()` is a native, cryptographically-strong RNG — never hand-roll a UUID generator (see Don't Hand-Roll) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| `postMessage` with a wildcard (`'*'`) `targetOrigin`, allowing any embedding frame to receive the discount_offer payload | Information Disclosure | RESP-03 explicitly requires an **explicit** `targetOrigin` (never `'*'`) — enforced via the `config.partnerOrigin` field, which must be a required, validated string in `config/schema.json` (not left optional/undefined, which would force a fallback to `'*'` or a thrown error) |
| Host-page CSS cascade collision corrupting the overlay's appearance or, in a worse case, hiding the dismiss control in a way that traps a tap target | Tampering (of rendered UI, not data) | UI-SPEC's locked "every property set inline, `!important` only where a specific collision is anticipated" styling mechanism — no `<style>` tag with class selectors (already covered in Standard Stack's Alternatives Considered) |
| A malformed/hostile `config.activeScreens` value (e.g., a non-array) silently disabling all logging without a hard-fail | Denial of Service (of the logging/observability surface, not the app itself) | CFG-02's existing "hard-fail, never partial/silent" philosophy — once the array-type bug (Pitfall 1) is fixed, an invalid `activeScreens` value throws at `init()` time rather than silently gating everything closed |
| Reading `el.value`/user input inside `response.js`/`log.js` for any reason (a plausible future temptation when debugging response copy against a real field) | Information Disclosure (PII) | Same firewall discipline as `signal.js`'s `buildPayload()` — `response.js`/`log.js` must never read a DOM element's `.value`/`.textContent`/`.innerHTML` anywhere; both new modules only ever consume already-PII-filtered bus payloads (`inference:result`, `signal:detected`) |

## Sources

### Primary (HIGH confidence)
- Direct file reads this session: `04-CONTEXT.md`, `04-UI-SPEC.md`, `REQUIREMENTS.md`, `STATE.md`,
  `PROJECT.md`, `src/inference.js`, `src/signal.js`, `src/bus.js`, `src/index.js`, `src/config.js`,
  `config/schema.json`, `config/demo-platform.json`, `test-harness/index.html`,
  `tests/signal-spa.test.js`, `tests/e2e/harness.spec.js`, `tests/index.test.js`,
  `tests/harness.test.js`, `tests/inference-endsession.test.js`, `CONTRACT.md`,
  `branch spec files/repo0_overview.txt`, `branch spec files/repo1_dummy_platform.txt`,
  `branch spec files/repo2_heed_sdk.txt`, `admin/check-bundle-purity.mjs`, `package.json`,
  `vitest.config.js`, `playwright.config.js`, `.planning/config.json`.
- Direct tool verification this session: `node -e` scripts confirming (1) `src/config.js`'s
  array-type validation bug, (2) happy-dom's `pagehide`/`PageTransitionEvent`/`postMessage` support,
  (3) a live Playwright/Chromium check of `crypto.randomUUID()` availability over `file://` against
  the exact `test-harness/index.html` URL the existing E2E suite uses.

### Secondary (MEDIUM confidence)
- WebSearch: "Playwright test pagehide event trigger page.close() reliably fires pagehide" — no
  authoritative answer found on `page.close()`'s `pagehide` reliability; informed this research's
  recommendation to prefer synthetic dispatch over real-navigation timing (Open Question 1).
- WebSearch: "postMessage targetOrigin config field name convention" — no single industry-standard
  field name found; `partnerOrigin` recommended for consistency with this project's existing
  `partnerId`/`platformId` naming, not because it's an established convention elsewhere.

### Tertiary (LOW confidence)
- None — all claims in this research are either directly verified against this repo's code/tools
  this session, or explicitly tagged `[ASSUMED]` in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all native browser APIs, all verified installed/
  working in this project's actual test environment this session.
- Architecture: HIGH — module boundaries, bus event flow, and file structure directly follow
  `repo2_heed_sdk.txt`'s locked file-structure spec and this codebase's own established Phase 1-3
  conventions (verified by direct code read, not inferred).
- Pitfalls: HIGH — all 5 pitfalls are either directly reproduced/verified via tool calls this
  session (Pitfalls 1, 4, 5 reference verified/pre-documented behavior) or derived from a direct,
  traceable chain through this codebase's own already-locked decisions (Pitfall 2's bbox-null
  chain, Pitfall 3's test-harness inspection).

**Research date:** 2026-07-18
**Valid until:** 30 days (stable domain — vanilla JS/browser APIs, no fast-moving dependency
churn; re-verify only if Branch 1's real routes become known before Phase 6, which would affect
Assumption A2's activeScreens pathnames specifically, not the rest of this research)
