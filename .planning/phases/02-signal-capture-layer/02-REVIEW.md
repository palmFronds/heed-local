---
phase: 02-signal-capture-layer
reviewed: 2026-07-15T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - config/demo-platform.json
  - config/schema.json
  - src/index.js
  - src/signal.js
  - test-harness/index.html
  - tests/e2e/harness.spec.js
  - tests/signal.test.js
  - tests/signal-spa.test.js
findings:
  critical: 1
  warning: 5
  info: 3
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-07-15T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the signal-capture layer (`src/signal.js`, `src/index.js`), its config
contract (`config/schema.json`, `config/demo-platform.json`), the standalone
test harness, and the Vitest/Playwright suites that exercise it.

The touch/blur/scroll/popstate wiring, the WeakSet-based re-attachment
idempotency (SIG-06), and the PII-firewall shape of `buildPayload` are all
implemented consistently with the extensive inline design-decision comments,
and the unit/E2E tests do genuinely exercise the real DOM listeners (not a
`publish()` bypass).

However, one finding is a genuine correctness BLOCKER: the D-06 "flow
complete" visibility check only inspects the element's **inline** `style`
attribute, not its actual computed visibility. Any host page that hides the
completion screen via a CSS class or external stylesheet (the overwhelmingly
common pattern in real SPAs, and plausibly how Branch 1's dummy platform
itself works) will cause `flowCompleteFlag` to latch `true` on the very first
attach pass, permanently and silently disabling `back_intent` (SIG-04) for
the rest of the session. The current implementation only "works" because the
test fixture happens to hide the element with an inline `style="display:
none"` attribute that mirrors the exact property being checked.

Several additional robustness gaps exist around real-device touch handling
(zero movement tolerance before cancelling a hold, and a re-entrant timer
leak on overlapping `touchstart`s), a mildly PII-adjacent `pathname` field on
`back_intent`, and some config-schema redundancy/dead-code around the
duplicated `completionSelector` field.

## Critical Issues

### CR-01: `checkFlowComplete` only checks inline style, not actual visibility — breaks back_intent (SIG-04) on any CSS-class-hidden completion screen

**File:** `src/signal.js:228-235`
**Issue:**
```js
function checkFlowComplete(config) {
  if (flowCompleteFlag) return;
  const selector = config.selectors?.flowComplete ?? config.completionSelector;
  const el = document.querySelector(selector);
  if (el && el.style.display !== 'none') {
    flowCompleteFlag = true;
  }
}
```
`el.style` is the element's **inline** style declaration only (the `style=`
HTML attribute) — it does not reflect the effective/computed visibility
contributed by a CSS class, an ID selector, or an external/`<style>`
stylesheet rule. For an element that is hidden via `class="hidden"` (with
`.hidden { display: none }` defined in a stylesheet) and carries no inline
`style` attribute at all, `el.style.display` evaluates to `''`, which is
`!== 'none'` — so this function incorrectly concludes the completion screen
is already visible.

Since `attachListeners` (and therefore `checkFlowComplete`) runs on the very
first attach pass — before the user has done anything — this means
`flowCompleteFlag` gets latched `true` immediately and *permanently* (per
D-06, this function is documented to "never clear" the flag) for any host
page that doesn't happen to hide the completion element with an inline
`display: none` style. From that point on, `!flowCompleteFlag` is always
`false`, so the `back_intent` publish in the `popstate` handler
(`src/signal.js:334-339`) never fires for the remainder of the session.

The only reason this currently passes tests/appears correct is that both
`tests/signal.test.js`'s fixture and `test-harness/index.html`'s markup
happen to hide the completion element with the exact inline style the check
is looking for (`<div data-heed="flow-complete" style="display: none;">`).
Any real partner platform using conditional rendering, a CSS class toggle,
or a framework's `hidden` attribute/visibility utility (React `className`
toggling is the standard pattern, not inline `style`) will silently break
SIG-04 with no error, no warning, and no test coverage catching it — directly
contradicting this branch's stated goal that "a real partner only changes
config, never the SDK itself."

