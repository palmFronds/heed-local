// src/response.js — response overlay rendering (RESP-01/02/03, D-04/D-05).
// Real implementation (Wave 2, Plan 04-04): injects a single fixed
// full-viewport overlay container at init, renders one of 4 response types
// mapped from src/inference.js's intent classes, positions the bubble via
// clampToViewport()'s safe-area-aware math (bbox-present anchored path OR
// bbox-null bottom-clamp fallback — the ONLY path discount_offer/social_proof
// ever take, 04-RESEARCH.md Pitfall 2), and enforces single-bubble-at-a-time
// concurrency (D-05): a new above-threshold inference:result while a bubble
// is already showing dismisses it first (dismissReason "replaced") before
// rendering the new one — only one bubble ever visible.
//
// No-PII firewall (CLAUDE.md "No PII ever", mirrors src/signal.js's
// buildPayload() firewall discipline, SIG-05/T-04-04): this module renders
// bubbles purely from already-PII-filtered bus payloads (`inference:result`)
// and never reads `.value` / `.textContent` / `.innerHTML` / `localStorage` /
// `document.cookie` from any host-page DOM element.
import { publish, subscribe } from './bus.js';
import { isActiveScreen } from './log.js'; // shared A5 gate — never re-implement the pathname check here

const GAP = 8;
const EDGE = 16;
const AUTO_DISMISS_MS = 6000;

// Intent class (src/inference.js CLASSES order) -> response type. D-04:
// hardcoded per 04-UI-SPEC.md's exact copy — not config-driven this phase.
const INTENT_TO_TYPE = {
  confusion: 'tooltip',
  price_doubt: 'discount_offer',
  trust_gap: 'social_proof',
  flow_friction: 'nudge_copy',
};

// Exact copy strings, locked by 04-UI-SPEC.md's "Response Types — Copy &
// Intent Mapping" table. Never read from config this phase (D-04).
const COPY = {
  tooltip: { body: 'Not sure what this means? Tap for a quick explanation.' },
  nudge_copy: { body: 'Almost there — one more step to finish.' },
  social_proof: { body: 'Thousands of people completed this safely today.' },
  discount_offer: { body: 'Complete now and save on fees.', cta: 'See offer' },
};

// discount_offer is a decision point, not a passive notice — it persists
// until the user taps the CTA or the dismiss control (04-UI-SPEC.md
// Animation contract). The other 3 types auto-dismiss after AUTO_DISMISS_MS.
const NO_AUTO_DISMISS = new Set(['discount_offer']);

// Overlay container, injected exactly once (RESP-01).
let container = null;
// Tracks the single currently-rendered bubble (D-05: only one at a time).
// Shape: { el: HTMLElement, responseType: string, timerId: number|null } | null
let current = null;
// Mutable module state, re-resolved EVERY initResponse() call so the
// once-registered inference:result handler always reads the CURRENT
// config/sessionId (mirrors src/inference.js's activeConfig pattern, CR-01).
let activeConfig = null;
let activeSessionId = null;
// Guards the one-time subscribe()/overlay-container-injection registration
// (mirrors src/inference.js line 134/245, src/signal.js line 312/330) —
// repeat initResponse() calls must never stack a second subscription or a
// second overlay container.
let initialized = false;

/**
 * 04-RESEARCH.md Pattern 1: one fixed full-viewport div, `pointer-events:
 * none` on the container itself so it never blocks host-page interaction
 * outside a rendered response element.
 * @returns {HTMLElement}
 */
function createOverlayContainer() {
  const el = document.createElement('div');
  el.setAttribute('data-heed-overlay', ''); // internal marker — NOT one of the 7 CONTRACT.md-locked selectors
  el.style.cssText =
    'position: fixed; top: 0; left: 0; width: 100%; height: 100%; ' +
    'pointer-events: none; z-index: 2147483647; overflow: hidden; box-sizing: border-box;';
  document.body.appendChild(el);
  return el;
}

/**
 * Reads an iOS safe-area-inset-* CSS env() value via a computed-style probe
 * element — env() is CSS-only, there is no direct JS API to read it. Falls
 * back to 0 (never NaN) when unavailable — 04-UI-SPEC.md's explicit
 * requirement, and the normal case in this project's happy-dom unit-test
 * environment, which does not evaluate env() at all.
 * @param {'top'|'bottom'|'left'|'right'} side
 * @returns {number}
 */
