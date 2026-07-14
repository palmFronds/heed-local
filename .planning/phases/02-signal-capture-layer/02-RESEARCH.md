# Phase 2: Signal Capture Layer - Research

**Researched:** 2026-07-14
**Domain:** Vanilla-JS DOM event capture (touch/blur/scroll/popstate), SPA-safe idempotent listener re-attachment, PII-free payload construction
**Confidence:** MEDIUM-HIGH

## Summary

This phase's real risk is not "which library to use" (there is none — everything here is vanilla
DOM APIs) but getting five mechanical-but-easy-to-get-subtly-wrong things right: (1) a live-firing
800ms hold timer that must not double-fire or race against `touchend`, (2) an idempotent
MutationObserver+popstate re-attachment scheme that survives 3+ SPA navigations without
double-listeners or silent gaps, (3) a scroll-reversal detector that filters momentum jitter with a
sensible hysteresis delta, (4) a `blur_incomplete` handler that reads `amountInput.value` internally
for its empty-check but must never leak that value into the emitted payload, and (5) rewiring
Phase 1's synthetic debug-panel buttons to dispatch *real* (if programmatically-constructed)
`TouchEvent`/`FocusEvent`/`scroll`/`PopStateEvent` instances so the panel exercises `signal.js`'s
actual listeners rather than bypassing them.

All four signal handlers converge on one architectural insight worth calling out before any code is
written: `D-01`'s "live fire at 800ms while still held" design means the *entire* touch-hesitation
tap/hold distinction is a single `setTimeout` + `clearTimeout` pair — there is no second "was this
under 300ms" branch to write. SIG-01's `<300ms` language describes the *emergent behavior* of the
single-timer design (anything released before the timer elapses never fires, whether that's 50ms or
750ms), not a second threshold requiring its own logic. Getting this wrong (adding a second timer or
a post-hoc "was duration < 300ms" check) is the single most likely implementation error in this
phase.

Similarly, the SPA re-attachment problem (Success Criterion 6, SIG-06) has one correct shape: a
`WeakSet` keyed on DOM element identity (not selector strings), a single `pathname`-diffed gate
function called from *both* the MutationObserver callback and the `popstate` listener, and reuse of
that same MutationObserver to also update the cached `flowComplete` flag (D-06) — one observer, two
jobs, not two observers. `popstate` alone is insufficient because SPA frameworks' programmatic
navigation (e.g. Next.js `router.push`) calls `history.pushState()`, which — per MDN — does **not**
fire `popstate`; only real back/forward navigation does. This is why both mechanisms are required,
not redundant.

**Primary recommendation:** Implement `signal.js` as four independent listener-attachment functions
(one per signal type) driven by a single `attachListeners(config)` entry point; back all
"has this element already been wired" checks with one `WeakSet<Element>`; gate both MutationObserver
and popstate callbacks through one `maybeReattach()` function that diffs `location.pathname`; and
centralize payload construction in one small per-signal-type builder so the PII-safety property
(SIG-05) is enforced at a single choke point, not scattered across four call sites.

## User Constraints

<user_constraints>
### Locked Decisions (from 02-CONTEXT.md)

- **D-01:** `touch_hesitation` fires **live** via `setTimeout` at the 800ms mark, while the touch
  is still held — not retrospectively on `touchend`. The whole point is real-time intervention;
  firing only after release means the user has already decided and left.
- **D-02:** Touch-hesitation (and blur) monitoring scope is **CTA-style selectors only** —
  `proceedCta`, `confirmCta`, `backBtn`. `feeRow` and `minReceivedRow` are explicitly excluded —
  users scroll past those, they don't hold them; monitoring them would be noise, not signal.
- **D-03:** `blur_incomplete` uses a **final-value diff at blur time only** — empty value at blur
  = incomplete, regardless of whether the user typed something and cleared it back to empty.
  (Typed-then-cleared is arguably a stronger hesitation signal, but V0 keeps this simple —
  documented here as an accepted V0 simplification, not an oversight.)
- **D-04:** (folded into D-03) — the blur listener applies **only to `amountInput`** — it's the
  only input element in the flow.
- **D-05:** `scroll_reversal` requires a **minimum reversal delta** after crossing the 40%
  viewport-depth threshold — not just any upward `scrollY` decrease. This filters out
  jitter/momentum micro-bounces so the signal reflects a meaningful retreat. The exact delta
  value (configurable, needs a sensible default) is Claude's discretion — see Code Examples.
- **D-06:** The `flowComplete` check at `popstate` time uses a **cached internal flag**, updated
  once via MutationObserver/bus when the completion selector first appears — not a live DOM
  query inside the `popstate` handler itself.
- **D-07:** For `scroll_reversal` and `back_intent` — which have no single "held" DOM element the
  way `touch_hesitation`/`blur_incomplete` do — `targetSelector`/`bbox` are **null/omitted**.
  `scroll_reversal` carries a `scrollDepth` field instead; `back_intent` carries a `pathname`
  field instead. This is a deliberate deviation from REQUIREMENTS.md's literal
  `{ type, targetSelector, bbox, timestamp }` payload-shape wording for all 4 signals — surfaced
  explicitly here, not silently reconciled.
- **D-08:** Phase 1's synthetic debug-panel buttons get **rewired to dispatch real DOM events**
  (fake `touchstart`/`touchend` sequences, `blur`, `scroll`, `popstate`) instead of calling
  `bus.publish()` directly. This makes the debug panel exercise `signal.js`'s real capture path
  rather than bypassing it.

### Claude's Discretion

- Exact scroll-reversal minimum-delta value and its config field/default.
- Exact WeakSet re-attachment granularity (per-element vs. per-listener-type tracking) — a
  concrete `attachListeners(config)` implementation detail, not a user-facing decision.
- Scroll-listener performance strategy (passive listener flag, debounce/throttle interval).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within Phase 2's scope (signal capture only; no inference, response, or
logging decisions were made here).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SIG-01 | Touch hesitation — `touchstart` timer, 800ms held-touch threshold distinguishes hesitation from a normal tap (<300ms) | Code Examples "Touch Hesitation Timer"; Common Pitfalls #1 (no second timer needed) |
| SIG-02 | Blur without completion — input focus → blur with no value change emits `blur_incomplete` | Code Examples "Blur Incomplete"; Common Pitfalls #4 (internal value read vs. payload leak) |
| SIG-03 | Scroll reversal — scroll past 40% viewport then reverse emits `scroll_reversal` | Code Examples "Scroll Reversal"; Common Pitfalls #7 (rAF misconception), #8 (test-harness scroll height) |
| SIG-04 | Back intent — `popstate` while `flowComplete` false emits `back_intent` | Code Examples "Back Intent + Cached flowComplete"; Architecture Pattern 2 |
| SIG-05 | All signal payloads are geometry/timing only, no field values, no identity | Code Examples "Centralized Payload Builder"; PII-Safety Verification section |
| SIG-06 | SPA re-attachment — MutationObserver + popstate, pathname-gated, WeakSet-idempotent | Architecture Pattern 1; Common Pitfalls #2, #6 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Touch hesitation capture | Browser / Client | — | Pure DOM event listener + timer, runs entirely in the partner's page context |
| Blur-incomplete capture | Browser / Client | — | Same — reads `HTMLInputElement.value` internally, never transmits it |
| Scroll-reversal capture | Browser / Client | — | Reads `window.scrollY`/`innerHeight` only; no server round-trip (latency-sensitive per PROJECT.md) |
| Back-intent capture | Browser / Client | — | `popstate` is a client-only browser API |
| SPA re-attachment (MutationObserver + popstate) | Browser / Client | — | Must react to the host page's own client-side router; no backend involvement |
| Cached `flowComplete` flag | Browser / Client | — | Derived from the same MutationObserver instrumenting the DOM; not a live query, not server state |
| Internal bus publish | Browser / Client | — | `signal.js` → `bus.js`, already built in Phase 1; no network hop |

