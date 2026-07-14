# Phase 2: Signal Capture Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-13
**Phase:** 2-Signal Capture Layer
**Areas discussed:** Touch-hesitation firing mechanism, Touch-hesitation monitoring scope, Blur-incomplete value-change semantics, Real DOM capture vs. harness synthetic triggers, Scroll-reversal sensitivity, Back-intent/flowComplete check, Signal payload shape for scroll/back

---

## Touch-hesitation firing mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Live firing via setTimeout at 800ms | Response can render while the finger is still held — real-time intervention | ✓ |
| Retrospective firing on touchend | Simpler, but no response until release | |

**User's choice:** Live firing via setTimeout at 800ms.
**Notes:** "Response should render while the finger is still held — that's the whole point of real-time intervention. Firing retrospectively on touchend means the user has already made a decision before the response appears."

---

## Touch-hesitation monitoring scope

| Option | Description | Selected |
|--------|-------------|----------|
| All 7 selectors | amountInput, feeRow, minReceivedRow, proceedCta, confirmCta, backBtn | |
| CTA-style buttons only | proceedCta, confirmCta, backBtn | ✓ |

**User's choice:** CTA-style buttons only — proceedCta, confirmCta, backBtn.
**Notes:** "Touch hesitation on feeRow and minReceivedRow is noise, not signal. Users scroll past those rows, they don't hold them. Restricting to CTAs keeps the signal clean."

---

## Blur-incomplete value-change semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Any keystroke ever entered counts as "changed" | Even if later cleared back to empty | |
| Final-value diff at blur time only | Empty at blur = incomplete, regardless of history | ✓ |

**User's choice:** Final-value diff at blur time only; applies only to amountInput.
**Notes:** "If the user typed something and cleared it back to empty, that's actually a stronger hesitation signal than never typing at all — but for V0, keep it simple: empty at blur = incomplete. Apply only to amountInput — it's the only input in the flow."

---

## Real DOM capture vs. harness synthetic triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both, side by side | Synthetic buttons stay as-is; real listeners run independently | |
| Replace buttons with real triggers | Remove synthetic buttons; debug panel becomes observational only | |
| Rewire buttons to dispatch real DOM events | Buttons stay, but dispatch synthetic DOM events through signal.js's real capture path | ✓ |

**User's choice:** Rewire buttons to dispatch real DOM events.
**Notes:** None beyond selection.

---

## Scroll-reversal sensitivity

| Option | Description | Selected |
|--------|-------------|----------|
| Any upward scroll | Any scrollY decrease after 40% threshold fires immediately | |
| Minimum reversal delta | Requires a configurable minimum reversal before firing | ✓ |

**User's choice:** Minimum reversal delta.
**Notes:** Exact delta value left to Claude's discretion during planning/research.

---

## Back-intent / flowComplete check

| Option | Description | Selected |
|--------|-------------|----------|
| Live DOM check of completionSelector | Query the DOM at popstate time | |
| Cached flag updated by MutationObserver/bus | Internal boolean flipped once when completion selector first appears | ✓ |

**User's choice:** Cached flag updated by a MutationObserver/bus.
**Notes:** None beyond selection.

---

## Signal payload shape for scroll_reversal / back_intent

| Option | Description | Selected |
|--------|-------------|----------|
| Nearest config selector in view | targetSelector/bbox = nearest element to the event position | |
| Null/omitted with scroll or path data instead | targetSelector/bbox null; scroll_reversal carries scrollDepth, back_intent carries pathname | ✓ |

**User's choice:** Null/omitted with scroll or path data instead.
**Notes:** Accepted as a deliberate deviation from REQUIREMENTS.md's literal uniform payload-shape wording — flagged for the planner/researcher to surface explicitly rather than silently reconcile.

---

## Claude's Discretion

- Exact scroll-reversal minimum-delta value and its config field/default.
- Exact WeakSet re-attachment granularity (per-element vs. per-listener-type tracking).
- Scroll-listener performance strategy (passive listener flag, debounce/throttle interval).

## Deferred Ideas

None — discussion stayed within Phase 2's scope.