export function safeAreaInset(side) {
  const probe = document.createElement('div');
  probe.style.cssText = `position: fixed; padding-${side}: env(safe-area-inset-${side}, 0px);`;
  document.body.appendChild(probe);
  const value = parseFloat(getComputedStyle(probe).getPropertyValue(`padding-${side}`)) || 0;
  probe.remove();
  return value;
}

/**
 * RESP-02: positions a response bubble within safe-area-aware viewport
 * bounds. With a real bbox, anchors below the target (flipping above if the
 * below placement would overflow the safe-bottom bound). With a null bbox —
 * the ONLY path discount_offer/social_proof ever take (04-RESEARCH.md
 * Pitfall 2, NOT a rare edge case) — falls back to a bottom-clamp placement.
 * Never returns NaN: safeAreaInset() always resolves to a number.
 * @param {{x:number,y:number,width:number,height:number}|null} bbox
 * @param {number} bubbleWidth
 * @param {number} bubbleHeight
 * @returns {{left:number, top:number}}
 */
export function clampToViewport(bbox, bubbleWidth, bubbleHeight) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const safeTop = EDGE + safeAreaInset('top');
  const safeBottom = vh - EDGE - safeAreaInset('bottom');

  const left = bbox
    ? Math.min(Math.max(EDGE, bbox.x), vw - bubbleWidth - EDGE)
    : EDGE; // no anchor — left-align at the safe edge

  let top;
  if (bbox) {
    const below = bbox.y + bbox.height + GAP;
    top = below + bubbleHeight <= safeBottom ? below : bbox.y - GAP - bubbleHeight;
  } else {
    top = safeBottom - bubbleHeight; // last-resort bottom clamp — the ONLY path for discount_offer/social_proof
  }
  top = Math.max(safeTop, Math.min(top, safeBottom - bubbleHeight));

  return { left, top };
}

/**
 * The single dismiss choke point (mirrors src/signal.js buildPayload()'s
 * "one function builds every payload" discipline) — every dismiss path
 * (manual x tap, CTA tap, 6000ms timeout, D-05 replacement) routes through
 * this function, so response:dismissed is only ever published from here.
 * @param {'manual'|'cta'|'timeout'|'replaced'} dismissReason
 */
function dismissCurrent(dismissReason) {
  if (!current) return;
  if (current.timerId) clearTimeout(current.timerId);
  const responseType = current.responseType;
  current.el.remove();
  current = null;
  publish('response:dismissed', { responseType, dismissReason });
}

/**
 * Renders one response bubble for an above-threshold, on-screen
 * inference:result payload. All presentation is set via inline
 * element.style (never a <style> tag + class selectors — host CSS cascade
 * isolation, 04-UI-SPEC.md Styling mechanism); the rendered response element
 * gets inline pointer-events: auto so it (and only it) is tappable inside
 * the pointer-events: none overlay container.
 * @param {*} payload - an inference:result bus payload
 */
