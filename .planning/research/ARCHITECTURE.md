# Architecture Research

**Domain:** Client-side event-capture SDK with embedded ML inference and DOM overlay rendering (behavioral-intent detection widget, single-file vanilla JS distribution)
**Researched:** 2026-07-10
**Confidence:** MEDIUM (no single canonical spec exists for this SDK sub-genre; findings are convergent industry practice cross-referenced across MDN, WebKit, brain.js source, and multiple third-party-widget engineering write-ups, not one authoritative source)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         HOST PAGE (uncontrolled)                      │
│   data-heed="amount-input" | "fee-row" | "proceed-cta" | ... (7)      │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ DOM events (touchstart/blur/scroll/popstate)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│  CAPTURE LAYER — signal.js                                            │
│  ┌────────────┐ ┌────────────┐ ┌───────────────┐ ┌────────────────┐  │
│  │touch timer │ │blur/focus  │ │scroll depth+   │ │popstate +      │  │
│  │(hesitation)│ │compare     │ │reversal        │ │flowComplete    │  │
│  └─────┬──────┘ └─────┬──────┘ └───────┬────────┘ └────────┬───────┘  │
│        │              │                │                    │         │
│  ┌─────┴──────────────┴────────────────┴────────────────────┴──────┐ │
│  │  MutationObserver(document.body) + popstate → re-attach routine  │ │
│  │  gated on pathname change, guarded by WeakSet<Element>           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────┬───────────────────────────────────────┘
                                 │ publish({type, targetSelector, bbox, timestamp})
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  INTERNAL EVENT BUS (pub/sub, in-memory, no I/O)      │
│         signal:detected  ──▶  inference:result  ──▶  log:*            │
└───────┬────────────────────────────┬───────────────────────┬─────────┘
        │ subscribe                  │ subscribe             │ subscribe
        ▼                            ▼                       ▼
┌───────────────────┐   ┌─────────────────────────┐  ┌──────────────────┐
│ INFERENCE LAYER    │   │ RESPONSE RENDERER        │  │ LOGGING LAYER     │
│ inference.js        │   │  overlay div (fixed,     │  │ console.log       │
│ W1/b1→ReLU→W2/b2→   │   │  pointer-events:none →   │  │ '[heed]' JSON     │
│ softmax → threshold │   │  auto on response node)  │  │ per event type    │
│ (0.65) gate          │   │ clampToViewport()        │  └──────────────────┘
│                      │   │ tooltip/nudge/discount/  │
│ weight-push (session │   │ social_proof             │
│ end, learning=0.01) ─┼──▶│ postMessage() for         │
└─────────┬───────────┘   │ discount fulfillment      │
          │                └─────────────────────────┘
          │ POST (session end only)
          ▼
┌──────────────────────────────────────────────────────────────────────┐
│  LOCAL WEIGHT-PUSH RECEIVER (dev-only local server)                    │
│  persists weight JSON → sdk.js cold-start reads it on next load        │
└──────────────────────────────────────────────────────────────────────┘

          ▲
          │ read-only config, validated at init, never mutated at runtime
