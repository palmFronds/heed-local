---
phase: 01-config-layer-bus-standalone-test-harness
plan: 01
subsystem: testing
tags: [vitest, happy-dom, esbuild, tdd, event-bus, json-schema]

# Dependency graph
requires: []
provides:
  - "package.json scaffolded (ESM, test/build scripts, pinned dev deps, zero runtime deps)"
  - "vitest.config.js with happy-dom environment"
  - "RED test suite mechanically encoding CFG-01, CFG-02, BUS-01, TEST-01"
  - "Decoupled bus test fixtures (test-emitter.js / test-subscriber.js) proving BUS-01's zero-direct-import requirement"
affects: [01-02, 01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: [vitest@4.1.10, happy-dom@20.10.6, esbuild@0.28.1, "@playwright/test@1.61.1"]
  patterns:
    - "Wave-0 TDD scaffold: executable RED tests encode requirements before implementation exists"
    - "Bus decoupling proven by fixture import graph (test-emitter/test-subscriber each import only src/bus.js)"

key-files:
  created:
    - package.json
    - vitest.config.js
    - .gitignore (updated)
    - tests/config.test.js
    - tests/bus.test.js
    - tests/harness.test.js
    - tests/fixtures/test-emitter.js
    - tests/fixtures/test-subscriber.js
  modified: []

key-decisions:
  - "Plain ESM JSON imports (no import assertion syntax) per Task 1's explicit instruction, since assert/with { type: 'json' } varies by Node version and would break the esbuild browser bundle"
  - "requirements-completed left empty for this plan despite frontmatter listing CFG-01/CFG-02/BUS-01/TEST-01 — those requirements are genuinely satisfied by Wave 1/2 implementation plans (01-02 through 01-05), not this RED-authoring wave; marking them complete now would misrepresent REQUIREMENTS.md traceability while src/config.js, src/bus.js, and test-harness/index.html do not yet exist"

patterns-established:
  - "Pattern 1 (schema-driven generic validator): config.js will interpret schema.json's type/required/properties/enum keywords generically rather than hand-rolling per-field checks"
  - "Pattern 2 (private EventTarget bus): bus.js will wrap a module-private new EventTarget(), never document/window"
  - "Pattern 3 (decoupled fixture proof): any future cross-module contract test should follow the test-emitter/test-subscriber shape — two fixtures that each import only the shared module under test, wired together from a third file"

requirements-completed: []

coverage:
  - id: D1
    description: "npx vitest run tests/config.test.js reports RED — CFG-01/CFG-02 assertions exist and fail only because src/config.js and config/*.json don't exist yet"
    requirement: "CFG-01"
    verification:
      - kind: unit
        ref: "tests/config.test.js — describe('CFG-01'), describe('CFG-02')"
        status: pass
    human_judgment: false
  - id: D2
    description: "npx vitest run tests/bus.test.js reports RED — BUS-01 decoupled emitter/subscriber fixtures exist and wire together correctly, failing only because src/bus.js doesn't exist yet"
    requirement: "BUS-01"
    verification:
      - kind: unit
        ref: "tests/bus.test.js — describe('BUS-01')"
        status: pass
    human_judgment: false
  - id: D3
    description: "npx vitest run tests/harness.test.js reports RED — TEST-01 structural assertion (7 data-heed elements) exists and fails only because test-harness/index.html doesn't exist yet"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "tests/harness.test.js — describe('TEST-01')"
        status: pass
    human_judgment: false
  - id: D4
    description: "package.json/vitest.config.js dev tooling scaffold: type=module, test/build scripts, pinned dev deps, zero runtime deps, happy-dom environment"
    verification:
      - kind: unit
        ref: "node -e guard (type/scripts/devDependencies/no-runtime-deps check) — see Task 1 verify block"
        status: pass
    human_judgment: false

duration: 5min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 01: Config Layer, Bus & Standalone Test Harness — Wave 0 Scaffold Summary

**Greenfield dev-tooling scaffold plus a fully RED Vitest suite (config, bus, harness) that mechanically encodes CFG-01, CFG-02, BUS-01, and TEST-01 as executable assertions before any src/ implementation exists.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-11T22:28:47Z
- **Completed:** 2026-07-11T22:33:04Z
- **Tasks:** 3 completed
- **Files modified:** 9 (package.json, package-lock.json, vitest.config.js, .gitignore, 5 test/fixture files)

## Accomplishments

- Initialized `package.json` (ESM, `type: module`, `test`/`build` scripts) with pinned dev dependencies: vitest@4.1.10, happy-dom@20.10.6, esbuild@0.28.1, @playwright/test@1.61.1 — zero runtime dependencies
- Created `vitest.config.js` with `environment: 'happy-dom'`
- Authored `tests/config.test.js` encoding CFG-01 (clean validation + all 7 CONTRACT.md selectors resolve verbatim) and CFG-02 (hard-fail throw on missing/invalid/empty config)
- Authored `tests/bus.test.js` + two provably-decoupled fixtures (`test-emitter.js`, `test-subscriber.js`, each importing only `src/bus.js`) encoding BUS-01, with an explicit deep-equal payload assertion guarding the "CustomEvent detail silently empty" pitfall
- Authored `tests/harness.test.js` encoding TEST-01's structural gate (exactly 7 `[data-heed]` elements), parsing `test-harness/index.html` via happy-dom's `Window`
- Confirmed `npx vitest run` executes end-to-end with no runner/config crash and reports RED for all three suites — the correct and expected Wave-0 state

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize package.json, dev dependencies, and Vitest config** - `5e1c8f2` (chore)
2. **Task 2: Author failing config tests (CFG-01, CFG-02)** - `e8bacd4` (test)
3. **Task 3: Author failing bus + harness tests with decoupled fixtures (BUS-01, TEST-01)** - `ec2870e` (test)

**Plan metadata:** (pending — final docs commit below)

_Note: This is a TDD Wave-0 plan; RED is the correct and expected outcome for all three suites. No GREEN implementation is expected until plans 01-02 through 01-05._

## Files Created/Modified

- `package.json` - ESM package manifest, test/build scripts, pinned dev deps, zero runtime deps
- `package-lock.json` - lockfile for the four pinned dev dependencies
- `vitest.config.js` - Vitest config setting `environment: 'happy-dom'`
- `.gitignore` - added `node_modules/` and `dist/` (kept pre-existing `.planning/research/.cache/` entry)
- `tests/config.test.js` - CFG-01/CFG-02 RED suite (imports not-yet-existing `src/config.js`, `config/schema.json`, `config/demo-platform.json`)
- `tests/bus.test.js` - BUS-01 RED suite, wires the two fixtures from outside, asserts handler called once + deep-equal payload
- `tests/harness.test.js` - TEST-01 RED suite, reads `test-harness/index.html` via `node:fs` and parses via happy-dom's `Window`
- `tests/fixtures/test-emitter.js` - imports only `../../src/bus.js`, exports `emitSynthetic()`
- `tests/fixtures/test-subscriber.js` - imports only `../../src/bus.js`, exports `collectReceived(onReceive)`

## Decisions Made

- Used plain ESM JSON imports (`import schema from '../config/schema.json'`, no `assert`/`with { type: 'json' }`) per Task 1's explicit instruction — Vitest's Vite-based resolver handles this natively, and avoiding the assertion syntax keeps the eventual esbuild browser bundle (which does not use Node's native JSON-import-assertion loader) unaffected.
- Deliberately did **not** run `requirements mark-complete` for CFG-01/CFG-02/BUS-01/TEST-01 in this plan, even though they appear in this PLAN.md's frontmatter `requirements` field. This Wave-0 plan's own success criteria ("RED tests exist and mechanically encode the requirements") were fully met, but the underlying requirements themselves (working `src/config.js`, `src/bus.js`, `test-harness/index.html`) are not yet implemented — REQUIREMENTS.md traceability should only flip to complete once plans 01-02 through 01-05 turn these suites GREEN.

## Deviations from Plan

None - plan executed exactly as written. All three tasks' acceptance criteria were verified exactly as specified (node -e guard prints `ok`; `npx vitest --version` prints 4.1.10; `RED-as-expected` printed for all three verify commands; fixture cross-import check confirms zero coupling).

## Known Stubs

None. Every artifact in this plan is intentionally not-yet-implemented (RED by design, per the plan's explicit Wave-0 objective) — this is not a stub in the "looks done but isn't" sense; it is the documented and correct end state for this plan. Wave 1/2 plans (01-02 through 01-05) turn these suites GREEN.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. `npm install` was run locally during this plan and both `package.json`/`package-lock.json` are committed so future sessions/CI reproduce the same dev-tooling versions.

## Next Phase Readiness

- Dev tooling (Vitest + happy-dom + esbuild + Playwright) is installed and pinned; `npx vitest run` runs cleanly end-to-end.
- Plans 01-02 (config.js + config/schema.json + config/demo-platform.json), 01-03 (bus.js), and 01-04/01-05 (test-harness/index.html) each have a concrete, already-written RED test target to turn GREEN — no further test authoring should be needed for CFG-01, CFG-02, BUS-01, or TEST-01's structural check.
- No blockers.

---
*Phase: 01-config-layer-bus-standalone-test-harness*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: package.json
- FOUND: vitest.config.js
- FOUND: .gitignore
- FOUND: tests/config.test.js
- FOUND: tests/bus.test.js
- FOUND: tests/harness.test.js
- FOUND: tests/fixtures/test-emitter.js
- FOUND: tests/fixtures/test-subscriber.js
- FOUND: commit 5e1c8f2 (Task 1)
- FOUND: commit e8bacd4 (Task 2)
- FOUND: commit ec2870e (Task 3)
