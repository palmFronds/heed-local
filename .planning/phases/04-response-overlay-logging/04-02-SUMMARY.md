---
phase: 04-response-overlay-logging
plan: 02
subsystem: response-overlay-logging
tags: [tdd, vitest, happy-dom, red-suite, vanilla-js, pub-sub]

# Dependency graph
requires:
  - phase: 04-response-overlay-logging
    provides: "plan 04-01's config/schema.json activeScreens+partnerOrigin fields and config.js array-type validation fix"
provides:
  - "src/response.js stub exporting initResponse(config, sessionId), clampToViewport(bbox, bubbleWidth, bubbleHeight), safeAreaInset(side)"
  - "src/log.js stub exporting initLogging(config, sessionId), isActiveScreen(config), writeLog(config, sessionId, event, data)"
  - "tests/response.test.js RED suite (RESP-01, RESP-02, RESP-03, D-05, auto-dismiss timers)"
  - "tests/log.test.js RED suite (LOG-01, session-lifecycle D-01/02/03, activeScreens D-06/07)"
affects: [response.js implementation plan, log.js implementation plan, index.js wiring plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One-time-registration guard + per-call state reset (mirrors initInference/initSignalCapture) is the locked contract initResponse/initLogging must implement"
    - "vi.hoisted + vi.mock partial-module mock used to spy on src/inference.js's endSession export from within tests/log.test.js without disturbing its other exports"
    - "clampToViewport tested as a pure function with explicit bbox/null args (never a real DOM element's getBoundingClientRect) per happy-dom Pitfall 5"

key-files:
  created:
    - src/response.js
    - src/log.js
    - tests/response.test.js
    - tests/log.test.js
  modified: []

key-decisions:
  - "Overlay container marker is [data-heed-overlay] and rendered response elements are marked [data-heed-response] -- internal markers only, NOT among the 7 locked data-heed selectors in CONTRACT.md"
  - "RESP-03 test payloads mirror the real signal->intent->response-type chain: price_doubt/discount_offer and trust_gap/social_proof are tested via scroll_reversal/back_intent-shaped payloads with bbox:null (Pitfall 2), not a generic touch payload"
  - "D-05's 'replaced' dismissReason value is exercised directly in the RED suite (a 4th enum value beyond UI-SPEC's existing manual/cta/timeout, per 04-RESEARCH.md D-05)"
  - "auto-dismiss-timer tests (vi.useFakeTimers) were authored in tests/response.test.js only, isolated from any MutationObserver-touching file, per 04-RESEARCH.md Pitfall 4"
  - "log.test.js mocks endSession via vi.hoisted+vi.mock rather than asserting on inference.js's internal weight state, since the plan text explicitly recommends spy/mock and this keeps the session-lifecycle assertions independent of Phase 3's forward-pass numerics"

patterns-established:
  - "RED suites for a not-yet-implemented pub/sub module publish synthetic bus events directly (signal:detected, inference:result, flow:complete, response:fired, response:dismissed) rather than depending on sibling stub modules' real behavior -- keeps each new test file's RED state independently diagnosable"

requirements-completed: []

coverage:
  - id: D1
    description: "src/response.js and src/log.js stub modules export all symbol names index.js wiring and the RED suites import, with no module-resolution error"
    requirement: "RESP-01/RESP-02/RESP-03/LOG-01 (contract surface only -- behavior not yet implemented)"
    verification:
      - kind: unit
        ref: "node -e import('./src/response.js') / import('./src/log.js') symbol check (Task 1 verify command)"
        status: pass
      - kind: unit
        ref: "npx vitest run tests/response.test.js tests/log.test.js (both files load and RUN)"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/response.test.js encodes RESP-01 (overlay container pointer-events split + host DOM untouched), RESP-02 (clampToViewport bbox-present + bbox-null fallback paths), RESP-03 (4 response types' copy + discount_offer postMessage shape/origin), and D-05 (single-bubble replace semantics) as failing (RED) assertions against the stub"
    requirement: "RESP-01, RESP-02, RESP-03, D-05"
    verification:
      - kind: unit
        ref: "npx vitest run tests/response.test.js -t \"RESP-01\" / -t \"RESP-02\" / -t \"RESP-03\" / -t \"D-05\" (each selects its cases, all fail on assertions)"
        status: red
    human_judgment: false
  - id: D3
    description: "tests/log.test.js encodes LOG-01 (all 6 event types' exact {ts,sessionId,partnerId,event,data} shape), session-lifecycle (endSession called exactly once across flow:complete+pagehide in both orderings, D-01/02/03), and activeScreens (permissive-default + history.pushState-driven gate, D-06/07) as failing (RED) assertions against the stub"
    requirement: "LOG-01, session-lifecycle (D-01/D-02/D-03), activeScreens (D-06/D-07)"
    verification:
      - kind: unit
        ref: "npx vitest run tests/log.test.js -t \"LOG-01\" / -t \"session-lifecycle\" / -t \"activeScreens\" (each selects its cases; 4 of 15 cases coincidentally pass against the always-true isActiveScreen stub, the rest fail on assertions)"
        status: red
    human_judgment: false

duration: 15min
completed: 2026-07-18
status: complete
---

# Phase 4 Plan 2: Response Overlay & Logging RED Suite + Stub Modules Summary

**Authored the RED unit-test suites (`tests/response.test.js`, `tests/log.test.js`) and minimal stub modules (`src/response.js`, `src/log.js`) that lock the observable behavior contract for RESP-01/02/03, D-05, LOG-01, and the session-lifecycle/activeScreens decisions ahead of Wave-1/2 implementation.**

## Performance

- **Duration:** ~15 min (Task 1 pre-completed and committed as `4fb24f7` before this session resumed; Tasks 2-3 executed this session)
- **Started:** 2026-07-18T23:05:23-04:00 (Task 1 commit) / resumed at Task 2 ~23:16
- **Completed:** 2026-07-18T23:18:33-04:00
- **Tasks:** 3 completed (1 pre-existing, 2 this session)
- **Files created:** 4 (2 stub source modules, 2 test files)

## Accomplishments
- `src/response.js` stub exports `initResponse(config, sessionId)`, `clampToViewport(bbox, bubbleWidth, bubbleHeight)`, `safeAreaInset(side)` — all plain named-function exports, no classes, no default export, with a No-PII firewall header comment mirroring `signal.js`'s `buildPayload()` discipline.
- `src/log.js` stub exports `initLogging(config, sessionId)`, `isActiveScreen(config)`, `writeLog(config, sessionId, event, data)` — same conventions, same firewall header.
- `tests/response.test.js` (254 lines, 12 test cases across 5 describe blocks): `RESP-01` (overlay container `pointer-events:none` + rendered element `pointer-events:auto` + host DOM untouched), `RESP-02` (4 cases: bbox-present below-anchor placement, bbox-present flip-above placement, bbox-null bottom-clamp fallback, bbox-null last-resort top clamp for an oversized bubble), `RESP-03` (4 cases: one per intent class's exact UI-SPEC copy string, with `discount_offer`'s case additionally asserting the exact `postMessage` payload shape and a non-wildcard `targetOrigin` equal to `config.partnerOrigin`), `D-05` (single-bubble replace semantics: old bubble dismissed with `dismissReason:"replaced"` before the new one renders), and 2 auto-dismiss-timer cases (`vi.useFakeTimers`, isolated in this file per Pitfall 4: `tooltip` auto-dismisses at 6000ms, `discount_offer` does not).
- `tests/log.test.js` (288 lines, 15 test cases across 3 describe blocks): `LOG-01` (6 cases, one per pipeline event type, each asserting the exact `{ts,sessionId,partnerId,event,data}` envelope and per-event data shape), `session-lifecycle` (3 cases: `endSession` called exactly once with the correct outcome boolean in both `flow:complete`-first and `pagehide`-first orderings, plus a case asserting exactly one of `flow_complete`/`flow_abandoned` is ever logged), `activeScreens` (6 cases: permissive on absent/empty list, correct allow/block on a populated list via `history.pushState`, and `writeLog`-level gating verified through a full `inference:result` publish in both blocked and open states).
- Both test files load and run cleanly against the stubs (verified via direct `npx vitest run` invocation) — all 12 `response.test.js` cases fail on assertions (true RED); 11 of 15 `log.test.js` cases fail on assertions, with 3 `isActiveScreen`-permissive-default cases and the "returns true when inside activeScreens" case coincidentally passing against the stub's unconditional `return true` (expected and harmless — they still exercise the real contract and will continue passing once the real gate is implemented).
- Full existing Vitest suite (8 pre-existing files, 52 tests) continues to pass with zero regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create stub modules src/response.js and src/log.js** — `4fb24f7` (feat) — completed and committed prior to this session
2. **Task 2: Author tests/response.test.js RED suite** — `6847160` (test)
3. **Task 3: Author tests/log.test.js RED suite** — `baa9062` (test)

**Plan metadata:** (this commit, following SUMMARY.md write)

## Files Created/Modified
- `src/response.js` — stub exporting `initResponse`, `clampToViewport`, `safeAreaInset` (no-op/placeholder bodies)
- `src/log.js` — stub exporting `initLogging`, `isActiveScreen` (returns `true`), `writeLog` (no-op)
- `tests/response.test.js` — new RED suite, RESP-01/02/03 + D-05 + auto-dismiss timers
- `tests/log.test.js` — new RED suite, LOG-01 + session-lifecycle + activeScreens

## Decisions Made
- Overlay/response DOM markers chosen as `[data-heed-overlay]` (container) and `[data-heed-response]` (rendered bubble) — internal implementation markers, explicitly distinct from and never confused with the 7 CONTRACT.md-locked `data-heed` selectors.
- RESP-03's `discount_offer`/`social_proof` test cases deliberately construct their synthetic `inference:result` payloads with `bbox: null` and the originating signal type (`scroll_reversal`/`back_intent`) that the real pipeline would produce — encoding 04-RESEARCH.md Pitfall 2's chain (these two response types NEVER receive a bbox) directly into the RED suite rather than testing only the generic happy path.
- `log.test.js` verifies the D-03 `sessionEnded` guard by mocking `src/inference.js`'s `endSession` export via `vi.hoisted` + `vi.mock` (Vitest's documented partial-module-mock pattern), rather than asserting on `inference.js`'s internal weight/forward-pass state — this keeps the session-lifecycle assertions decoupled from Phase 3's numeric internals and directly satisfies the plan's "assert endSession call count (spy/mock endSession)" instruction.
- Kept all `vi.useFakeTimers()` usage confined to `tests/response.test.js`'s dedicated `auto-dismiss timers` describe block, never combined with any MutationObserver-touching test file, per 04-RESEARCH.md Pitfall 4 (`happy-dom#2097`).

## Deviations from Plan

None — plan executed exactly as written. Task 1's stub modules (read from disk, not re-authored) already matched the plan's specified export names, firewall-comment requirement, and no-op bodies exactly, so Tasks 2-3 were authored directly against them with no adjustment needed.

## Issues Encountered

None. Both RED suites loaded and ran on the first attempt with no import-resolution failures; `vi.hoisted`/`vi.mock`'s partial-mock pattern for `endSession` worked as expected without needing troubleshooting.

## Known Stubs

- `src/response.js` and `src/log.js` remain intentional Wave-0 stubs (no-op bodies) — this is the expected and documented state for this plan. Real behavior is filled in by the Wave-1/2 implementation plan(s) that follow.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- The stub API surface (`initResponse`, `clampToViewport`, `safeAreaInset`, `initLogging`, `isActiveScreen`, `writeLog`) is now locked and test-verified; the next implementation plan(s) can fill in real bodies against this exact signature set with no further contract negotiation.
- Both RED suites are runnable via `npx vitest run tests/response.test.js tests/log.test.js` and via each requirement's own `-t` filter, giving the implementation plan(s) a precise, requirement-scoped green/red signal to drive against (RESP-01/02/03, D-05, LOG-01, session-lifecycle, activeScreens).
- `src/index.js` wiring (generating `sessionId`, calling `initLogging`/`initResponse`) and `src/signal.js`'s `checkFlowComplete` extension (adding the `flow:complete` publish) remain for a later plan in this phase — this plan intentionally scoped to stub authorship + RED test authorship only, per its Wave-0 role.

---
*Phase: 04-response-overlay-logging*
*Completed: 2026-07-18*

## Self-Check: PASSED