┌─────────┴────────────────────────────────────────────────────────────┐
│  CONFIG LAYER — schema.json (contract) + demo-platform.json (values)   │
│  maps abstract signal/response defs → concrete data-heed selectors     │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `signal.js` | Attach/detach DOM listeners on config-selected elements, apply timing/threshold logic (touch hold, blur-without-change, scroll reversal, popstate), emit normalized `{type, targetSelector, bbox, timestamp}` events onto the bus. Owns SPA re-attachment (MutationObserver + popstate + WeakSet). | `addEventListener` with `{passive: true}` on touch/scroll to avoid blocking the main thread; `getBoundingClientRect()` for bbox; no state beyond per-element timers |
| Event bus | Decouple `signal.js` from `inference.js` from the logger; the only channel by which layers communicate. No signal ever crosses it to the network. | A module-scoped singleton wrapping either (a) a hand-rolled `Map<eventName, Set<callback>>` publish/subscribe class, or (b) a native `EventTarget` instance with `dispatchEvent(new CustomEvent(...))` — both are standard; `EventTarget` avoids reinventing dispatch/listener bookkeeping |
| `inference.js` | Run the explicit 2-layer forward pass per incoming signal, apply the confidence gate, publish `inference:result` when it clears threshold, and own the session-end weight-push and the online weight-update step (learning rate 0.01, outcome = `flowComplete`). | Cold-start weights hardcoded as arrays (domain-knowledge mapping); brain.js used to *produce/train* those arrays offline, but the runtime forward pass is hand-written reading `W1/b1/W2/b2` arrays directly (see Pattern 2) |
| Response renderer | Own the single injected overlay div's lifecycle, `clampToViewport()`, and the 4 response type templates; never touch host DOM outside the overlay; fire `postMessage` for `discount_offer` fulfillment. | Overlay div created once at SDK init, appended to `document.body`; container `pointer-events: none`, individual response node `pointer-events: auto`; inline styles only (no external stylesheet) to resist host CSS cascade |
| Logging layer | Cross-cutting observer, not a pipeline stage. Emits the structured `{ts, sessionId, partnerId, event, data}` record for every lifecycle event. | Implemented as *just another bus subscriber* that listens to all channels and calls `console.log('[heed]', JSON.stringify(entry))` — keeps logging centralized instead of scattered `console.log` calls inside business logic |
| Config layer | Validate `demo-platform.json` against `schema.json` at init, hard-fail on invalid schema, and become the single source of selector strings and response copy. | Loaded and validated before `signal.js` attaches anything; no component hardcodes a `data-heed` string — all read it from the validated config object |
| Weight-push receiver | Out-of-band dev tooling: accept the session-end POST, persist to a local JSON file, serve it back on next cold-start read. | Not part of `sdk.js` itself — a separate minimal local server in this branch, decoupled from the SDK's runtime bundle |

## Recommended Project Structure

```
heed-sdk/
├── src/
│   ├── signal.js          # capture layer: touch/blur/scroll/popstate listeners + SPA re-attach
│   ├── bus.js              # tiny pub/sub singleton (EventTarget-based or Map-based)
│   ├── inference.js        # forward pass (W1/b1→ReLU→W2/b2→softmax), threshold gate, weight-push, online update
│   ├── weights.js          # cold-start weight arrays (domain-knowledge mapping) — data, not logic
│   ├── renderer.js         # overlay div lifecycle, clampToViewport, 4 response templates
│   ├── logger.js           # bus subscriber → structured console.log
│   ├── config.js           # schema validation + config loader
│   └── index.js            # init() orchestrator: load config → build bus → wire subscribers → attach signal.js
├── config/
│   ├── schema.json         # documented config contract
│   └── demo-platform.json  # concrete data-heed selector values (CONTRACT.md-locked)
├── dist/
│   └── sdk.js               # single-file bundle output (no bundler per constraint — hand-concatenated or IIFE-wrapped)
├── test-harness/
│   └── index.html            # standalone static HTML exposing all 7 data-heed selectors
└── weight-receiver/
    ├── server.js              # minimal local server, POST → persisted weights.json
    └── weights.json            # persisted learned weights (read by inference.js cold-start)
```

### Structure Rationale