function renderBubble(payload) {
  const responseType = INTENT_TO_TYPE[payload.intent];
  if (!responseType) return; // unrecognized intent class — nothing to render

  const copy = COPY[responseType];
  const bubbleWidth = Math.min(358, window.innerWidth - 2 * EDGE);
  const bubbleHeight = responseType === 'discount_offer' ? 112 : 80; // estimate — CTA row adds height

  const reduceMotion =
    typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const el = document.createElement('div');
  el.setAttribute('data-heed-response', '');
  el.dataset.responseType = responseType;
  el.style.cssText =
    'position: absolute; box-sizing: border-box; pointer-events: auto; ' +
    `width: ${bubbleWidth}px; max-width: calc(100vw - ${2 * EDGE}px); ` +
    'background: #1a1a1a; color: #ffffff; border-radius: 8px; padding: 16px; ' +
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; ' +
    'font-size: 14px; font-weight: 400; line-height: 1.4; ' +
    'opacity: 0; ' +
    (reduceMotion
      ? 'transition: opacity 200ms ease-out;'
      : 'transition: opacity 200ms ease-out, transform 200ms ease-out; transform: translateY(8px);');

  const bodyEl = document.createElement('div');
  bodyEl.textContent = copy.body;
  el.appendChild(bodyEl);

  if (responseType === 'discount_offer') {
    const ctaEl = document.createElement('button');
    ctaEl.type = 'button';
    ctaEl.textContent = copy.cta;
    ctaEl.style.cssText =
      'display: block; margin-top: 8px; min-height: 44px; padding: 0 16px; ' +
      'background: #2f6fed; color: #ffffff; border: none; border-radius: 6px; ' +
      'box-sizing: border-box; font-size: 14px; font-weight: 600; line-height: 1.2; ' +
      'pointer-events: auto;';
    ctaEl.addEventListener('click', () => dismissCurrent('cta'));
    el.appendChild(ctaEl);
  }

  const dismissEl = document.createElement('button');
  dismissEl.type = 'button';
  dismissEl.setAttribute('aria-label', 'Dismiss');
  dismissEl.textContent = '×'; // × glyph — 44x44px hit target via padding, not a 44px visible box
  dismissEl.style.cssText =
    'position: absolute; top: 0; right: 0; width: 44px; height: 44px; ' +
    'box-sizing: border-box; background: transparent; color: #ffffff; border: none; ' +
    'font-size: 14px; line-height: 1.3; pointer-events: auto;';
  dismissEl.addEventListener('click', () => dismissCurrent('manual'));
  el.appendChild(dismissEl);

  const { left, top } = clampToViewport(payload.bbox ?? null, bubbleWidth, bubbleHeight);
  el.style.left = `${left}px`;
  el.style.top = `${top}px`;

  container.appendChild(el);

  // Entrance animation via a microtask (never a timer) so it can never
  // interact with vi.useFakeTimers() in the auto-dismiss-timer tests
  // (04-RESEARCH.md Pitfall 4's fake-timer interaction risk is timer-
  // specific — Promise microtasks are not faked by vi.useFakeTimers()).
  Promise.resolve().then(() => {
    el.style.opacity = '1';
    if (!reduceMotion) el.style.transform = 'translateY(0)';
  });

  let timerId = null;
  if (!NO_AUTO_DISMISS.has(responseType)) {
    timerId = setTimeout(() => dismissCurrent('timeout'), AUTO_DISMISS_MS);
  }
  current = { el, responseType, timerId };

  publish('response:fired', {
    intent: payload.intent,
    responseType,
    targetSelector: payload.targetSelector ?? null,
  });

  if (responseType === 'discount_offer') {
    // Heed only signals that the discount-offer moment exists — no
    // fulfillment logic anywhere in this module (RESP-03).
    window.parent.postMessage(
      {
        type: 'heed:discount_offer',
        sessionId: activeSessionId,
        partnerId: activeConfig.platformId,
        intent: payload.intent,
        timestamp: Date.now(),
      },
      activeConfig.partnerOrigin // explicit target origin — NEVER a wildcard
    );
  }
}

/**
 * SDK entry point for the response overlay layer. Injects the single fixed
 * full-viewport overlay container (RESP-01) and subscribes to
 * inference:result — rendering only when `payload.fires === true` AND
 * `isActiveScreen(config)` is true (D-06). Safe to call repeatedly —
 * config/sessionId and any currently-displayed bubble are reset every call
 * (mirrors src/inference.js's initInference reset-on-reinit convention), but
 * the subscription and container injection are registered at most once.
 * @param {*} config
 * @param {string} sessionId
 */
export function initResponse(config, sessionId) {
  activeConfig = config;
  activeSessionId = sessionId;

  // Reset-on-reinit: clear any bubble left over from a prior init (fresh
  // session state) without publishing a dismissed event — this is a
  // re-initialization, not a user-triggered dismissal.
  if (current) {
    if (current.timerId) clearTimeout(current.timerId);
    current.el.remove();
    current = null;
  }

  if (initialized) return; // never stack a second inference:result subscription or a second container
  initialized = true;

  container = createOverlayContainer();

  subscribe('inference:result', (payload) => {
    if (!payload.fires || !isActiveScreen(activeConfig)) return;
    // D-05: only one bubble ever visible — a new above-threshold result
    // dismisses the existing bubble (reason "replaced") before rendering.
    if (current) dismissCurrent('replaced');
    renderBubble(payload);
  });
}