No API/Backend, CDN/Static, or Database/Storage tier is involved in this phase — signal capture is
100% client-side per PROJECT.md's latency constraint ("inference has to run client-side... a server
round-trip kills it," which applies transitively to signal capture feeding it).

## Standard Stack

### Core

No new runtime dependency. `signal.js` is pure vanilla JS — DOM Events API (`addEventListener`,
`TouchEvent`, `FocusEvent`, `PopStateEvent`, `MutationObserver`), consistent with CLAUDE.md's
"no framework dependencies in the SDK" hard constraint. brain.js is not touched by this phase.

### Supporting (dev-only, already installed — no changes needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| vitest | 4.1.10 [VERIFIED: npm registry, confirmed in 01-RESEARCH.md] | Unit tests for `signal.js`'s pure listener-attachment/timer logic | Already selected and installed at Phase 1 |
| happy-dom | 20.10.6 [VERIFIED: npm registry, confirmed in 01-RESEARCH.md] | DOM environment providing native `TouchEvent`/`PopStateEvent`/`FocusEvent`/`MutationObserver` classes for unit tests | Confirmed via source inspection (`BrowserWindow.ts`) that happy-dom's Window implementation includes `TouchEvent` — this is the reason happy-dom was chosen over jsdom at the project level [CITED: github.com/capricorn86/happy-dom] |
| @playwright/test | 1.61.1 [VERIFIED: npm registry, confirmed in 01-RESEARCH.md] | Real-browser verification that the built `dist/sdk.js` + rewired `test-harness/index.html` (D-08) actually exercises real listeners | See "happy-dom vs. Playwright test split" below — this is the layer that proves the debug-panel HTML/script-execution path works, which happy-dom's `document.write()` cannot reliably substitute for |

**No new packages this phase.** `signal.js` uses only browser-native constructors (`TouchEvent`,
`Touch`, `FocusEvent`, `PopStateEvent`, `MutationObserver`) — no polyfill or library needed for any
evergreen mobile browser target (Safari iOS 14+, Chrome Android), consistent with the project's
`STACK.md` platform target.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `setTimeout`-based hold-timer for touch hesitation | `PointerEvent`'s `pointerdown`/`pointerup` (unified pointer model) | Spec explicitly calls for `touchstart`/`touchend` (mobile-only signal set per PROJECT.md: "no mouse/hover"); `PointerEvent` would also fire for mouse/pen input, which the spec and CLAUDE.md's "mobile-only signal set" explicitly want to exclude. Not recommended — stick with `TouchEvent`. |
| Native `MutationObserver` for SPA-navigation detection | Monkey-patching `history.pushState`/`replaceState` (wrap-and-call-through) | Some SPA-detection libraries wrap `pushState` directly instead of using MutationObserver. The spec (`repo2_heed_sdk.txt`) explicitly locks in "MutationObserver on `document.body` + popstate listener" as the strategy — this is a locked architectural decision from the canonical spec, not open to reconsideration. |
| Fixed-pixel scroll-reversal delta | Percentage-of-viewport-height delta | Both are defensible; a percentage scales correctly across device sizes (a 390px-wide iPhone vs. a larger phone), a fixed pixel value is simpler to reason about and test. Recommendation below uses a percentage-derived default expressed in px for the given viewport, documented as Claude's discretion. |

## Package Legitimacy Audit