- **`src/` split by pipeline stage, not by type:** each file is one component boundary from the diagram above (capture / bus / inference / render / log / config), matching the spec's own layer names (`signal.js`, `inference.js`) so the file structure *is* the architecture — no hidden coupling behind a generic `utils.js`.
- **`weights.js` separated from `inference.js`:** cold-start weight *data* is not forward-pass *logic*. Keeping them apart makes the forward-pass math reviewable/testable independent of what values it's fed, and makes the "domain-knowledge mapping" decision (touch_hesitation→confusion, etc.) a single, auditable file.
- **`weight-receiver/` isolated from `src/`:** per CLAUDE.md's no-framework/single-file constraint on the SDK itself, the receiver is dev tooling that must never be bundled into `dist/sdk.js` — a real partner's page only ever loads the `dist/` output.
- **`dist/sdk.js` as a build target, not the source of truth:** even without a bundler, keep authored source split by concern and produce the single-file output via a trivial concatenation/IIFE-wrap step (documented in the build order below), rather than authoring one giant file from the start — much easier to reason about and test each layer in isolation.

## Architectural Patterns

### Pattern 1: Bus-Mediated Layer Decoupling

**What:** `signal.js` and `inference.js` (and the logger, and the renderer) never import or call each other directly. All communication is `bus.publish(eventName, payload)` / `bus.subscribe(eventName, callback)`. This is the standard shape used by third-party embeddable widgets to keep the capture, data, and rendering layers independently swappable — confirmed as convergent practice across chat-widget/analytics-tag SDK write-ups, though no single canonical spec exists for this pattern.
**When to use:** Any time two layers need to react to the same event stream without knowing about each other's internals — here, inference and logging both need every signal, but only inference should gate the renderer.
**Trade-offs:** Adds one layer of indirection versus direct function calls, but is what makes `signal.js` unit-testable against the standalone static-HTML harness without `inference.js` existing yet, and vice versa (inference testable with synthetic vectors without real signals).

**Example:**
```javascript
// bus.js — EventTarget-based singleton avoids hand-rolling dispatch bookkeeping
const bus = new EventTarget();
export function publish(type, detail) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}
export function subscribe(type, handler) {
  const wrapped = (e) => handler(e.detail);
  bus.addEventListener(type, wrapped);
  return () => bus.removeEventListener(type, wrapped); // always return unsubscribe
}
```

### Pattern 2: Explicit Forward Pass Reading Externally-Trained Weights

**What:** brain.js's `NeuralNetwork` internally stores `layers[].weights` (2D array) and `layers[].biases` (array), and exposes `toJSON()`/`toFunction()` to export a trained network for standalone use. The recommended integration for this SDK is *not* to call brain.js's `.run()` at inference time (that hides the exact steps the branch is meant to teach), but to read the exported `W1/b1/W2/b2` arrays and hand-write `matmul → +bias → ReLU → matmul → +bias → softmax` in `inference.js`. brain.js becomes the tool that *produces* correct weight arrays (via training, or via the hand-authored cold-start arrays that mimic its structure); the runtime forward pass is fully explicit and independently reviewable.
**When to use:** Whenever the domain goal includes understanding/teaching the math, not just getting a prediction — matches this branch's stated emphasis on the inference layer being the conceptual core.
**Trade-offs:** More code than calling `.run()`, but the forward pass becomes a small, pure, synchronously-testable function (`predict(inputVector) → {class, confidence}`) with zero framework coupling at inference time — you could delete the brain.js dependency from the runtime bundle entirely and only need it for an offline training script, if bundle size ever becomes a concern.

**Example:**
```javascript
function forward(x, { W1, b1, W2, b2 }) {
  const h = relu(addBias(matVecMul(W1, x), b1));      // hidden layer
  const logits = addBias(matVecMul(W2, h), b2);        // output layer
  const probs = softmax(logits);                        // {confusion, price_doubt, trust_gap, flow_friction}
  return probs;
}
```

### Pattern 3: Idempotent Observer Re-attachment for SPA Compatibility

