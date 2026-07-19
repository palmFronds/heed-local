---
phase: 04-response-overlay-logging
reviewed: 2026-07-19T18:29:35Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - config/demo-platform.json
  - config/schema.json
  - src/config.js
  - src/index.js
  - src/log.js
  - src/response.js
  - src/signal.js
  - test-harness/index.html
  - tests/config.test.js
  - tests/e2e/harness.spec.js
  - tests/log.test.js
  - tests/response.test.js
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-07-19T18:29:35Z
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Reviewed the response-overlay and logging phase: `src/response.js`, `src/log.js`,
`src/config.js`'s array-type validation fix, and the supporting config/schema/test-harness
files. The No-PII firewall discipline holds in both `src/response.js` and `src/log.js` — no
`.value`/`.textContent`/`.innerHTML`/`localStorage`/`document.cookie` reads found anywhere in
either module, and the `discount_offer` `postMessage` call correctly uses
`activeConfig.partnerOrigin` (never `'*'`), verified by both `tests/response.test.js` and
`tests/e2e/harness.spec.js`. The `flow:complete` + `pagehide` dual-trigger session-lifecycle
wiring in `src/log.js` is sound — `EventTarget.dispatchEvent` and native DOM event dispatch are
both synchronous in a single-threaded JS runtime, so the `sessionEnded` guard cannot race; I
traced both orderings and found no double-fire path.

However, the array-type validation fix in `src/config.js` (CFG-02) is incomplete: it fixed the
`typeof [] === 'object'` bypass for `{ type: 'array' }` schema nodes, but left a **symmetric and
more severe** bug unfixed for `{ type: 'object' }` schema nodes — a `null` config value for an
object-typed field is silently treated as passing the type check (because `typeof null ===
'object'` short-circuits the whole guard clause before the null-exclusion special case is even
evaluated), and then crashes the validator with a raw, uncaught `TypeError` instead of the
intended structured `[heed] Invalid config` error. I reproduced this directly (see CR-01). A
related, narrower gap allows an array to silently pass validation where an object was expected,
whenever the schema node has no `required` array (WR-01).

## Critical Issues

### CR-01: `null` value for an object-typed config field crashes validateConfig() with a raw TypeError instead of the intended structured hard-fail

**File:** `src/config.js:16-24`
**Issue:**

The type-check guard is:

```js
if (
  schemaNode.type &&
  typeof value !== schemaNode.type &&
  !(schemaNode.type === 'object' && value !== null && typeof value === 'object') &&
  !(schemaNode.type === 'array' && Array.isArray(value))
) {
  errors.push(`${path}: expected type "${schemaNode.type}", got "${typeof value}"`);
  return;
}
```

When `schemaNode.type === 'object'` and `value === null`, the second conjunct
(`typeof value !== schemaNode.type`) is **already `false`** — `typeof null` is `'object'`, which
equals `schemaNode.type`. Because `&&` short-circuits left-to-right, the whole condition
evaluates to `false` without ever reaching the null-exclusion clause
(`value !== null && typeof value === 'object'`). That clause is dead code for exactly the case it
was written to guard against. So a `null` value for any object-typed field (e.g.
`config.selectors: null`) passes the type check silently, and `walk()` falls through into:

```js
for (const key of schemaNode.required ?? []) {
  if (!(key in value)) errors.push(...);   // `key in null` throws TypeError
}
```

which throws `TypeError: Cannot use 'in' operator to search for "X" in null` — an unhandled,
uncontrolled crash, not the aggregated `[heed] Invalid config — refusing to initialize:` error
this module's entire purpose (per its own header comment) is to guarantee. Confirmed by direct
reproduction:

```
$ node --input-type=module -e "
import { validateConfig } from './src/config.js';
const schema = { type:'object', required:['selectors'],
  properties:{ selectors:{ type:'object', required:['a'], properties:{ a:{type:'string'} } } } };
validateConfig({ selectors: null }, schema);
"
TypeError: Cannot use 'in' operator to search for 'a' in null
```

