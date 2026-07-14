# Requirements: heed-sdk (Branch 2)

**Defined:** 2026-07-11
**Core Value:** All four signal types (touch hesitation, blur incomplete, scroll reversal, back intent) are captured cleanly and fed through a correctly implemented 2-layer feedforward net that produces a real probability distribution over intent classes — not a lookup table wearing a neural network's clothes.

## v1 Requirements

Requirements for initial release. Each maps to a roadmap phase. Per PROJECT.md, this is a learning build — no narrowing of signal or response types; every signal/response type teaches a distinct pattern.

### Config

- [x] **CFG-01**: `config/schema.json` (documented schema) + `config/demo-platform.json` target the 7 locked `data-heed` selectors from CONTRACT.md
- [x] **CFG-02**: Config validation hard-fails on invalid schema

### Bus

- [x] **BUS-01**: Internal event bus carries signals from `signal.js` to `inference.js` with no signal leaving the browser except the session-end weight push

### Signals

- [x] **SIG-01**: Touch hesitation — `touchstart` timer, held-touch threshold (default 800ms) distinguishes hesitation from a normal tap (<300ms)
- [x] **SIG-02**: Blur without completion — input focus → blur with no value change emits `blur_incomplete`
- [x] **SIG-03**: Scroll reversal — scroll past configurable depth threshold (default 40% viewport) then reverse emits `scroll_reversal`
- [ ] **SIG-04**: Back intent — `popstate` while `flowComplete` is false emits `back_intent`
- [x] **SIG-05**: All signal payloads are geometry/timing only — `{ type, targetSelector, bbox, timestamp }`, no field values, no identity
- [ ] **SIG-06**: SPA re-attachment — MutationObserver on `document.body` + popstate listener, both gated on pathname change, idempotent re-attachment via WeakSet tracking, no double-firing

### Inference

- [ ] **INF-01**: 2-layer feedforward net: 4-node input → 4-node hidden (ReLU) → 4-node softmax output over {confusion, price_doubt, trust_gap, flow_friction}
- [ ] **INF-02**: Forward pass implemented explicitly in `sdk.js` (W1/b1 → ReLU → W2/b2 → softmax) reading weight arrays exported from brain.js training — not a brain.js `.run()` black-box call at inference time
- [ ] **INF-03**: Confidence threshold gate (default 0.65) — no response fires below threshold
- [ ] **INF-04**: Weight update fires once at session end (not per-event), outcome label from `flowComplete`, learning rate 0.01
- [ ] **INF-05**: Cold-start weights encode the domain-knowledge mapping (touch_hesitation→confusion, blur_incomplete→flow_friction, scroll_reversal→price_doubt, back_intent→trust_gap) and are used when no learned weights exist yet

### Response

- [ ] **RESP-01**: Single fixed full-viewport div injected at init, `pointer-events: none` on the container, `pointer-events: auto` on rendered response elements, host DOM untouched
- [ ] **RESP-02**: `clampToViewport()` keeps responses within iOS safe-area insets on a 390px viewport
- [ ] **RESP-03**: All 4 response types implemented: tooltip, nudge_copy, discount_offer (fires `postMessage` to host, does not fulfill the offer itself), social_proof

### Logging

- [ ] **LOG-01**: Every entry `{ ts, sessionId, partnerId, event, data }`, event types `signal_detected | inference_run | response_fired | response_dismissed | flow_complete | flow_abandoned`, emitted via `console.log('[heed]', JSON.stringify(entry))`

### Test Harness & Weight Loop

- [x] **TEST-01**: Standalone local test harness (static HTML, not the real Next.js app) exposing all 7 `data-heed` selectors so every signal type can be manually triggered without a running Branch 1
- [ ] **WEIGHT-01**: Real local weight-push receiver — minimal local server accepts the session-end POST, persists the updated weight array to a local JSON file, and `sdk.js` cold-start reads that file if present (falling back to structured-guess weights otherwise)

### Integration

- [ ] **INTEG-01**: Manual testing sequence from the spec passes against a live Branch 1 once available: press-and-hold triggers hesitation, blur-without-typing triggers blur_incomplete, scroll down/up triggers scroll_reversal, back button before success triggers back_intent, log sequence is `signal_detected → inference_run → response_fired`, overlay renders above platform UI without blocking interaction, no logs fire on Screen 1 (not in `activeScreens`)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Inference

- **INF-V2-01**: Session-level multi-signal correlation — classify intent from a sequence of signals within a session rather than one signal event at a time (flagged by features research as the natural next increment once the single-event net and weight-push loop are proven)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Narrowing to a subset of signal or response types | Learning build — every signal/response type teaches a distinct browser-event pattern; cutting any cuts that lesson |
| Production weight-push backend, database, or auth | Local receiver is dev/test tooling to close the loop, not a service; Branch 4 (heed-eval) owns real training/eval infrastructure |
| React/Vue/any framework, any bundler shipped to the partner | Vanilla JS only per hard constraint; brain.js is the one allowed runtime dependency, esbuild is a dev-only build tool |
| Vision model pipeline, federated learning, multi-partner dashboard | Explicitly deferred per harness scope boundaries (CLAUDE.md) |
| Any external API call during a session other than the session-end weight push | Hard constraint — latency and PII surface |
| Reading or transmitting PII, field values, user identity, cookies, or localStorage | Signal payloads are bbox + timestamp only |
| Shadow DOM for overlay isolation | Plain-div + pointer-events split is simpler and sufficient for v1; flagged by architecture research as a v2 CSS-isolation refinement, not a v1 requirement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| CFG-01 | Phase 1 | Complete |
| CFG-02 | Phase 1 | Complete |
| BUS-01 | Phase 1 | Complete |
| TEST-01 | Phase 1 | Complete |
| SIG-01 | Phase 2 | Complete |
| SIG-02 | Phase 2 | Complete |
| SIG-03 | Phase 2 | Complete |
| SIG-04 | Phase 2 | Pending |
| SIG-05 | Phase 2 | Complete |
| SIG-06 | Phase 2 | Pending |
| INF-01 | Phase 3 | Pending |
| INF-02 | Phase 3 | Pending |
| INF-03 | Phase 3 | Pending |
| INF-04 | Phase 3 | Pending |
| INF-05 | Phase 3 | Pending |
| RESP-01 | Phase 4 | Pending |
| RESP-02 | Phase 4 | Pending |
| RESP-03 | Phase 4 | Pending |
| LOG-01 | Phase 4 | Pending |
| WEIGHT-01 | Phase 5 | Pending |
| INTEG-01 | Phase 6 | Pending |

**Coverage:**

- v1 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-07-11*
*Last updated: 2026-07-11 after roadmap creation — traceability mapped, 100% coverage*
