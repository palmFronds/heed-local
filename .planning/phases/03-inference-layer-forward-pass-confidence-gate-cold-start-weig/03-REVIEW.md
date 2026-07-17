---
phase: 03-inference-layer-forward-pass-confidence-gate-cold-start-weig
reviewed: 2026-07-17T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - package.json
  - config/schema.json
  - admin/generate-weights.mjs
  - admin/weights.js
  - tests/inference.test.js
  - tests/inference-endsession.test.js
  - src/inference.js
  - src/index.js
  - admin/check-bundle-purity.mjs
  - admin/print-softmax-margins.mjs
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-07-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

The hand-written forward pass (`forwardPass`/`relu`/`softmax`) was traced by hand against the
`INF02_WEIGHTS` fixture and independently re-derived: weight orientation, ReLU, max-subtraction
softmax, and the `gradientStep` backprop math (standard softmax+cross-entropy `p - t` output
delta, correctly backpropagated through `W2` with the genuine ReLU derivative) are all
mathematically correct. `brain.js` is confined to `admin/generate-weights.mjs` and never imported
by anything reachable from `src/index.js`'s import graph — confirmed by reading every import in
`src/inference.js` and `admin/weights.js` (the latter is plain generated JSON-as-JS, no import at
all).

The one confirmed **Critical** bug is a closure-capture staleness bug in `initInference`:
`activeWeights` is correctly re-resolved on every call (matches the documented INF-05 contract),
but `confidenceThreshold` is read from the `config` parameter closed over by the `signal:detected`
handler, which is only registered on the *first* `initInference()` call. Every subsequent
`initInference(newConfig)` call silently keeps using the first call's threshold. No existing test
catches this because every fixture in `tests/inference.test.js` happens to use `confidenceThreshold:
0.65` (including the implicit default), so the staleness is invisible today but will misfire the
first time two different thresholds are used across repeat `init()` calls — which the SDK's own
docstring explicitly claims is safe ("Safe to call repeatedly").

Several further issues around weak/missing schema validation for injected cold-start weights,
`endSession`'s loose boolean handling, stale `lastInference` across re-init, and un-enforced
verification tooling are documented below as Warnings.

## Critical Issues

### CR-01: `confidenceThreshold` is frozen to the first `initInference()` call's config, never re-resolved on repeat calls

**File:** `src/inference.js:186-228` (specifically line 202 inside the closure registered at line 197)
**Issue:**
`initInference` re-resolves `activeWeights` unconditionally on every call (line 192), but the
`signal:detected` handler that reads `confidenceThreshold` is only ever *registered* once, guarded
by the `initialized` flag (lines 194-195):

```js
export function initInference(config) {
  activeWeights = config.inference?.weights ?? coldStartWeights;   // re-resolved every call

  if (initialized) return;      // <-- subscribe() below only ever runs on the FIRST call
  initialized = true;

  subscribe('signal:detected', (payload) => {
    ...
    const threshold = config.inference?.confidenceThreshold ?? 0.65;   // closes over the FIRST call's `config`
    const fires = confidence >= threshold;
    ...
  });
}
```

Because the handler closure captures the `config` parameter binding from whichever call first ran
`subscribe(...)`, every later `initInference(otherConfig)` call updates `activeWeights` (module-scoped,
read live inside the closure) but **silently keeps using the original call's `confidenceThreshold`**
— the docstring's claim "weights are re-resolved every call (INF-05)... Safe to call repeatedly" is
only true for weights, not for the threshold that gates `fires`.

This is not hypothetical: `src/index.js`'s `init()`/`initDemo()` are both plausible to be called more
than once in one page lifetime (e.g. a harness that inits a demo config then re-inits with a real
partner config, or any future SPA/multi-tenant scenario), and nothing in this phase resets or warns
against it. No test currently catches this because every config fixture across
`tests/inference.test.js` uses the same `0.65` value (explicitly or via the shared default), so the
staleness is numerically invisible today.

**Fix:** Mirror the `activeWeights` pattern — store the whole config in a module-scoped variable that
is reassigned on every call, and read the threshold from that inside the handler instead of closing
over the parameter:

```js
let activeConfig = null;

export function initInference(config) {
  activeConfig = config;
  activeWeights = config.inference?.weights ?? coldStartWeights;

  if (initialized) return;
  initialized = true;

  subscribe('signal:detected', (payload) => {
    const input = oneHot(payload.type);
    const { probs } = forwardPass(input, activeWeights);
    const predictedIdx = argmax(probs);
    const confidence = probs[predictedIdx];
    const threshold = activeConfig.inference?.confidenceThreshold ?? 0.65;
    const fires = confidence >= threshold;
    ...
  });
}
```