Not applicable — this phase installs no new packages. `signal.js` is 100% vanilla JS against
browser-native APIs; all dev-tooling (vitest, happy-dom, @playwright/test) was already verified in
`01-RESEARCH.md`'s Package Legitimacy Audit and requires no re-verification (unchanged versions,
same `package.json`).

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  Host page DOM (test-harness/index.html or a real partner page)      │
│                                                                        │
│  [data-heed="amount-input"]  ← focus/blur listeners (SIG-02)          │
│  [data-heed="proceed-cta"]   ← touchstart/touchmove/touchend (SIG-01) │
│  [data-heed="confirm-cta"]   ← touchstart/touchmove/touchend (SIG-01) │
│  [data-heed="back-btn"]      ← touchstart/touchmove/touchend (SIG-01) │
│  [data-heed="flow-complete"] ← observed for MutationObserver (D-06)   │
│  window                       ← scroll listener (SIG-03), popstate (SIG-04)│
└───────────────────────┬────────────────────────────────────────────────┘
                         │ real DOM events
                         ▼
        ┌───────────────────────────────────────────┐
        │ signal.js                                   │
        │                                              │
        │  attachListeners(config)  ← single entry point│
        │    ├─ attachTouchHesitation(el)  (per CTA)    │
        │    ├─ attachBlurIncomplete(el)   (amountInput)│
        │    ├─ attachScrollReversal()      (window)    │
        │    └─ attachBackIntent()          (window)    │
        │                                              │
        │  WeakSet<Element> attachedElements            │
        │    ← gates re-attachment idempotency (SIG-06) │
        │                                              │
        │  let flowCompleteFlag = false                 │
        │    ← updated once by MutationObserver (D-06)  │
        │                                              │
        │  MutationObserver(document.body)              │
        │    ├─ checks pathname → maybeReattach()       │
        │    └─ checks completionSelector → sets flag   │
        │                                              │
        │  popstate listener                            │
        │    ├─ checks pathname → maybeReattach()       │
        │    └─ if !flowCompleteFlag → emit back_intent │
        │                                              │
        │  buildPayload(type, ...)  ← single choke point │
        │    for SIG-05 PII-safety (allow-listed keys)   │
        └───────────────────┬─────────────────────────┘
                             │ publish(type, payload)
                             ▼
                     ┌───────────────┐
                     │   bus.js       │  (Phase 1, unchanged)
                     │ private        │
                     │ EventTarget    │
                     └───────┬────────┘
                             │ subscribe (Phase 3's inference.js, later)
                             ▼
                  (out of scope this phase)
```

A reader can trace the primary use case — a real touch/blur/scroll/popstate event enters at the
top, is captured by one of `signal.js`'s four listener groups, converted into a PII-free payload
through the single `buildPayload` choke point, and published onto the existing Phase-1 bus — by
following the arrows top to bottom.

### Recommended Project Structure

```
src/
├── config.js          # unchanged (Phase 1)
├── bus.js              # unchanged (Phase 1)
├── signal.js            # NEW — this phase's primary deliverable
└── index.js             # MODIFIED — wires attachListeners(config) into init()/initDemo()
config/
├── schema.json          # MODIFIED — add optional signals.* threshold fields (see Note below)
└── demo-platform.json    # MODIFIED (optional) — supply concrete threshold overrides if desired
test-harness/
└── index.html            # MODIFIED (D-08) — debug panel dispatches real events, not bus.publish()
tests/
├── signal.test.js         # NEW — unit tests for all 4 signal types against a happy-dom fixture DOM
├── signal-spa.test.js      # NEW — SPA re-attachment idempotency tests (SIG-06, Success Criterion 6)
└── harness.spec.js (Playwright) # NEW or extended — verifies D-08 rewiring in a real browser
```

**Note on `config/schema.json`:** The current schema (Phase 1) has no `signals.*` section at all —
only `platformId`, `selectors`, `completionSelector`. D-05 explicitly requires the scroll-reversal
delta to be "configurable." Since `src/config.js`'s validator (`walk()`) only enforces keys listed
in a node's `required` array and does not set `additionalProperties: false` anywhere, adding new
**optional** properties (e.g. `signals.touchHesitation.thresholdMs`, `signals.scrollReversal.minReversalDeltaPx`)
to `schema.json`'s `properties` — without adding them to `required` — is fully backward-compatible
with the existing `demo-platform.json` (verified by reading `src/config.js` directly — it only
walks properties that exist in the config object; it never rejects unknown-but-undeclared keys
either). This means Phase 2 can and should extend `config/schema.json` with these optional fields
even though the phase's boundary description says it "does not touch inference/response/logging" —
config schema changes for *signal* thresholds are squarely in this phase's scope.

### Pattern 1: Single WeakSet, Single Pathname-Gated Reattach Function (SIG-06)

**What:** One `WeakSet<Element>` tracks "has this exact DOM element already had its listener(s)
attached." One `maybeReattach(config)` function is the *only* place that compares
`window.location.pathname` against a `lastPathname` closure variable and calls `attachListeners(config)`
when it differs. Both the MutationObserver callback and the `popstate` listener call this same
function — there is exactly one re-attachment code path to reason about and test, not two parallel
ones that could drift.

**Why WeakSet keyed on the element (not the selector string):** In a real SPA route swap, the OLD
`amount-input` element is detached from the DOM and (once no other reference exists) garbage
collected — its `WeakSet` entry disappears for free, with zero manual cleanup. The NEW route's
`amount-input` element is a *different object*, so `attachedElements.has(newEl)` is `false` and it
correctly receives a fresh, real listener. A `Set` keyed on the selector *string* would incorrectly
treat "I've seen this selector before" as "already wired" and silently fail to attach to the new
element — this is exactly the "silent under-attachment" failure mode Success Criterion 6 calls out.

**Why both MutationObserver AND popstate are needed (not redundant):** `popstate` fires only for
real back/forward browser navigation (and `history.back()`/`.forward()`/`.go()`); it does **not**
fire for `history.pushState()`/`.replaceState()` calls, which is what most SPA routers (including
Next.js's client-side navigation) use for *forward* navigation [CITED:
developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API]. MutationObserver
is the general-purpose catch-all that detects the DOM subtree swap regardless of which history API
triggered it; `popstate` is required anyway for SIG-04's own back-intent detection, so reusing it as
a second re-attachment trigger is free.

**Why the pathname gate must live inside the callback, not rely on WeakSet alone:** MutationObserver
fires on effectively *any* DOM mutation (a user typing in `amountInput` also triggers text-node
mutations). Without checking `pathname !== lastPathname` first, every keystroke would trigger a
(harmless, thanks to WeakSet idempotency, but wasteful) full `document.querySelector` sweep across
all 7 selectors. The gate exists for performance/query-cost hygiene, not correctness.

**Reuse the same observer for `flowComplete` (D-06):** The same MutationObserver callback can also
check `document.querySelector(config.selectors.flowComplete)` and set a cached boolean flag the
first time it resolves non-null — this satisfies D-06's "cached flag, not live DOM query in the
popstate handler" requirement without instantiating a second `MutationObserver`.

**Example:**
```javascript
// signal.js — SPA re-attachment core
const attachedElements = new WeakSet();
let lastPathname = window.location.pathname;
let flowCompleteFlag = false;

function attachListeners(config) {
  const targets = resolveTargets(config); // { el, selectorKey } pairs for all 7 selectors present in DOM
  for (const { el, selectorKey } of targets) {
    if (attachedElements.has(el)) continue; // idempotent — element already wired
    attachedElements.add(el);
    wireElement(el, selectorKey, config);
  }
  checkFlowComplete(config); // also re-check on every attach pass
}

function checkFlowComplete(config) {
  if (flowCompleteFlag) return; // once true, stays true for the session
  const el = document.querySelector(config.selectors.flowComplete);
  if (el) flowCompleteFlag = true;
}

function maybeReattach(config) {
  const currentPathname = window.location.pathname;
  if (currentPathname !== lastPathname) {
    lastPathname = currentPathname;
    attachListeners(config);
  } else {
    checkFlowComplete(config); // pathname unchanged, but completion element may have just appeared
  }
}

export function initSignalCapture(config) {
  attachListeners(config); // initial attach

  const observer = new MutationObserver(() => maybeReattach(config));
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    maybeReattach(config);
    if (!flowCompleteFlag) {
      publish('signal:detected', buildPayload('back_intent', { pathname: window.location.pathname }));
    }
  });
}
```
Source: derived directly from `repo2_heed_sdk.txt`'s "SPA safety" section + D-06/SIG-06.

### Pattern 2: Live-Firing Hold Timer with Guaranteed Single Emission (SIG-01, D-01)

**What:** `touchstart` schedules exactly one `setTimeout`. If `touchend`/`touchcancel`/`touchmove`
fires first, `clearTimeout` cancels it — no signal. If the timer elapses first, it fires the signal
*immediately* (D-01's "live" requirement) and nulls its own reference so a subsequent `touchend` has
nothing left to clear (idempotent no-op, not a second emission).

**Why there is no race condition:** JavaScript timers and DOM event dispatch run on the same single
thread via one task queue. Either the `touchend` handler runs to completion *before* the timer's
callback is dequeued (in which case `clearTimeout` reliably prevents the timer from ever firing —
this is guaranteed by the spec, not a timing coincidence), or the timer callback runs to completion
first (in which case `touchend`'s later `clearTimeout` call is a harmless no-op on an
already-consumed timer id). There is no interleaving where "half of each" runs — single-threadedness
rules that out structurally.

**Touchmove cancellation policy:** The spec does not define a movement tolerance. Recommended
default for V0 (Claude's discretion, low-risk either way): cancel on **any** `touchmove` — this
matches the common "long-press" implementation pattern found across web references and is simpler
than tracking a movement-distance tolerance. A future refinement could add a small pixel tolerance
(~10px) to avoid canceling on natural finger tremor, but this is not required by any locked decision
and adds complexity to a phase PROJECT.md explicitly calls "comparatively mechanical."

**Example:**
```javascript
// signal.js — touch hesitation (CTA-scoped: proceedCta, confirmCta, backBtn per D-02)
const HESITATION_THRESHOLD_MS = config.signals?.touchHesitation?.thresholdMs ?? 800;

