# heed-sdk (Branch 2)

## What This Is

The actual Heed product: a vanilla JavaScript file (`sdk.js`) that a partner
embeds via a single script tag. It instruments mobile touch-based hesitation
signals on the host page, classifies intent through a small feedforward
neural network running entirely client-side, and fires config-driven overlay
responses — without touching the host DOM, reading user data, or requiring
any backend integration. Built against the dummy platform (Branch 1) via the
locked `data-heed` selector contract, but generic — a real partner only
changes config, never the SDK itself.

## Core Value

All four signal types (touch hesitation, blur incomplete, scroll reversal,
back intent) are captured cleanly and fed through a correctly implemented
2-layer feedforward net that produces a real probability distribution over
intent classes — not a lookup table wearing a neural network's clothes. The
inference layer is what separates Heed from a rules engine, and this branch
exists to prove it's built right.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Signal 1 — touch hesitation: touchstart timer, held-touch threshold (default 800ms) distinguishes hesitation from a normal tap (<300ms)
- [ ] Signal 2 — blur without completion: input focus → blur with no value change emits `blur_incomplete`
- [ ] Signal 3 — scroll reversal: scroll past configurable depth threshold (default 40% viewport) then reverse emits `scroll_reversal`
- [ ] Signal 4 — back intent: `popstate` while `flowComplete` is false emits `back_intent`
- [ ] All signal payloads are geometry/timing only — `{ type, targetSelector, bbox, timestamp }`, no field values, no identity
- [ ] Internal event bus carries signals from signal.js to inference.js with no signal leaving the browser except the session-end weight push
- [ ] 2-layer feedforward net: 4-node input → 4-node hidden (ReLU) → 4-node softmax output over {confusion, price_doubt, trust_gap, flow_friction}
- [ ] Forward pass implemented explicitly (W1/b1 → ReLU → W2/b2 → softmax) — not abstracted behind a black-box call without understanding each step
- [ ] Confidence threshold gate (default 0.65) — no response fires below threshold
- [ ] Weight update fires once at session end (not per-event), outcome label from `flowComplete`, learning rate 0.01
- [ ] Cold-start weights encode the domain-knowledge mapping (touch_hesitation→confusion, blur_incomplete→flow_friction, scroll_reversal→price_doubt, back_intent→trust_gap) and are used when no learned weights exist yet
- [ ] Response overlay: single fixed full-viewport div injected at init, `pointer-events: none` on the container, `pointer-events: auto` on rendered response elements, host DOM untouched
- [ ] `clampToViewport()` keeps responses within iOS safe-area insets on a 390px viewport
- [ ] All 4 response types implemented: tooltip, nudge_copy, discount_offer (fires `postMessage` to host, does not fulfill the offer itself), social_proof
- [ ] Config layer: `config/schema.json` (documented schema) + `config/demo-platform.json` (targets the 7 locked `data-heed` selectors from CONTRACT.md)
- [ ] Config validation hard-fails on invalid schema
- [ ] SPA re-attachment: MutationObserver on `document.body` + popstate listener, both gated on pathname change, idempotent re-attachment via WeakSet tracking — no double-firing
- [ ] Logging layer: every entry `{ ts, sessionId, partnerId, event, data }`, event types `signal_detected | inference_run | response_fired | response_dismissed | flow_complete | flow_abandoned`, emitted via `console.log('[heed]', JSON.stringify(entry))`
- [ ] Standalone local test harness (static HTML, not the real Next.js app) exposing all 7 `data-heed` selectors so every signal type can be manually triggered without a running Branch 1
- [ ] Real local weight-push receiver: minimal local server accepts the session-end POST, persists the updated weight array to a local JSON file, and `sdk.js` cold-start reads that file if present (falling back to the structured-guess weights otherwise) — closes the learning loop across sessions
- [ ] Manual testing sequence from the spec passes against a live Branch 1 once available: press-and-hold triggers hesitation, blur-without-typing triggers blur_incomplete, scroll down/up triggers scroll_reversal, back button before success triggers back_intent, log sequence is `signal_detected → inference_run → response_fired`, overlay renders above platform UI without blocking interaction, no logs fire on Screen 1 (not in `activeScreens`)

### Out of Scope