**Fix:** Use computed visibility instead of inline style, e.g.:
```js
function checkFlowComplete(config) {
  if (flowCompleteFlag) return;
  const selector = config.selectors?.flowComplete ?? config.completionSelector;
  const el = document.querySelector(selector);
  if (el && el.offsetParent !== null) {
    // offsetParent is null for display:none (and detached) elements,
    // regardless of whether the hiding is inline, class-based, or via an
    // external stylesheet — this is visibility-agnostic to the CSS
    // mechanism used, unlike el.style.display.
    flowCompleteFlag = true;
  }
}
```
(or `getComputedStyle(el).display !== 'none'` if `visibility`/`opacity`
edge cases are not a concern). Add a regression test using a CSS class
(not inline style) to hide/show the completion element to lock this in.

## Warnings

### WR-01: `touchmove` cancels the hesitation timer with zero movement tolerance

**File:** `src/signal.js:98-105`
**Issue:** Every `touchmove` event — including the sub-pixel jitter that
real capacitive touchscreens routinely report even while a finger is
believed to be held perfectly still — immediately calls `cancel()` and
clears the hold timer:
```js
el.addEventListener('touchmove', cancel, { passive: true }); // any movement cancels intent to hold
```
On real hardware this risks making `touch_hesitation` (SIG-01) very hard to
trigger in practice, undermining the stated "Core Value" that hesitation
signals are "captured cleanly." The happy-dom/Playwright tests can't catch
this because synthetic `TouchEvent`s in tests never dispatch the incidental
jitter `touchmove` events real devices generate.
**Fix:** Track the touch's start coordinates and only cancel once cumulative
movement exceeds a small tolerance (e.g. 10px), rather than on the mere
presence of a `touchmove` event:
```js
function onTouchMove(e) {
  const t = e.touches[0];
  if (!t) return;
  const dx = t.clientX - startX, dy = t.clientY - startY;
  if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) cancel();
}
```

### WR-02: Overlapping `touchstart` calls silently orphan the previous timer

**File:** `src/signal.js:80-105`
**Issue:** `timerId` is a single closured variable. If `start()` runs a
second time before a prior `touchend`/`touchcancel`/`touchmove` has fired
(e.g. a stray duplicate `touchstart`, or multi-touch on the same element —
both are observed on real mobile hardware, not purely theoretical), the new
`setTimeout` return value overwrites `timerId`, and the reference to the
first timer is lost. That first timer keeps running unobserved:
- If it fires before the second is cancelled, `timerId` gets set to `null`
  by its own callback, `publish()` fires once (seemingly fine) — but the
  *second* timer is still pending and untracked, since `cancel()` will now
  see `timerId === null` and skip `clearTimeout` entirely on the real
  (second) timer, which will go on to fire a **second**, unwanted
  `touch_hesitation` publish later, after the element was already released.
**Fix:** Guard `start()` against re-entrancy, or explicitly clear any
existing timer before scheduling a new one:
```js
function start() {
  if (timerId !== null) clearTimeout(timerId);
  timerId = setTimeout(() => { ... }, thresholdMs);
}
```

### WR-03: `back_intent` payload carries raw `window.location.pathname`

