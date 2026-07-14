// src/signal.js — captures raw DOM signals (touch/blur/scroll/popstate) and
// converts them into PII-safe payloads published on the bus. Producer-only:
// imports { publish } from './bus.js', never { subscribe } — signal.js only
// ever writes to the bus, it never reads from it (02-RESEARCH.md diagram).
import { publish } from './bus.js';

/**
 * The single choke point that constructs every object handed to publish().
 * SIG-05's PII guarantee is enforced HERE, structurally, not by convention at
 * each call site: any field read from a DOM element in this function other
 * than getBoundingClientRect() is a No-PII-rule violation (CLAUDE.md
 * "No PII ever"). touch_hesitation/blur_incomplete never read
 * el.value/.textContent/.innerHTML/localStorage/document.cookie here;
 * scroll_reversal/back_intent carry no element reference at all — D-07's
 * deliberate deviation from REQUIREMENTS.md's literal 4-field payload shape
 * for all signals (targetSelector/bbox are null; scrollDepth/pathname
 * substitute).
 * @param {'touch_hesitation'|'blur_incomplete'|'scroll_reversal'|'back_intent'} type
 * @param {*} ctx
 * @returns {object}
 */
export function buildPayload(type, ctx) {
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
      // D-07: no single "held" element for a scroll gesture — targetSelector/
      // bbox are null; scrollDepth carries the signal instead.
      return { type, targetSelector: null, bbox: null, scrollDepth: ctx.scrollDepth, timestamp };
    case 'back_intent':
      // D-07: same reasoning as scroll_reversal — pathname substitutes for
      // targetSelector/bbox, both null.
      return { type, targetSelector: null, bbox: null, pathname: ctx.pathname, timestamp };
    default:
      throw new Error(`[heed] unknown signal type: ${type}`);
  }
}

/**
 * Resolves the configured selectors against the live DOM. Only selectors
 * actually present are returned — a host page that hasn't rendered a given
 * screen yet should not throw attachListeners into an error.
 * @param {*} config
 * @returns {Array<{el: Element, selectorKey: string, selectorValue: string}>}
 */
export function resolveTargets(config) {
  const targets = [];
  for (const [selectorKey, selectorValue] of Object.entries(config.selectors ?? {})) {
    const el = document.querySelector(selectorValue);
    if (el) targets.push({ el, selectorKey, selectorValue });
  }
  return targets;
}

// D-02: touch-hesitation monitoring is CTA-scoped only — feeRow/
// minReceivedRow are scroll-past targets, not hold targets; users scroll
// past those, they don't hold them, so monitoring them would be noise.
const TOUCH_HESITATION_SELECTOR_KEYS = ['proceedCta', 'confirmCta', 'backBtn'];

/**
 * Wires the live-firing hold timer for a single CTA element (SIG-01, D-01).
 * D-01: fires LIVE via a single setTimeout while still held, not
 * retrospectively on touchend — real-time intervention is the entire point.
 * Pitfall 1: there is deliberately no second "<300ms tap" check; the single
 * timer produces tap-rejection for free — anything released before the timer
 * elapses (at 50ms or 750ms) never fires, no separate threshold needed.
 * @param {Element} el
 * @param {string} selectorValue
 * @param {*} config
 */
