# Phase 3: Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights - Context

**Gathered:** 2026-07-16 (via `--auto` discuss-phase — single pass, recommended options auto-selected, logged below for audit)
**Status:** Ready for planning

<domain>
## Phase Boundary

Incoming signals (from `signal.js`'s bus events) are classified into one of 4 intent classes
(confusion, price_doubt, trust_gap, flow_friction) through a genuine, explicitly hand-written
forward pass — not a black-box `.run()` call — gated by a 0.65 confidence threshold, and improved
through a real, bounded session-end learning update (learning rate 0.01, fires once per session).
This is the conceptual core of the branch per PROJECT.md's explicit direction and gets this
roadmap's deepest planning/verification treatment. This phase does NOT build response rendering
(Phase 4), does NOT build the weight-push receiver/persistence loop (Phase 5), and does NOT wire a
real session-end trigger from a live user flow (no `flow_complete`/`flow_abandoned` events exist
yet — those are Phase 4's logging-layer requirements).

</domain>

<decisions>
## Implementation Decisions

*(Auto-selected under `--auto` — single pass, no interactive prompts. Each decision below is the
recommended default with its rationale logged inline, per `modes/auto.md`'s audit-trail
requirement.)*

### Bus Contract Between Inference and Signal/Response Layers
- **D-01:** `inference.js` subscribes to `signal:detected` and, for every incoming signal
  (regardless of confidence), publishes exactly one `inference:result` bus event containing the
  full softmax vector, the predicted class, the confidence value, and a boolean `fires` flag gated
  by the 0.65 threshold. The publish itself is **never** gated on confidence — only downstream
  *rendering* (Phase 4's concern) is gated on `fires`. **Rationale:** LOG-01 requires an
  `inference_run` log entry for every signal regardless of whether a response ultimately fires
  (`signal_detected → inference_run → response_fired` is the required sequence, and
  `response_fired` is explicitly conditional in the spec while `inference_run` is not) — gating the
  publish itself on confidence would make it impossible for Phase 4's logger to log `inference_run`
  for below-threshold cases.
  `[auto] Bus contract — Q: "Does inference.js publish on every signal or only above-threshold ones?" → Selected: "Always publish; gate only the fires flag" (recommended default, derived directly from LOG-01's required event sequence)`

### Input Vector Construction (determined by Phase 2's already-locked payload shapes)
- **D-02:** Because `signal.js`'s payloads (locked in Phase 2, `02-CONTEXT.md` D-07) carry only
  `{ type, targetSelector, bbox, timestamp }` (touch/blur), `{ type, scrollDepth, timestamp }`
  (scroll), or `{ type, pathname, timestamp }` (back) — with no continuous "duration held" or
  "reversal count" magnitude field — each incoming signal event is classified as an effectively
  **one-hot** input vector: the input node corresponding to the event's `type` is set to `1`, the
  other 3 nodes are `0`. There is no per-event graded magnitude to normalize; normalization applies
  only in the sense that the vector is already in `[0, 1]`. **Rationale:** Phase 2's payload
  contract is locked and already shipped/tested — reopening it to add a magnitude field would
  require revisiting a closed, verified phase. A one-hot encoding is also consistent with the
  spec's own framing of classifying "each signal event" independently, one event at a time, with no
  cross-event history in v1 (multi-signal correlation is explicitly INF-V2-01, deferred to v2).
  `[auto] Input vector — Q: "How does inference.js get graded/continuous magnitude values (normalizedTouchHesitation, normalizedReversalCount) when signal.js's locked payloads don't carry duration/count fields?" → Selected: "One-hot per event type; no magnitude available or needed for v1" (recommended default — matches the locked Phase 2 contract and the spec's single-event framing)`

### Session-End Trigger (Phase 3's own scope, ahead of Phase 4/5)
- **D-03:** Phase 3 exposes a directly-callable, unit-testable function (e.g. `endSession(config,
  outcome)`) that computes exactly one bounded weight update and refreshes the in-memory weight
  arrays the forward pass reads — it does **not** add any new test-harness UI control, and does
  **not** persist anything to disk or push anywhere (Phase 5's job). Testing this in Phase 3 means
  calling the exported function directly from a unit test with a synthetic `outcome` boolean, not
  driving it through a live session flow (no `flow_complete`/`flow_abandoned` events exist until
  Phase 4). **Rationale:** keeps Phase 3 scoped to "inference + one bounded weight update" per its
  own success criteria; avoids scope creep into Phase 4's logging-event work and Phase 5's
  persistence/push work.
  `[auto] Session-end trigger — Q: "Does Phase 3 need a new harness UI control ('End Session' button) to test the weight update, or is a direct function call sufficient?" → Selected: "Direct function call, unit-tested; no new harness UI this phase" (recommended default — matches this roadmap's phase-boundary design, where Phase 4 owns flow completion events and Phase 5 owns the push/persistence loop)`

### Cold-Start Weight Generation Approach
- **D-04:** Cold-start weights are produced by calling brain.js's `NeuralNetwork.train()` (a
  dev-side/build-time step — never shipped to the browser, per PROJECT.md's locked "brain.js is
  training/weight-export only" decision) against a small hand-authored synthetic dataset encoding
  the 4 canonical one-hot mappings (touch_hesitation→confusion, blur_incomplete→flow_friction,
  scroll_reversal→price_doubt, back_intent→trust_gap), then exporting the resulting weights via
  `toJSON()` into `admin/weights.js` as plain `{ W1, b1, W2, b2 }` arrays that `inference.js`'s
  hand-written forward pass reads directly. **This does not decide the exact training
  hyperparameters** (dataset size/diversity, iteration count, noise) — per STATE.md's existing
  research flag, there is no established recipe for weight *magnitude* tuning (only direction is
  obviously correct from the mapping), and this needs empirical validation during
  research/planning, with softmax-margin verification (Success Criterion 2: a real margin, not a
  saturated ~1.0 or uniform ~0.25 distribution) as the acceptance gate.
  `[auto] Cold-start weights — Q: "Hand-craft W1/b1/W2/b2 matrices by hand, or train them via brain.js against a synthetic dataset?" → Selected: "Train via brain.js against a small synthetic dataset, export via toJSON()" (recommended default — directly implements PROJECT.md's already-locked "brain.js used for training/weight-export only" decision; hand-crafting matrices by hand would make brain.js's role in this project vestigial)`

### Claude's Discretion (flagged for research, not decided here)
- Exact training hyperparameters for cold-start weights (dataset size/diversity/noise, iteration
  count) — needs empirical validation via the softmax-margin acceptance gate (STATE.md research
  flag, carried forward unchanged).
- Whether brain.js's `train()` called with `{ iterations: 1, learningRate: 0.01 }` against a single
  labeled example actually produces one online gradient update, or iterates internally to
  convergence on that one example — needs direct verification against brain.js's source/behavior
  (STATE.md research flag, carried forward unchanged). This directly affects how `endSession`
  invokes `train()`.
- Exact module/function naming beyond what's fixed by the spec's file structure
  (`inference.js`, `admin/weights.js`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Inference Layer Spec
- `branch spec files/repo2_heed_sdk.txt` — "Inference layer (inference.js)" section: architecture
  (4→4→4, ReLU, softmax), forward pass formula, weight update semantics (once per session, learning
  rate 0.01), cold-start weight rationale ("why a net and not a lookup table").
- `.planning/REQUIREMENTS.md` — INF-01 through INF-05 (this phase's requirement IDs), and the
  locked SIG-01 through SIG-06 payload shapes (Phase 2, already shipped) that D-02 above derives
  the one-hot input-vector rule from.
- `.planning/PROJECT.md` — Key Decisions table: "brain.js used for training/weight-export only;
  forward pass in `sdk.js` is hand-written" — the architectural decision D-04 directly implements.
- `.planning/STATE.md` — "Blockers/Concerns" section: the two open Phase-3 research flags (weight
  magnitude tuning recipe; brain.js `train()` single-example semantics) carried forward verbatim
  into this phase's Claude's Discretion list above.

### Existing Code (Phases 1-2 output)
- `src/bus.js` — `publish`/`subscribe` — `inference.js` imports both (unlike `signal.js`, which is
  producer-only).
- `src/signal.js` — the exact payload shapes `inference.js` will receive via `signal:detected`
  (see D-02's derivation).
- `.planning/phases/02-signal-capture-layer/02-RESEARCH.md` — bus/event patterns and the
  PII-firewall (`buildPayload` choke-point) precedent `inference.js` should mirror for its own
  `inference:result` payload construction.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bus.js` `publish`/`subscribe` — `inference.js` subscribes to `signal:detected` and publishes
  `inference:result`.
- `src/index.js` `init()` — likely wiring point for `inference.js`'s subscription setup, mirroring
  how `initSignalCapture(config)` was wired in Phase 2.

### Established Patterns
- Single choke-point + why-comment discipline (`bus.js`'s `publish()`, `signal.js`'s
  `buildPayload()`) — `inference.js`'s own payload-construction point for `inference:result` should
  follow the same discipline.
- Plain named-function exports only — no classes, no default exports (Phase 1/2 convention,
  confirmed via Phase 2's pattern-mapper).
- `brain.js` is **not yet a dependency** — `package.json`'s `devDependencies` currently list only
  `@playwright/test`, `esbuild`, `happy-dom`, `vitest`. Adding `brain.js@2.0.0-beta.24` (pinned
  exact version per `.claude/CLAUDE.md`'s stack guidance) is an implicit Wave-0 prerequisite for
  this phase.

### Integration Points
- `src/index.js` `init()` — where `inference.js`'s bus subscription gets wired in, alongside the
  existing `initSignalCapture(config)` call.
- `admin/weights.js` — new module (per spec's file structure) holding cold-start weight arrays,
  read by `inference.js` at cold-start.

</code_context>

<specifics>
## Specific Ideas

No specific UI/reference examples beyond the decisions captured above — the spec's own wording
(`branch spec files/repo2_heed_sdk.txt`) and the already-locked PROJECT.md/REQUIREMENTS.md
decisions are the primary sources of truth for this phase's architecture.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 3's scope (inference/forward-pass/confidence-gate/cold-start
weights and the session-end update mechanism only; no response-rendering, logging, or
weight-push-persistence decisions were made here — those remain Phase 4/5's territory).

</deferred>

---

*Phase: 3-Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights*
*Context gathered: 2026-07-16 (--auto mode)*
