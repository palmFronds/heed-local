# Phase 2: Signal Capture Layer - Context

**Gathered:** 2026-07-13
**Status:** Ready for planning

<domain>
## Phase Boundary

All 4 signal types (touch hesitation, blur incomplete, scroll reversal, back intent) are captured
cleanly from raw DOM events, survive SPA navigation without double-firing or silent
under-attachment, and emit strictly PII-free payloads onto the internal bus (`src/bus.js`) for
`inference.js` (Phase 3) to consume. This phase delivers `signal.js` and its wiring into
`src/index.js`'s `init()`/`initDemo()` — it does not touch inference, response rendering, or
logging.

</domain>

<decisions>
## Implementation Decisions

### Touch Hesitation Mechanics
- **D-01:** `touch_hesitation` fires **live** via `setTimeout` at the 800ms mark, while the touch
  is still held — not retrospectively on `touchend`. The whole point is real-time intervention;
  firing only after release means the user has already decided and left.
- **D-02:** Touch-hesitation (and blur) monitoring scope is **CTA-style selectors only** —
  `proceedCta`, `confirmCta`, `backBtn`. `feeRow` and `minReceivedRow` are explicitly excluded —
  users scroll past those, they don't hold them; monitoring them would be noise, not signal.

### Blur Incomplete
- **D-03:** `blur_incomplete` uses a **final-value diff at blur time only** — empty value at blur
  = incomplete, regardless of whether the user typed something and cleared it back to empty.
  (Typed-then-cleared is arguably a stronger hesitation signal, but V0 keeps this simple —
  documented here as an accepted V0 simplification, not an oversight.)
- **D-04:** The blur listener applies **only to `amountInput`** — it's the only input element in
  the flow.

### Scroll Reversal
- **D-05:** `scroll_reversal` requires a **minimum reversal delta** after crossing the 40%
  viewport-depth threshold — not just any upward `scrollY` decrease. This filters out
  jitter/momentum micro-bounces so the signal reflects a meaningful retreat. The exact delta
  value (configurable, needs a sensible default) is Claude's discretion during planning/research.

### Back Intent
- **D-06:** The `flowComplete` check at `popstate` time uses a **cached internal flag**, updated
  once via MutationObserver/bus when the completion selector first appears — not a live DOM
  query inside the `popstate` handler itself.

### Signal Payload Shape
- **D-07:** For `scroll_reversal` and `back_intent` — which have no single "held" DOM element the
  way `touch_hesitation`/`blur_incomplete` do — `targetSelector`/`bbox` are **null/omitted**.
  `scroll_reversal` carries a `scrollDepth` field instead; `back_intent` carries a `pathname`
  field instead. This is a deliberate, deviation from REQUIREMENTS.md's literal
  `{ type, targetSelector, bbox, timestamp }` payload-shape wording for all 4 signals — the
  planner/researcher should surface this explicitly rather than silently reconciling it.

### Test Harness Integration
- **D-08:** Phase 1's synthetic debug-panel buttons get **rewired to dispatch real DOM events**
  (fake `touchstart`/`touchend` sequences, `blur`, `scroll`, `popstate`) instead of calling
  `bus.publish()` directly. This makes the debug panel exercise `signal.js`'s real capture path
  rather than bypassing it.

### Claude's Discretion
- Exact scroll-reversal minimum-delta value and its config field/default.
- Exact WeakSet re-attachment granularity (per-element vs. per-listener-type tracking) — a
  concrete `attachListeners(config)` implementation detail, not a user-facing decision.
- Scroll-listener performance strategy (passive listener flag, debounce/throttle interval).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Signal Capture Spec
- `branch spec files/repo2_heed_sdk.txt` — Branch 2 spec; "Signal capture layer (signal.js)" and
  "SPA safety (MutationObserver + popstate)" sections are the ground truth for all 4 signal
  definitions, payload shapes, and re-attachment strategy.
- `CONTRACT.md` — the 7 locked `data-heed` selectors this phase's listeners attach to.
- `.planning/REQUIREMENTS.md` — SIG-01 through SIG-06 (this phase's requirement IDs).

### Existing Code (Phase 1 output)
- `.planning/phases/01-config-layer-bus-standalone-test-harness/01-RESEARCH.md` — bus/event
  patterns (private `EventTarget`, `CustomEvent` `{ detail }` wrapping) that `signal.js` must
  follow when publishing.
- `.planning/phases/01-config-layer-bus-standalone-test-harness/01-PATTERNS.md` — existing
  pattern map for this codebase.
- `config/schema.json`, `config/demo-platform.json` — selector names (`amountInput`, `feeRow`,
  `minReceivedRow`, `proceedCta`, `confirmCta`, `backBtn`, `flowComplete`) signal.js reads to
  resolve DOM targets.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/bus.js` `publish`/`subscribe` — `signal.js` imports `publish` and calls it once per
  detected signal with the constructed payload as `detail`.
- `src/index.js` `init()`/`initDemo()` — the orchestrator this phase's listener-attachment entry
  point (e.g. `attachListeners(config)`) plugs into.
- `config/demo-platform.json` `selectors` object — already resolves all 7 `data-heed` targets;
  D-02's CTA-only scope picks `proceedCta`/`confirmCta`/`backBtn` from this existing list.

### Established Patterns
- Private module-scoped `EventTarget` in `bus.js`, never bound to any host-page global — must not
  be violated by anything this phase adds.
- `bus.js`'s `publish()` already wraps payloads in `{ detail }` — `signal.js` just needs to pass
  the right `type`/payload; it does not construct `CustomEvent` itself.

### Integration Points
- `test-harness/index.html` debug panel — needs the D-08 rewiring from synthetic `bus.publish()`
  calls to real dispatched DOM events.
- `src/index.js` `init()` — where `signal.js`'s listener attachment gets wired in for both
  `init(rawConfig)` and `initDemo()`.

</code_context>

<specifics>
## Specific Ideas

No specific UI/reference examples beyond the decisions captured above — the spec's own wording
(`branch spec files/repo2_heed_sdk.txt`) is the primary source of truth for exact signal
semantics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 2's scope (signal capture only; no inference, response, or
logging decisions were made here).

</deferred>

---

*Phase: 2-Signal Capture Layer*
*Context gathered: 2026-07-13*