- Narrowing to a subset of signal or response types — this is a learning build; every signal type teaches a distinct browser-event pattern (timer, state comparison, positional tracking, navigation interception) and cutting any of them cuts that lesson
- A production weight-push backend, database, or auth — the local receiver is dev/test tooling to close the loop, not a service; Branch 4 (heed-eval) owns real training/eval infrastructure
- React/Vue/any framework, any bundler — vanilla JS only, per hard constraint; brain.js is the one allowed dependency
- Vision model pipeline, federated learning, multi-partner dashboard — explicitly deferred per harness scope boundaries (CLAUDE.md)
- Any external API call during a session other than the one session-end weight push
- Reading or transmitting PII, field values, user identity, cookies, or localStorage — signal payloads are bbox + timestamp only

## Context

- **Waterfall position:** Built SECOND, after Branch 1 (heed-demo-platform) exists and the `data-heed` selectors are confirmed. As of this writing, Branch 1 is mid-Phase-1 (routed flow skeleton), not yet gate-passed. CLAUDE.md's waterfall rule was deliberately relaxed by the project owner ("Branches are built in waterfall order by default but the project owner can override this deliberately at any time") to allow Branch 2 planning to begin now.
- **Decoupling from live Branch 1:** The 7 `data-heed` selectors are locked in CONTRACT.md independent of Branch 1's implementation progress, so `signal.js` and `config/demo-platform.json` can be built and unit-tested against a standalone local test harness (static HTML exposing the same selectors) without waiting on a running Branch 1. The spec's full manual testing sequence — the true integration gate — still requires Branch 1 live, and is tracked as its own requirement.
- **The contract:** CONTRACT.md's 7 locked selectors are the interface this branch consumes and Branch 3 (Playwright agents) will later drive. This branch does not own or modify them.
- **Runtime connection (later branches):** Branch 1 runs on localhost:3000; this branch's `sdk.js` is loaded via a script tag in Branch 1's HTML head; Branch 3 points a browser at Branch 1's URL with this SDK attached.
- **What building this teaches:** low-level browser event APIs (touchstart/touchend/blur/scroll/popstate) and what data they carry; how a feedforward net actually works end to end (forward pass, ReLU, softmax, weight matrices, backprop at a conceptual level); why inference must run client-side (latency — the hesitation window is seconds, a server round-trip kills it); why `postMessage` is the safe channel between a sandboxed surface and a host page; config-as-contract architecture (generic SDK, specific config); and what "no PII" means in concrete implementation terms.
- **Emphasis:** per explicit direction, the inference layer (forward pass, weight matrices, softmax, learning rate, weight persistence) is the conceptual core of this branch and should receive the most planning and execution depth — signal capture and response rendering are comparatively mechanical.

## Constraints

- **Tech stack**: Vanilla JavaScript only, single-file `sdk.js` output, no framework, no bundler — the one dependency is brain.js for the neural network. Fixed by spec so the SDK stays portable to any real partner platform.
- **Network**: No external API calls during a session — the only outbound call is the session-end weight push, and even that goes to a local dev receiver in this branch, not a real CDN endpoint.
- **PII**: Signal payloads are bbox + timestamp only — no field values, no user identity, no cookies, no localStorage reads. Any change that would leak these must stop and flag.
- **Selectors**: Consumes but never renames the 7 locked `data-heed` selectors from CONTRACT.md — downstream (Branch 3) breaks if they move.
- **Platform**: Mobile-only signal set (touch events only, no mouse/hover), designed against a 390px viewport with iOS safe-area insets.
- **Scope**: No dashboard, no production CDN deploy, no federated learning, no vision pipeline — waterfall/harness scope boundaries per CLAUDE.md.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build all 4 signal types and all 4 response types in v1, no narrowing | Learning build — each signal/response type teaches a distinct technical pattern; cutting any cuts that lesson | — Pending |
| Inference layer gets dedicated, deeper planning phase(s) vs. interleaved | Explicitly the conceptual core of the product per spec and user direction; signal/response layers are comparatively mechanical | — Pending |
| Standalone local static-HTML test harness (not dependent on live Branch 1) | Branch 1 isn't gate-passed yet; the 7 selectors are locked in CONTRACT.md independent of Branch 1's build status, so signal/config work can proceed and be tested now | — Pending |
| Real local weight-push receiver that persists and reloads weights | Closes the actual learning loop across sessions (not just a logged stub) — teaches weight serialization and cold-start-vs-learned-weight handling, matching the "learning build" goal | — Pending |
| Waterfall rule relaxed to allow Branch 2 planning before Branch 1's gate passes | Deliberate project-owner override recorded in CLAUDE.md | ✓ Good |

---
*Last updated: 2026-07-09 after initialization*