**What:** Combine a `MutationObserver` on `document.body` (`{childList: true, subtree: true}`) with a `popstate` listener, both gated behind a pathname-change check so the re-attach routine doesn't run on every unrelated DOM mutation. Idempotency is enforced with a `WeakSet<Element>`: before attaching listeners to a config-selected element, check `if (attached.has(el)) return;` then `attached.add(el)`. Because `WeakSet` entries are keyed by object identity and auto-collected when the element is removed from the DOM, this avoids both duplicate listener attachment and manual cleanup bookkeeping — this is the pattern converged on across MDN's MutationObserver guidance and multiple SPA-instrumentation write-ups.
**When to use:** Any SDK instrumenting elements on a page that can re-render its DOM client-side (React/Vue SPA route changes) without a full page load, where `data-heed` elements may be destroyed and recreated.
**Trade-offs:** `MutationObserver` callbacks firing frequently on a busy SPA can be a performance drag if the callback does heavy work — best practice is to do the minimum in the callback itself (just the pathname-changed check + a `querySelectorAll` re-scan) and avoid synchronous heavy computation inside it.

**Example:**
```javascript
const attached = new WeakSet();
let lastPath = location.pathname;

function attachIfNeeded(el, selectorKey) {
  if (attached.has(el)) return;   // idempotent guard
  attached.add(el);
  bindSignalListeners(el, selectorKey);
}

function rescan() {
  if (location.pathname === lastPath) return; // gate on pathname change
  lastPath = location.pathname;
  for (const [key, selector] of Object.entries(config.selectors)) {
    const el = document.querySelector(selector);
    if (el) attachIfNeeded(el, key);
  }
}

new MutationObserver(rescan).observe(document.body, { childList: true, subtree: true });
window.addEventListener('popstate', rescan);
```

### Pattern 4: Overlay Isolation via Split pointer-events + Defensive Styling

**What:** A single `position: fixed; inset: 0` container div, injected once at `init()`, with `pointer-events: none` on the container and `pointer-events: auto` set only on the specific response element being rendered inside it — so the host page remains fully interactive except where a response is actively showing. Because `pointer-events: none` on a parent disables interaction for *all* descendants unless individually overridden, this split is what makes "renders above platform UI without blocking interaction" (an explicit PROJECT.md requirement) achievable with one div rather than toggling the whole overlay's visibility.
**When to use:** Any full-viewport overlay embedded in a host page that must never block scroll/tap/click on the underlying page except at the exact moment (and exact element) it needs attention.
**Trade-offs:** The current spec (single plain div, no Shadow DOM) is simpler and matches the "host DOM untouched" and "no framework/no bundler" constraints, but a plain div is *not* isolated from host CSS cascade — a host's `* { box-sizing: border-box }`, global resets, or aggressive `!important` rules can bleed into it. **Refinement recommendation:** style the overlay and its children entirely via inline `style` attributes (never external classes/stylesheets) so there is no selector for host CSS to accidentally match; treat Shadow DOM as a v2 option if a real partner's CSS is found to leak in, since Shadow DOM still inherits host fonts (good for visual blending) while blocking host rule leakage (the current in-repo choice of a plain div is reasonable for the harness scope but should not be assumed CSS-safe for a real partner without this refinement).

**Example:**
```javascript
const overlay = document.createElement('div');
overlay.setAttribute('data-heed-overlay', '');
Object.assign(overlay.style, {
  position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '2147483647'
});
document.body.appendChild(overlay);

function renderResponse(node) {
  node.style.pointerEvents = 'auto';   // only this element becomes clickable
  overlay.appendChild(node);
}
```

### Pattern 5: Session-Scoped Overlay Positioning Clamp (iOS Safe Area)

**What:** `env(safe-area-inset-*)` only resolves to non-zero values when the *host page's* `<meta name="viewport">` includes `viewport-fit=cover` — a value the SDK does not control on a real partner's page. `clampToViewport()` should therefore combine `max()`/`min()` CSS clamping with `env()` as a progressive enhancement, plus a JS-computed numeric fallback (e.g. `window.visualViewport` dimensions) so the overlay stays on-screen even when the host never sets `viewport-fit=cover` (in which case `env()` silently resolves to `0`, not an error — so this fails silently rather than loudly if untested).
**When to use:** Any fixed-position UI injected into a page whose `<meta viewport>` configuration is outside your control.
**Trade-offs:** None significant — this is strictly additive safety over relying on `env()` alone; the WebKit-documented pattern (`padding-bottom: max(16px, env(safe-area-inset-bottom))`) costs nothing when insets are `0`.