function wireTouchHesitation(el, selectorValue) {
  let timerId = null;

  function start() {
    timerId = setTimeout(() => {
      timerId = null; // consumed — a later touchend/touchcancel is now a no-op
      publish('signal:detected', buildPayload('touch_hesitation', { el, targetSelector: selectorValue }));
    }, HESITATION_THRESHOLD_MS);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel, { passive: true });
  el.addEventListener('touchcancel', cancel, { passive: true });
  el.addEventListener('touchmove', cancel, { passive: true }); // any movement cancels intent to hold
}
```
[CITED: developer.mozilla.org/en-US/docs/Web/API/Touch_events — "combine touchstart with touchend
... use a timer to detect long presses ... cancel via touchmove"]

### Pattern 3: Centralized PII-Safe Payload Builder (SIG-05)

**What:** One function, `buildPayload(type, ctx)`, is the *only* place in `signal.js` that
constructs the object passed to `publish()`. Each signal type has an explicit allow-list of output
keys; nothing outside that allow-list can appear in the emitted payload, regardless of what data the
calling handler had access to internally.

```javascript
function buildPayload(type, ctx) {
  const timestamp = Date.now();
  switch (type) {
    case 'touch_hesitation':
    case 'blur_incomplete': {
      const rect = ctx.el.getBoundingClientRect();
      return {
        type,
        targetSelector: ctx.targetSelector,
        bbox: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        timestamp,
      };
    }
    case 'scroll_reversal':
      return { type, targetSelector: null, bbox: null, scrollDepth: ctx.scrollDepth, timestamp }; // D-07
    case 'back_intent':
      return { type, targetSelector: null, bbox: null, pathname: ctx.pathname, timestamp }; // D-07
    default:
      throw new Error(`[heed] unknown signal type: ${type}`);
  }
}
```

**Why this matters for `blur_incomplete` specifically:** D-03's empty-check *must* read
`amountInput.value` internally (`el.value === ''`) to decide whether to fire at all — but that value
must never appear in `ctx` passed to `buildPayload`, and `buildPayload`'s `blur_incomplete` case
never reads anything from `ctx` except `el`/`targetSelector` (used only for `bbox`, via
`getBoundingClientRect()`, never `el.value`). The value-check and the payload-construction are two
separate steps in the blur handler — verifying this separation is the concrete, testable form of
SIG-05's "confirmed by code inspection" requirement (see PII-Safety Verification section below).

### Anti-Patterns to Avoid

- **A second "was this under 300ms" check bolted onto SIG-01's timer logic** — D-01's single-timer
  design already produces this behavior for free; adding a second threshold is redundant complexity
  and a likely source of an off-by-one/double-fire bug.
- **Two separate `MutationObserver` instances** (one for re-attachment, one for `flowComplete`) —
  one instance, two responsibilities in its callback (Pattern 1).
- **A `Set<string>` of selector strings instead of `WeakSet<Element>`** for re-attachment tracking —
  this is the single most likely way to accidentally reintroduce "silent under-attachment" after a
  DOM subtree swap (see Pattern 1's rationale).
- **Calling `preventDefault()` inside a `{ passive: true }` touch listener** — throws a console
  warning (Chrome/Safari both warn or silently ignore the call) and is never needed here; this SDK
  never blocks the host page's default touch/scroll behavior.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Long-press / held-touch detection | A custom multi-state gesture-recognition state machine | A single `setTimeout` + `clearTimeout` pair per element (Pattern 2) | There is no browser API for "long press" on touch (confirmed via research — no native long-press event exists for `TouchEvent`), but the timer pattern is the universally converged solution; anything more elaborate (velocity tracking, multi-touch gesture disambiguation) is unnecessary for a single-finger CTA hold |
| SPA route-change detection | Hooking `history.pushState`/`replaceState` via monkey-patching | `MutationObserver` + `popstate` (Pattern 1) | Explicitly locked by the canonical spec (`repo2_heed_sdk.txt`); also avoids the fragility of monkey-patching a global API that other scripts on the host page might also patch (patch-ordering conflicts) |
| Scroll-position tracking | A custom `IntersectionObserver`-based percentage tracker | Direct `window.scrollY` / `document.documentElement.scrollHeight` reads inside a throttled `scroll` listener | `IntersectionObserver` is well-suited to "did element X enter the viewport" but this signal needs a continuous depth *percentage* and *reversal* comparison against a remembered previous value — a plain scroll listener with two remembered numbers (`maxDepthReached`, `lastScrollY`) is simpler and sufficient here |

**Key insight:** Every piece of this phase has a converged, well-known browser-native answer. The
risk is not missing tooling — it is subtly over-engineering the touch/scroll state machines beyond
what a `setTimeout` pair or two remembered numbers require, or under-engineering the SPA
re-attachment logic by skipping the `WeakSet`/pathname-gate combination.

## Common Pitfalls

### Pitfall 1: Adding a redundant second "was this a tap" threshold

**What goes wrong:** A second timer or a `duration < 300ms` check is added alongside the 800ms
hold timer, in a literal reading of SIG-01's "distinguishes hesitation from a normal tap (<300ms)"
wording.
**Why it happens:** SIG-01's requirement text mentions two numbers (800ms, 300ms), which reads like
two thresholds are needed.
**How to avoid:** D-01's single-timer design already produces the correct behavior: anything
released before 800ms elapses (whether at 50ms or 750ms) never fires. No second check is needed.
**Warning signs:** A second `setTimeout`, a stored `touchstart` timestamp compared against a second
threshold on `touchend`, or any code path that fires a *different* signal for "medium-length" taps.

### Pitfall 2: MutationObserver fires without a pathname gate, causing wasted work (not incorrectness, but a performance smell)

**What goes wrong:** `attachListeners(config)` (a full `querySelectorAll` sweep across all 7
selectors) runs on every single DOM mutation — including the user simply typing in `amountInput` —
because the pathname-diff check was omitted or misplaced outside the MutationObserver callback.
**Why it happens:** MutationObserver's callback receives a `MutationRecord[]` on every batched
mutation; it's easy to wire `attachListeners` directly to the observer without an intermediate gate.
**How to avoid:** Route both MutationObserver and popstate through the single `maybeReattach()`
gate function (Pattern 1) that diffs `location.pathname` before ever calling `attachListeners`.
**Warning signs:** Performance profiling shows `querySelectorAll` being called far more often than
actual navigations occur; a test asserting "attachListeners is called at most once per genuine
route change" fails.

### Pitfall 3: `MutationObserver` callbacks are asynchronous — tests assert before the callback runs

**What goes wrong:** A unit test mutates the DOM (simulating a route change) and immediately
asserts the new element has a listener, but the assertion runs before the `MutationObserver`'s
microtask-queued callback has fired, producing a false failure (or worse, a false pass if the
assertion is checking `attachedElements.has(oldEl)` which was already true from initial setup).
**Why it happens:** Per the MutationObserver spec, callbacks are delivered as a microtask, batched
across the current synchronous task — they do not run synchronously inside the code that triggered
the mutation.
**How to avoid:** Either (a) `await` a microtask flush (e.g. `await Promise.resolve()` or
`await new Promise(queueMicrotask)`) before asserting in unit tests, or (b) for the fastest, most
deterministic unit tests, call `maybeReattach(config)` directly in the test rather than relying on
the observer's async delivery, reserving true async-observer-wiring verification for the Playwright
layer (which runs in a real browser where the timing is real, not simulated).
**Warning signs:** Flaky tests that pass/fail depending on execution order; a GitHub-documented
happy-dom issue (`capricorn86/happy-dom#2097`) notes MutationObserver has known interaction problems
with Vitest's fake-timer mode specifically — avoid combining `vi.useFakeTimers()` (needed for the
touch-hesitation timer tests) with MutationObserver-dependent assertions in the *same* test file/
`describe` block; keep the timer tests and the SPA re-attachment tests in separate test files
(reflected in the Recommended Project Structure above: `signal.test.js` vs. `signal-spa.test.js`).
[CITED: github.com/capricorn86/happy-dom/issues/2097]