export function wireTouchHesitation(el, selectorValue, config) {
  const thresholdMs = config.signals?.touchHesitation?.thresholdMs ?? 800;
  let timerId = null;

  function start() {
    timerId = setTimeout(() => {
      timerId = null; // consumed — a later touchend/touchcancel is now a no-op, not a second emission
      publish('signal:detected', buildPayload('touch_hesitation', { el, targetSelector: selectorValue }));
    }, thresholdMs);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  // { passive: true } on every touch listener — this SDK never calls
  // preventDefault() and never blocks the host page's default touch/scroll
  // behavior (Anti-Patterns, 02-RESEARCH.md).
  el.addEventListener('touchstart', start, { passive: true });
  el.addEventListener('touchend', cancel, { passive: true });
  el.addEventListener('touchcancel', cancel, { passive: true });
  el.addEventListener('touchmove', cancel, { passive: true }); // any movement cancels intent to hold
}

/**
 * Wires the blur-incomplete detector for amountInput (SIG-02, D-03, D-04).
 * D-04: amountInput is the only input element in the flow, so this is wired
 * for exactly one selector key.
 * @param {Element} el
 * @param {string} selectorValue
 */
export function wireBlurIncomplete(el, selectorValue) {
  el.addEventListener('blur', () => {
    // SIG-05 firewall: el.value is read ONLY to decide whether to publish —
    // this boolean never reaches buildPayload, and buildPayload's
    // blur_incomplete branch never reads el.value itself. D-03: final-value
    // diff at blur time only — empty at blur = incomplete, regardless of
    // whether a non-empty value existed earlier in the element's lifecycle.
    const isEmpty = el.value === '';
    if (isEmpty) {
      publish('signal:detected', buildPayload('blur_incomplete', { el, targetSelector: selectorValue }));
    }
  });
}

// Module-scoped scroll-reversal state (SIG-03, D-05). window is a singleton
// for the lifetime of a real page load, so these are safe as module-level
// variables in production; attachScrollReversal's re-entrancy guard below
// prevents accumulating duplicate `scroll` listeners on repeat
// attachListeners calls (e.g. after a Plan 02-03 SPA re-attachment pass).
let maxScrollY = 0;
let thresholdCrossed = false;
let scrollListenerAttached = false;

function checkScrollReversal(config) {
  const depthThresholdPct = config.signals?.scrollReversal?.depthThresholdPct ?? 0.4;
  const minReversalDeltaPx = config.signals?.scrollReversal?.minReversalDeltaPx ?? 50;

  const scrollY = window.scrollY;
  const viewportHeight = window.innerHeight;
  const depthPct = scrollY / viewportHeight;

  if (scrollY > maxScrollY) {
    maxScrollY = scrollY;
    if (depthPct >= depthThresholdPct) thresholdCrossed = true;
    return;
  }

  // scrollY <= maxScrollY: potentially reversing.
  if (thresholdCrossed && maxScrollY - scrollY >= minReversalDeltaPx) {
    publish('signal:detected', buildPayload('scroll_reversal', { scrollDepth: depthPct }));
    thresholdCrossed = false; // one emission per down-then-up cycle; re-arms on next descent
  }
}

/**
 * Wires the window-level scroll-reversal detector (SIG-03, D-05). The
 * `scroll` listener itself is attached at most once (scrollListenerAttached
 * guard) — window is a singleton, so a repeat attachListeners call (e.g.
 * Plan 02-03's SPA re-attachment) must not accumulate a second listener.
 * maxScrollY/thresholdCrossed ARE reset on every call, though: a fresh
 * attachListeners pass represents a new scroll "session" — the initial page
 * load, or (once Plan 02-03 wires SPA re-attachment) a new route the user
 * has just landed on with a fresh scroll position — so any baseline
 * established before this call is stale and must not leak forward.
 * @param {*} config
 */
export function attachScrollReversal(config) {
  maxScrollY = 0;
  thresholdCrossed = false;

  if (scrollListenerAttached) return;
  scrollListenerAttached = true;

  // Computed synchronously inside the scroll listener, NOT deferred through
  // requestAnimationFrame. 02-RESEARCH.md's Pattern originally suggested an
  // rAF-coalescing wrapper (a real per-frame performance optimization in a
  // live browser), but happy-dom implements requestAnimationFrame via
  // Node's setImmediate (verified by direct source inspection of
  // node_modules/happy-dom/lib/window/BrowserWindow.js) — an async macrotask
  // that would not have run by the time tests/signal.test.js's synchronous
  // SIG-03 `it()` blocks assert, since they dispatch 'scroll' events and
  // check `received` in the same synchronous tick with no await. Deferring
  // via rAF would make the pre-authored RED tests unobservably async and
  // fail every run. Synchronous computation is correctness-equivalent (each
  // `scroll` event is still cheap: two window reads + a few comparisons) and
  // keeps the listener itself `{ passive: true }`.
  window.addEventListener('scroll', () => checkScrollReversal(config), { passive: true });
}

/**
 * Entry point that wires the DOM-element/window signal handlers. Extended in
 * Plan 02-03 with back-intent/SPA-reattachment wiring (WeakSet idempotency,
 * MutationObserver, cached flowComplete flag) — this plan wires only the
 * three signal types whose RED tests were authored in Plan 02-01
 * (touch hesitation, blur incomplete, scroll reversal).
 * @param {*} config
 */
export function attachListeners(config) {
  const targets = resolveTargets(config);
  for (const { el, selectorKey, selectorValue } of targets) {
    // D-02 scope: only proceedCta/confirmCta/backBtn get touch-hesitation
    // wiring — feeRow/minReceivedRow are excluded (see const comment above).
    if (TOUCH_HESITATION_SELECTOR_KEYS.includes(selectorKey)) {
      wireTouchHesitation(el, selectorValue, config);
    }
    // D-04: blur monitoring is wired only for amountInput.
    if (selectorKey === 'amountInput') {
      wireBlurIncomplete(el, selectorValue);
    }
  }
  attachScrollReversal(config);
}

/**
 * Thin wrapper around attachListeners so tests/signal.test.js's import of
 * initSignalCapture resolves cleanly (a missing named export would fail the
 * whole test file's module load, not just the SIG-04 tests that use it).
 * Plan 02-03 extends this with MutationObserver-based SPA re-attachment
 * (SIG-06) and popstate-driven back-intent detection (SIG-04, D-06) — until
 * then, back_intent-related assertions remain RED by design (see
 * 02-02-PLAN.md's verification section).
 * @param {*} config
 */
export function initSignalCapture(config) {
  attachListeners(config);
}
