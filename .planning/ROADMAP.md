# Roadmap: heed-sdk (Branch 2)

## Overview

This branch builds the actual Heed product: a vanilla-JS `sdk.js` that captures four
touch-based hesitation signals, classifies intent through a hand-written 2-layer
feedforward net, and fires one of four confidence-gated overlay responses — all
client-side, all PII-free. The build follows a horizontal-layer path dictated by the
project's own architecture: config and a pub/sub bus first (so every later layer has
something to read from and write to), then signal capture (so inference has real
payloads to classify), then the inference layer itself — the conceptual core of this
branch and the phase that gets the deepest treatment — then response rendering and
logging as pure consumers of inference output, then the session-end weight-push loop
that closes the learning cycle, and finally a live integration-verification pass
against Branch 1 (heed-demo-platform) once that branch's own gate has passed. A
standalone static-HTML test harness built in Phase 1 decouples Phases 1-5 entirely
from Branch 1's build status; only the final phase requires Branch 1 live.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Config Layer, Bus & Standalone Test Harness** - Config-driven selector targeting, a pub/sub bus, and a static test harness that unblocks every later phase from Branch 1's build status (completed 2026-07-12)
- [ ] **Phase 2: Signal Capture Layer** - All 4 signal types captured cleanly, SPA-safe, and emitted as PII-free payloads onto the bus
- [ ] **Phase 3: Inference Layer** - A genuine, explicitly hand-written forward pass classifies signals into 4 intent classes, gated by confidence, improved by a real session-end learning update
- [ ] **Phase 4: Response Overlay & Logging** - Confidence-gated inference results render as one of 4 non-blocking overlay responses; every pipeline event is structurally logged
- [ ] **Phase 5: Weight-Push Learning Loop** - Session-end weight updates persist locally and are picked up on the next cold start, closing the learning loop across sessions
- [ ] **Phase 6: Integration Verification Against Live Branch 1** - The spec's full manual testing sequence passes end-to-end against a live, gate-passed Branch 1

## Phase Details

### Phase 1: Config Layer, Bus & Standalone Test Harness

**Goal**: The SDK's foundational plumbing — config-driven selector targeting, a working pub/sub bus, and a standalone way to trigger every signal type — exists and is verifiable independent of Branch 1's build status.
**Depends on**: Nothing (first phase)
**Requirements**: CFG-01, CFG-02, BUS-01, TEST-01
**Success Criteria** (what must be TRUE):

  1. `config/demo-platform.json` validates cleanly against `config/schema.json` and resolves all 7 locked `data-heed` selectors from CONTRACT.md.
  2. Loading a config file with an invalid or missing field causes the SDK to hard-fail at init — not silently degrade or fall back to defaults.
  3. A signal published on the bus by a test emitter is received by a separate subscriber module with no direct import between the two.
  4. Opening `test-harness/index.html` in a browser exposes all 7 `data-heed` selectors and every signal type can be manually triggered with no running Branch 1 and no backend.

**Plans**: 5/5 plans complete
**Wave 1**

