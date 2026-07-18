# Phase 4: Response Overlay & Logging - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Confidence-gated `inference:result` bus events (published by Phase 3's `inference.js` on every
signal, regardless of `fires`) render as one of 4 non-blocking overlay bubbles (tooltip,
nudge_copy, discount_offer, social_proof) without touching host DOM, and every one of the 6
pipeline event types (`signal_detected`, `inference_run`, `response_fired`, `response_dismissed`,
`flow_complete`, `flow_abandoned`) produces exactly one structured `console.log('[heed]', ...)`
line. This phase also wires the real session-end trigger that Phase 3's `inference.js` deliberately
left unwired — `endSession(config, outcome)` exists but nothing calls it yet. This phase does NOT
build weight persistence/push (Phase 5) and does NOT require a live Branch 1 (Phase 6) — the
standalone test harness remains the test surface.

Most of the visual/copy/positioning/logging-shape ground is already locked by
`04-UI-SPEC.md` (produced by `/gsd-ui-phase` before this discussion) — this discussion focused only
on the integration/architecture decisions the UI-SPEC deliberately left open.

</domain>

<decisions>
## Implementation Decisions

### Session-End Trigger Wiring
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
  non-idempotent (03-CONTEXT.md — a second call against already-updated weights produces a second,
  distinct delta), so an unguarded double-call would double-count the session's learning signal.

### Response Copy/Type Source
- **D-04:** Response copy and the intent→response-type mapping are **hardcoded** in `response.js`
  per `04-UI-SPEC.md`'s exact strings — not read from a `config.responses.*` structure this phase.
  `config/schema.json` may declare an optional `responses` field for future per-partner overrides,
  but `demo-platform.json` does not set it in this phase. **Rationale:** proves the response
  mechanism with real, UI-SPEC-approved content now; full per-partner config-driven copy is a
  natural v2 increment once the mechanism itself is validated, not a v1 requirement per
  REQUIREMENTS.md's RESP-03 wording (which only requires the 4 types render correctly, not that
  copy be externally configurable).

### Response Concurrency
- **D-05:** Only one response bubble is visible at a time. If a new above-threshold
  `inference:result` arrives while a bubble is already showing, the existing bubble is dismissed
  and the new one renders immediately in its place. **This requires adding a 4th `dismissReason`
  value** beyond UI-SPEC's existing `"manual" | "cta" | "timeout"` enum — planner/executor should
  add `"replaced"` to that enum in `log.js`'s `response_dismissed` payload shape and flag the
  addition back to `04-UI-SPEC.md` if UI-SPEC needs a matching update.

### activeScreens Gating
- **D-06:** `activeScreens` (a new `config` field, not yet in `config/schema.json`) gates **only**
  the logging layer and the response layer — `inference.js`'s `publish('inference:result', ...)`
  behavior is completely unchanged by this phase (still publishes on every signal, per Phase 3's
  D-01, regardless of screen). Concretely: `log.js` checks `activeScreens` before writing any of the
  6 log lines; `response.js` checks it before rendering a bubble, even when `fires === true`.
  **Rationale:** matches UI-SPEC's own framing ("no log line fires while outside activeScreens";
  "response_fired ... AND activeScreens gate passes") and keeps Phase 3's already-verified inference
  behavior untouched — gating further upstream (in `signal.js`/`index.js`) would reopen a closed,
  verified phase's behavior.
- **D-07:** `demo-platform.json`'s `activeScreens` value should list **every screen/route in the
  demo flow except the entry screen** ("Screen 1" per the branch spec and ROADMAP's Phase 6
  acceptance criterion). Exact pathname list is Claude's discretion at planning time — the planner
  should inspect the actual test-harness routes to build the concrete exclusion list.

### sessionId / partnerId Generation
- **D-08:** `sessionId` is generated via `crypto.randomUUID()` once per page load, inside
  `index.js`'s `init()`/`initDemo()`, stored in module state, and reused by every log entry and the
  `discount_offer` `postMessage` payload for that page load. Native browser API, no new dependency,
  no PII (random, not derived from any user data).
