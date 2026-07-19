---
phase: 04-response-overlay-logging
plan: 04
subsystem: ui
tags: [vanilla-js, dom-overlay, postmessage, clamping, pub-sub]

requires:
  - phase: 04-response-overlay-logging (plan 01-03)
    provides: bus.js flow:complete publish, log.js's writeLog/isActiveScreen shared gate, config schema activeScreens/partnerOrigin fields
provides:
  - "src/response.js real implementation: overlay injection, clampToViewport/safeAreaInset, 4 response type renderers, discount_offer postMessage, single-bubble-at-a-time concurrency with the replaced dismissReason"
  - "response:fired / response:dismissed bus events, consumed by log.js for response_fired/response_dismissed log entries"
  - "04-UI-SPEC.md dismissReason enum extended to 4 values (D-05)"
affects: [phase-4-plan-05 (index.js wiring), phase-4-plan-06 (e2e harness assertions), phase-6-integration-verification]

tech-stack:
  added: []
  patterns:
    - "One-time-registration guard + reset-on-reinit module state (mirrors initInference/initSignalCapture): initResponse resets activeConfig/activeSessionId/current bubble every call but registers the inference:result subscription and the overlay container exactly once"
    - "Single dismiss choke point (dismissCurrent(dismissReason)) — every dismissal path (manual x tap, CTA tap, 6000ms timeout, D-05 replacement) routes through one function that removes the DOM node, clears the timer, and publishes response:dismissed"
    - "All presentation set via inline element.style.cssText, never a <style> tag + class selectors, per UI-SPEC's host-CSS-cascade-isolation styling mechanism"
    - "Entrance animation driven by a Promise microtask (not setTimeout) specifically to avoid interacting with vi.useFakeTimers() in the auto-dismiss-timer tests"

key-files:
  created: []
  modified:
    - src/response.js
    - .planning/phases/04-response-overlay-logging/04-UI-SPEC.md

key-decisions:
  - "Reset-on-reinit removes any bubble left over from a prior initResponse() call directly (DOM removal + timer clear) WITHOUT publishing response:dismissed — this is treated as fresh-session initialization, not a user-triggered dismissal, and keeps repeat initResponse() calls (as exercised across the test file) from leaking stale bubbles into later assertions"
  - "bubbleWidth/bubbleHeight fed into clampToViewport() at render time are fixed estimates (358px cap, 80px/112px height) rather than measured via getBoundingClientRect(), since happy-dom returns zeroed rects (04-RESEARCH.md Pitfall 5) and no spec value was locked for real measured size"

requirements-completed: [RESP-01, RESP-02, RESP-03]

coverage:
  - id: D1
    description: "Single pointer-events:none overlay container injected once at init; every rendered response element carries inline pointer-events:auto; host DOM outside the overlay untouched"
    requirement: "RESP-01"
    verification:
      - kind: unit
        ref: "tests/response.test.js#RESP-01 injects a single pointer-events:none fixed overlay container..."
        status: pass
    human_judgment: false
  - id: D2
    description: "clampToViewport() anchors below/above a real bbox (flipping when the below placement overflows the safe-bottom bound) and falls back to a bottom-clamp placement for a null bbox, including the never-off-screen last-resort clamp"
    requirement: "RESP-02"
    verification:
      - kind: unit
        ref: "tests/response.test.js#RESP-02 (4 tests: bbox-present below, bbox-present flip-above, bbox-null fallback, bbox-null last-resort clamp)"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 4 response types (tooltip/discount_offer/social_proof/nudge_copy) render their exact UI-SPEC copy for their mapped intent class; discount_offer fires postMessage with the locked payload shape and an explicit non-wildcard partnerOrigin target, with no fulfillment logic"
    requirement: "RESP-03"
    verification:
      - kind: unit
        ref: "tests/response.test.js#RESP-03 (4 tests: tooltip, nudge_copy, social_proof, discount_offer+postMessage)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A second above-threshold inference:result while a bubble is showing dismisses the old bubble (dismissReason 'replaced') before rendering the new one — only one bubble ever visible"
    verification:
      - kind: unit
        ref: "tests/response.test.js#D-05 dismisses the currently-showing bubble with dismissReason \"replaced\"..."
        status: pass
    human_judgment: false
  - id: D5
    description: "Auto-dismiss timers: tooltip/nudge_copy/social_proof auto-dismiss after 6000ms (dismissReason timeout); discount_offer persists (no auto-dismiss)"
    verification:
      - kind: unit
        ref: "tests/response.test.js#auto-dismiss timers (UI-SPEC Animation contract) (2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "04-UI-SPEC.md's response_dismissed dismissReason enum documents the 4th value (replaced) with a note tracing it to CONTEXT.md D-05"
    verification:
      - kind: other
        ref: "grep -c \"replaced\" .planning/phases/04-response-overlay-logging/04-UI-SPEC.md (returns 2)"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-19
status: complete
---

# Phase 4 Plan 4: Response Overlay Implementation Summary

