# heed-sdk (Branch 2 — `feat/heed-sdk`)

## 1. What this branch is

This is the actual Heed product: one JavaScript file that a mobile web page loads with a single `<script>` tag. Once it's running, it quietly watches how a person touches, scrolls, and navigates a checkout-style screen — pressing and holding a button without releasing it, focusing a field and leaving it empty, scrolling down to read something and then scrolling back up, hitting the browser's back button before finishing. When it sees one of those patterns, a small neural network that runs entirely inside the browser — no server call, no round trip — decides what the person is probably stuck on, and a small non-blocking message appears near the relevant part of the screen. It never reads what anyone actually typed, never touches cookies or local storage, and the only time it ever talks to a server is a single message at the very end of a session, carrying nothing but its own updated numbers. This repository is where that file, and everything needed to build, test, and train it, lives.

---

## 2. Folder and file structure

### Root

| Path | What it is |
|---|---|
| `CLAUDE.md` | Repo-wide rules that apply to every branch: the locked selector contract, the PII/network/dependency hard limits, and what belongs on `main` vs. a feature branch |
| `.claude/CLAUDE.md` | This branch's own project brief — tech stack rationale, constraints, and the GSD workflow requirement for this branch specifically |
| `CONTRACT.md` | The seven locked `data-heed` selectors that connect Branches 1, 2, and 3, and how each branch is expected to use them |
| `README.md` | This file |
| `package.json` | npm scripts (`build`, `test`, `receiver`, `generate-weights`, `soak-test`) and the project's two dependency groups |
| `package-lock.json` | Locked dependency tree |
| `playwright.config.js` | Two Playwright projects — `file-harness` (the file:// static harness) and `live-branch1` (a real, worktree'd Branch 1) |
| `vitest.config.js` | Vitest config: `happy-dom` environment, excludes `tests/e2e/**` (that's Playwright's own suite) |
| `.gitignore` | Ignores `node_modules/`, `dist/`, `test-results/`, `playwright-report/`, `local-receiver/weights.json`, `.next/` |

### `src/` — the SDK itself, bundled into `dist/sdk.js`

| File | What it owns |
|---|---|
| `index.js` | `init()`/`initDemo()` — validates config, then wires all five layers together in a specific, load-bearing order |
| `bus.js` | The private pub/sub event bus every other module talks through — a wrapped `EventTarget`, never exposed on `window` |
| `config.js` | A generic JSON-Schema-subset validator (`type`/`required`/`properties`/`enum`/`additionalProperties`) that hard-fails on any invalid config |
| `signal.js` | Captures the four raw DOM signals and turns them into PII-free bus payloads |
| `inference.js` | The hand-written forward pass, the confidence gate, and the session-end learning update |
| `response.js` | Renders the non-blocking overlay bubble for a fired response |
| `log.js` | The sole `console.log('[heed]', ...)` call site in the codebase, plus session-lifecycle wiring (when a session ends and why) |

### `config/` — SDK configuration

| File | What it is |
|---|---|
| `schema.json` | The schema `config.js` validates every config object against |
| `demo-platform.json` | Config used by the standalone file:// test harness — `activeScreens: []` (permissive, no gating) |
| `demo-platform-live.json` | Config used for live Branch 1 verification — `activeScreens` gated to `["/swap", "/confirm", "/success"]` |

### `admin/` — dev-only tooling, never imported by `src/`, never bundled

| File | What it does |
|---|---|
| `generate-weights.mjs` | Trains the 4 canonical signal→intent mappings through brain.js and writes the extracted weights to `admin/weights.js`. **The only place brain.js is imported anywhere in this project.** |
| `weights.js` | GENERATED — the cold-start `{W1, b1, W2, b2}` weight arrays. Do not hand-edit; regenerate with `npm run generate-weights` |
| `print-softmax-margins.mjs` | Prints the softmax output for the 4 canonical mappings plus one ambiguous blend, and fails loudly if any margin is saturated or collapsed |
| `check-bundle-purity.mjs` | Runs automatically after `npm run build`; fails the build if brain.js internals leaked into `dist/sdk.js` |
| `soak-test-weights.mjs` | Drives 16 synthetic sessions through the real receiver, proving the learning loop doesn't degenerate over repeated updates |

### `local-receiver/` — dev/test-only local server, never imported by `src/`, never bundled

| File | What it is |
|---|---|
| `server.js` | A plain Node `http` server (zero framework) serving `GET`/`POST /weights`, `GET /sdk.js`, and `GET /config/demo-platform-live.json` |
| `weights.json` | The currently persisted learned weights (gitignored — written by `POST /weights`, read back by `GET /weights`) |

### `test-harness/` — manual testing without Branch 1 or any server

| File | What it is |
|---|---|
| `index.html` | A static page exposing all 7 `data-heed` selectors on one page, plus a debug panel with 4 "simulate signal" buttons and a live log |

### `tests/` — Vitest unit/integration suites + the Playwright e2e suite

| File | What it covers |
|---|---|
| `bus.test.js` | The pub/sub bus |
| `config.test.js` | The config validator |
| `index.test.js` | `init()`/`initDemo()` orchestration |
| `harness.test.js` | Structural checks on the static test-harness file |
| `signal.test.js` | SIG-01 through SIG-05 — the four raw signal types and the PII-free payload shape |
| `signal-spa.test.js` | SIG-06 — SPA re-attachment idempotency |
| `inference.test.js` | INF-01/02/03/05 — forward pass, confidence gate, cold-start loading |
| `inference-endsession.test.js` | INF-04 — the session-end learning update |
| `response.test.js` | RESP-01/02/03 — overlay rendering, positioning, response types |
| `log.test.js` | LOG-01 — structured logging and session-lifecycle wiring |
| `local-receiver.test.js` | WEIGHT-01 — receiver GET/POST behavior and persistence |
| `fixtures/test-emitter.js` | A tiny module that publishes one synthetic bus event, used to prove bus decoupling |
| `fixtures/test-subscriber.js` | A tiny module that subscribes to the bus and collects what it receives |
| `e2e/harness.spec.js` | Playwright, real Chromium, against the file:// static harness |
| `e2e/branch1-live.spec.js` | Playwright, real Chromium, against a live worktree'd Branch 1 (INTEG-01 SC1–SC4) |

### `dist/` — gitignored build output

| File | What it is |
|---|---|
| `sdk.js` | The single bundled file a partner actually loads — produced by `npm run build` (`esbuild --bundle --minify`) |

### `branch spec files/` — the original text specs this repo was bootstrapped from

| File | What it is |
|---|---|
| `repo0_overview.txt` | System-level overview and the runtime connection map across all 4 branches |
| `repo1_dummy_platform.txt` | Branch 1 spec |
| `repo2_heed_sdk.txt` | Branch 2 spec — this branch |
| `repo3_heed_agents.txt` | Branch 3 spec |
| `repo4_heed_eval.txt` | Branch 4 spec |

### `.planning/`

GSD's phase-by-phase planning state — `STATE.md`, `ROADMAP.md`, `PROJECT.md`, and one directory per phase with its research/plan/summary files. This is tooling-owned; don't hand-edit it (see `CLAUDE.md`).

---

## 3. The five layers

The SDK is five layers, each one a pure consumer of the layer before it, connected only through the bus (`src/bus.js`) — no layer ever imports another layer's internals directly. `src/index.js`'s `init()` wires them in this exact order:

```
initSignalCapture(config)   // Layer 2
initLogging(config, id)     // Layer 5 (registered here, deliberately, not last — see below)
initInference(config)       // Layer 3
initResponse(config, id)    // Layer 4
```

### Layer 1 — Config (`src/config.js`, `config/schema.json`)

`validateConfig(config, schema)` walks a restricted JSON-Schema-draft-07 subset — `type`, `required`, `properties`, `enum`, `additionalProperties` — against whatever config object `init()` was called with. It throws on the first violation; there is no partial success and no silent fallback to defaults. This runs first, before any DOM listener is attached, so an invalid config never gets a chance to half-instrument the page. The validated config object is what every other layer below receives as its `config` argument.

### Layer 2 — Signal Capture (`src/signal.js`)

`initSignalCapture(config)` wires four raw-DOM-event listeners:

- **touch_hesitation** — a `setTimeout` armed on `touchstart`, cleared on `touchend`/`touchcancel`/`touchmove`; if it isn't cleared before `config.signals.touchHesitation.thresholdMs` (default 800ms), it fires live, while the finger is still down
- **blur_incomplete** — on `blur`, checks `el.value === ''`; a value diff, never the value itself, decides whether to publish
- **scroll_reversal** — tracks `maxScrollY`; once scroll depth crosses `depthThresholdPct` (default 40%) and then reverses by more than `minReversalDeltaPx` (default 50px), it fires
- **back_intent** — a `popstate` listener that fires unless a cached `flowCompleteFlag` is already true

Every one of these funnels through `buildPayload()`, the single function that constructs what actually gets published — this is where the no-PII guarantee is enforced structurally: the only DOM read is `getBoundingClientRect()`, never `.value`/`.textContent`/`.innerHTML`/`localStorage`/`document.cookie`. The result — `{ type, targetSelector, bbox, timestamp }` (or `scrollDepth`/`pathname` in place of `targetSelector`/`bbox` for the two signals with no single held element) — is published as `signal:detected`. A `MutationObserver` + `WeakSet`-keyed idempotency guard makes this SPA-safe: route changes re-attach listeners to new elements without double-firing on ones already wired.

### Layer 3 — Inference (`src/inference.js`) — the conceptual core

`initInference(config)` subscribes to `signal:detected`. For each signal, the four-class one-hot input vector is run through `forwardPass()` — an explicit, hand-written `W1/b1 → ReLU → W2/b2 → softmax`, never a `brain.js .run()` call, never any function this project doesn't own the math of. Output is a probability distribution over four intent classes: `confusion`, `price_doubt`, `trust_gap`, `flow_friction`. If the winning class's probability clears `config.inference.confidenceThreshold` (default 0.65), `fires: true`; either way, `inference:result` is published unconditionally — `fires` is a flag on the payload, never a gate on whether the event happens at all.

At session end, `endSession(config, outcome)` runs exactly one hand-rolled `gradientStep()` (learning rate hard-coded to 0.01) against the session's last prediction — reinforcing that predicted class if the session was abandoned, softening confidence in it (toward uniform) if the session completed — and returns the updated weights.

### Layer 4 — Response Overlay (`src/response.js`)

`initResponse(config, sessionId)` injects one `pointer-events: none`, full-viewport `<div data-heed-overlay>` exactly once, then subscribes to `inference:result`. It renders only when `payload.fires` is true and the current screen is in `config.activeScreens`. Intent maps to response type: `confusion → tooltip`, `price_doubt → discount_offer`, `trust_gap → social_proof`, `flow_friction → nudge_copy`. Every rendered bubble carries `pointer-events: auto` so it — and only it — is tappable inside the otherwise-transparent overlay; `clampToViewport()` keeps it inside iOS safe-area insets. `discount_offer` additionally posts a `heed:discount_offer` message to `window.parent` at `config.partnerOrigin` (an explicit origin, never a wildcard) — Heed only signals that the moment exists, it never grants or fulfills anything. Only one bubble is ever visible; a new above-threshold result dismisses whatever's showing first.

### Layer 5 — Logging (`src/log.js`)

`initLogging(config, sessionId)` owns the one and only `console.log('[heed]', JSON.stringify(entry))` call site in the codebase, and subscribes to `signal:detected`, `inference:result`, `response:fired`, `response:dismissed`, and `flow:complete`. It also owns session-lifecycle: a `pagehide` listener plus a `sessionEnded` guard mean `inference.js`'s `endSession()` fires exactly once per session, from whichever path (flow completion or page abandonment) arrives first, and its returned weights get forwarded to the receiver.

**Why logging is initialized before inference, not after:** both `log.js` and `inference.js` subscribe to the same `signal:detected` event on the same underlying `EventTarget`, which invokes same-event listeners in registration order, synchronously. If inference registered first, a signal would synchronously cascade through the *entire* inference → response chain — including their own log writes — before `log.js`'s own `signal_detected` line ever got written, producing the wrong console order (`inference_run → response_fired → signal_detected` instead of `signal_detected → inference_run → response_fired`). This was a real bug, found and fixed during Phase 6's live integration testing — see `.planning/quick/260720-wau-fix-sc2-log-order-bug-in-src-index-js-in/`.

---

## 4. The learning loop

1. A session ends one of two ways: the configured completion element becomes visible (`flow:complete`, via `signal.js`'s `checkFlowComplete()`), or the page unloads first (`pagehide`). `log.js`'s `sessionEnded` guard means only the first of these to arrive actually does anything.
2. That triggers `inference.js`'s `endSession(config, outcome)` — one hand-rolled gradient step, never brain.js at runtime — which returns the updated `{W1, b1, W2, b2}`.
3. `log.js` forwards those weights: `fetch()` on the `flow_complete` path, `navigator.sendBeacon()` on `pagehide`/`flow_abandoned` (it has to survive the page actually going away).
4. The destination is `config.weightPushUrl`, which in both demo configs points at `local-receiver/server.js`'s `POST /weights`.
5. The receiver validates the shape (`isValidWeights` — boolean-returning, never throws), writes to a per-request temp file, then atomically renames it onto `local-receiver/weights.json`. Concurrent POSTs are serialized through a single write-queue promise so two near-simultaneous renames onto the same destination can't race each other (an observed Windows-specific failure mode during development).
6. On the next cold start, whatever's bootstrapping the SDK (the test harness, or the worktree boot script used for live verification) does a `GET /weights` *before* calling `init()`, and injects the result into `config.inference.weights`. `initInference()` prefers that over the baked-in `admin/weights.js` default; `validateWeightsShape()` hard-fails if the injected object is malformed.
7. If `weights.json` is missing, corrupt, or the wrong shape, the receiver returns an error and never crashes; the SDK falls back to its cold-start default instead of loading garbage.

The cold-start defaults themselves (`admin/weights.js`) are generated once, offline, by `npm run generate-weights` — training brain.js's `NeuralNetwork` on the four canonical signal→intent mappings and extracting `{W1, b1, W2, b2}` from `toJSON()`. This is the *only* place brain.js is imported anywhere in this project; it never ships in `dist/sdk.js` (`admin/check-bundle-purity.mjs` enforces that automatically after every build).

---

## 5. The test harness

`test-harness/index.html` is a static page you open directly as a `file://` URL — no server, no Branch 1, nothing else running. It lays out all 7 `data-heed` selectors across three fake "screens" stacked on one page: Screen 2 (amount entry — `amount-input`, `fee-row`, `min-received-row`, `proceed-cta`), Screen 3 (confirm — `confirm-cta`, `back-btn`), and Screen 4 (success — `flow-complete`, hidden by default so `back_intent` can actually fire on first load).

It loads `../dist/sdk.js`, so **you must run `npm run build` first** or the page has nothing to load. On boot it tries a `GET` to the local receiver for persisted weights before calling `window.Heed.initDemo(overrides)` — if the receiver isn't running, or has nothing persisted yet, that's fine; the SDK falls through to its cold-start default.

The debug panel's four buttons each dispatch a **real** DOM event (constructed programmatically, `isTrusted: false`, but still a genuine `touchstart`/`focus`/`scroll`/`popstate` that `signal.js`'s real listeners react to — not a shortcut that calls `window.Heed.publish()` directly):

| Button | What it does |
|---|---|
| Simulate touch_hesitation | Dispatches `touchstart` on `proceed-cta`, waits 900ms, dispatches `touchend` |
| Simulate blur_incomplete | Dispatches `focus` then `blur` on `amount-input`, with its value forced empty |
| Simulate scroll_reversal | Scrolls to 50% of viewport height, then back up by more than 50px, dispatching `scroll` events at each step |
| Simulate back_intent | Dispatches a `popstate` event on `window` |

A live `#log` panel is subscribed to `window.Heed.subscribe('signal:detected', ...)` and prints every bus receipt as JSON — proof the event actually traveled through the bus, not a direct function call. There's also a `window.postMessage` listener for `discount_offer`'s cross-frame message; note it won't actually receive anything under `file://`, since that gives the page an opaque `null` origin and `postMessage`'s explicit target-origin check can never match it — that's a browser fact, not an SDK bug.

**To run it:** `npm run build`, then just open `test-harness/index.html` in a browser (double-click it, or drag it in — no serving step needed).

---

## 6. The local weight receiver

`local-receiver/server.js` is a plain Node `http` server — no framework, zero new dependencies — that exists purely to close the learning loop locally.

**Start it:** `npm run receiver` (runs `node local-receiver/server.js`)
**Port:** `4310` by default, overridable via the `PORT` environment variable

| Route | What it does |
|---|---|
| `GET /weights` | Returns the persisted `local-receiver/weights.json`. Returns a 404-with-JSON-error if nothing's been persisted yet, or a 500 if the on-disk file is corrupt or the wrong shape — it never serves garbage. |
| `POST /weights` | Body is a `{W1, b1, W2, b2}` JSON object, from either `fetch()` (JSON content-type) or `sendBeacon()` (text/plain) — both are parsed identically, the handler never branches on `Content-Type`. Validates the shape, then does an atomic write-temp-file-then-rename onto `weights.json`, serialized behind a write queue so concurrent POSTs can't corrupt each other. |
| `GET /sdk.js` | Serves the built `dist/sdk.js` bundle (added for Phase 6's live-Branch-1 verification, so a worktree'd Branch 1 has somewhere to load the SDK from). |
| `GET /config/demo-platform-live.json` | Serves the live-route config (same reason). |

CORS is wildcard (`Access-Control-Allow-Origin: *`) because `file://` pages carry an opaque `null` origin that can never match a specific origin string — this is safe here specifically because no credentials are ever sent and nothing served carries secrets or PII; it would not be an acceptable posture for anything actually deployed. This whole file is dev/test tooling: it is never imported by anything in `src/`, and never ends up inside `dist/sdk.js`.

---

## 7. How to run everything

```bash
# 1. Install dependencies
npm install

# 2. Build the SDK bundle (also runs a bundle-purity check automatically)
npm run build

# 3. Start the local weight receiver, in its own terminal — leave it running
npm run receiver

# 4. Open the test harness directly in a browser — no serving step
#    (double-click test-harness/index.html, or drag it into a browser window)
```

Optional, once the above works:

```bash
# Unit + integration tests (Vitest, happy-dom)
npm test

# Playwright, real browser, against the static harness
npx playwright test --project=file-harness

# Regenerate the cold-start weight defaults (admin/weights.js)
npm run generate-weights

# Prove the learning loop holds up over repeated sessions
# (requires the receiver running from step 3)
npm run soak-test
```

To verify against a **live** Branch 1 instead of the static harness (requires a `git worktree` of `feat/demo-platform` checked out as a sibling directory, external to this branch — see `.planning/phases/06-integration-verification-against-live-branch-1/` for how that's wired):

```bash
# Terminal 1, this repo
npm run receiver

# Terminal 2, the Branch 1 worktree
cd ../heed-worktree-demo-platform && npm run dev

# Terminal 3, this repo
npx playwright test --project=live-branch1
```

---

## 8. The contract

Seven `data-heed` selectors, locked in `CONTRACT.md`, are the entire interface between this branch and the other two technical branches. Branch 1 (the demo platform) is responsible for every one of these existing in its DOM with the exact attribute; Branch 2 (this branch) only ever *consumes* them, via `config/*.json`'s `selectors` block; Branch 3 (the Playwright agents) drives them directly.

| Selector | Screen | What Branch 2 does with it |
|---|---|---|
| `[data-heed="amount-input"]` | 2 — amount entry | `touch_hesitation` (via hold on nearby CTA is separate) and `blur_incomplete` wiring |
| `[data-heed="fee-row"]` | 2 — amount entry | Scroll target contributing to `scroll_reversal` |
| `[data-heed="min-received-row"]` | 2 — amount entry | Scroll target contributing to `scroll_reversal` |
| `[data-heed="proceed-cta"]` | 2 — amount entry | `touch_hesitation` hold-timer target |
| `[data-heed="confirm-cta"]` | 3 — confirm | `touch_hesitation` hold-timer target |
| `[data-heed="back-btn"]` | 3 — confirm | Not directly listened to — `back_intent` comes from a real `popstate`, not a click on this element (see Pitfall note in `tests/e2e/branch1-live.spec.js`) |
| `[data-heed="flow-complete"]` | 4 — success | `completionSelector` — its visibility sets the internal `flowComplete` flag that gates `back_intent` and drives the session-end learning trigger |

**Why they can't be renamed:** all three branches reference the literal attribute string independently — Branch 1 renders it, Branch 2's `config/*.json` targets it, Branch 3's Playwright scripts click/scroll/type on it. Renaming one, anywhere, silently breaks the other two branches with no compile-time signal — Branch 3's scripts would simply stop finding the element and fail at runtime. Changing a selector requires updating `CONTRACT.md` first, then all three branches in lockstep, never just this one.

---

## 9. What this branch is NOT

- **Not a dashboard, not any partner-facing UI.** There is no visual admin surface anywhere in this repo.
- **Not a production CDN deployment.** `local-receiver/server.js` is dev/test tooling to close the learning loop locally — it is not, and is not meant to become, a real backend service.
- **Not shipped with a framework or a bundler.** `dist/sdk.js` is one flat vanilla-JS file. `esbuild` is a dev-only build tool that never reaches a partner's page; a real integration is still exactly one `<script>` tag, zero build step on their side.
- **Not making any external API call during a session.** The single outbound call anywhere in this SDK is the session-end weight push — and even that, in this repo, only ever goes to a local dev receiver, never a real endpoint.
- **Not reading or transmitting PII.** No field values, no user identity, no cookies, no `localStorage` reads. Every signal payload is bounding-box geometry and a timestamp, full stop — enforced structurally in `signal.js`'s `buildPayload()` and `response.js`'s rendering path, not just by convention.
- **Not narrowed to a subset of signals or responses.** All four signal types and all four response types are in scope for v1 — this is a learning build, and each one teaches a distinct browser-event or rendering pattern that cutting it would cut.
- **Not a vision model, not federated learning, not a multi-partner system.** Explicitly out of scope per the harness's own boundaries.
- **Not cross-branch.** This branch never imports code from Branch 1, 3, or 4, and shares state with them only through the one locked selector contract and the weight file Branch 4 would eventually write into this branch's config. Manual verification against a live Branch 1 uses a disposable `git worktree` with a throwaway, never-committed script-tag edit — nothing from that process is ever merged into another branch's history.
- **Not mouse- or hover-driven.** Every signal is a real touch/mobile browser event; there is no mouse or hover handling anywhere in `signal.js`. The whole SDK is designed against a 390px viewport with iOS safe-area insets in mind.
