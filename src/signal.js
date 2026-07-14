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

/**
 * Entry point that wires the DOM-element/window signal handlers. Extended in
 * Plan 02-03 with back-intent/SPA-reattachment wiring (WeakSet idempotency,
 * MutationObserver, cached flowComplete flag) — this plan wires only the
 * three signal types whose RED tests were authored in Plan 02-01
 * (touch hesitation, blur incomplete, scroll reversal).
 * @param {*} config
 */
export function attachListeners(config) {
  resolveTargets(config);
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
