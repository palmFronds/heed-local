---
phase: 05-weight-push-learning-loop
fixed_at: 2026-07-20T14:10:00Z
review_path: .planning/phases/05-weight-push-learning-loop/05-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-07-20T14:10:00Z
**Source review:** .planning/phases/05-weight-push-learning-loop/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (2 Critical + 4 Warning; Info findings IN-01/IN-02 out of scope per `fix_scope: critical_warning`)
- Fixed: 6
- Skipped: 0

## Fixed Issues

### CR-01: Receiver's request-error handler can double-respond and crash the process on the size-limit path

**Files modified:** `local-receiver/server.js`, `tests/local-receiver.test.js`
**Commit:** `c46866a`
**Applied fix:** Guarded the `req.on('error', ...)` handler with a check on `destroyed || res.headersSent` before writing a response, so it no-ops if a response (e.g. the 413 body-too-large path) already completed on this request instead of throwing `ERR_HTTP_HEADERS_SENT`. Added a regression test in `tests/local-receiver.test.js` that POSTs a body larger than `MAX_BODY_BYTES` and asserts the server stays up and answers a subsequent request — the size-limit path previously had zero coverage. Verified via `npm test` (full suite green, no regressions).

### CR-02: `init()` attaches DOM signal-capture listeners before validating `config.inference.weights`, leaving the host page instrumented even when init() throws

**Files modified:** `src/index.js`, `src/inference.js`, `tests/config.test.js`
**Commit:** `530eee1`
**Applied fix:** Moved `validateWeightsShape()` (exported from `src/inference.js`) ahead of `initSignalCapture()` in `init()`, so a malformed `config.inference.weights` now hard-fails before any DOM wiring occurs — restoring the file's documented invariant "Signal listeners attach only AFTER hard-fail validation passes." Added a regression test asserting no listeners attach when `init()` is called with malformed weights. Verified via `npm test`.

### WR-01: `config/schema.json` never sets `additionalProperties: false`, so typo'd/malformed config keys silently pass validation

**Files modified:** `config/schema.json`, `src/config.js`, `tests/config.test.js`
**Commit:** `0b1a98d`
**Applied fix:** Added `"additionalProperties": false` to the top-level schema and to `selectors`, `signals`, `signals.touchHesitation`, `signals.scrollReversal`, and `inference` nodes, and extended `src/config.js`'s `walk()` to enforce it — rejecting any key present on the value that isn't declared in `schemaNode.properties` when `additionalProperties === false`. Added a regression test reproducing a typo'd config key (e.g. `weightPushUrll`) and asserting it now hard-fails instead of silently passing. Verified via `npm test`.

### WR-02: Receiver's temp-file write path is not per-request, allowing concurrent POSTs to corrupt the persisted weights

**Files modified:** `local-receiver/server.js`
**Commits:** `864edee` (initial fix), `1018644` (follow-up — see below)
**Applied fix:** Replaced the single shared `tmpPath` computed once per server instance with a unique per-request temp path (`${weightsPath}.${process.pid}.${Date.now()}.${random suffix}.tmp`), so concurrent POSTs each write-then-rename through their own temp file rather than racing on a shared one.

**Follow-up (found during `/gsd-verify-work`'s independent re-verification, not by this fixer pass):** The unique-temp-path fix alone was incomplete — both concurrent requests' `fs.rename()` calls still target the same shared `weightsPath` destination, and Windows can intermittently fail one of two renames to the same destination in quick succession (reproduced ~15-30% of the time, `AssertionError: expected 500 to be 200`, both in the full suite and in isolation). Commit `1018644` closes this by chaining every write+rename onto a single in-process `writeQueue` promise, making the persist step a true single-writer critical section rather than relying on filesystem-specific rename atomicity. Re-verified: 10/10 isolated `concurrent POSTs` runs and 6/6 full-suite runs (88/88 each) with zero flakiness after the follow-up.

### WR-03: `endSession`'s training signal reinforces the model's own prior prediction rather than any ground truth

**Files modified:** `.planning/STATE.md` (documentation only)
**Commit:** `ddb5e18`
**Applied fix:** This is an accepted design decision from planning (03-RESEARCH.md Assumption A1), not a code bug — the review's own suggested fix was to flag it explicitly rather than change behavior. Added an entry to STATE.md's Blockers/Concerns section documenting the self-reinforcing training loop as a known, accepted limitation, distinct from (but related to) the existing Phase-5-planning credit-assignment flag already recorded there. No code change; no test impact.

### WR-04: Soak test's cold-start/round-trip comparison depends on incidental JSON key ordering

**Files modified:** `admin/soak-test-weights.mjs`
**Commit:** `dfa8d01`
**Applied fix:** Added a `stableWeightsKey()` helper that explicitly normalizes `{W1, b1, W2, b2}` key order before `JSON.stringify`-based comparison, replacing the direct `JSON.stringify(persisted) !== JSON.stringify(coldStartWeights)` comparison. Verified the soak-test script still runs correctly end-to-end against a live receiver (SC2/SC3 gates both pass, exit 0).

## Skipped Issues

None — all in-scope findings (2 Critical + 4 Warning) were fixed. Info findings IN-01 (inconsistent receiver error response shapes) and IN-02 (duplicated CLASSES/SIGNAL_ORDER/argmax constants) were left as-is per `fix_scope: critical_warning` — both are minor, non-blocking nits explicitly out of scope for this pass.

---

_Fixed: 2026-07-20T14:10:00Z_
_Fixer: Claude (gsd-code-fixer, recovered by orchestrator after a stream-stall interruption)_
_Iteration: 1_