This is directly reachable from a realistic partner-authored `config/*.json` (e.g. a template
where a field was left as a JSON `null` placeholder instead of an object), and it defeats CFG-02's
explicit "always throws [a structured error] on any violation" contract — callers that expect to
pattern-match on `error.message` (e.g. to show a partner-friendly diagnostic) instead get an
opaque native `TypeError` from deep inside the validator. `tests/config.test.js` does not cover
this case (it only exercises wrong-type non-null values), which is why it shipped.

**Fix:** Make the per-type check explicit instead of relying on `typeof` equality with bolted-on
exceptions, so `null` is rejected the same way for every type, including `'object'`:

```js
function walk(value, schemaNode, path, errors) {
  if (schemaNode.type) {
    const expected = schemaNode.type;
    const matches =
      expected === 'object'
        ? value !== null && typeof value === 'object' && !Array.isArray(value)
        : expected === 'array'
          ? Array.isArray(value)
          : typeof value === expected;

    if (!matches) {
      const got = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
      errors.push(`${path}: expected type "${expected}", got "${got}"`);
      return; // don't recurse into a value whose base type is already wrong
    }
  }
  ...
```

Also add a regression test to `tests/config.test.js`:

```js
it('hard-fails (throws the structured config error, not a raw TypeError) when an object-typed field is null', () => {
  expect(() => validateConfig({ ...validPartialConfig, selectors: null }, schema)).toThrow(
    /expected type "object"/
  );
});
```

## Warnings

### WR-01: array values silently pass validation for object-typed schema nodes with no `required` array

**File:** `src/config.js:16-24, 26-33`
**Issue:** With the same guard clause as CR-01, an array value passed where `{ type: 'object' }`
is expected also incorrectly passes the type check (`typeof [] === 'object'` and
`value !== null` both true), because — unlike the null case — nothing downstream forces an
error *unless* the schema node also declares `required` fields. Confirmed:

```
$ node --input-type=module -e "
import { validateConfig } from './src/config.js';
const schema = { type:'object', properties:{ inference:{ type:'object',
  properties:{ confidenceThreshold:{type:'number'} } } } };
const result = validateConfig({ inference: [] }, schema);
console.log(result); // { inference: [] } — no throw
"
```

`config/schema.json`'s `inference`, `signals`, and `responses` nodes all declare `properties`
but no `required` array, so an array value for any of them (e.g. `config.inference: []`) is
silently accepted as a valid config today. This is the same class of bug the array/object
type-confusion fix in this file was meant to close — it just closed the mirror-image case
(`{ type: 'array' }` schema node given a plain object) rather than this one.

**Fix:** Covered by the same fix as CR-01 — adding `&& !Array.isArray(value)` to the object-type
match makes arrays fail the object type check unconditionally, regardless of whether the schema
node declares `required`.

### WR-02: header comment claims `additionalProperties` is implemented; it isn't

**File:** `src/config.js:2`
**Issue:** The file's own header states: `// Implements only: type, required, properties, enum,
additionalProperties.` — but `additionalProperties` is never referenced anywhere in the
implementation (`walk()` only iterates `schemaNode.properties` keys that are present in `value`;
it never checks `value` for keys *not* declared in `schemaNode.properties`). This means a
partner config with a misspelled or unexpected key (e.g. `"selecters"` instead of `"selectors"`,
alongside a coincidentally-valid `"selectors"`) is not rejected, contradicting the "reject
anything wrong, never soft-fail" design intent this module advertises for itself. Not currently
exploitable via `config/schema.json` (which sets no `additionalProperties: false` anywhere), but
the comment actively misleads a future maintainer into believing unknown-key rejection already
exists.

**Fix:** Either implement `additionalProperties: false` checking (walk `Object.keys(value)` and
flag any key absent from `schemaNode.properties` when `schemaNode.additionalProperties === false`),
or correct the header comment to `// Implements only: type, required, properties, enum.` so the
documented contract matches the code.