## Warnings

### WR-01: No shape validation on `config.inference.weights`; malformed injected weights silently produce NaN instead of a clear error

**File:** `config/schema.json:47-53`; `src/inference.js:50-56` (`forwardPass`)
**Issue:** `config/schema.json`'s `inference.weights` schema is `{ "type": "object" }` — it accepts
any object at all, never checking that `W1`/`b1`/`W2`/`b2` exist or have the 4x4/4 shapes
`forwardPass` assumes. `forwardPass` itself has no defensive checks either: if a partner-injected
weights object is missing a key or has a mismatched dimension, `row.reduce((sum, w, k) => sum + w *
input[k], b1[i])` silently multiplies by `undefined` (`w * undefined === NaN`), and NaN propagates
silently through `softmax` (a NaN logit still produces a numeric-looking, non-thrown output — every
`probs` entry becomes `NaN`). Downstream, `confidence >= threshold` evaluates to `false` for any
NaN confidence, and `argmax` (all comparisons against NaN are false) always resolves to index 0 —
so a malformed weights config silently and consistently misclassifies as `CLASSES[0]` with
`fires: false` rather than failing loudly at `validateConfig` time, which is exactly the "hard-fail,
never partial/silent" contract `src/config.js`'s header comment and `src/index.js`'s CFG-02 comment
both claim for the rest of config validation.
**Fix:** Extend `config/schema.json`'s `inference.weights` (or add a bespoke check in
`validateConfig`/`initInference`) to require `W1`, `b1`, `W2`, `b2` are present and array-shaped
before accepting them, e.g. reject/log clearly if `Array.isArray(weights.W1) === false` or row
lengths don't match the expected 4x4 shape.

### WR-02: `endSession`'s `outcome` uses strict `=== false`, silently treating any non-boolean as "success"

**File:** `src/inference.js:128-136` (`buildTarget`), called from `src/inference.js:249`
**Issue:** `buildTarget` branches with `if (outcome === false)`. Anything that isn't the literal
boolean `false` — `undefined` (e.g. a caller bug that omits the second argument), `0`, `null`, or a
stray truthy value — falls through to the "completed successfully" branch and softens the
prediction toward uniform `[0.25, 0.25, 0.25, 0.25]`. Since `endSession` is documented as the
function Phase 4 will wire directly to real host-page session-end events, a caller passing an
unexpected value (e.g. forgetting the second argument entirely) fails silently into the wrong
training branch instead of surfacing the mistake.
**Fix:** Either validate the input explicitly (`if (typeof outcome !== 'boolean') throw new
TypeError(...)`) or branch on the positive case instead of the negative one so the safer branch is
the default: `return outcome === true ? CLASSES.map(() => 0.25) : CLASSES.map((_, i) => (i ===
predictedIdx ? 1 : 0));` — pick one and document why an unrecognized value should fail loudly rather
than defaulting to "success."

### WR-03: `lastInference` is never reset on re-init — a later `endSession()` can silently train on a stale, unrelated prior session's signal

