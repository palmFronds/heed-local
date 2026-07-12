---
phase: 01-config-layer-bus-standalone-test-harness
plan: 03
subsystem: testing
tags: [event-bus, EventTarget, pub-sub, decoupling]

# Dependency graph
requires:
  - phase: 01-01
    provides: "RED tests/bus.test.js suite + decoupled test-emitter.js/test-subscriber.js fixtures"
provides:
  - "src/bus.js: private module-scoped EventTarget wrapper exposing publish(type, detail) and subscribe(type, handler)"
  - "Sole CustomEvent construction site in the codebase, always wrapping payload in { detail }"
affects: [02-signal-detection, 03-inference]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Private EventTarget bus (Pattern 2): module-scoped new EventTarget() never exported, only publish/subscribe wrappers"

key-files:
  created:
    - src/bus.js
  modified: []

key-decisions:
  - "Avoided the literal words 'document'/'window' even in code comments, since the acceptance criteria's grep check operates on the whole file text — reworded the explanatory comment to 'host-page global object' to keep the grep check meaningful (zero false positives) while preserving the same intent"

patterns-established:
  - "Pattern 2 (private EventTarget bus) now implemented exactly per 01-RESEARCH.md's canonical excerpt: publish() is the only CustomEvent construction site; subscribe() always returns an unsubscribe closure"

requirements-completed: [BUS-01]

coverage:
  - id: D1
    description: "publish/subscribe deliver a payload across two fixtures with zero direct import between them, and event.detail deep-equals the published payload"
    requirement: "BUS-01"
    verification:
      - kind: unit
        ref: "tests/bus.test.js — describe('BUS-01') both tests"
        status: pass
    human_judgment: false
  - id: D2
    description: "Bus is bound to a private EventTarget, never document/window — structurally prevents host-page eavesdropping on internal signal traffic"
    requirement: "BUS-01"
    verification:
      - kind: unit
        ref: "grep -n 'document\\|window' src/bus.js (no match) and grep -c 'new EventTarget()' src/bus.js (== 1)"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 03: Event Bus (BUS-01) Summary

**Private module-scoped EventTarget wrapper (src/bus.js) turning the Wave-0 RED bus suite GREEN — publish/subscribe decouples future signal.js from inference.js with no shared import and no document/window eavesdropping surface.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-11T22:43:04Z
- **Completed:** 2026-07-11T22:44:11Z
- **Tasks:** 1 completed
- **Files modified:** 1

## Accomplishments

- Implemented `src/bus.js` with a module-private `const target = new EventTarget()`, never exported
- `publish(type, detail)` dispatches `new CustomEvent(type, { detail })` — the sole CustomEvent construction site in the codebase, always correctly wrapping the payload to avoid the silent-`undefined`-detail pitfall
- `subscribe(type, handler)` wraps the handler as `(e) => handler(e.detail)`, registers it, and returns an unsubscribe closure that calls `removeEventListener`
- Confirmed `npx vitest run tests/bus.test.js` GREEN: both the "handler called once" and "payload deep-equal via detail" assertions pass, proving decoupled `test-emitter.js` → bus → `test-subscriber.js` delivery with zero direct import between the two fixtures
- Confirmed via grep that `src/bus.js` contains no `document`/`window` reference (including comments) and exactly one `new EventTarget()` instantiation

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement src/bus.js private-EventTarget pub/sub (turns BUS-01 GREEN)** - `b2bac58` (feat)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified

- `src/bus.js` - Private-EventTarget pub/sub bus: exports `publish(type, detail)` and `subscribe(type, handler)`; module-private `EventTarget` never bound to `document`/`window`

## Decisions Made

- Reworded the explanatory code comment to avoid the literal strings `document`/`window` (used "host-page global object" instead), since the plan's acceptance criteria specifies a grep check on the file's full text, not just executable code. Keeps the grep check meaningful as a structural guardrail rather than tripping on its own explanatory prose.

## Deviations from Plan

None — plan executed exactly as written. The only adjustment was the comment wording above, which is a documentation nuance (not a code-behavior change) made to keep the plan's own acceptance-criteria grep check accurate.

## Issues Encountered

None.

## Known Stubs

None. `src/bus.js` is a complete, working implementation — no placeholder logic, no empty defaults flowing anywhere.

## Threat Flags

None — this plan directly implements the threat mitigation already documented in the plan's own `<threat_model>` (T-01-02: private EventTarget preventing host-page eavesdropping). No new, undocumented security-relevant surface was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/bus.js` is complete and GREEN; `publish`/`subscribe` are ready for Phase 2's `signal.js` (publisher) and Phase 3's `inference.js` (subscriber) to consume with zero direct import between them.
- Full test suite (`npx vitest run`) shows only the expected `tests/harness.test.js` RED failure (missing `test-harness/index.html`, out of scope for this plan — covered by plans 01-04/01-05). `tests/config.test.js` and `tests/bus.test.js` are both GREEN.
- No blockers.

---
*Phase: 01-config-layer-bus-standalone-test-harness*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: src/bus.js
- FOUND: .planning/phases/01-config-layer-bus-standalone-test-harness/01-03-SUMMARY.md
- FOUND: commit b2bac58 (Task 1)
- FOUND: commit 067da2e (SUMMARY docs commit)
