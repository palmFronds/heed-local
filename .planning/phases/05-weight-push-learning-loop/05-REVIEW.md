---
phase: 05-weight-push-learning-loop
reviewed: 2026-07-20T13:40:14Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - admin/soak-test-weights.mjs
  - config/demo-platform.json
  - config/schema.json
  - local-receiver/server.js
  - src/index.js
  - src/inference.js
  - src/log.js
  - test-harness/index.html
  - tests/e2e/harness.spec.js
  - tests/index.test.js
  - tests/inference-endsession.test.js
  - tests/local-receiver.test.js
findings:
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-07-20T13:40:14Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed the weight-push learning loop end-to-end: the hand-rolled forward/backward pass in
`src/inference.js`, the session-lifecycle + weight-push wiring in `src/log.js`, the dev-only
local receiver, the demo harness bootstrap, and the associated soak-test/unit-test coverage.
The math in `forwardPass`/`gradientStep`/`softmax` is correct (verified the backprop derivation
by hand: softmax+cross-entropy output delta, ReLU-gated hidden delta, and the weight/bias update
signs all check out), and the session-lifecycle guards (`sessionEnded`, `initialized`,
`lastInference` reset-on-reinit) are consistent with their documented intent.

Two BLOCKER-tier issues were found: (1) the local receiver's request-error handler can attempt
to write HTTP headers a second time after already responding, which risks crashing the dev
receiver process on exactly the oversized/aborted-request path its own comments say must "never
throw into the process"; and (2) `src/index.js`'s `init()` wires DOM signal-capture listeners
*before* it validates `config.inference.weights`'s shape, so a config that fails deep weight
validation still leaves the host page instrumented even though `init()` throws and the caller
believes initialization failed. Four WARNING-tier issues cover a config-schema gap that lets
typo'd/malformed partner config keys silently pass validation, a race condition in the receiver's
shared temp-file write path, a self-referential (no ground-truth) training signal design risk in
`endSession`, and a key-order-dependent equality check in the soak test.

## Critical Issues

### CR-01: Receiver's request-error handler can double-respond and crash the process on the size-limit path

**File:** `local-receiver/server.js:96-156` (specifically the `req.on('error', ...)` handler at 150-155, interacting with the `MAX_BODY_BYTES` branch at 100-111)

**Issue:** When an incoming POST body exceeds `MAX_BODY_BYTES`, the `data` handler sets
`destroyed = true`, calls `res.writeHead(413); res.end();`, then `req.destroy()` (lines 103-109).
Node's `IncomingMessage` can still emit an `'error'` event after `.destroy()` is called on it
(e.g. the socket teardown races with more buffered bytes already in flight, or a genuinely
aborted/reset connection on the same request). The `req.on('error', ...)` handler at lines
150-155 does **not** check `destroyed` (or `res.headersSent`) before acting:

```js
req.on('error', () => {
  // Aborted/malformed request stream -- never throw into the process (T-05-01).
  destroyed = true;
  res.writeHead(400);
  res.end();
});
```

If this fires after the 413 response already completed (`res.writeHead(413); res.end();` already
ran), calling `res.writeHead(400)` again throws
`ERR_HTTP_HEADERS_SENT: Cannot set headers after they are sent to the client`. That exception is
thrown synchronously inside an event listener with no surrounding try/catch, so it becomes an
uncaught exception and can bring down the whole receiver process — the exact outcome the file's
own comment (`// never throw into the process (T-05-01)`) says must never happen. There is no
regression test exercising the oversized-body (413) path or a mid-stream client abort, so this
gap is currently unguarded by the test suite (`tests/local-receiver.test.js` only covers
malformed-JSON and shape-invalid bodies, not the size-limit path).

**Fix:**
```js
req.on('error', () => {
  if (destroyed || res.headersSent) return; // a response was already sent on this request
  destroyed = true;
  res.writeHead(400);
  res.end();
});
```
Also add a `tests/local-receiver.test.js` case that POSTs a body larger than `MAX_BODY_BYTES`
(and ideally simulates a mid-stream abort) and asserts the server stays up and answers a
subsequent request — the size-limit path currently has zero test coverage.

### CR-02: `init()` attaches DOM signal-capture listeners before validating `config.inference.weights`, leaving the host page instrumented even when init() throws

**File:** `src/index.js:22-49` (ordering of lines 34 and 38); root cause confirmed against `config/schema.json:51-57` and `src/config.js:15-44`