**Real `src/response.js` implementation: single fixed overlay container, safe-area-aware clampToViewport with a first-class null-bbox fallback, all 4 response types with exact UI-SPEC copy, discount_offer's explicit-origin postMessage, and single-bubble-at-a-time concurrency with the new "replaced" dismissReason — the RED response suite is now fully GREEN (12/12).**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `initResponse(config, sessionId)` injects one `[data-heed-overlay]` container (inline `pointer-events: none`) guarded by a one-time-registration boolean, subscribes to `inference:result`, and renders only when `payload.fires === true && isActiveScreen(config)` (D-06), importing `isActiveScreen` from `log.js` rather than duplicating the pathname gate (A5)
- `clampToViewport(bbox, bubbleWidth, bubbleHeight)` and `safeAreaInset(side)` implement 04-RESEARCH.md Pattern 2 verbatim: bbox-present anchored placement (below-anchor default, flips above when it would overflow the safe-bottom bound) and the bbox-null bottom-clamp fallback — the fallback is the ONLY path `discount_offer`/`social_proof` will ever take in production, and is tested with equal rigor to the anchored path, including the never-off-screen last-resort clamp
- All 4 intent classes render their exact UI-SPEC copy: `confusion`→tooltip, `price_doubt`→discount_offer, `trust_gap`→social_proof, `flow_friction`→nudge_copy; every bubble carries a 44×44px `aria-label="Dismiss"` control
- `discount_offer` fires `window.parent.postMessage({ type: 'heed:discount_offer', sessionId, partnerId, intent, timestamp }, config.partnerOrigin)` on render (never on CTA tap) with an explicit, never-wildcard target origin, and contains zero discount-fulfillment logic
- One `dismissCurrent(dismissReason)` choke point handles every dismissal path — manual `×` tap, CTA tap, the 6000ms auto-timeout (all types except `discount_offer`, which persists), and D-05's "replaced" path — publishing exactly one `response:dismissed` per dismissal
- D-05: a new above-threshold `inference:result` while a bubble is showing calls `dismissCurrent('replaced')` (removing the old bubble and publishing `response:dismissed` BEFORE the new bubble renders) so exactly one bubble is ever visible in the container
- `04-UI-SPEC.md`'s `response_dismissed` `dismissReason` enum extended from 3 to 4 values (`"manual" | "cta" | "timeout" | "replaced"`), with a note tracing the addition to `04-CONTEXT.md` D-05

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement src/response.js — overlay, clampToViewport, 4 response types, postMessage, single-bubble concurrency** - `139f92e` (feat)
2. **Task 2: Add the 4th dismissReason value to 04-UI-SPEC.md's enum (D-05)** - `b354b1e` (docs)

**Plan metadata:** (this commit) `docs(04-04): complete response overlay implementation plan`

## Files Created/Modified

- `src/response.js` - Real implementation replacing the Wave-0 stub: overlay container injection, `clampToViewport`/`safeAreaInset`, 4 response-type renderers, `dismissCurrent` choke point, `discount_offer` postMessage, D-05 single-bubble concurrency
- `.planning/phases/04-response-overlay-logging/04-UI-SPEC.md` - `response_dismissed` `dismissReason` enum extended to 4 values + D-05 traceability note

## Decisions Made

- **Reset-on-reinit removes leftover bubbles silently.** `initResponse()`'s reset-on-reinit step (mirroring `initInference`'s `lastInference = null` convention) directly removes any bubble left over from a prior `initResponse()` call — clearing its timer and DOM node — WITHOUT publishing `response:dismissed`. This is treated as fresh-session initialization, not a user-triggered dismissal, and is what keeps the test file's repeated `initResponse()` calls (once per RESP-03 test) from leaking a stale bubble from a previous test into the next test's `querySelector` assertion.
- **Fixed-estimate bubble dimensions for `clampToViewport()`'s render-time call.** `renderBubble()` feeds `clampToViewport()` a capped-at-358px width and an 80px/112px height estimate (rather than a real `getBoundingClientRect()` measurement), since happy-dom returns zeroed rects (04-RESEARCH.md Pitfall 5) and no spec value locks an exact measured size. `clampToViewport()` itself is exercised as a pure function against explicit numeric arguments in the test suite, so this estimate only affects the (untested-by-assertion) real-render positioning, not the locked math.
- **Entrance animation via microtask, not a timer.** The bubble's opacity/transform entrance transition is triggered via `Promise.resolve().then(...)` rather than `setTimeout`, specifically so it can never interact with `vi.useFakeTimers()` in the auto-dismiss-timer test block (04-RESEARCH.md Pitfall 4's fake-timer interaction risk is timer-specific — Vitest's fake timers do not fake Promise microtasks).

## Deviations from Plan

None - plan executed exactly as written. All acceptance criteria (RESP-01/02/03 + D-05 test groups green, inline pointer-events styles, explicit-origin postMessage with no wildcard literal, `isActiveScreen` imported not reimplemented, no PII-adjacent DOM reads, single-bubble concurrency) were met directly by the implementation described in the plan's `<action>` block with no bugs, missing functionality, or blocking issues requiring auto-fix.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/response.js` is fully implemented and GREEN against `tests/response.test.js` (12/12); full project suite remains green (75/75 across all 10 test files, including `tests/log.test.js`).
- `response:fired` (`{ intent, responseType, targetSelector }`) and `response:dismissed` (`{ responseType, dismissReason }`, now with 4 possible reason values) are the exact payload shapes plan 04-05 (index.js wiring) and plan 04-06 (e2e harness assertions) should reference.
- `discount_offer`'s postMessage payload type is `heed:discount_offer` with fields `{ type, sessionId, partnerId, intent, timestamp }`.
- No blockers for the next plan in this phase.

---
*Phase: 04-response-overlay-logging*
*Completed: 2026-07-19*

## Self-Check: PASSED
