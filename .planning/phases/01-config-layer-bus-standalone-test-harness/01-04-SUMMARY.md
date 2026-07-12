---
phase: 01-config-layer-bus-standalone-test-harness
plan: 04
subsystem: infra
tags: [esbuild, iife-bundle, static-harness, event-bus, config-validation]

# Dependency graph
requires:
  - phase: 01-02
    provides: "src/config.js validateConfig(config, schema) hard-fail validator + config/schema.json + config/demo-platform.json"
  - phase: 01-03
    provides: "src/bus.js private-EventTarget publish(type, detail)/subscribe(type, handler)"
provides:
  - "src/index.js: init(rawConfig) orchestrator — validates then exposes { config, publish, subscribe }, throws before returning on invalid config"
  - "src/index.js: initDemo() convenience export calling init(demoConfig)"
  - "dist/sdk.js: esbuild IIFE bundle exposing global window.Heed = { init, initDemo, publish, subscribe } with schema.json + demo-platform.json inlined at build time"
  - "test-harness/index.html: standalone static harness — 7 real data-heed elements + labeled synthetic-signal debug panel wired end-to-end to the bus"
affects: [02-signal-detection, 03-inference, 05-weight-push-receiver]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "init() hard-fail gate: no try/catch around validateConfig — throw propagates and stops initialization before publish/subscribe are exposed (CFG-02 wired end-to-end into the orchestrator)"
    - "esbuild --bundle --format=iife --global-name=Heed inlines JSON imports at build time so the standalone harness needs no fetch/backend"
    - "Debug-panel synthetic signal payloads built only from getBoundingClientRect() + Date.now() + the element's own data-heed attribute — never element.value/textContent/cookies/localStorage"

key-files:
  created:
    - src/index.js
    - test-harness/index.html
    - tests/index.test.js
  modified: []

key-decisions:
  - "src/index.js re-exports publish/subscribe as top-level named exports (in addition to being returned from init()) so the esbuild IIFE bundle exposes window.Heed.publish/window.Heed.subscribe directly, which the harness's debug-panel/log-subscriber code needs without holding onto init()'s return value"
  - "Signal-to-element mapping in the debug panel: touch_hesitation and blur_incomplete target amount-input, scroll_reversal targets fee-row, back_intent targets back-btn — chosen to match CONTRACT.md's documented Branch-2-targets-per-selector table"

patterns-established:
  - "Pattern: init() orchestrator composes validateConfig (config.js) + publish/subscribe (bus.js) with zero business logic of its own — a pure wiring layer, matching 01-RESEARCH.md's 'Wiring init() to hard-fail' excerpt"

requirements-completed: [TEST-01]

coverage:
  - id: D1
    description: "init(rawConfig) validates then returns { config, publish, subscribe }; init(invalidConfig) throws before returning any bus interface (no partial init)"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/index.test.js — 'returns { config, publish, subscribe } on valid config' and 'hard-fails (throws) on invalid config before exposing any bus interface'"
        status: pass
    human_judgment: false
  - id: D2
    description: "esbuild bundles src/index.js into dist/sdk.js as global window.Heed, inlining the demo config and schema so the harness needs no backend or fetch"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "npm run build && node -e check for Heed/publish/subscribe in dist/sdk.js (plan's automated verify command)"
        status: pass
    human_judgment: false
  - id: D3
    description: "test-harness/index.html exposes exactly the 7 locked data-heed selectors and a labeled synthetic-signal debug panel that publishes each of the 4 signal types onto the bus, with an on-page log proving subscriber receipt"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/harness.test.js — 'exposes exactly the 7 locked data-heed selectors from CONTRACT.md'"
        status: pass
      - kind: integration
        ref: "manual happy-dom smoke script: initDemo() + click Simulate touch_hesitation + subscriber log receipt, confirmed payload shape { type, targetSelector, bbox, timestamp } with no PII fields"
        status: pass
    human_judgment: false
  - id: D4
    description: "Full in-browser manual verification (opening the harness in a real browser and clicking each of the 4 trigger buttons) — visual/interactive confirmation beyond automated tests"
    requirement: "TEST-01"
    verification: []
    human_judgment: true
    rationale: "This plan's own <verification> section explicitly defers manual browser confirmation of button-triggered bus receipt to plan 01-05's human-verify checkpoint; automated coverage here (D1-D3) proves the plumbing programmatically via vitest + a happy-dom smoke script, not a real browser."

