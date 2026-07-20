---
phase: 05-weight-push-learning-loop
verified: 2026-07-20T14:45:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 4/4
  gaps_closed:
    - "WR-02 residual concurrency race (intermittent 500 on one of two concurrent POST /weights requests, ~15-30% failure rate on Windows) — closed by commit 1018644, which chains every write+rename onto a single in-process writeQueue promise, making the persist step a true single-writer critical section."
  gaps_remaining: []
  regressions: []
---

# Phase 5: Weight-Push Learning Loop Verification Report

**Phase Goal:** The on-device learning loop closes across sessions — updated weights persist locally and are picked up on the next cold start, without corrupting the pipeline if that persistence ever fails.
**Verified:** 2026-07-20T14:45:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (follow-up fix commit `1018644` for the WR-02 residual concurrency race flagged `human_needed` in the prior verification pass)

## What changed since the prior verification

The prior verification (2026-07-20T10:40:00Z) independently confirmed all 4 ROADMAP success criteria pass, but flagged `status: human_needed` for one issue: an intermittent (~15-30%) failure of `tests/local-receiver.test.js > concurrent POSTs use distinct temp files` on Windows. Root cause: two concurrent `POST /weights` requests both called `fs.rename()` onto the same shared `weightsPath` destination — the WR-02 code-review fix's unique-temp-path approach stopped writers from clobbering each other's temp file, but didn't stop two renames from racing onto the same final destination, which Windows' `MoveFile` semantics can intermittently fail.

The orchestrator applied a follow-up fix in commit `1018644`: `local-receiver/server.js` now chains every write+rename onto a single in-process `writeQueue` promise (lines 65, 149-172), serializing the persist step into a true single-writer critical section rather than relying on filesystem-specific rename atomicity. This re-verification's job was to independently confirm that fix actually closes the race — not just read the commit message and 05-REVIEW-FIX.md's claim.

### Independent re-verification of the fix (this pass)