## Data Flow

### Signal-to-Response Flow

```
DOM event (touchstart/blur/scroll/popstate on a data-heed element)
    ↓
signal.js: apply timing/threshold logic → build {type, targetSelector, bbox, timestamp}
    ↓ bus.publish('signal:detected', payload)
logger.js (subscriber): log signal_detected
inference.js (subscriber): forward(payload → input vector) → {class, confidence}
    ↓ bus.publish('inference:result', {class, confidence, ...})
logger.js (subscriber): log inference_run
    ↓ if confidence >= 0.65
renderer.js (subscriber): pick response template for class → renderResponse()
    ↓ bus.publish('response:fired', {...})
logger.js (subscriber): log response_fired
```

### Session-End Weight Flow (distinct, infrequent path)

```
flow_complete or flow_abandoned (from signal.js's flowComplete tracking)
    ↓ bus.publish('session:end', {outcomeLabel})
inference.js: online weight update (learning rate 0.01) using in-memory forward-pass activations + outcomeLabel
    ↓ single POST (the only outbound network call in the SDK)
local weight-push receiver: persist weights.json
    ↓ (next page load, cold-start)
inference.js init: read weights.json if present, else fall back to hardcoded domain-knowledge weights
```

### Key Data Flows

1. **Per-signal inference (hot path, stateless):** Each raw signal event triggers exactly one forward pass independently — there is no session-level aggregation/batching of multiple signals into one inference call in v1. This matches the spec's log sequence (`signal_detected → inference_run → response_fired` per occurrence) and keeps `inference.js`'s `predict()` a pure function of a single input vector, easiest to unit test.
2. **Weight learning (cold path, stateful):** Only the weight-update-and-push happens once per session, at the very end, decoupled from the hot per-signal path — this is a deliberate architectural separation between "predict" (called many times, must be fast, pure) and "learn" (called once, side-effecting, network I/O).
3. **Config as the only cross-cutting dependency:** `signal.js` (which selectors to watch), `renderer.js` (response copy/templates), and `index.js` (init order) all read from the validated config object, but config itself never depends on any other layer — a strict one-way dependency that lets the config layer be validated and hard-failed before anything else runs.

## Scaling Considerations

This is a client-side, single-instance-per-page-load SDK — "scale" here means signal volume and DOM complexity per session, not concurrent users.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Typical session (a handful of `data-heed` elements, tens of signal events) | Current design (synchronous bus dispatch, per-signal inference) is fine as-is |
| High-frequency signal sources (rapid scroll events) | `scroll` fires very frequently; use a `{passive: true}` listener and throttle/debounce the scroll-reversal check inside `signal.js` before publishing to the bus — publish only on threshold-crossing transitions, not every scroll tick, to avoid flooding inference/logging with near-duplicate events |
| Busy SPA with frequent route-level DOM churn | `MutationObserver` callback must stay cheap (pathname-gate first, `querySelectorAll` only after); avoid observing more than `document.body` subtree unless a narrower stable container is available |

### Scaling Priorities

1. **First bottleneck:** Unthrottled scroll listener flooding the bus with `scroll_reversal` candidate checks — mitigate with `{passive: true}` + an internal debounce inside `signal.js` before it ever publishes.
2. **Second bottleneck (unlikely at this scope but worth flagging):** `MutationObserver` callback doing `querySelectorAll` across a large/deep host DOM on every mutation batch — mitigate by keeping the pathname-gate as the very first check in the callback so most invocations short-circuit immediately.

## Anti-Patterns