### Pitfall 4: `blur_incomplete`'s internal value-read leaks into the payload

**What goes wrong:** The blur handler reads `el.value` to check emptiness (required by D-03), and a
careless implementation passes that same value (or the whole element) through to `buildPayload`,
which then includes it in the emitted payload — a direct PII violation (SIG-05, CLAUDE.md's "No PII
ever").
**Why it happens:** It's natural to pass "the element" as context to a payload builder, and easy to
forget that `getBoundingClientRect()` needs the element but must never call `.value`/`.textContent`
on it.
**How to avoid:** Structurally separate the value-check (boolean, used only to decide *whether* to
call `publish` at all) from payload construction (Pattern 3) — `buildPayload`'s `blur_incomplete`
case must never accept or read a `value` field. Enforce with a unit test asserting
`Object.keys(payload)` for `blur_incomplete` is exactly `['type', 'targetSelector', 'bbox', 'timestamp']`
— no extra keys, and specifically no `value`/`amount` key — even when the test fixture element has a
non-empty `.value` at other points in its lifecycle.
**Warning signs:** Any function signature where a payload builder receives the input element AND is
also responsible for the emptiness decision in the same call; any object spread (`{...el.dataset}`
or similar) near payload construction.

### Pitfall 5: happy-dom has no real layout engine — scroll/geometry values are not "real" in unit tests

**What goes wrong:** A unit test scrolls a happy-dom-created `window` expecting `window.scrollY`,
`window.innerHeight`, or `getBoundingClientRect()` to reflect realistic values the way a real browser
would after actual layout — happy-dom (like jsdom) does not run a real rendering/layout engine, so
these values default to `0` or fixed stubs unless explicitly set by the test.
**Why it happens:** happy-dom is fast specifically because it skips real layout computation; this is
a deliberate tradeoff of the tool, not a bug.
**How to avoid:** Unit tests for `scroll_reversal` must explicitly set `window.innerHeight` (via
`Object.defineProperty` or happy-dom's window-construction options) and directly assign
`window.scrollY`/dispatch synthetic `scroll` events with pre-set values, rather than expecting
`window.scrollTo()` to produce realistic derived state. Reserve true pixel-accurate, real-layout
verification for the Playwright layer (a real headless browser genuinely lays out the page).
**Warning signs:** A scroll-reversal unit test that calls `window.scrollTo(0, 500)` and then asserts
based on `window.scrollY` without first confirming happy-dom actually updates that property from
`scrollTo` (it may not, depending on version) — verify this assumption directly against the
installed happy-dom version before writing the test, don't assume browser parity.

### Pitfall 6: `requestAnimationFrame` mistaken for a rate-limiting throttle

**What goes wrong:** Scroll-reversal detection wraps the `scroll` handler in `requestAnimationFrame`
expecting it to reduce the *frequency* of computation to some slower cadence (e.g., "once every
100ms") — but `rAF` fires at the display's refresh rate (~60fps), which is the *same* rate `scroll`
events already fire at on modern browsers. It does not throttle to a slower rate on its own.
**Why it happens:** `rAF`'s "runs once per frame" framing is easily conflated with "runs less often,"
when it actually just *coalesces* multiple `scroll` events that landed within the same frame into a
single scheduled callback — a real benefit, but a different one than time-based throttling.
**How to avoid:** Use `rAF` for what it's good at (coalescing per-frame work: a boolean
"already scheduled this frame" flag gates re-entrancy) and, if a slower cadence is actually wanted,
combine it with an explicit elapsed-time check inside the callback, not `rAF` alone.
**Warning signs:** Code comments claiming "`rAF` throttles this to Nms" without an accompanying
`Date.now()`/timestamp comparison actually enforcing that interval.
[CITED: developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event — passive listener guidance;
corroborated by multiple scroll-performance sources on the rAF-vs-throttle distinction]

### Pitfall 7: Test-harness page isn't tall enough to genuinely cross the 40% scroll-depth threshold

**What goes wrong:** `test-harness/index.html`'s current content (3 short `.screen` sections) may
not produce enough total scrollable height for `window.scrollTo()` to move `scrollY` past 40% of
`window.innerHeight` on a real device viewport — if total document height is shorter than or close
to the viewport height, there is nothing to scroll, and the debug-panel's "Simulate scroll_reversal"
button (D-08) cannot exercise the real listener's threshold logic even though it dispatches a real
`scroll` event.
**Why it happens:** The harness was built in Phase 1 purely to expose the 7 selectors and prove bus
plumbing — no one needed real scrollable height until this phase's D-08 rewiring.
**How to avoid:** Add a small amount of filler height to `test-harness/index.html` (e.g., a spacer
element or simply enough vertical padding across the existing screens) so a real `window.scrollTo()`
call can meaningfully cross the 40% threshold on a typical viewport. Verify this concretely: open the
harness and confirm `document.documentElement.scrollHeight > window.innerHeight * 1.5` (enough
headroom to scroll down 40%+ and back).
**Warning signs:** D-08's rewired scroll-reversal button appears to work in a unit test (which can
freely stub `scrollY`/`innerHeight`) but silently no-ops when manually clicked in a real browser
because there's nothing to scroll.

## PII-Safety Verification Approach (SIG-05)

"Confirmed by code inspection of the payload-construction path" should concretely mean the
following three checks, at least one of which must be automated (not just asserted in prose):

1. **Structural allow-list unit test (required):** For each of the 4 signal types, assert
   `Object.keys(payload).sort()` deep-equals an explicit allow-listed array. This is the single
   strongest, cheapest, fully-automatable form of this verification — any accidental extra field
   (a stray `value`, `text`, `id`, or `class` key) fails the test immediately, for every future code
   change, not just at initial review time.
2. **Single-choke-point code review (Pattern 3):** Because `buildPayload()` is the only function
   that constructs the object passed to `publish()`, a reviewer only needs to read one ~20-line
   function to confirm no PII-shaped field (element `.value`, `.textContent`, `.innerHTML`,
   `localStorage`, `document.cookie`) is ever read inside it — rather than auditing every call site
   in all four signal handlers.
3. **Grep-based static check (optional, defense-in-depth):** A test or CI step that greps
   `signal.js` for `.value`, `.textContent`, `.innerText`, `localStorage`, `document.cookie` and
   confirms any matches occur *only* inside the blur-handler's internal empty-check (never inside
   `buildPayload` itself, never assigned to a variable that flows into `publish()`). This is
   secondary to (1) — a structural test is stronger evidence than a text grep, but the grep is cheap
   defense-in-depth against future refactors accidentally merging the value-check and payload-build
   steps back together.