**Issue:** `init()` calls `initSignalCapture(config)` (line 34) *before* `initInference(config)`
(line 38). `initInference` is the function that performs the deep shape check on
`config.inference.weights` (`validateWeightsShape()` in `src/inference.js:97-111`, invoked at
line 234) and throws a hard `Error` if the shape is wrong. But `config/schema.json` only declares
`"weights": { "type": "object" }` (schema.json:55) — any object at all satisfies that — and
`src/config.js`'s hand-rolled interpreter (`walk()`) implements only `type`/`required`/
`properties`/`enum`, so `validateConfig()` at `src/index.js:23` cannot catch a malformed weights
matrix. That means:

1. `validateConfig(rawConfig, schema)` passes for a config with e.g. `inference.weights = { foo: 1 }`.
2. `initSignalCapture(config)` runs and attaches real `touchstart`/`blur`/`scroll`/`popstate`
   listeners to the host page (per `src/signal.js`'s `initialized` guard, these attach exactly
   once and are never detached).
3. `initInference(config)` then throws inside `validateWeightsShape()`, and that exception
   propagates out of `init()`.

From the caller's perspective, `init()` failed (it threw) — per the file's own comment at
`src/index.js:31-33`, "Signal listeners attach only AFTER hard-fail validation passes — never
instrument the DOM against an unvalidated config." That invariant is violated for exactly the
`config.inference.weights` case: the DOM is instrumented, then initialization is aborted. Because
`initSignalCapture`'s attach guard is a one-shot module flag, a caller that catches the thrown
error, fixes the weights, and calls `init()` again will find the *original* (already-attached)
listeners are the ones active — they were wired before validation ever completed, contradicting
CFG-02's "hard-fail, never partial/silent" design philosophy that the rest of this codebase
consistently follows.

**Fix:** Perform the weights-shape validation before any side-effecting wiring — either move
`initInference`'s validation ahead of `initSignalCapture`, or (better) fold the weights shape
check into `validateConfig`/`schema.json` itself so a single hard-fail gate covers the whole
config before *any* initializer runs:
```js
export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  if (config.inference?.weights) validateWeightsShape(config.inference.weights); // moved up, throws before any wiring
  const sessionId = crypto.randomUUID();
  initSignalCapture(config);
  initInference(config);
  initLogging(config, sessionId);
  initResponse(config, sessionId);
  return { config, publish, subscribe };
}
```
(`validateWeightsShape` would need to be exported from `src/inference.js` for this, or the check
duplicated/shared via a small schema addition.)

## Warnings

### WR-01: `config/schema.json` never sets `additionalProperties: false`, so typo'd/malformed config keys silently pass validation

**File:** `config/schema.json:1-59`

**Issue:** None of the `object`-typed schema nodes (top level, `selectors`, `signals`,
`inference`) set `"additionalProperties": false`. Combined with `src/config.js`'s interpreter
(which only checks declared `properties` and `required`, and silently ignores any key not listed
in `properties`), a partner config with a typo — e.g. `"weightPushUrll"` instead of
`"weightPushUrl"`, or `"confidenceThresholdd"` instead of `"confidenceThreshold"` — passes
`validateConfig()` without any error. The typo'd field is simply ignored and the SDK silently
falls back to defaults (no weight push ever fires; the 0.65 default confidence threshold is used
instead of the partner's intended value) with zero diagnostic signal. This directly contradicts
the "hard-fail, never partial/silent" philosophy documented at CFG-02 and repeated throughout
`src/inference.js`/`src/index.js`'s comments.

**Fix:** Add `"additionalProperties": false` to the top-level schema and to `selectors`,
`signals`, `signals.touchHesitation`, `signals.scrollReversal`, and `inference`, and extend
`src/config.js`'s `walk()` to enforce it (reject any key present on `value` that isn't in
`schemaNode.properties` when `additionalProperties === false`).

### WR-02: Receiver's temp-file write path is not per-request, allowing concurrent POSTs to corrupt the persisted weights

**File:** `local-receiver/server.js:55-56, 130-148`