**File:** `src/inference.js:91-99, 186-196, 246-253`
**Issue:** `initInference()` resets `activeWeights` every call (line 192) but never touches
`lastInference` (module-scoped, line 95). `endSession`'s documented "safe no-op" guard is `if
(!lastInference) return;` (line 247) — but that only protects the very first session ever, before
any signal has fired. If `initInference()` is called again later (e.g. a new page/session in the
same SDK instance, or the SPA re-init path already anticipated elsewhere in this codebase for
`signal.js`), `lastInference` still holds the `{input, predictedIdx}` from the *previous* session's
last signal. Calling `endSession()` for the *new* session before any new signal has fired will
therefore not be the documented no-op — it will silently perform a real gradient step using a
signal from an unrelated, already-concluded prior session.
**Fix:** Reset `lastInference = null;` at the top of `initInference()` alongside the `activeWeights`
reassignment, so each (re-)init starts with a genuinely clean "no signal fired yet this session"
state.

### WR-04: Bundle-purity and margin-quality gates exist but are not wired into any script or CI step

**File:** `package.json:7-11`; `admin/check-bundle-purity.mjs`; `admin/print-softmax-margins.mjs`
**Issue:** Both `admin/check-bundle-purity.mjs` (guards against `brain.js` leaking into
`dist/sdk.js`) and `admin/print-softmax-margins.mjs` (guards against a degenerate/saturated
cold-start distribution) are well-written, exit-code-driven gates — but `package.json`'s `scripts`
block only defines `test`, `build`, and `generate-weights`. Neither verification script is
referenced anywhere (no `postbuild`, no `pretest`, no documented CI step), so both are inert unless
a developer remembers to run them by hand. This defeats their purpose as an enforced gate against
exactly the regression class this phase cares most about (`03-RESEARCH.md`'s Common Pitfall #4:
brain.js leaking into the shipped bundle).
**Fix:** Add e.g. `"postbuild": "node admin/check-bundle-purity.mjs"` to `package.json`'s scripts so
`npm run build` fails the build the moment a future change reintroduces `brain.js` into the bundle,
and reference `print-softmax-margins.mjs` from the weight-regeneration workflow (e.g. as part of
`generate-weights` or a documented manual step immediately after it).

### WR-05: `build` script omits `--minify`, shipping an unminified bundle with full source/comments

**File:** `package.json:9`
**Issue:** `"build": "esbuild src/index.js --bundle --format=iife --global-name=Heed --outfile=dist/sdk.js"`
has no `--minify` flag. Given the SDK ships as a single flat `<script>` file dropped directly onto a
partner's page (per CLAUDE.md/the project's own recommended stack notes), this means the full
source — including every doc-comment in `src/inference.js`, `src/signal.js`, etc. — is shipped
verbatim to every partner site, unnecessarily inflating payload size and exposing internal
implementation detail/commentary that a minified build would strip.
**Fix:** Add `--minify` to the build script (`esbuild src/index.js --bundle --format=iife
--global-name=Heed --minify --outfile=dist/sdk.js`), consistent with the project's own documented
stack recommendation.

## Info

### IN-01: `check-bundle-purity.mjs`'s forbidden-string list is narrow

**File:** `admin/check-bundle-purity.mjs:15`
**Issue:** `FORBIDDEN_STRINGS = ['NeuralNetworkGPU', 'thaw']` is a reasonable proxy today (brain.js's
UMD bundle is not tree-shakeable, so any import pulls the whole file in, including these strings),
but it's an indirect signal rather than checking for `brain.js`'s own identifying markers directly
(e.g. its package name/version banner, or the `NeuralNetwork` class name itself guarded by a
brain.js-specific comment format).
**Fix:** Consider also asserting on a more direct marker (e.g. a distinctive brain.js license/banner
string) for defense in depth, in case a future brain.js version changes internal class naming.

### IN-02: `endSession`'s `config` parameter is unused

**File:** `src/inference.js:241-253`
**Issue:** `config` is accepted but never read in the function body; the docstring explains it's
"reserved for a future config-driven learning-rate override," which is a reasonable forward-looking
API decision, but as written it's dead weight this phase and could mask a future caller-side bug
(e.g. passing the wrong object) since nothing validates it.
**Fix:** No action required now; consider either removing the parameter until Phase 5 needs it, or
adding an eslint-disable/`void config;` marker so the "currently unused" state is explicit rather
than implicit.

### IN-03: `confidenceThreshold` has no range constraint in schema

**File:** `config/schema.json:50`
**Issue:** `"confidenceThreshold": { "type": "number" }` accepts any number, including negative
values or values greater than 1. Since `probs` entries are always in `[0,1]`, a threshold outside
that range would make `fires` unconditionally `true` (threshold ≤ 0) or unconditionally `false`
(threshold > 1) for every signal, silently disabling or always-triggering the confidence gate.
**Fix:** Add `"minimum": 0, "maximum": 1` to the `confidenceThreshold` schema property.

### IN-04: Test helper `collectInferenceResults()` never unsubscribes, accumulating listeners across `it()` blocks

**File:** `tests/inference.test.js:130-134`; `tests/inference-endsession.test.js:48-52`
**Issue:** `subscribe('inference:result', ...)` returns an unsubscribe function (per `src/bus.js`)
that neither test file's `collectInferenceResults()` helper ever calls. Within a single test file,
every `it()` block that calls this helper adds one more permanent listener to the module-scoped
`EventTarget` in `src/bus.js`, all of which keep firing (into now-unread arrays) for the rest of the
file's test run. This doesn't currently cause assertion failures (each test only reads its own
`received` array), but it is a latent listener leak, and it's also the reason the CR-01
closure-capture bug went undetected — every `initInference()` call in these files reuses the same
`0.65` threshold, so the frozen-closure behavior never diverges from the intended behavior in any
existing test.
**Fix:** Call and store the unsubscribe function returned by `subscribe(...)` and invoke it in an
`afterEach`, and consider adding a dedicated regression test that calls `initInference()` twice with
two different `confidenceThreshold` values to directly cover CR-01's contract going forward.

---

_Reviewed: 2026-07-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