**File:** `src/signal.js:39-42`, `src/signal.js:327-339`
**Issue:** CLAUDE.md's hard rule is "No PII ever... Signal payloads contain
bbox coordinates and timestamps only." `back_intent` (and its D-07
deviation) instead publishes the live URL pathname unfiltered. Many routing
schemes embed identifiers in the path itself (`/tx/abc123`,
`/reset/<token>`, `/user/<id>/...`), which would leave the browser in the
signal payload. This is a deliberate, documented deviation (D-07) from the
locked 4-field shape, but nothing constrains what a pathname is allowed to
contain, and the rule as written in CLAUDE.md is unconditional ("No PII
ever"), not scoped to form-field values only.
**Fix:** At minimum, flag this explicitly to the project owner as a
CLAUDE.md-adjacent policy question (per the "stop and flag it" instruction)
rather than treating D-07 as having already settled it. If pathname must be
kept, consider hashing/truncating or allow-listing known-safe route
segments rather than passing the raw string through.

### WR-04: `completionSelector` is a redundant, effectively dead config field

**File:** `config/schema.json:2-7`, `config/demo-platform.json:2-3`, `src/signal.js:230`
**Issue:** `schema.json` requires both a top-level `completionSelector` and
`selectors.flowComplete`, and `demo-platform.json` sets them to the
identical string. `signal.js`'s only consumer of `completionSelector` is the
fallback branch `config.selectors?.flowComplete ?? config.completionSelector`
— but since `schema.json` also lists `flowComplete` as `required` inside
`selectors`, `validateConfig` guarantees `selectors.flowComplete` is always
present by the time `checkFlowComplete` runs, meaning the `??
config.completionSelector` fallback can never actually execute against a
config that passed validation. This is dead code masking a data-duplication
hazard: if a future config author updates one field and not the other, the
schema will happily accept the divergence (no validation ties the two
together) and the SDK will silently use whichever one signal.js prefers,
with no visible error.
**Fix:** Drop `completionSelector` from the schema/config entirely and read
only `selectors.flowComplete`, or explicitly document why both exist and add
a validation step ensuring they match.

### WR-05: Bus subscriptions in tests are never torn down between cases

**File:** `tests/signal.test.js` (all `describe` blocks), `tests/signal-spa.test.js` (all `describe` blocks), `tests/fixtures/test-subscriber.js:3-5`
**Issue:** `collectReceived` returns an unsubscribe function (`subscribe`'s
return value), but every call site in both test files discards it:
```js
const received = [];
collectReceived((payload) => received.push(payload));
```
`bus.js`'s `target` is a module-level singleton `EventTarget`, and within a
single test file all `it()` blocks share that same module instance (fresh
`describe`/`it` runs don't reset ES module state). Each test therefore adds
one more permanent listener on top of every prior test's listener in the
same file, with no `afterEach` cleanup. It doesn't currently corrupt
assertions (each test's `received` array is its own closure), but it is a
real test-hygiene gap: it silently grows the number of live listeners for
the remainder of the file's run, and it means any future test that asserts
something like "exactly N subscribers fired" or that inspects
`EventTarget` internals would be unreliable without first fixing this.
**Fix:** Capture and call the unsubscribe function in `afterEach`:
```js
let unsubscribe;
afterEach(() => unsubscribe?.());
...
unsubscribe = collectReceived((payload) => received.push(payload));
```

## Info

### IN-01: No bounds validation on numeric signal-tuning fields

**File:** `config/schema.json:32-45`
**Issue:** `thresholdMs`, `depthThresholdPct`, and `minReversalDeltaPx` are
only type-checked as `"number"` — `config.js`'s interpreter implements no
`minimum`/`maximum` keyword at all. A config with `thresholdMs: -100` or
`depthThresholdPct: 0` passes `validateConfig` and produces a degenerate,
hyperactive SDK (e.g. `setTimeout` with a negative delay fires almost
immediately) instead of the CFG-02 hard-fail this module is designed around.
**Fix:** Either extend `config.js`'s interpreter to support
`minimum`/`maximum`, or add an explicit sanity check in `signal.js` when
reading these values.

### IN-02: `depthThresholdPct` measures viewport-heights scrolled, not fraction of page scrolled

**File:** `src/signal.js:137-149`
**Issue:** `depthPct = scrollY / viewportHeight` computes what fraction of
one viewport-height the user has scrolled down, not what fraction of the
*total scrollable page* they've traversed (which would be
`scrollY / (document.documentElement.scrollHeight - viewportHeight)`). The
config field is named `depthThresholdPct`, which strongly implies "percent
of page depth" to a config author, not "viewport-heights scrolled." On a
page whose content is, say, 4 viewport-heights tall, this formula will cross
the 0.4 threshold after scrolling only 10% of the actual page. The current
behavior is internally consistent (tests and the harness were both written
against this same formula), but the field name is a foot-gun for anyone
tuning `demo-platform.json`-style configs without reading `signal.js`'s
source.
**Fix:** Either rename the field to something like
`viewportHeightsThreshold`, or change the implementation to divide by total
scrollable range so the name and behavior match.

### IN-03: `wireBlurIncomplete` assumes `el.value` exists

**File:** `src/signal.js:114-126`
**Issue:** `const isEmpty = el.value === '';` assumes the `amountInput`
element is a real form control (`<input>`/`<textarea>`). If a partner
implements the amount field as a `contenteditable` div or a custom
component that doesn't expose `.value` (common for custom numeric keypads),
`el.value` is `undefined`, `undefined === ''` is always `false`, and
`blur_incomplete` silently never fires for that platform — with no error to
surface the mismatch.
**Fix:** Fall back to `el.value ?? el.textContent ?? ''` when reading the
emptiness check, or document the `amountInput` selector contract as
requiring a real form-control element.

---

_Reviewed: 2026-07-15T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