### Anti-Pattern 1: Hardcoding `data-heed` Selectors in Logic Files

**What people do:** Write `document.querySelector('[data-heed="proceed-cta"]')` directly inside `signal.js` or `renderer.js`.
**Why it's wrong:** Breaks the explicit "generic SDK, specific config" architecture goal in PROJECT.md — a real partner would need to fork the SDK instead of just editing config, and it silently duplicates the CONTRACT.md selector list in multiple places, risking drift.
**Do this instead:** Every selector reference goes through the validated config object (`config.selectors.proceedCta`), loaded once by the config layer; `signal.js`/`renderer.js` never contain a literal `data-heed="..."` string.

### Anti-Pattern 2: Calling brain.js's `.run()` as a Black Box at Inference Time

**What people do:** `const output = trainedNet.run(input);` directly in the hot path.
**Why it's wrong:** Defeats the branch's explicit purpose — "not abstracted behind a black-box call without understanding each step" — and couples the runtime bundle to brain.js's full `NeuralNetwork` class when only a tiny forward-pass function is actually needed at runtime.
**Do this instead:** Export weights via `toJSON()` (or hand-author cold-start arrays in the same shape) and hand-write the forward pass in `inference.js` as shown in Pattern 2.

### Anti-Pattern 3: Attaching Listeners Without an Idempotency Guard in the Re-attach Routine

**What people do:** Re-run the full `bindSignalListeners()` routine on every `MutationObserver`/`popstate` firing without checking whether an element is already instrumented.
**Why it's wrong:** Produces duplicate listeners on the same element after any DOM churn, causing every subsequent signal to fire multiple times (multiple `signal_detected` logs, multiple inference runs, multiple responses) — a silent correctness bug that only shows up as "weird" duplicate behavior during manual testing, exactly the kind of bug the spec's `no double-firing` requirement calls out.
**Do this instead:** Guard every attach call with the `WeakSet<Element>` check from Pattern 3 — attachment becomes safe to call redundantly from both the `MutationObserver` callback and the `popstate` handler.

### Anti-Pattern 4: Scattering `console.log('[heed]', ...)` Calls Throughout Business Logic

**What people do:** Add ad hoc `console.log` calls inside `signal.js`, `inference.js`, and `renderer.js` wherever something interesting happens.
**Why it's wrong:** Makes the exact `{ts, sessionId, partnerId, event, data}` shape and the fixed event-type vocabulary (`signal_detected | inference_run | response_fired | response_dismissed | flow_complete | flow_abandoned`) easy to drift out of sync across files, and couples business logic to logging format.
**Do this instead:** Implement the logger as a bus subscriber (Pattern 1) that listens to every published event type and is the *only* place that calls `console.log`; business logic only ever calls `bus.publish(...)`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| brain.js | Bundled dependency; used to produce/train weight arrays (offline or via the cold-start domain-knowledge mapping), not called at runtime inference (Pattern 2) | The one allowed dependency per CLAUDE.md/PROJECT.md constraints |
| Local weight-push receiver | Single `POST` at session end only, `sdk.js` → local dev server; response written to a local JSON file, read back on next cold-start | Not a production CDN endpoint — dev/test tooling per PROJECT.md's explicit scope boundary; no other outbound network call is permitted anywhere in the SDK |
| Host page (`data-heed` selectors) | Read-only DOM query + event listener attachment on 7 locked selectors from CONTRACT.md; SDK writes nothing to host DOM except appending its own overlay div | Selectors are the entire coupling surface to Branch 1/any real partner page — SDK must never assume anything about host DOM structure beyond these 7 attributes |
| Host page (`postMessage`) | `discount_offer` response type fires `postMessage` to the host window; SDK does not fulfill the offer itself | Standard safe channel between a script running in a sandboxed/isolated context and a host page it doesn't own |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `signal.js` ↔ event bus | `publish('signal:detected', payload)` only, one direction | `signal.js` never imports `inference.js` or `renderer.js` |
| event bus ↔ `inference.js` | `subscribe('signal:detected', ...)` in, `publish('inference:result', ...)` out | `inference.js` never imports `signal.js` or `renderer.js` directly |
| event bus ↔ `renderer.js` | `subscribe('inference:result', ...)` in, `publish('response:fired'/'response:dismissed', ...)` out | Renderer is a pure consumer of inference results; never triggers inference itself |
| event bus ↔ `logger.js` | `subscribe` to every event type, no publish | Logger is a strict observer — must have zero side effects on the pipeline it's watching |
| `config.js` ↔ everything else | Read-only injected object, validated once at `index.js` init, passed by reference | No component re-reads or re-validates config after init; no component mutates it |

