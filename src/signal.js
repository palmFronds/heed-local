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

// SIG-06: attachedElements is the SOLE idempotency gate for re-attachment,
// keyed on DOM ELEMENT IDENTITY (not selector string). In a real SPA route
// swap the OLD amountInput/CTA elements are detached and eventually
// garbage-collected — their WeakSet entries disappear for free, zero manual
// cleanup — while the NEW route's elements are different objects, so
// `attachedElements.has(newEl)` is false and they correctly receive fresh
// listeners. A `Set<string>` keyed on selector string would instead treat
// "I've seen this selector before" as "already wired" and silently fail to
// attach to the new element post-swap — the exact silent-under-attachment
// failure mode SIG-06 guards against (02-RESEARCH.md Pattern 1).
const attachedElements = new WeakSet();
// lastPathname is the ONLY state maybeReattach() diffs against — it is the
// single pathname-gated re-attach path reached from both the
// MutationObserver callback and the popstate listener (SIG-06).
let lastPathname = window.location.pathname;
// D-06's cached flowComplete flag — read by the popstate handler instead of
// a live DOM query. checkFlowComplete() below is the only place that ever
// sets it true.
let flowCompleteFlag = false;

/**
 * D-06: sets flowCompleteFlag the first time the completion element resolves
 * as VISIBLE — never clears it once true (this function only ever sets it,
 * it does not reset it; see attachListeners' reset comment below for why a
 * separate reset path exists at the attach-pass boundary instead). Checks
 * `el.style.display !== 'none'` rather than mere presence in the DOM: a real
 * SPA route swap would remove the completion element from the DOM entirely
 * when it isn't the active screen, but this project's shared test fixture
 * (and potentially a real partner page using CSS-based show/hide instead of
 * conditional rendering) keeps the element present with `display: none`
 * until the completion screen is actually reached — treating mere presence
 * as "resolved" would latch the flag true on the very first attach pass,
 * before the completion screen has genuinely appeared.
 * @param {*} config
 */
function checkFlowComplete(config) {
  if (flowCompleteFlag) return; // once true, this function never clears it (D-06)
  const selector = config.selectors?.flowComplete ?? config.completionSelector;
  const el = document.querySelector(selector);
  if (el && el.style.display !== 'none') {
    flowCompleteFlag = true;
  }
}

/**
 * Entry point that wires the DOM-element/window signal handlers. Idempotent
 * per element via the attachedElements WeakSet (SIG-06) — safe to call
 * repeatedly (initial load, every genuine SPA navigation) without stacking
 * duplicate listeners on an element that was already wired.
 * @param {*} config
 */
export function attachListeners(config) {
  // Reset flowCompleteFlag at the top of every attach pass: an attach pass
  // only ever runs on initial load or a genuine route change (maybeReattach
  // only calls this on a pathname diff), so — mirroring attachScrollReversal's
  // established per-attach-pass state reset (Plan 02-02) — a fresh
  // route/session starts with a fresh "has THIS screen's completion element
  // appeared" baseline, recomputed immediately below by checkFlowComplete
  // against the current DOM. checkFlowComplete itself still never clears the
  // flag (its own body only ever sets it true), so a single attach pass
  // cannot both clear and then correctly re-detect within the same call in a
  // way that violates D-06's "cached, not live-queried in the popstate
  // handler" requirement — the live query still only ever happens here or in
  // maybeReattach, never inside the popstate listener itself.
  flowCompleteFlag = false;

  const targets = resolveTargets(config);
  for (const { el, selectorKey, selectorValue } of targets) {
    if (attachedElements.has(el)) continue; // idempotent — element already wired (SIG-06)
    attachedElements.add(el);
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
  checkFlowComplete(config); // re-check on every attach pass (D-06)
}

/**
 * The single pathname-gated re-attach gate (SIG-06) — the ONLY function that
 * diffs window.location.pathname against a remembered value and calls
 * attachListeners for re-attachment. Both the MutationObserver callback and
 * the popstate listener call this same function so there is exactly one
 * re-attachment code path to reason about (02-RESEARCH.md Pattern 1).
 * @param {*} config
 */
export function maybeReattach(config) {
  const currentPathname = window.location.pathname;
  if (currentPathname !== lastPathname) {
    lastPathname = currentPathname;
    attachListeners(config); // also re-checks flowComplete internally (D-06)
  } else {
    checkFlowComplete(config); // pathname unchanged, but completion element may have just appeared
  }
}

// Guards initSignalCapture's one-time MutationObserver/popstate registration
// — window and document.body are singletons for the page's lifetime, so a
// second registration would stack duplicate observers/listeners and cause
// double-firing. attachListeners itself stays un-guarded (see below) since
// it is already idempotent per element via the WeakSet.
let initialized = false;

/**
 * SDK entry point: wires the initial attach pass, then a single
 * MutationObserver (which drives BOTH pathname-gated re-attachment AND the
 * D-06 flowComplete flag update via maybeReattach → checkFlowComplete — one
 * observer instance, two responsibilities, never two observers) and a single
 * popstate listener (SIG-04) that also funnels through maybeReattach before
 * reading the cached flag.
 * @param {*} config
 */
export function initSignalCapture(config) {
  // Always safe to call — idempotent per element via the WeakSet (SIG-06) —
  // so repeat calls (e.g. against a freshly-rendered DOM) still pick up any
  // new elements even after the observer/popstate guard below has already
  // fired once.
  attachListeners(config);

  if (initialized) return; // never stack a second observer/popstate listener
  initialized = true;

  // ONE MutationObserver serves two jobs via maybeReattach: pathname-gated
  // re-attachment AND the flowComplete flag update (D-06) — never a second
  // observer instance (02-RESEARCH.md Anti-Patterns).
  const observer = new MutationObserver(() => maybeReattach(config));
  observer.observe(document.body, { childList: true, subtree: true });

  window.addEventListener('popstate', () => {
    maybeReattach(config);
    // Reads the CACHED flowCompleteFlag only — this handler never runs a
    // live querySelector for the completion element itself (D-06's explicit
    // requirement); the live check, when needed, happens inside
    // maybeReattach()/checkFlowComplete() above, synchronously, before this
    // line runs.
    if (!flowCompleteFlag) {
      publish(
        'signal:detected',
        buildPayload('back_intent', { pathname: window.location.pathname })
      );
    }
  });
}
