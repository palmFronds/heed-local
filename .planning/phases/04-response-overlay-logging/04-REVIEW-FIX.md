---
phase: 04-response-overlay-logging
fixed_at: 2026-07-19T18:37:32Z
review_path: .planning/phases/04-response-overlay-logging/04-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-07-19T18:37:32Z
**Source review:** .planning/phases/04-response-overlay-logging/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical + Warning; Info findings IN-01/IN-02/IN-03 out of scope per `fix_scope: critical_warning`)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: `null` value for an object-typed config field crashes validateConfig() with a raw TypeError instead of the intended structured hard-fail

**Files modified:** `src/config.js`, `tests/config.test.js`
**Commit:** `1325d38`
**Applied fix:** Rewrote `walk()`'s type-check guard clause to compute an explicit `matches` boolean per expected type instead of relying on `typeof value !== schemaNode.type` with bolted-on exceptions. For `type: 'object'`, the check is now `value !== null && typeof value === 'object' && !Array.isArray(value)`, so `null` (and arrays) are unconditionally rejected rather than passing through the short-circuited `typeof null === 'object'` case. The error message now reports `"null"` or `"array"` explicitly instead of falling back to `typeof value`. Added a regression test (`CR-01` describe block) reproducing the exact repro from the review: `validateConfig({ selectors: null }, schema)` now throws `expected type "object"` instead of an uncaught `TypeError: Cannot use 'in' operator to search for "a" in null`. Verified via direct reproduction in the fixed code (throws the structured `[heed] Invalid config` error) and via the full `tests/config.test.js` suite (12/12 passing).

### WR-01: array values silently pass validation for object-typed schema nodes with no `required` array

**Files modified:** `tests/config.test.js` (code fix already applied by CR-01's commit)
**Commit:** `993ecf5`
**Applied fix:** The review noted this is "covered by the same fix as CR-01" — the `!Array.isArray(value)` addition to the object-type match (applied in commit `1325d38`) already makes arrays fail the object type check unconditionally, regardless of whether the schema node declares `required`. Verified directly: `validateConfig({ inference: [] }, objSchema)` (no `required` array on the `inference` node) now throws `expected type "object", got "array"` instead of silently passing. Added a dedicated `WR-01` regression test reproducing the review's exact repro case to lock in the fix and document the finding as resolved.

### WR-02: header comment claims `additionalProperties` is implemented; it isn't

**Files modified:** `src/config.js`
**Commit:** `087d43a`
**Applied fix:** Chose the "correct the comment" option (of the two offered in the Fix section) since `config/schema.json` never sets `additionalProperties: false` anywhere, so implementing real enforcement would be a behavior-inert change carrying unnecessary risk for this pass. Updated the header comment from `// Implements only: type, required, properties, enum, additionalProperties.` to `// Implements only: type, required, properties, enum.` so the documented contract now matches the actual implementation. Verified via syntax check and full test suite (12/12 `config.test.js` tests still passing — comment-only change).

### WR-03: `tests/response.test.js` has no DOM cleanup between tests, masked only by a module-level singleton guard

**Files modified:** `tests/response.test.js`
**Commit:** `66e71c4`
**Applied fix:** Adapted the review's literal suggestion (`afterEach(() => { document.body.innerHTML = ''; })`) because applying it verbatim broke 7 of 12 tests in the file: `src/response.js`'s overlay container is injected into `document.body` exactly once (guarded by the module-level `initialized` singleton) and is never re-appended on later `initResponse()` calls, so wiping the entire body detaches that singleton container from the live document while `response.js` continues rendering into the now-stale in-memory reference — every later `document.querySelector('[data-heed-overlay] ...')` assertion then finds nothing. Instead, added an `afterEach` that removes only body children that are NOT the `[data-heed-overlay]` singleton container, which discards stray host-DOM elements a test appended directly to body (e.g. RESP-01's `#host-sentinel`) while leaving the container — and the bubbles rendered inside it — intact. Verified the full `tests/response.test.js` suite passes (12/12) after the change, and the full project test suite (77/77 across all 10 test files) has no regressions.

## Skipped Issues

None — all in-scope findings were fixed.

---

_Fixed: 2026-07-19T18:37:32Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
