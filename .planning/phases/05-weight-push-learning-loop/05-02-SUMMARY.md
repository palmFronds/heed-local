---
phase: 05-weight-push-learning-loop
plan: 02
subsystem: infra
tags: [node-http, json-schema, atomic-file-io, cors, weight-persistence]

# Dependency graph
requires:
  - phase: 05-weight-push-learning-loop
    provides: "Plan 05-01's RED test suite (tests/local-receiver.test.js) encoding SC1/SC4 receiver-side behavior"
provides:
  - "local-receiver/server.js — hand-written Node http receiver (createReceiver factory, isValidWeights validator, GET/POST /weights)"
  - "Optional weightPushUrl config field (schema + demo value) wired to the receiver's default URL"
  - "npm run receiver and npm run soak-test script entries"
  - "local-receiver/weights.json gitignored (runtime state, created on first POST)"
affects: [05-03, 05-04, 05-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Factory-with-injectable-path pattern (createReceiver({ weightsPath })) so tests bind an ephemeral port against a temp file instead of the real weights.json"
    - "Boolean-returning shape validator (isValidWeights) mirrors the SDK's hard-fail validateWeightsShape() but degrades instead of throwing — two deliberately different validation postures for two different failure-tolerance requirements"
    - "Temp-file-then-fs.rename atomic write for single-writer local dev persistence"
    - "Content-Type-agnostic JSON.parse on POST body so both fetch's application/json and sendBeacon's text/plain payloads persist"

key-files:
  created:
    - local-receiver/server.js
  modified:
    - config/schema.json
    - config/demo-platform.json
    - package.json
    - .gitignore

key-decisions:
  - "isValidWeights() never throws (returns boolean) — receiver degrades to last-known-good on malformed/corrupt data rather than crashing, per D-06"
  - "weightPushUrl added to config/schema.json as an OPTIONAL top-level string (not in required array), matching activeScreens/responses precedent — a partner config omitting it must no-op gracefully"
  - "Receiver port 4310 and route /weights (GET+POST differentiated by method) picked as concrete defaults per RESEARCH.md Assumption A1 (Claude's discretion)"

patterns-established:
  - "Dev-only Node http server under local-receiver/, run-as-main guarded, never imported by src/ or bundled into dist/sdk.js"

requirements-completed: [WEIGHT-01]

coverage:
  - id: D1
    description: "Node http receiver at local-receiver/server.js accepts POST /weights, validates {W1,b1,W2,b2} shape, and atomically persists to local-receiver/weights.json"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: "tests/local-receiver.test.js#POST persists a valid weights body to the weights file (SC1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /weights re-validates on-disk shape and serves last-known-good rather than garbage; a corrupt file never crashes the process"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: "tests/local-receiver.test.js#a corrupt on-disk weights file does not crash the receiver and is never served as-is on GET (SC4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Malformed or oversized POST body yields a 4xx, is never written to disk, and never crashes the process"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: "tests/local-receiver.test.js#malformed POST is rejected with 400, never crashes the server, never writes the weights file (SC4)"
        status: pass
    human_judgment: false
  - id: D4
    description: "config/schema.json documents an optional weightPushUrl string; config/demo-platform.json sets it to the receiver's URL"
    requirement: "WEIGHT-01"
    verification:
      - kind: unit
        ref: "node -e schema/demo-config shape+value check (see Task Commits)"
        status: pass
    human_judgment: false
  - id: D5
    description: "npm run receiver starts the server; the persisted weights file is gitignored"
    verification:
      - kind: manual_procedural
        ref: "npm run receiver + curl POST/GET smoke test — valid POST returns 200 and creates weights.json, malformed POST returns 400 and leaves the file untouched"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 2: Local Weight-Push Receiver + Config Plumbing Summary

**Hand-written Node `http` receiver (no framework, zero new deps) that atomically persists and re-serves `{W1,b1,W2,b2}` weight pushes at `local-receiver/server.js`, plus the `weightPushUrl` config field and `npm run receiver`/`npm run soak-test` scripts.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-20T00:54:00Z
- **Completed:** 2026-07-20T00:56:44Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `local-receiver/server.js`: `createReceiver({ weightsPath })` factory (injectable path, no `.listen()` until run-as-main) exporting `isValidWeights(w)` — flips all 3 receiver-side RED cases in `tests/local-receiver.test.js` to GREEN (SC1 persist, SC4 malformed-POST, SC4 corrupt-file).
- `config/schema.json` + `config/demo-platform.json`: optional `weightPushUrl` field, concrete demo value `http://localhost:4310/weights` matching the receiver's default port/route.
- `package.json`: `receiver` and `soak-test` npm scripts; `.gitignore`: `local-receiver/weights.json` excluded (runtime state).

## Task Commits

Each task was committed atomically:

1. **Task 1: Hand-written Node http receiver (SC1 write + SC4 serve)** - `84bb990` (feat)
2. **Task 2: Add optional weightPushUrl to schema + demo config** - `c6c20c3` (feat)
3. **Task 3: package.json scripts + gitignore the persisted weights file** - `2f41967` (chore)

**Plan metadata:** committed separately after this SUMMARY.

## Files Created/Modified
- `local-receiver/server.js` - Node `http.createServer` with `GET /weights` (on-disk re-validation, last-known-good on corrupt), `POST /weights` (byte-capped body, content-type-agnostic JSON.parse, atomic temp-file+rename write), OPTIONS CORS preflight, `req.on('error')` guard
- `config/schema.json` - added `"weightPushUrl": { "type": "string" }` as an optional top-level property
- `config/demo-platform.json` - set `"weightPushUrl": "http://localhost:4310/weights"`
- `package.json` - added `receiver` and `soak-test` script entries
- `.gitignore` - added `local-receiver/weights.json`

## Decisions Made
- `isValidWeights()` mirrors `src/inference.js`'s `validateWeightsShape()` shape checks exactly (4x4-matrix/4-element numeric-finite) but returns `false` instead of throwing — the receiver's "never crash, serve last-known-good" posture (D-06) is deliberately different from the SDK's hard-fail posture, and both validators must accept the same shapes so nothing that passes the receiver's GET ever fails the SDK's own validation downstream.
- `weightPushUrl` left OPTIONAL in the schema (not in `required`) per RESEARCH.md Assumption A3 — a partner config omitting it must no-op gracefully once `src/log.js`'s guarded push call lands in a later plan.
- Port `4310` / route `/weights` picked as concrete defaults (RESEARCH.md Assumption A1, explicitly Claude's discretion) and kept consistent across the receiver's `PORT` env default, `config/demo-platform.json`'s value, and the harness bootstrap URL later plans will use.

## Deviations from Plan

None - plan executed exactly as written. All three tasks matched RESEARCH.md's Architecture Pattern 3 and PATTERNS.md's file classification without needing any bug fixes, missing-functionality additions, or blocking-issue workarounds.

## Issues Encountered

**Full `npm test` suite is not green after this plan** — two pre-existing tests remain RED: `tests/inference-endsession.test.js` (`endSession()` returns the updated weights — Pitfall 1) and `tests/index.test.js` (`initDemo(overrides)` injects fetched weights — Pitfall 2). Both were authored as Wave-0 RED tests by Plan 05-01 and encode changes to `src/inference.js` and `src/index.js` respectively — neither file is in this plan's `files_modified` scope (`local-receiver/server.js`, `config/schema.json`, `config/demo-platform.json`, `package.json`, `.gitignore`). These are expected to flip GREEN in a separate Wave-1 plan (05-03) that owns those two source files. This plan's own scoped verification (`npx vitest run tests/local-receiver.test.js` — 3/3 pass; `tests/config.test.js` — 12/12 pass; manual `npm run receiver` + curl smoke test) is fully green.

## User Setup Required

None - no external service configuration required. The receiver is local dev/test tooling (`npm run receiver`), not a hosted service.

## Next Phase Readiness
- `local-receiver/server.js` is ready to receive real POSTs from `src/log.js`'s `pushWeights()` once Plan 05-03 wires the `endSession()` return value and the fetch/sendBeacon transport split (D-03).
- `config.weightPushUrl` is available for `src/log.js` to read once that plan lands.
- `admin/soak-test-weights.mjs` (D-08, Plan 05-05) can POST through this real receiver via `npm run soak-test` once authored — the script entry is already wired.
- Blocker/note carried forward: `tests/inference-endsession.test.js` and `tests/index.test.js` remain RED until Plan 05-03 completes (see Issues Encountered) — this is expected sequencing, not a regression from this plan.

---
*Phase: 05-weight-push-learning-loop*
*Completed: 2026-07-20*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task/summary commit hashes (`84bb990`, `c6c20c3`, `2f41967`, `86cdc85`) verified present in git log.