- **D-09:** `partnerId` is sourced directly from the existing `config.platformId` field (already
  required by CFG-01's schema, already set to `"demo-platform"` in `demo-platform.json`) — no new
  config field needed.

### Claude's Discretion
- Exact module/file boundary for session-lifecycle wiring (D-01/D-02/D-03) — whether the
  `flow:complete`/`pagehide` subscriptions and the `sessionEnded` guard live in `log.js`, `index.js`,
  or a new small module. The spec's file structure names `response.js` and `log.js` explicitly but
  doesn't dictate which owns session-lifecycle wiring.
- Exact `demo-platform.json` `activeScreens` pathname list (D-07) — derive from the actual
  test-harness route structure during planning/research.
- Whether `config/schema.json`'s optional `responses` field (D-04) is added this phase as an unused
  placeholder or deferred entirely until a phase actually needs it — either is consistent with D-04's
  decision; the planner may choose based on schema-validation ergonomics.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 4 Design Contract
- `.planning/phases/04-response-overlay-logging/04-UI-SPEC.md` — locked visual/copy/positioning/
  animation/logging-shape contract; do not re-derive or contradict any `(locked)`-marked value.

### Response & Logging Layer Spec
- `branch spec files/repo2_heed_sdk.txt` — "Response layer (response.js)" and "Logging layer
  (log.js)" sections: overlay div structure, `clampToViewport()`, the 4 response types, the exact
  log entry shape and event vocabulary, and the `config` field list (`activeScreens`, `logLevel`,
  `weightPushUrl`, `responses.*`) this phase partially implements.
- `.planning/REQUIREMENTS.md` — RESP-01 through RESP-03, LOG-01 (this phase's requirement IDs).
- `.planning/PROJECT.md` — Key Decisions table and Requirements section for this phase's scope.

### Existing Code (Phases 1-3 output)
- `src/inference.js` — `endSession(config, outcome)` (D-03 in 03-CONTEXT.md) is the function this
  phase wires a real trigger to; read its doc comment on non-idempotency before implementing D-03's
  guard. Also publishes `inference:result` with `fires`, `intent`, `confidence`, and pass-through
  `bbox`/`targetSelector`/`scrollDepth`/`pathname` fields this phase's response/logging layers
  consume directly.
- `src/signal.js` — `checkFlowComplete()`/`flowCompleteFlag` (D-06 in Phase 2) is the exact function
  D-01 extends to publish `flow:complete`; read it before modifying.
- `src/bus.js` — `publish`/`subscribe`; the new `flow:complete` event follows the same
  `CustomEvent`/`{ detail }` wrapping convention already established.
- `config/schema.json`, `config/demo-platform.json` — current schema; this phase adds
  `activeScreens` (D-06/D-07) and possibly an unused `responses` placeholder (D-04) to the former,
  and a concrete `activeScreens` value (D-07) to the latter.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bus.js` `publish`/`subscribe` — the new `flow:complete` event and `log.js`'s subscriptions
  to `signal:detected`/`inference:result`/`flow:complete` all reuse this same bus.
- `src/inference.js` `endSession(config, outcome)` — already fully implemented and unit-tested;
  this phase only adds the calling code, never modifies `endSession` itself.
- `src/signal.js` `checkFlowComplete()` — the function D-01 extends with one new `publish()` call.

### Established Patterns
- Single choke-point + why-comment discipline (`bus.js`'s `publish()`, `signal.js`'s
  `buildPayload()`, `inference.js`'s payload construction in `initInference`) — `log.js`'s own log-
  entry-construction point should follow the same discipline: one function builds `{ ts, sessionId,
  partnerId, event, data }`, called from every event handler.
- Plain named-function exports only — no classes, no default exports (established Phase 1-3
  convention).
- Per-call state reset on `init()`/`initInference()` re-entry (`flowCompleteFlag`, `activeWeights`,
  `lastInference` all reset on repeat calls) — any new session-lifecycle module state (`sessionEnded`
  guard, `sessionId`) should follow the same reset-on-reinit discipline for consistency, even though
  the standalone test harness only calls `init()` once per page load in practice.

### Integration Points
- `src/index.js` `init()` — where `sessionId` generation (D-08) happens, and likely where the new
  session-lifecycle wiring (D-01/D-02/D-03) gets registered, alongside the existing
  `initSignalCapture(config)` and `initInference(config)` calls.
- `config/schema.json` — needs `activeScreens` added (D-06/D-07), and optionally `responses` (D-04,
  Claude's discretion on whether to add this phase).

</code_context>

<specifics>
## Specific Ideas

No specific UI/reference examples beyond the decisions captured above and everything already
locked in `04-UI-SPEC.md` — that document plus `branch spec files/repo2_heed_sdk.txt` are the
primary sources of truth for this phase's visual/copy/logging content.

</specifics>

<deferred>
## Deferred Ideas

- Fully config-driven `responses.*` copy/type mapping (per-partner customization) — deferred to a
  future phase/v2 per D-04; this phase hardcodes UI-SPEC's content and only optionally reserves the
  schema field.
- A separate `config.partnerId` field distinct from `platformId` — deferred per D-09; no current
  use case for the two to differ.

None of the discussion strayed outside Phase 4's scope (response rendering + logging + session-end
trigger wiring only; weight persistence/push remains Phase 5, live Branch 1 integration remains
Phase 6).

</deferred>

---

*Phase: 4-Response Overlay & Logging*
*Context gathered: 2026-07-18*