| Check | Command | Result |
|---|---|---|
| Isolated regression test, repeated | `npx vitest run tests/local-receiver.test.js -t "concurrent POSTs"` × 10 | 10/10 passed, 0 failures |
| Full suite, repeated | `npm test` × 8 | 8/8 runs, 88/88 tests passed each time (704 total individual test executions, 0 failures) |
| Higher-concurrency stress test (beyond the regression test's 2-way race) | Custom script: 8-way concurrent `POST /weights` × 20 trials against a live `createReceiver()` instance, asserting every response is `200` and the on-disk file always equals one whole, uncorrupted request body (never mixed) | 20/20 trials, 0 failures, 0 corrupted/mixed writes across 160 concurrent POSTs |
| Code diff review of the fix commit | `git show 1018644 -- local-receiver/server.js` | Confirmed the `writeQueue` promise chain wraps the write+rename+response for every POST (not a partial/cosmetic change); confirmed no new debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`) introduced |

The original flake rate (~15-30%, reproduced in roughly 1-in-3-to-8 runs during the prior pass) would almost certainly have shown up at least once across 10 isolated runs, 8 full-suite runs (704 individual test executions), and 160 stress-test POSTs if still present. It did not. The fix is confirmed to close the race.

### Regression check on previously-passed items (quick sanity, not full re-derivation)

| Item | Check | Result |
|---|---|---|
| SC1/SC4 (sequential POST/GET behavior, malformed/corrupt handling) | Covered by the same 8 full-suite runs above (88/88 each includes all SC1/SC4 unit tests) | ✓ No regression |
| SC2/SC3 (soak test — persisted weights differ from cold-start, no softmax collapse over 16 sessions) | Re-ran `node local-receiver/server.js` (bg) + `node admin/soak-test-weights.mjs` | Both gates `GATE PASS`, exit 0 — identical result to prior verification |
| Build + bundle purity | `npm run build` | esbuild + `postbuild` purity check both exit 0; `dist/sdk.js` 13.7kb, `check-bundle-purity.mjs` reports PASS |
| Playwright e2e | `npx playwright test` | 6/6 passed — identical result to prior verification |
| Requirements traceability staleness (previously flagged) | `.planning/REQUIREMENTS.md` line 104 | Now reads `WEIGHT-01 \| Phase 5 \| Complete` — the staleness noted in the prior verification's Requirements Coverage section has been resolved |

No regressions found in any previously-passed item.

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth (Success Criterion) | Status | Evidence |
|---|---------|------------|----------|
| SC1 | A session-end weight-update POST is accepted by the local receiver and persisted to a local JSON weight file. | ✓ VERIFIED | Confirmed via the 8/8 full-suite regression runs (88/88 each) covering the "POST persists" unit test; behavior unchanged from prior verification's independent `curl` smoke test. Now also holds under concurrent load — see below. |
| SC2 | Restarting the test harness after a persisted weight file exists causes sdk.js to load those learned weights instead of the cold-start domain-knowledge weights. | ✓ VERIFIED | Independently re-ran `admin/soak-test-weights.mjs` against a freshly-started live receiver: `GATE PASS: persisted weights differ from cold-start defaults` and `GATE PASS: forwardPass against persisted weights losslessly reproduces the in-memory "after" margins`, exit code 0. |
| SC3 | Running 10-20 synthetic sessions back-to-back through the local harness does not collapse the softmax output toward uniform or saturated for the canonical test signals, checked before and after the run. | ✓ VERIFIED | Same soak-test run (16 sessions): all 4 canonical signals `GATE PASS` (margins 0.22-0.33, well clear of the 0.98 saturation / 0.02 collapse thresholds), exit 0. |
| SC4 | A malformed or corrupt weight file does not crash the receiver or the SDK's cold-start path — the SDK falls back to the structured-guess cold-start weights instead. | ✓ VERIFIED | Covered by the 8/8 full-suite regression runs (malformed-POST, corrupt-on-disk-GET, and now-fixed concurrent-POST tests all pass every run). The **previously-open concern was specifically that this "never crashes / never corrupts" guarantee wasn't reliably true under concurrent load** — that gap is now closed: 20 trials of 8-way concurrent POSTs (160 total requests) produced zero corrupted or mixed writes and zero 500s. |

**Score:** 4/4 ROADMAP success criteria verified with reproduced, independently-run evidence. The one residual gap from the prior pass (concurrent-POST race) is now closed and independently re-confirmed at a higher bar (10 isolated runs + 8 full-suite runs + a 160-request, 8-way stress test) than the original flake was caught at.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `local-receiver/server.js` | Node `http` receiver, `createReceiver`/`isValidWeights` exports, GET/POST `/weights`, single-writer persist queue | ✓ VERIFIED | Read in full this pass. `writeQueue` (line 65) chains every write+rename+response onto a single promise (lines 149-172) — genuine serialization, not a cosmetic change. No Express/framework import. |
| `src/inference.js` | `endSession()` returns updated `{W1,b1,W2,b2}` | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification; covered by full-suite pass. |
| `src/log.js` | `pushWeights()` choke-point, fetch/sendBeacon transport split | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification; covered by full-suite pass. |
| `src/index.js` | `initDemo(overrides)` weight injection | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification; covered by full-suite pass. |
| `test-harness/index.html` | Bootstrap fetches persisted weights before init | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification. |
| `config/schema.json` / `config/demo-platform.json` | Optional `weightPushUrl` field + demo value | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification. |
| `admin/soak-test-weights.mjs` | D-08 soak-test script, SC2+SC3 gates | ✓ VERIFIED | Independently re-executed against a live receiver this pass; both gates PASS, exit 0. |
| `package.json` / `.gitignore` | `receiver`/`soak-test` scripts, gitignored weights file | ✓ VERIFIED (regression, unchanged this pass) | Not modified since prior verification. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `src/log.js finishSession()` | `local-receiver/server.js POST /weights` | `pushWeights()` fetch/sendBeacon | ✓ WIRED | Unchanged this pass; confirmed via full-suite regression pass. |
| `test-harness/index.html` bootstrap | `local-receiver/server.js GET /weights` | `fetch()` before `initDemo(overrides)` | ✓ WIRED | Unchanged this pass; confirmed via soak-test's live GET readback. |
| `initDemo(overrides)` | `src/inference.js initInference` | `config.inference.weights` merge | ✓ WIRED | Unchanged this pass. |
| `local-receiver/server.js` | shipped `dist/sdk.js` | (must NOT be linked) | ✓ CONFIRMED ABSENT | Independently rebuilt `dist/sdk.js` this pass; `check-bundle-purity.mjs` PASS. |
| Concurrent `POST /weights` requests | single `weightsPath` destination | `writeQueue` promise chain (new this pass) | ✓ WIRED | Independently stress-tested at 8-way concurrency, 20 trials, 160 total requests — every write+rename+response serialized correctly, zero corrupted/mixed writes, zero unexpected 500s. |

### Behavioral Spot-Checks / Live Execution (independently run this pass, not re-read from commit messages or 05-REVIEW-FIX.md)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Concurrent-POSTs regression test, isolated | `npx vitest run tests/local-receiver.test.js -t "concurrent POSTs"` × 10 | 10/10 pass | ✓ PASS (previously ⚠️ FLAKY — now resolved) |
| Full Vitest suite | `npm test` × 8 | 8/8 runs, 88/88 pass each | ✓ PASS (previously ⚠️ FLAKY on 1/6 runs — now resolved) |
| 8-way concurrent-POST stress test (beyond regression test's 2-way scope) | Custom script against `createReceiver()`, 20 trials | 20/20 trials, 160/160 requests 200 OK, on-disk file always one whole valid result, never mixed | ✓ PASS (new check this pass, not run previously) |
| Playwright e2e | `npx playwright test` | 6/6 passed | ✓ PASS |
| Build + bundle purity | `npm run build` | esbuild + `postbuild` purity check both exit 0; `dist/sdk.js` 13.7kb | ✓ PASS |
| Soak test (SC2+SC3) | `node local-receiver/server.js` (bg) + `node admin/soak-test-weights.mjs` | Both gates GATE PASS for all 4 canonical signals; exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| WEIGHT-01 | 05-01 through 05-05 (all 5 plans) | Real local weight-push receiver — persists session-end POST, `sdk.js` cold-start reads the file if present, falls back otherwise | ✓ SATISFIED | All 4 SC evidenced above, including the now-closed concurrency gap. `.planning/REQUIREMENTS.md` line 104 now reads `Complete` — the staleness flagged in the prior verification pass has been resolved. |

No orphaned requirements — `.planning/REQUIREMENTS.md` maps only WEIGHT-01 to Phase 5, and all 5 plans declare `requirements: [WEIGHT-01]`.

### Anti-Patterns Found

None. `git show 1018644 -- local-receiver/server.js` (the fix commit) introduces no `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers. No new anti-patterns found in this pass's re-reads of `local-receiver/server.js`.

### Human Verification Required

None. The single item that previously routed to human verification (the WR-02 concurrent-POST race) has been independently re-verified as closed by this pass, at a higher confidence bar (10 isolated runs, 8 full-suite runs = 704 individual test executions, and a 160-request 8-way stress test) than the original flake was caught at.

### Gaps Summary

None. All 4 ROADMAP success criteria are verified with independently re-executed evidence. The one open item from the prior verification pass — the WR-02 residual concurrency race causing an intermittent (~15-30%) 500 on one of two concurrent `POST /weights` requests on Windows — is confirmed closed by commit `1018644`'s single-writer `writeQueue` serialization. This re-verification pushed well past the sample size that originally caught the flake (10 isolated runs + 8 full-suite runs + a 160-request, 8-way concurrency stress test, all 0 failures) and reviewed the fix commit's diff directly rather than trusting the commit message or 05-REVIEW-FIX.md's claim. Phase 5's goal — the on-device learning loop closes across sessions, weights persist and are picked up on cold start, and persistence failure never corrupts the pipeline, now including under concurrent load — is achieved.

---

_Verified: 2026-07-20T14:45:00Z_
_Verifier: Claude (gsd-verifier)_