The tightest edge case (and the one worth explicit test coverage) is `blur_incomplete`: the handler
*must* read `amountInput.value` internally to satisfy D-03, but the emitted payload must never
contain it. A test that sets `amountInput.value = 'some amount'` after focus, then blurs while it's
non-empty (expecting **no** signal to fire at all per D-03/SIG-02), and separately a test that blurs
while empty (expecting a signal to fire whose payload contains none of `amountInput`'s content) both
belong in `signal.test.js`.

## Code Examples

### Scroll Reversal with Hysteresis Delta (SIG-03, D-05)

Sensible default: a **50px minimum reversal delta** (roughly 5-6% of a 390×844 iPhone viewport
height), applied *after* the 40% depth threshold is first crossed. This filters iOS rubber-band
overscroll bounce and momentum micro-jitter (commonly tens of pixels) without requiring the user to
scroll back a large, deliberate distance. Expose it as a configurable field so a partner integration
can tune it without a code change, consistent with D-05's "configurable" requirement.

```javascript
// signal.js — scroll reversal
const DEPTH_THRESHOLD_PCT = config.signals?.scrollReversal?.depthThresholdPct ?? 0.4; // SIG-03 default
const MIN_REVERSAL_DELTA_PX = config.signals?.scrollReversal?.minReversalDeltaPx ?? 50; // D-05 discretion

let maxScrollY = 0;
let thresholdCrossed = false;
let reversalArmed = false; // true once we've seen scrollY start decreasing past threshold
let rafScheduled = false;

function onScroll() {
  if (rafScheduled) return; // coalesce multiple scroll events into one computation per frame
  rafScheduled = true;
  requestAnimationFrame(() => {
    rafScheduled = false;
    checkScrollReversal();
  });
}

function checkScrollReversal() {
  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const depthPct = scrollY / viewportHeight;

  if (scrollY > maxScrollY) {
    maxScrollY = scrollY;
    if (depthPct >= DEPTH_THRESHOLD_PCT) thresholdCrossed = true;
    reversalArmed = false; // still scrolling down — reset any partial reversal tracking
    return;
  }

  // scrollY <= maxScrollY: potentially reversing
  if (thresholdCrossed && maxScrollY - scrollY >= MIN_REVERSAL_DELTA_PX) {
    publish('signal:detected', buildPayload('scroll_reversal', { scrollDepth: depthPct }));
    thresholdCrossed = false; // one emission per down-then-up cycle; re-arms on next descent
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
```

### Back Intent with Cached flowComplete Flag (SIG-04, D-06)

See Pattern 1's `initSignalCapture` example above — the `popstate` listener checks the
module-level `flowCompleteFlag` (updated only by the shared MutationObserver callback), never
performing a live `document.querySelector` inside the `popstate` handler itself.

### Debug-Panel Rewiring to Dispatch Real Events (D-08)

```javascript
// test-harness/index.html — replaces the Phase 1 bus.publish()-calling buttons
function simulateHold(el, holdMs) {
  const touch = new Touch({ identifier: Date.now(), target: el, clientX: 0, clientY: 0 });
  el.dispatchEvent(new TouchEvent('touchstart', {
    touches: [touch], targetTouches: [touch], changedTouches: [touch], bubbles: true, cancelable: true,
  }));
  setTimeout(() => {
    el.dispatchEvent(new TouchEvent('touchend', {
      touches: [], targetTouches: [], changedTouches: [touch], bubbles: true, cancelable: true,
    }));
  }, holdMs);
}

function simulateBlurIncomplete(el) {
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.value = ''; // ensure empty at blur time
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

function simulateScrollReversal() {
  window.scrollTo(0, window.innerHeight * 0.5); // past 40% depth
  window.dispatchEvent(new Event('scroll'));
  window.scrollTo(0, window.innerHeight * 0.5 - 100); // reverse by >50px
  window.dispatchEvent(new Event('scroll'));
}

function simulateBackIntent() {
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}
```

**Fidelity note (flagged explicitly per research focus item 6):** `dispatchEvent()`-originated
events always have `isTrusted: false` — this does **not** prevent `signal.js`'s own
`addEventListener` callbacks from firing (untrusted-event handling only affects browser default
actions like `requestFullscreen`, not ordinary listener invocation), so this rewiring genuinely
exercises the real capture path, not a bypass. However, this is **not equivalent to** Playwright's
`hasTouch: true` real-device-emulated touch input, which drives the full compositor-thread input
pipeline. The debug panel's synthetic-but-real events prove `signal.js`'s *listener logic* is wired
correctly (timer start/cancel, bbox capture, payload shape); they are not a substitute for
Phase 6/INTEG-01's real-device manual testing sequence or Branch 3's Playwright-driven sessions —
this mirrors 01-RESEARCH.md's Pitfall 4 (synthetic triggers ≠ real interaction coverage) one layer
deeper (event-construction fidelity vs. bus-plumbing fidelity).

### happy-dom vs. Playwright Test Split

Given `test-harness/index.html` loads `dist/sdk.js` via a `<script>` tag, and happy-dom's
`document.write()` + external-script-execution fidelity for a *relative-path* `<script src>` is
uncertain (untested in this project; Phase 1's `harness.test.js` only counted selectors via
`document.write`, never exercised script execution), the recommended test split is:

- **Unit tests (`signal.test.js`, `signal-spa.test.js`):** Import `signal.js` directly as an ES
  module against a happy-dom-created detached DOM fixture (not the actual harness HTML file) and
  dispatch synthetic events directly via `element.dispatchEvent()`. This is fast, deterministic, and
  does not depend on `dist/sdk.js` having been built.
- **Playwright test (new or extended `tests/e2e/harness.spec.js`):** After `npm run build`, open the
  actual `test-harness/index.html` in a real (headless, or `hasTouch: true` mobile-viewport-emulated)
  browser and click the rewired debug-panel buttons, asserting the `#log` panel shows the expected
  signal receipts. This is the layer that actually proves D-08's HTML/script wiring works — happy-dom
  unit tests cannot substitute for it.

## State of the Art

No stale/deprecated patterns apply — `TouchEvent`, `MutationObserver`, `popstate`, `FocusEvent`, and
passive scroll listeners are all long-stable, unchanged browser primitives. One relevant modern
nuance: the historical "300ms tap delay" (browsers waiting to distinguish a tap from a
double-tap-to-zoom gesture) has been largely eliminated on mobile browsers that respect
`<meta name="viewport" content="width=device-width">` (already present in `test-harness/index.html`),
so `touchend` firing quickly after `touchstart` for a genuine tap is not itself delayed by the
browser — the phase's own 800ms threshold is the only relevant timing gate, not a legacy browser tap
delay.

**Deprecated/outdated:** None identified specific to this phase's APIs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 50px minimum reversal delta (D-05 default) — not sourced from any authoritative spec or benchmark, derived from general "filter momentum jitter" reasoning and typical mobile-viewport proportions | Code Examples (Scroll Reversal) | Low-Medium — purely a tuning default; if too small, false-positives on iOS overscroll bounce; if too large, real reversals go undetected. Easily adjusted via the `minReversalDeltaPx` config field once observed against real usage; not a breaking/architectural risk either way |
| A2 | "Any touchmove cancels the hold timer" (no pixel tolerance) as the V0 touchmove-cancellation policy | Pattern 2 | Low — matches common long-press implementation patterns, but if real usage shows natural finger tremor causing false-negative cancellations, a small pixel-distance tolerance can be added later without changing the signal's payload shape or public behavior |
| A3 | happy-dom's `document.write()` + relative-path `<script src>` execution fidelity is "uncertain" for testing the actual harness HTML file | happy-dom vs. Playwright Test Split | Low — the recommendation (unit-test `signal.js` directly, Playwright-test the harness HTML) is the safer choice regardless of whether happy-dom's script execution turns out to work fine; worst case this assumption merely means an unnecessary test-layer split, not a functional gap |
| A4 | `window.scrollTo()` reliably updates `window.scrollY` inside happy-dom the same way a real browser would | Common Pitfalls #5 | Medium — if false, `scroll_reversal` unit tests must explicitly stub `scrollY` via `Object.defineProperty` rather than relying on `scrollTo()`; this should be verified directly against the installed happy-dom 20.10.6 version at plan/implementation time before writing tests around it |

## Open Questions

1. **Does `config/schema.json` need new `signals.*` threshold fields added this phase, or should the
   defaults (800ms, 40%, 50px) live as hardcoded constants in `signal.js` with config as an optional
   override only?**
   - What we know: D-05 explicitly says the scroll-reversal delta must be "configurable... needs a
     sensible default," implying a config field is expected, not just a hardcoded constant. The
     existing validator (`src/config.js`) tolerates new optional properties without any schema
     changes breaking `demo-platform.json`.
   - What's unclear: Whether the planner should treat this as "extend `schema.json` with an optional
     `signals` object this phase" (recommended, see Recommended Project Structure note) or defer the
     config surface entirely to a later phase and just hardcode defaults with a code comment.
   - Recommendation: Extend `schema.json` with an optional (non-`required`) `signals` object this
     phase — it's a small, additive, backward-compatible change and directly satisfies D-05's
     "configurable" language rather than deferring it.

2. **Should `attachListeners`/`initSignalCapture` expose a teardown/`disconnect()` function?**
   - What we know: Neither the spec (`repo2_heed_sdk.txt`) nor CONTEXT.md mentions SDK teardown; the
     harness and real partner pages are expected to run for the lifetime of the page load, not be
     dynamically un-instrumented.
   - What's unclear: Whether Phase 6 (Integration Verification) or a later phase will need a
     teardown path for repeated test runs within a single Playwright session.
   - Recommendation: Not required this phase; `MutationObserver.disconnect()`/listener-removal can be
     added later without changing the public payload/bus contract if it becomes necessary.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | Vitest, esbuild build step | Yes | v22.20.0 (confirmed in 01-RESEARCH.md) | — |
| A real mobile-capable browser or Playwright with `hasTouch: true` | Manual/Playwright verification of real touch fidelity (D-08 fidelity note) | Assumed available (Playwright already a devDependency; project's own STACK.md documents `hasTouch: true` + iPhone viewport preset usage) | @playwright/test 1.61.1 | — |
| happy-dom | Unit tests for all 4 signal types | Yes | 20.10.6 (installed, confirmed 01-RESEARCH.md) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — all tooling required by this phase is already
installed from Phase 1; no new environment dependency introduced.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 + happy-dom 20.10.6 (unchanged from Phase 1) |
| Config file | `vitest.config.js` (`environment: 'happy-dom'`, already exists) |
| Quick run command | `npx vitest run tests/signal.test.js tests/signal-spa.test.js` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| SIG-01 | 800ms held touch on a CTA fires `touch_hesitation` live; <800ms release fires nothing | unit (`vi.useFakeTimers()`) | `npx vitest run tests/signal.test.js -t "SIG-01"` | ❌ Wave 0 |
| SIG-02 | Blur with unchanged (empty) value fires `blur_incomplete`; blur after a value change fires nothing | unit | `npx vitest run tests/signal.test.js -t "SIG-02"` | ❌ Wave 0 |
| SIG-03 | Scroll past 40% then reverse by ≥50px fires `scroll_reversal`; momentum jitter under the delta does not | unit (with explicit `scrollY`/`innerHeight` stubs per Pitfall 5) | `npx vitest run tests/signal.test.js -t "SIG-03"` | ❌ Wave 0 |
| SIG-04 | `popstate` while cached `flowComplete` is false fires `back_intent`; true does not | unit | `npx vitest run tests/signal.test.js -t "SIG-04"` | ❌ Wave 0 |
| SIG-05 | Every emitted payload's key set matches its signal type's allow-list exactly — no extra/PII-shaped fields | unit (structural allow-list assertion, see PII-Safety Verification) | `npx vitest run tests/signal.test.js -t "SIG-05"` | ❌ Wave 0 |
| SIG-06 | 3+ simulated SPA navigations re-attach exactly once per navigation via WeakSet; no double-firing, no missed re-attachment | unit (direct `maybeReattach` calls per Pitfall 3) | `npx vitest run tests/signal-spa.test.js -t "SIG-06"` | ❌ Wave 0 |
| D-08 | Rewired debug-panel buttons dispatch real events that produce real bus receipts, visible in the harness `#log` panel | Playwright (real browser, after `npm run build`) | `npx playwright test tests/e2e/harness.spec.js` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/signal.test.js tests/signal-spa.test.js`
- **Per wave merge:** `npx vitest run` (full suite)
- **Phase gate:** Full suite green, plus the Playwright D-08 smoke test green, plus a manual
  press-and-hold/blur/scroll/back-button walkthrough of `test-harness/index.html` in a real mobile
  viewport before `/gsd-verify-work` (mirrors Phase 1's manual-verification gate pattern).

### Wave 0 Gaps

- [ ] `tests/signal.test.js` — covers SIG-01, SIG-02, SIG-03, SIG-04, SIG-05
- [ ] `tests/signal-spa.test.js` — covers SIG-06 (kept separate from the fake-timer-using tests per
  Pitfall 3's happy-dom/Vitest fake-timer + MutationObserver interaction warning)
- [ ] `tests/e2e/harness.spec.js` (Playwright) — covers D-08's real-browser fidelity requirement
- [ ] `config/schema.json` — optional `signals.*` threshold fields (see Open Question 1)
- [ ] `test-harness/index.html` — added scroll-height filler content (Pitfall 7) so real scroll
  gestures/simulated scroll can genuinely cross the 40% depth threshold

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth surface in signal capture |
| V3 Session Management | No | Not applicable — no session/cookie handling in this phase |
| V4 Access Control | No | No access-control boundary; single-tenant-per-page-load client code |
| V5 Input Validation | Yes | `config/schema.json`'s existing hard-fail validator (Phase 1) already covers config-shape validation; this phase adds no new external input surface — DOM events are not "input" in the ASVS sense (no user-supplied strings are parsed/executed) |
| V6 Cryptography | No | No cryptographic operations in this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| PII/field-value leakage into signal payloads (the central risk of this entire phase) | Information Disclosure | Centralized `buildPayload()` choke point (Pattern 3) + structural allow-list unit tests (PII-Safety Verification section) — this is this phase's primary security control, not a generic library |
| Internal bus traffic observable by host-page scripts | Information Disclosure | Already mitigated by Phase 1's private `EventTarget` (`bus.js`) — this phase does not alter that; `signal.js` only ever calls the existing `publish()` wrapper, never constructs its own `CustomEvent` |
| A malicious/compromised host page synthesizing fake `touchstart`/`popstate` events to manipulate `signal.js` into firing arbitrary signals | Spoofing | Out of scope for v1 — `signal.js` has no way to distinguish trusted (`isTrusted: true`) from untrusted events without explicitly checking `event.isTrusted`, and the spec does not require this hardening for a first-party/dummy-platform harness context; worth flagging as a v2 hardening consideration if the SDK is ever embedded on a page whose script integrity isn't fully trusted (real partner pilots) |

## Sources

### Primary (HIGH confidence)
- `branch spec files/repo2_heed_sdk.txt` — canonical signal definitions, payload shapes, SPA-safety
  strategy (MutationObserver + popstate + WeakSet)
- `CONTRACT.md` — 7 locked `data-heed` selectors
- `.planning/phases/02-signal-capture-layer/02-CONTEXT.md` — locked decisions D-01 through D-08
- `.planning/REQUIREMENTS.md`, `.planning/PROJECT.md`, `.planning/STATE.md` — this repo
- `src/bus.js`, `src/index.js`, `src/config.js`, `config/schema.json`, `config/demo-platform.json`,
  `test-harness/index.html` — direct inspection of existing Phase 1 code this phase builds on
- `.planning/phases/01-config-layer-bus-standalone-test-harness/01-RESEARCH.md` — prior phase's bus
  patterns and pitfalls (Pitfall 4 on synthetic-vs-real signal coverage directly informs this
  phase's D-08 fidelity note)

### Secondary (MEDIUM confidence)
- [MDN — Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) — long-press
  timer + touchmove-cancellation pattern [CITED]
- [MDN — Working with the History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API/Working_with_the_History_API) — confirms `pushState()` does not fire `popstate` [CITED]
- [MDN — Document: scroll event](https://developer.mozilla.org/en-US/docs/Web/API/Document/scroll_event) — passive listener + scroll-performance guidance [CITED]
- [capricorn86/happy-dom GitHub source (BrowserWindow.ts)](https://github.com/capricorn86/happy-dom/blob/master/packages/happy-dom/src/window/BrowserWindow.ts) — confirms `TouchEvent`/`PopStateEvent` classes present in happy-dom's Window implementation [CITED]
- [capricorn86/happy-dom Issue #2097](https://github.com/capricorn86/happy-dom/issues/2097) — MutationObserver + Vitest fake-timer interaction issue [CITED]
- [MDN — TouchEvent() constructor](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent) — synthetic `TouchEvent`/`Touch` construction for testing [CITED]
- [MDN — PopStateEvent](https://developer.mozilla.org/en-US/docs/Web/API/PopStateEvent) — synthetic `popstate` dispatch [CITED]

### Tertiary (LOW confidence)
- General WebSearch results on scroll-throttle/rAF best practices, SPA route-change detection
  patterns, and touch-hold implementation examples — used to corroborate the recommendations above,
  cross-referenced across 2-3 sources each, not independently verified against a single canonical
  source per claim [ASSUMED, low-risk tuning defaults only — see Assumptions Log A1/A2]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency introduced; all tooling already installed and verified
  in Phase 1's research
- Architecture: MEDIUM-HIGH — WeakSet/MutationObserver/popstate pattern is directly specified by the
  canonical `repo2_heed_sdk.txt` spec, not invented this session; the single-choke-point payload
  builder and single-gate-function re-attachment design are this session's own synthesis but follow
  directly from the locked decisions and Phase 1's own "centralize the risky operation" pattern
  (bus.js's `CustomEvent` construction)
- Pitfalls: MEDIUM — touch-timer race-condition reasoning and MutationObserver-async-timing pitfalls
  are derived from JS execution-model fundamentals (HIGH confidence in the reasoning itself); the
  happy-dom-specific behavioral claims (script-execution fidelity, `scrollTo`/`scrollY` interaction)
  are flagged LOW/MEDIUM and logged as assumptions requiring direct verification during
  implementation, not asserted as settled fact

**Research date:** 2026-07-14
**Valid until:** 2026-08-13 (30 days — all findings are stable, unchanging browser/JS primitives;
the only volatility risk is the two happy-dom-specific behavioral assumptions, which should be
spot-checked against the installed version at implementation time regardless of this date)