### WR-03: `tests/response.test.js` has no DOM cleanup between tests, masked only by a module-level singleton guard

**File:** `tests/response.test.js:44-65` (and throughout the file)
**Issue:** The first test appends a `#host-sentinel` div to `document.body` and calls
`initResponse(CONFIG, 'session-1')`, which creates the one-and-only overlay container (guarded by
`src/response.js`'s `initialized` flag). No `afterEach`/`beforeEach` in this file resets
`document.body.innerHTML`, so `#host-sentinel` and every rendered `[data-heed-response]` bubble
from earlier tests remain in the live DOM for the rest of the file. This currently "works" only
because `container` is a true singleton (subsequent `initResponse()` calls in later tests hit the
`if (initialized) return;` guard and reuse the same container, and `dismissCurrent`/reset-on-reinit
correctly clear the *current* bubble before each new `publish`). But the test file's assertions
rely on `document.querySelector` (single match) rather than scoping to a container reference
obtained at test start, so any future test that adds a second `document.querySelectorAll(...)`
length assertion, or reorders tests, will silently pick up stale elements from a prior test's DOM
mutations and produce a flaky, hard-to-diagnose failure.

**Fix:** Add cleanup to isolate each test's DOM state:

```js
afterEach(() => {
  document.body.innerHTML = '';
});
```

(Note: this alone won't reset `src/response.js`'s module-level `container`/`current`/`initialized`
variables, which persist across tests in the same file by design per the file's own comments —
but clearing `document.body` at minimum prevents leftover sentinel/bubble elements from earlier
tests being mistaken for current-test output.)

## Info

### IN-01: `config/schema.json` declares an unused `responses` config surface

**File:** `config/schema.json:10`
**Issue:** `"responses": { "type": "object" }` is declared as a valid top-level config field, but
nothing in `src/` ever reads `config.responses` — `src/response.js` hardcodes all four response
types' copy in its own `COPY`/`INTENT_TO_TYPE` maps per an explicit "not config-driven this phase
(D-04)" comment. A partner integrator reading `schema.json` could reasonably assume setting
`config.responses` customizes copy; it silently does nothing.
**Fix:** Either remove the `responses` schema property until it's wired up, or add a comment in
`schema.json`/`CONTRACT.md` noting it's reserved for a future phase and currently inert.

### IN-02: magic numbers for bubble sizing in `src/response.js`

**File:** `src/response.js:161-162`
**Issue:** `bubbleWidth = Math.min(358, window.innerWidth - 2 * EDGE)` and
`bubbleHeight = responseType === 'discount_offer' ? 112 : 80` use unnamed literals, inconsistent
with the file's own convention of naming `GAP`, `EDGE`, and `AUTO_DISMISS_MS` as constants.
**Fix:** Extract `MAX_BUBBLE_WIDTH = 358`, `BUBBLE_HEIGHT_DEFAULT = 80`,
`BUBBLE_HEIGHT_WITH_CTA = 112` as named module-level constants alongside the existing ones.

### IN-03: redundant guard duplicated between the `pagehide` listener and `finishSession()`

**File:** `src/log.js:127-129`
**Issue:**
```js
window.addEventListener('pagehide', () => {
  if (!sessionEnded) finishSession(false, 'flow_abandoned');
});
```
`finishSession()` itself already starts with `if (sessionEnded) return;` (line 78), so the outer
`if (!sessionEnded)` check is dead weight — harmless, but it duplicates the guard logic in two
places, and a future edit to one without the other could silently diverge.
**Fix:** Drop the redundant outer check; `window.addEventListener('pagehide', () =>
finishSession(false, 'flow_abandoned'));` is equivalent and keeps the guard in one place.

---

_Reviewed: 2026-07-19T18:29:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
