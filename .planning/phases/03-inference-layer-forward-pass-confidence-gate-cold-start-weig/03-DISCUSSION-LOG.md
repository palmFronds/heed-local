# Phase 3: Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 3-Inference Layer — Forward Pass, Confidence Gate & Cold-Start Weights
**Areas discussed (--auto mode — all auto-selected, no interactive prompts):** Bus contract between inference and signal/response layers, Input vector construction, Session-end trigger mechanism, Cold-start weight generation approach

---

## Bus contract between inference and signal/response layers

| Option | Description | Selected |
|--------|-------------|----------|
| Always publish; gate only the `fires` flag | inference:result fires on every signal; fires:boolean gates rendering only | ✓ |
| Gate the publish itself on confidence | inference.js only publishes when confidence >= 0.65 | |

**Selected (auto):** Always publish; gate only the `fires` flag.
**Rationale:** LOG-01's required log sequence (`signal_detected → inference_run → response_fired`) implies `inference_run` logs unconditionally while `response_fired` is conditional — gating the publish itself would make below-threshold cases unloggable.

---

## Input vector construction

| Option | Description | Selected |
|--------|-------------|----------|
| One-hot per event type | Active signal's input node = 1, others = 0; no magnitude available | ✓ |
| Derive continuous magnitude from payload | Would require adding duration/count fields to signal.js's payloads | |

**Selected (auto):** One-hot per event type.
**Rationale:** Phase 2's payload shapes are locked and already shipped/verified (02-CONTEXT.md D-07); they carry no duration/count magnitude field. Reopening Phase 2 to add one would revisit closed, verified work. One-hot also matches the spec's single-event classification framing (no cross-event history in v1).

---

## Session-end trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Direct function call, unit-tested | e.g. endSession(config, outcome); no new harness UI this phase | ✓ |
| New harness "End Session" debug button | Would add UI scope ahead of Phase 4/5's actual session-lifecycle events | |

**Selected (auto):** Direct function call, unit-tested; no new harness UI this phase.
**Rationale:** Phase 4 owns flow_complete/flow_abandoned events; Phase 5 owns the push/persistence loop. Adding harness UI now would anticipate work those phases haven't built yet.

---

## Cold-start weight generation approach

| Option | Description | Selected |
|--------|-------------|----------|
| Train via brain.js against a synthetic dataset, export via toJSON() | Implements PROJECT.md's locked "brain.js = training/weight-export only" decision | ✓ |
| Hand-craft W1/b1/W2/b2 matrices directly | Simpler but makes brain.js vestigial in this project | |

**Selected (auto):** Train via brain.js, export via toJSON().
**Rationale:** Directly implements the already-locked PROJECT.md Key Decision. Exact hyperparameters (dataset size, iterations, noise) are NOT decided here — flagged to Claude's Discretion / research, per STATE.md's existing "no established recipe" blocker.

---

## Claude's Discretion

- Exact cold-start training hyperparameters (dataset size/diversity/noise, iteration count) — needs empirical validation via softmax-margin acceptance gate.
- Whether brain.js's `train({ iterations: 1, learningRate: 0.01 })` on one example produces one online gradient update vs. iterating to convergence — needs direct source/behavior verification.
- Exact module/function naming beyond what the spec's file structure already fixes.

## Deferred Ideas

None — discussion stayed within Phase 3's scope.