**Issue:** `createReceiver()` computes a single shared `tmpPath = `${weightsPath}.tmp`` once per
server instance (line 56), and every POST handler writes to that same path before renaming it
onto `weightsPath` (lines 133-144). If two POST requests are in flight concurrently (e.g. two
browser tabs finishing a session at nearly the same time, or `admin/soak-test-weights.mjs` run
against a receiver that's also serving a live harness session), request A's `fs.writeFile(tmpPath, ...)`
can be overwritten mid-flight by request B's `fs.writeFile(tmpPath, ...)`, and the subsequent
`fs.rename` calls can then race, potentially persisting a mix of A's and B's writes or losing one
entirely. The write-then-rename pattern only guarantees atomicity for a *single* writer; it does
nothing to serialize concurrent writers sharing the same temp path.

**Fix:** Use a unique temp path per request (e.g. `${weightsPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`), or serialize POST handling behind a simple in-process write queue/mutex.

### WR-03: `endSession`'s training signal reinforces the model's own prior prediction rather than any ground truth

**File:** `src/inference.js:151-177` (`buildTarget`), used by `endSession` at 297-305

**Issue:** `buildTarget` builds its training target purely from `predictedIdx` — the class the
model itself just predicted — never from any independent signal of which intent was actually
correct. On the `outcome === false` (abandoned) path, the target one-hots exactly the class the
model already output for `lastInference`, so `gradientStep` always nudges the weights *toward*
whatever the model currently believes, regardless of whether that belief was right. This is a
self-referential/confirmation-bias training loop: an early, wrong classification for a given
signal type has no independent corrective force pushing it back toward the correct class — it can
only be reinforced (on abandon) or softened toward uniform (on completion), never corrected. The
16-session soak test (`admin/soak-test-weights.mjs`) only asserts no softmax collapse/saturation
over that short, alternating-outcome run (SC3) and does not test longer-run drift toward a
degenerate dominant-class predictor, which this design permits over many real sessions with the
same skewed outcome distribution.

**Fix:** This may be an accepted scope decision already (comments cite "03-RESEARCH.md
Assumption A1" as the documented rationale), but it's worth flagging explicitly in
STATE.md/PROJECT.md as a known limitation if not already tracked there, and/or extending the soak
test to run many more sessions with a skewed (not alternating) outcome distribution to confirm
the model doesn't collapse toward a single always-predicted class under realistic traffic
patterns.

### WR-04: Soak test's cold-start/round-trip comparison depends on incidental JSON key ordering

**File:** `admin/soak-test-weights.mjs:175-176`

**Issue:** The SC2 gate's "persisted weights differ from cold-start defaults" check does
`JSON.stringify(persisted) !== JSON.stringify(coldStartWeights)`. `JSON.stringify` output is
key-order-dependent, so this only works correctly because every object in this codebase happens
to be constructed with the same `{W1, b1, W2, b2}` key order everywhere. If any future code
constructs a weights object with keys in a different order (still semantically identical), this
gate could report a false "differs from cold-start" (or, more concerning, a false "identical")
result even when the actual numeric content matches/differs correctly.

**Fix:** Replace with an order-independent structural comparison, e.g. compare
`JSON.stringify({W1: w.W1, b1: w.b1, W2: w.W2, b2: w.b2})` for both sides (normalizing key order
explicitly), or a small recursive deep-equal helper.

## Info

### IN-01: `local-receiver/server.js`'s error responses are inconsistent in shape

**File:** `local-receiver/server.js:105-106, 135-136, 141-142, 152-154`

**Issue:** Some error paths return a JSON body with `Content-Type: application/json` and an
`{ error: '...' }` payload (e.g. malformed JSON at 121-124, invalid shape at 126-128), while
others (413 body-too-large at 105-106, 500 write/rename failures at 135-136/141-142, and the
`req.on('error')` 400 at 152-154) return a bare status code with no body or `Content-Type`. This
is a minor API-consistency nit for a dev-only tool but makes debugging a failed push harder than
necessary (curl/browser devtools show an empty response body instead of a reason).

**Fix:** Give every error path the same `{ 'Content-Type': 'application/json' }` + `{ error: '...' }` shape for consistency.

### IN-02: `CLASSES`/`SIGNAL_ORDER`/`argmax` are re-declared verbatim in `admin/soak-test-weights.mjs` instead of being exported from `src/inference.js`

**File:** `admin/soak-test-weights.mjs:25-26, 42-46`; mirrored in `src/inference.js:61-64, 81-85`

**Issue:** The comments in `admin/soak-test-weights.mjs` acknowledge these constants/helpers are
duplicated by necessity ("CLASSES and SIGNAL_ORDER are module-scoped (not exported) constants...
so both are re-declared here matching that file's values exactly"). This is a real drift risk:
if `src/inference.js`'s `CLASSES`/`SIGNAL_ORDER` order ever changes (e.g. a future phase adds a
5th signal type), every admin script that re-declares these constants silently goes stale with no
compiler/lint error to catch the mismatch — classification would break silently, which is exactly
the failure mode the comments warn about.

**Fix:** Consider exporting `CLASSES` and `SIGNAL_ORDER` (and `argmax`) from `src/inference.js`
and importing them in the admin scripts, eliminating the duplication and the drift risk entirely.

---

_Reviewed: 2026-07-20T13:40:14Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
