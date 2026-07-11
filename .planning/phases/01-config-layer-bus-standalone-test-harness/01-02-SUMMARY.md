---
phase: 01-config-layer-bus-standalone-test-harness
plan: 02
subsystem: infra
tags: [json-schema, config-validation, vitest, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "RED tests/config.test.js encoding CFG-01/CFG-02 against not-yet-existing src/config.js and config/*.json"
provides:
  - "config/schema.json — documented draft-07-subset schema contract (platformId, selectors, completionSelector)"
  - "config/demo-platform.json — concrete config targeting all 7 locked CONTRACT.md data-heed selectors"
  - "src/config.js exporting validateConfig(config, schema) — generic hard-fail schema-subset validator"
affects: [01-03, 01-04, 01-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Schema-driven generic validator: validateConfig/walk interprets schema.json's type/required/properties/enum keywords generically rather than hand-rolling per-field checks, keeping documented and enforced schema mechanically identical"
    - "Hard-fail-only validation: collects all violations into an errors array, throws once with a joined message; never console.warn-and-return, never merges defaults"

key-files:
  created:
    - config/schema.json
    - config/demo-platform.json
    - src/config.js
  modified: []

key-decisions:
  - "Implemented validateConfig/walk exactly per 01-RESEARCH.md Pattern 1 (verbatim canonical excerpt) — no deviation from the researched keyword subset (type/required/properties/enum/additionalProperties)"
  - "Reworded an in-file comment from a literal 'console.warn' mention to 'soft-fail' phrasing so the Task 2 acceptance-criteria grep for the literal string console.warn stays a true negative (the original comment was documentation-only, not a code path, but the grep is a blunt string match)"

patterns-established: []

requirements-completed: [CFG-01, CFG-02]

coverage:
  - id: D1
    description: "config/schema.json documents the config contract (platformId, selectors, completionSelector) and config/demo-platform.json supplies all 7 locked CONTRACT.md data-heed selector values verbatim"
    requirement: "CFG-01"
    verification:
      - kind: unit
        ref: "tests/config.test.js — describe('CFG-01')"
        status: pass
      - kind: other
        ref: "node -e guard (schema selector-key + demo selector-value cross-check) — Task 1 verify block"
        status: pass
    human_judgment: false
  - id: D2
    description: "src/config.js validateConfig throws on any missing-required or wrong-type config violation, with no warn-and-continue or default-merge fallback path"
    requirement: "CFG-02"
    verification:
      - kind: unit
        ref: "tests/config.test.js — describe('CFG-02')"
        status: pass
    human_judgment: false

duration: 3min
completed: 2026-07-11
status: complete
---

# Phase 01 Plan 02: Config Layer Summary

**Schema-driven generic JSON-Schema-subset validator (src/config.js) plus config/schema.json and config/demo-platform.json targeting all 7 locked CONTRACT.md data-heed selectors — turns the Wave-0 CFG-01/CFG-02 RED suite fully GREEN.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-11T22:36:44Z
- **Completed:** 2026-07-11T22:38:20Z
- **Tasks:** 2 completed
- **Files modified:** 3 (config/schema.json, config/demo-platform.json, src/config.js)

## Accomplishments

- Authored `config/schema.json` as a documented JSON-Schema-draft-07-shaped contract restricted to the `type`/`required`/`properties`/`enum`/`additionalProperties` keyword subset — requires top-level `platformId`, `selectors`, `completionSelector`, and `selectors` itself requires all 7 CONTRACT.md-mapped keys
- Authored `config/demo-platform.json` carrying all 7 locked CONTRACT.md `data-heed` selector values verbatim (6 under `selectors`, `flow-complete` as `completionSelector`), with `platformId: "demo-platform"`
- Implemented `src/config.js` exporting `validateConfig(config, schema)` + internal `walk(value, schemaNode, path, errors)` — a generic keyword-subset interpreter that reads `schema.json`'s declared keywords rather than hardcoding per-field checks, so the documented and enforced schemas cannot silently drift
- Confirmed `npx vitest run tests/config.test.js` passes 6/6 — both CFG-01 (clean validation + all 7 selectors resolve) and CFG-02 (hard-fail throw on missing/invalid/empty config) blocks are GREEN
- Confirmed via grep that `src/config.js` contains no `console.warn` soft-fail path and no hardcoded `[data-heed=...]` literal — selector strings live only in `config/demo-platform.json`

## Task Commits

Each task was committed atomically:

1. **Task 1: Author config/schema.json and config/demo-platform.json** - `b852760` (feat)
2. **Task 2: Implement src/config.js generic hard-fail validator** - `602e35a` (feat)

**Plan metadata:** (pending — final docs commit below)

## Files Created/Modified

- `config/schema.json` - documented draft-07-subset schema; required top-level keys `platformId`, `selectors`, `completionSelector`; `selectors` requires all 7 CONTRACT.md-mapped keys, all string-typed
- `config/demo-platform.json` - concrete values; carries all 7 locked CONTRACT.md `data-heed` selector strings verbatim
- `src/config.js` - exports `validateConfig(config, schema)`; internal `walk()` recursive keyword-subset interpreter; throws `[heed] Invalid config …` on any violation, returns config unchanged when valid

## Decisions Made

- Implemented `validateConfig`/`walk` exactly per 01-RESEARCH.md Pattern 1's canonical excerpt — no deviation from the researched keyword subset or error-collection strategy (collect all violations, throw once with a joined multi-line message).
- Reworded an in-file comment that originally used the literal substring `console.warn` (in a documentation sentence describing what the module must never do) to `soft-fail` phrasing, so a literal grep for `console.warn` across `src/config.js` — per the plan's Task 2 acceptance criteria — returns zero matches with no ambiguity, while preserving the same intent in the comment.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria were verified exactly as specified: the Task 1 `node -e` guard prints `ok`; `npx vitest run tests/config.test.js` passes 6/6; grep of `src/config.js` shows no `console.warn` call and no `[data-heed` literal; `validateConfig` returns the config on the valid path and throws (never returns) on any missing-required or wrong-type violation.

## Issues Encountered

None.

## Known Stubs

None. `config/schema.json`, `config/demo-platform.json`, and `src/config.js` are fully implemented per this plan's scope — no placeholder values, no unwired data paths. `src/bus.js`, `src/index.js`, and `test-harness/index.html` remain intentionally out of scope for this plan (owned by 01-03/01-04/01-05) and are the reason `tests/bus.test.js` and `tests/harness.test.js` still fail when running the full suite — this is expected, not a stub in this plan's deliverables.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The config layer (CFG-01, CFG-02) is fully implemented and GREEN — `src/bus.js` (01-03) and `test-harness/index.html` (01-04/01-05) can now build on a validated config object via `validateConfig`.
- `src/index.js`'s eventual `init()` orchestrator can call `validateConfig(rawConfig, schema)` synchronously before any listener attaches, per the researched "Wiring init() to hard-fail" pattern.
- No blockers. `tests/bus.test.js` and `tests/harness.test.js` remain RED as expected — owned by subsequent plans in this phase.

---
*Phase: 01-config-layer-bus-standalone-test-harness*
*Completed: 2026-07-11*

## Self-Check: PASSED

- FOUND: config/schema.json
- FOUND: config/demo-platform.json
- FOUND: src/config.js
- FOUND: commit b852760 (Task 1)
- FOUND: commit 602e35a (Task 2)