## Sources

- [Building Embeddable React Widgets: Production-Ready Guide](https://makerkit.dev/blog/tutorials/embeddable-widgets-react) — single-script-tag/Shadow DOM widget pattern (MEDIUM confidence, cross-referenced with multiple similar write-ups)
- [How to Build a Lightweight Embeddable Widget in Vanilla JS (Under 30KB)](https://dev.to/alex_boykov/how-to-build-a-lightweight-embeddable-widget-in-vanilla-js-under-30kb-5f4b) — `document.currentScript`/config pattern (MEDIUM confidence)
- [Widget SDK | chatwoot/chatwoot | DeepWiki](https://deepwiki.com/chatwoot/chatwoot/6-widget-sdk) — dual-context widget architecture reference (MEDIUM confidence)
- [BrainJS/brain.js GitHub — neural-network.ts source](https://github.com/BrainJS/brain.js/blob/master/src/neural-network.ts) — internal `weights`/`biases` structure, `toJSON()`/`toFunction()` (MEDIUM confidence, primary source is the library's own repo)
- [Let's Create a Lightweight Native Event Bus in JavaScript — CSS-Tricks](https://css-tricks.com/lets-create-a-lightweight-native-event-bus-in-javascript/) — `EventTarget`-based bus pattern (MEDIUM confidence)
- [MutationObserver — MDN](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) — official API reference (MEDIUM-HIGH; official docs)
- [Behind the Curtain: Using the MutationObserver for Performance Optimization](https://fsjs.dev/behind-the-curtain-mutationobserver-performance-optimization/) — WeakMap/WeakSet idempotency and narrow-observation best practice (MEDIUM confidence)
- [pointer-events — CSS-Tricks](https://css-tricks.com/almanac/properties/p/pointer-events/) — click-through overlay pattern (MEDIUM confidence)
- [Shadow DOM CSS Isolation: How to Embed a Widget Without Breaking the Host Page](https://dev.to/issuecapture/shadow-dom-css-isolation-how-to-embed-a-widget-without-breaking-the-host-page-4oio) — Shadow DOM vs iframe vs plain-div tradeoffs (MEDIUM confidence)
- [Shadow DOM vs. iframes: Which One Actually Works? — HackerNoon](https://hackernoon.com/shadow-dom-vs-iframes-which-one-actually-works) — font inheritance/accessibility tradeoffs (MEDIUM confidence)
- [Designing Websites for iPhone X — WebKit blog](https://webkit.org/blog/7929/designing-websites-for-iphone-x/) — official `viewport-fit=cover`/`env(safe-area-inset-*)` documentation (MEDIUM-HIGH; official WebKit source)
- [CSS Environment variables; how to deal with the software bezel of iPhone X — Ben Frain](https://benfrain.com/css-environment-variables-iphonex/) — `max()`/`min()` clamping pattern (MEDIUM confidence)
- PROJECT.md (this repo, `.planning/PROJECT.md`) — the authoritative spec this research validates against

---
*Architecture research for: client-side hesitation-detection SDK (event capture + embedded ML inference + DOM overlay), single-file vanilla JS distribution*
*Researched: 2026-07-10*
