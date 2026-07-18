# Phase 4: Response Overlay & Logging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 4-Response Overlay & Logging
**Areas discussed:** Session-end trigger wiring, Response copy/type source & concurrency, activeScreens gating scope, sessionId/partnerId generation

---

## Session-end trigger wiring

### Q: How should flow_complete be detected and wired to endSession()?

| Option | Description | Selected |
|--------|-------------|----------|
| New bus event from signal.js | Extend checkFlowComplete() to publish('flow:complete') on the flowCompleteFlag transition; log.js/index.js subscribes, logs flow_complete, calls endSession(config, true). | ✓ |
| Independent MutationObserver in Phase 4 | Duplicates signal.js's detection logic in a new observer. | |
| Polling via setInterval | Periodic visibility check of completionSelector. | |

**User's choice:** New bus event from signal.js (Recommended)

### Q: How should flow_abandoned be detected?

| Option | Description | Selected |
|--------|-------------|----------|
| pagehide listener | Fires reliably on mobile Safari/Chrome tab close/background/navigate-away, unlike beforeunload. If flowCompleteFlag is false at pagehide, log flow_abandoned and call endSession(config, false). | ✓ |
| back_intent as the abandonment signal | Simpler, but conflates a hesitation signal with actual session end. | |
| visibilitychange (hidden) as a proxy | Broader trigger surface but can fire multiple times per session. | |

**User's choice:** pagehide listener (Recommended)

### Q: Should there be an explicit once-per-session guard against endSession() firing twice?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — explicit sessionEnded flag | Module-level boolean flips true on the first of flow:complete/pagehide and short-circuits the other. | ✓ |
| No guard — rely on flow ordering | Assumes the two paths are mutually exclusive in practice. | |

**User's choice:** Yes — explicit sessionEnded flag (Recommended)

**Notes:** endSession() is documented as non-idempotent (03-CONTEXT.md) — a second call against already-updated weights produces a second, distinct delta — so an unguarded double-call would double-count the session's learning signal.

---

## Response copy/type: hardcoded vs config-driven

### Q: Which should this phase actually build — hardcoded UI-SPEC content or fully config-driven responses.*?

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded per UI-SPEC, config overrides later | response.js ships UI-SPEC's exact copy/type mapping as defaults; schema gets an optional `responses` field for future overrides, unused by demo-platform.json this phase. | ✓ |
| Fully config-driven now | demo-platform.json explicitly declares the responses.* mapping; response.js reads everything from config with no hardcoded fallback. | |

**User's choice:** Hardcoded per UI-SPEC, config overrides later (Recommended)

### Q: Can multiple response bubbles be visible at once, or does a new one replace/queue behind an existing one?

| Option | Description | Selected |
|--------|-------------|----------|
| One at a time, new replaces old | Existing bubble dismissed (new `dismissReason: "replaced"` needed), new one renders immediately. | ✓ |
| One at a time, new is dropped | Above-threshold result still logged (inference_run) but doesn't render until current bubble dismisses. | |
| Stack multiple bubbles | Each above-threshold result gets its own bubble. | |

**User's choice:** One at a time, new replaces old (Recommended)

**Notes:** Requires adding a 4th `dismissReason` value ("replaced") beyond UI-SPEC's existing `"manual" | "cta" | "timeout"` enum — flagged for the planner to also update 04-UI-SPEC.md if needed.

---

## activeScreens gating scope

### Q: Where should the activeScreens gate live?

| Option | Description | Selected |
|--------|-------------|----------|
| Gate at the logging layer only | inference.js unchanged (still publishes on every signal per D-01); log.js and response.js each check activeScreens independently before logging/rendering. | ✓ |
| Gate upstream in signal.js/index.js | Suppress signal capture entirely outside activeScreens. | |

**User's choice:** Gate at the logging layer only (Recommended)

### Q: What should demo-platform.json's activeScreens value contain?

| Option | Description | Selected |
|--------|-------------|----------|
| All screens except the entry screen | Matches the spec's manual test step 8 and Phase 6's acceptance criterion wording verbatim. | ✓ |
| Claude's discretion at planning time | Don't lock the exact pathname list now. | |

**User's choice:** All screens except the entry screen (Recommended)

**Notes:** Exact pathname list left as Claude's Discretion for the planner to derive from the actual test-harness routes.

---

## sessionId / partnerId generation

### Q: How should sessionId be generated?

| Option | Description | Selected |
|--------|-------------|----------|
| crypto.randomUUID() per page load | Generated once in init()/initDemo(), stored in module state, reused across every log entry and postMessage. | ✓ |
| Incrementing counter | Simple integer counter reset per page load. | |

**User's choice:** crypto.randomUUID() per page load (Recommended)

### Q: How should partnerId be sourced?

| Option | Description | Selected |
|--------|-------------|----------|
| config.platformId | Reuse the existing "demo-platform" platformId field directly. | ✓ |
| New dedicated config.partnerId field | Separate field in case platformId/partnerId ever need to differ. | |

**User's choice:** config.platformId (Recommended)

---

## Claude's Discretion

- Exact module/file boundary for session-lifecycle wiring (log.js vs index.js vs a new module).
- Exact demo-platform.json activeScreens pathname list — derive from actual test-harness routes.
- Whether config/schema.json's optional `responses` field is added this phase as an unused placeholder or deferred entirely.

## Deferred Ideas

- Fully config-driven `responses.*` copy/type mapping (per-partner customization) — deferred to v2.
- A separate `config.partnerId` field distinct from `platformId` — no current use case.