- [x] 01-01-PLAN.md — Project scaffold + failing (RED) test suite for CFG-01/CFG-02/BUS-01/TEST-01 (Wave 0)
- [x] 01-02-PLAN.md — Config layer: schema.json, demo-platform.json, hard-fail validator (CFG-01, CFG-02) (Wave 1)
- [x] 01-03-PLAN.md — Private-EventTarget pub/sub bus (BUS-01) (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-04-PLAN.md — init() orchestrator, esbuild bundle, static test harness with synthetic-signal debug panel (TEST-01) (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — Human-verify checkpoint: harness end-to-end in a real browser (TEST-01 gate) (Wave 3)

### Phase 2: Signal Capture Layer

**Goal**: All 4 signal types are captured cleanly from raw DOM events, survive SPA navigation without double-firing or silent under-attachment, and emit strictly PII-free payloads onto the bus.
**Depends on**: Phase 1
**Requirements**: SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, SIG-06
**Success Criteria** (what must be TRUE):

  1. Pressing and holding a touch target for 800ms+ emits a `touch_hesitation` signal with a `{ type, targetSelector, bbox, timestamp }` payload; a tap under 300ms emits nothing.
  2. Focusing then blurring an input with no value change emits `blur_incomplete`; blurring after a value change emits nothing.
  3. Scrolling past 40% viewport depth then reversing direction emits `scroll_reversal`.
  4. Triggering back navigation (`popstate`) while `flowComplete` is false emits `back_intent`.
  5. Every emitted signal payload contains only geometry/timing fields — no field values, no user identity, confirmed by code inspection of the payload-construction path.
  6. Simulating 3+ consecutive SPA route changes re-attaches listeners exactly once per navigation via WeakSet-keyed idempotency, with no duplicate signal firing and no missed re-attachment.

**Plans**: TBD

### Phase 3: Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights

**Goal**: Incoming signals are classified into one of 4 intent classes through a genuine, explicitly hand-written forward pass — not a black-box call — gated by a confidence threshold, and improved through a real, bounded session-end learning update. This is the conceptual core of the branch per PROJECT.md's explicit direction and receives the deepest planning and verification of any phase in this roadmap.
**Depends on**: Phase 2 (inference correctness is only verifiable against real signal payloads, not synthetic stand-ins)
**Requirements**: INF-01, INF-02, INF-03, INF-04, INF-05
**Success Criteria** (what must be TRUE):

  1. A signal event fed into `inference.js` produces a 4-class probability distribution (confusion, price_doubt, trust_gap, flow_friction) that sums to 1, computed via an explicit hand-written W1/b1 → ReLU → W2/b2 → softmax pass reading externally-produced weight arrays — never a brain.js `.run()` call at inference time.
  2. Printing the full softmax vector for each of the 4 canonical cold-start mappings (touch_hesitation→confusion, blur_incomplete→flow_friction, scroll_reversal→price_doubt, back_intent→trust_gap) plus one deliberately ambiguous input shows the correct class winning with a real margin — not a saturated (~1.0) or uniform (~0.25 each) distribution.
  3. An inference result below the 0.65 confidence threshold produces no downstream response; a result at or above it does.
  4. At session end, exactly one weight update fires — never per-event — using the session's `flowComplete` value as the outcome label and a learning rate of 0.01, confirmed by inspecting weights before and after a single synthetic session.
  5. With no learned-weights file present, `sdk.js` cold-starts from the domain-knowledge weight arrays; with one present, it loads and uses those instead.

**Plans**: TBD

### Phase 4: Response Overlay & Logging

**Goal**: Confidence-gated inference results render as one of 4 non-blocking overlay responses without touching host DOM, and every pipeline event is captured in a structured, replayable log.
**Depends on**: Phase 3 (renderer and logger are pure consumers of inference output)
**Requirements**: RESP-01, RESP-02, RESP-03, LOG-01
**Success Criteria** (what must be TRUE):

  1. A single full-viewport overlay div is injected once at init with `pointer-events: none` on the container; the host page remains fully tappable/scrollable underneath it, and every individual rendered response element carries its own `pointer-events: auto` so it is itself tappable — verified in both directions.
  2. On a 390px viewport, rendered responses stay clamped within the iOS safe-area insets via `clampToViewport()` regardless of the triggering signal's original position on screen.
  3. Each of the 4 response types (tooltip, nudge_copy, discount_offer, social_proof) renders correctly for its mapped intent class; `discount_offer` fires a `postMessage` to the host with an explicit target origin and does not itself grant or fulfill the discount.
  4. Every pipeline event type (`signal_detected`, `inference_run`, `response_fired`, `response_dismissed`, `flow_complete`, `flow_abandoned`) produces exactly one structured `console.log('[heed]', JSON.stringify(entry))` line with `{ ts, sessionId, partnerId, event, data }`, emitted only from the logging layer.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Weight-Push Learning Loop

**Goal**: The on-device learning loop closes across sessions — updated weights persist locally and are picked up on the next cold start, without corrupting the pipeline if that persistence ever fails.
**Depends on**: Phase 4 (needs the full pipeline in place to generate realistic session outcomes to test the loop against)
**Requirements**: WEIGHT-01
**Success Criteria** (what must be TRUE):

  1. A session-end weight-update POST is accepted by the local receiver and persisted to a local JSON weight file.
  2. Restarting the test harness after a persisted weight file exists causes `sdk.js` to load those learned weights instead of the cold-start domain-knowledge weights.
  3. Running 10-20 synthetic sessions back-to-back through the local harness does not collapse the softmax output toward uniform or saturated for the canonical test signals, checked before and after the run.
  4. A malformed or corrupt weight file does not crash the receiver or the SDK's cold-start path — the SDK falls back to the structured-guess cold-start weights instead.

**Plans**: TBD

### Phase 6: Integration Verification Against Live Branch 1

**Goal**: The spec's full manual testing sequence — the true integration gate for this branch — passes end-to-end against a live Branch 1 (heed-demo-platform).

**⚠️ External dependency flag**: This phase requires Branch 1 (heed-demo-platform) to be live and gate-passed. As of this roadmap's creation, Branch 1 is mid-Phase-1 (routed flow skeleton) and has NOT yet gate-passed. Phases 1-5 of this branch are fully decoupled from Branch 1's status via the standalone test harness built in Phase 1, but this phase cannot start — and should not be silently assumed unblocked — until Branch 1 reports its own gate pass. Re-check Branch 1's STATE.md before beginning this phase.

**Depends on**: Phase 5, AND Branch 1 (heed-demo-platform) reaching its own gate-pass (external, not yet met)
**Requirements**: INTEG-01
**Success Criteria** (what must be TRUE):

  1. Press-and-hold on a live Branch 1 touch target triggers `touch_hesitation`; blurring an untouched input triggers `blur_incomplete`; scrolling down then up triggers `scroll_reversal`; pressing back before flow completion triggers `back_intent`.
  2. The console log sequence for a triggered signal reads `signal_detected → inference_run → response_fired` with no missing or reordered steps.
  3. The response overlay renders visually above Branch 1's UI without blocking interaction with the underlying platform.
  4. No `[heed]` log entries fire while on Screen 1 (a screen not present in `activeScreens`).

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Config Layer, Bus & Standalone Test Harness | 5/5 | Complete   | 2026-07-12 |
| 2. Signal Capture Layer | 0/TBD | Not started | - |
| 3. Inference Layer | 0/TBD | Not started | - |
| 4. Response Overlay & Logging | 0/TBD | Not started | - |
| 5. Weight-Push Learning Loop | 0/TBD | Not started | - |
| 6. Integration Verification Against Live Branch 1 | 0/TBD | Not started | - |