duration: 4min
completed: 2026-07-12
status: complete
---

# Phase 01 Plan 04: init() Orchestrator, esbuild Bundle & Standalone Test Harness Summary

**Wired src/index.js's init()/initDemo() orchestrator over config.js + bus.js, built dist/sdk.js as an esbuild IIFE global `Heed` with the demo config inlined, and shipped test-harness/index.html — a static, no-backend harness exposing all 7 CONTRACT.md data-heed selectors plus a synthetic-signal debug panel wired end-to-end to the bus (TEST-01 GREEN).**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-07-12T17:03:12Z
- **Completed:** 2026-07-12T17:06:17Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 source files + 1 new test file)

## Accomplishments

- Implemented `src/index.js`: `init(rawConfig)` calls `validateConfig(rawConfig, schema)` with no surrounding try/catch, so an invalid config throws and stops initialization before `publish`/`subscribe` are exposed — the CFG-02 hard-fail gate now wired end-to-end into the SDK's actual entry point (T-01-01 threat mitigation).
- `initDemo()` convenience export calls `init(demoConfig)` so the bundled global is directly usable by the standalone harness with no duplicate config literal living in the harness itself.
- `publish`/`subscribe` re-exported as top-level named exports (alongside being returned from `init()`) so `window.Heed.publish`/`window.Heed.subscribe` work directly from the harness's debug-panel and log-subscriber code.
- `npm run build` (esbuild, `--bundle --format=iife --global-name=Heed`) produces `dist/sdk.js` (4.1kb) exposing `window.Heed = { init, initDemo, publish, subscribe }` with `config/schema.json` and `config/demo-platform.json` inlined at build time — confirmed no `try`/`catch` anywhere in the bundle around the validation path.
- Built `test-harness/index.html`: 7 real, visible `data-heed` elements arranged to mirror Branch 1's screens (amount-input/fee-row/min-received-row/proceed-cta on a Screen-2-style card, confirm-cta/back-btn on a Screen-3-style card, flow-complete as the Screen-4 success marker), loading `dist/sdk.js` via a single `<script>` tag.
- Debug panel explicitly labeled "Bus/Config Smoke Test — synthetic signals, not real touch/scroll detection" (Pitfall 4 mitigation) with one trigger button per signal type (`touch_hesitation`, `blur_incomplete`, `scroll_reversal`, `back_intent`); each handler builds `{ type, targetSelector, bbox, timestamp }` from `getBoundingClientRect()` + `Date.now()` + the target element's own `data-heed` attribute only — never `element.value`/`textContent`/cookies/localStorage (T-01-04 threat mitigation).
- On-page log subscriber (`window.Heed.subscribe('signal:detected', ...)`) proves config→bus→subscriber receipt end-to-end; confirmed via a manual happy-dom smoke script that clicking "Simulate touch_hesitation" produces a correctly-shaped, PII-free logged payload.

## Task Commits

Each task was committed atomically. Task 1 followed the TDD RED/GREEN cycle (per its `tdd="true"` attribute):

1. **Task 1 (RED): add failing test for init() orchestrator** - `86c5121` (test)
2. **Task 1 (GREEN): implement init() orchestrator and build dist/sdk.js** - `d87e8ab` (feat)
3. **Task 2: build standalone test harness with synthetic-signal debug panel** - `76192ec` (feat)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified

- `src/index.js` - `init(rawConfig)` (hard-fail-then-expose) and `initDemo()` orchestrator; re-exports `publish`/`subscribe`
- `dist/sdk.js` - esbuild IIFE bundle (gitignored build artifact, not committed) exposing global `Heed`; regenerate via `npm run build`
- `test-harness/index.html` - Static standalone harness: 7 `data-heed` elements + labeled synthetic-signal debug panel + on-page bus-receipt log
- `tests/index.test.js` - RED/GREEN-driving unit tests for `init()`'s valid-config and hard-fail-on-invalid-config behaviors

## Decisions Made

- Re-exported `publish`/`subscribe` as top-level named exports from `src/index.js` (not only nested inside `init()`'s return value), so the esbuild IIFE bundle exposes them directly as `window.Heed.publish`/`window.Heed.subscribe` — required by the harness's debug-panel trigger buttons and log subscriber, which call these without holding a reference to `init()`'s return object.
- Mapped each debug-panel signal button to the CONTRACT.md-documented target element for that signal type: `touch_hesitation`→`amount-input`, `blur_incomplete`→`amount-input`, `scroll_reversal`→`fee-row`, `back_intent`→`back-btn`.
- Ran `npm install` before building (dependencies were declared in `package.json` from Wave 0 but `node_modules/` did not yet exist on this fresh checkout) — installing already-declared dependencies, not adding a new/unverified package, so this did not require a package-legitimacy checkpoint.

## Deviations from Plan

None — plan executed exactly as written. `npm install` was a necessary environment-setup step (dependencies already declared in `package.json`), not a deviation from the plan's file/task scope.

## Issues Encountered

None. All automated verification passed on first attempt: `tests/index.test.js` (2/2), `tests/harness.test.js` (1/1), full suite (`npx vitest run`, 11/11), `npm run build` (dist/sdk.js produced, contains `Heed`/`publish`/`subscribe`, no try/catch around the validation path). A manual happy-dom smoke script additionally confirmed the debug panel's click-to-publish-to-subscribe-to-log wiring works end-to-end in a simulated DOM before committing.

## Known Stubs

None. Both `src/index.js` and `test-harness/index.html` are complete, working implementations — no placeholder logic, no hardcoded empty values flowing to any rendered surface.

## Threat Flags

None — this plan directly implements the two threat mitigations already documented in its own `<threat_model>` (T-01-01: init() hard-fail gate; T-01-04: PII-free synthetic debug-panel payloads). No new, undocumented security-relevant surface was introduced. T-01-05 (bundled demo config content) is an accepted, pre-documented low-severity item, not a new flag.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/index.js`, `dist/sdk.js`, and `test-harness/index.html` are complete and GREEN; the full config→bus→subscriber pipeline is now exercisable in a real browser with no Branch 1 and no backend (TEST-01 core plumbing satisfied).
- Full test suite (`npx vitest run`) is 11/11 GREEN across `tests/config.test.js`, `tests/bus.test.js`, `tests/harness.test.js`, and the new `tests/index.test.js`.
- Manual, real-browser confirmation of button-triggered bus receipt (opening `test-harness/index.html` directly and clicking each of the 4 trigger buttons) is explicitly deferred to plan `01-05`'s human-verify checkpoint, per this plan's own `<verification>` section — not a blocker for this plan's completion.
- Phase 2 (`signal.js`) can attach real DOM listeners to the same 7 elements in `test-harness/index.html` without any structural change to the harness, per the plan's design intent.
- No blockers.

---
*Phase: 01-config-layer-bus-standalone-test-harness*
*Completed: 2026-07-12*

## Self-Check: PASSED

- FOUND: src/index.js
- FOUND: test-harness/index.html
- FOUND: tests/index.test.js
- FOUND: dist/sdk.js (gitignored build artifact, regenerated via `npm run build`)
- FOUND: commit 86c5121 (Task 1 RED)
- FOUND: commit d87e8ab (Task 1 GREEN)
- FOUND: commit 76192ec (Task 2)
