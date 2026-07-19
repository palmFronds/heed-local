---
phase: 04-response-overlay-logging
plan: 03
subsystem: infra
tags: [logging, event-bus, session-lifecycle, vanilla-js]

# Dependency graph
requires:
  - phase: 04-response-overlay-logging (04-01, 04-02)
    provides: config.js activeScreens/partnerOrigin support, src/log.js stub exports, RED test suites (tests/log.test.js, tests/response.test.js)
provides:
  - Real src/log.js implementation — writeLog choke point, isActiveScreen live gate, initLogging session-lifecycle wiring
  - src/signal.js checkFlowComplete now publishes flow:complete once at the false->true transition
affects: [04-04 (response overlay — will publish response:fired/response:dismissed that log.js already subscribes to), 04-05/index.js wiring (initLogging call site), Phase 6 integration verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Session-lifecycle ownership co-located in log.js (not index.js) since log.js already subscribes to flow:complete to log it — avoids a second subscription (04-RESEARCH.md Pattern 3 / Assumption A1)"
    - "Single choke-point discipline: writeLog() is the sole console.log('[heed]', ...) call site; every event handler routes through it"
    - "Module-level mutable state (activeConfig/activeSessionId) re-resolved every init call, subscriptions registered once behind an 'initialized' guard (mirrors src/inference.js/src/signal.js precedent)"

key-files:
  created: []
  modified:
    - src/log.js
    - src/signal.js

key-decisions:
  - "inference_run log data is a curated subset (intent/confidence/fires only), not the full inference:result payload — matches 04-UI-SPEC.md's Logging Contract and the RED test's partial assertions"
  - "signal_detected/response:fired/response:dismissed pass their full bus payload through to writeLog's data field unchanged (payloads already match the exact logged shape)"

patterns-established:
  - "Session-lifecycle guard pattern: a single finishSession(outcome, event) internal function, guarded by module-level sessionEnded, callable from either of two competing async paths (bus event vs. window event) with correctness independent of ordering"

requirements-completed: [LOG-01]

coverage:
  - id: D1
    description: "writeLog(config, sessionId, event, data) is the sole console.log('[heed]', ...) choke point, gated on isActiveScreen(config), emitting the locked { ts, sessionId, partnerId, event, data } envelope"
    requirement: "LOG-01"
    verification:
      - kind: unit
        ref: "tests/log.test.js#LOG-01 (6 tests: signal_detected, inference_run, response_fired, response_dismissed, flow_complete, flow_abandoned)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isActiveScreen(config) live-reads window.location.pathname every call; permissive default when activeScreens absent/empty; gates writeLog"
    verification:
      - kind: unit
        ref: "tests/log.test.js#activeScreens (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "endSession fires exactly once per session via the sessionEnded guard, regardless of flow:complete/pagehide ordering"
    verification:
      - kind: unit
        ref: "tests/log.test.js#session-lifecycle (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "signal.js checkFlowComplete publishes flow:complete exactly once at the false->true transition; Phase 2 signal suites remain regression-free"
    verification:
      - kind: unit
        ref: "tests/log.test.js session-lifecycle tests (exercise the publish indirectly via signal.js not directly used, but flow:complete publish call verified by source assertion) + tests/signal.test.js + tests/signal-spa.test.js"
        status: pass
    human_judgment: false

duration: 12min
completed: 2026-07-19
status: complete
---

# Phase 04 Plan 03: Structured Logging + Session Lifecycle Summary

**Real src/log.js implementation (writeLog choke point, live activeScreens gate, 6-event session-lifecycle wiring) plus a one-line signal.js extension publishing flow:complete once, turning the RED log suite (15 tests) fully GREEN.**

## Performance

- **Duration:** 12 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- src/log.js now has a real `writeLog(config, sessionId, event, data)` — the sole `console.log('[heed]', ...)` call site in the codebase, gated on `isActiveScreen(config)`
- `isActiveScreen(config)` live-reads `window.location.pathname` on every call (never cached), permissive when `activeScreens` is absent/empty
- `initLogging(config, sessionId)` wires all 6 pipeline events (`signal:detected`, `inference:result`, `response:fired`, `response:dismissed`, `flow:complete`, `pagehide`) behind a one-time `initialized` registration guard, resetting `sessionEnded` on every call
- `finishSession(outcome, event)` + module-level `sessionEnded` guard make `endSession` fire exactly once per session regardless of whether `flow:complete` or `pagehide` arrives first
- `src/signal.js`'s `checkFlowComplete` now publishes `flow:complete` once, at the exact moment `flowCompleteFlag` transitions false→true
- tests/log.test.js: 15/15 GREEN (LOG-01, session-lifecycle, activeScreens describe blocks)

## Task Commits

1. **Task 1: Implement src/log.js — writeLog choke point, isActiveScreen gate, and all 6 event subscriptions** - `19f8346` (feat)
2. **Task 2: Extend signal.js checkFlowComplete to publish flow:complete once at the false→true transition** - `248f780` (feat)

**Plan metadata:** (pending final commit)

## Files Created/Modified
- `src/log.js` - Real implementation of `writeLog`, `isActiveScreen`, `initLogging`, and internal `finishSession` — structured logging choke point + session-lifecycle owner
- `src/signal.js` - `checkFlowComplete` now publishes `publish('flow:complete', {})` inside the existing `flowCompleteFlag`-set branch

## Decisions Made
- `inference_run` log entries carry a curated `{ intent, confidence, fires }` subset of the `inference:result` bus payload rather than the full payload (matches 04-UI-SPEC.md's Logging Contract; the raw payload also carries `probs`/`bbox`/`targetSelector`/`scrollDepth`/`pathname`/`timestamp`/`signalType` which are not part of the locked log shape)
- `signal_detected`, `response:fired`, and `response:dismissed` pass their full bus payload straight through as `data` — their bus payload shapes already exactly match what UI-SPEC's Logging Contract requires, so no field curation was needed there

## Deviations from Plan

None — plan executed exactly as written. The `04-RESEARCH.md` Pattern 3 skeleton (`initLogging`/`finishSession`/`isActiveScreen`/`writeLog`) was used near-verbatim, extended only with the `activeConfig`/`activeSessionId`/`initialized` one-time-registration guard the plan's Task 1 `<action>` explicitly required (mirroring `src/inference.js`'s `initInference` pattern), which the RESEARCH.md skeleton comment itself acknowledged was abbreviated ("... additional subscriptions ...").

## Issues Encountered

None. `tests/response.test.js` (12 failing tests) remains RED as expected — that suite exercises `src/response.js`, which is explicitly out of scope for this plan (plan 04-04's job) and was not modified.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `log.js`'s `response:fired`/`response:dismissed` subscriptions are wired and unit-tested via synthetic bus dispatch; plan 04-04 (`src/response.js`) will be the real producer of those two events — no further changes to `log.js` should be needed when 04-04 lands
- `initLogging(config, sessionId)` is ready to be wired from `src/index.js`'s `init()` alongside `initResponse` and a generated `sessionId` (D-08) — that wiring is plan 04-05's job per 04-PATTERNS.md
- Phase 2 signal suites (`tests/signal.test.js`, `tests/signal-spa.test.js`) remain regression-free after the `checkFlowComplete` extension
- No blockers for 04-04.

---
*Phase: 04-response-overlay-logging*
*Completed: 2026-07-19*

## Self-Check: PASSED
- FOUND: src/log.js
- FOUND: .planning/phases/04-response-overlay-logging/04-03-SUMMARY.md
- FOUND commit: 19f8346 (Task 1)
- FOUND commit: 248f780 (Task 2)
- FOUND commit: efa2792 (SUMMARY docs commit)
