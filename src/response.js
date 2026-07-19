// src/response.js — response overlay rendering (RESP-01/02/03, D-04/D-05).
// STUB (Wave 0, Plan 04-02): minimal bodies only, so tests/response.test.js's
// import resolves and its assertions fail meaningfully instead of failing on
// module-load (Phase 1-3 precedent: a missing named export fails the WHOLE
// test file, masking every individual assertion). A later Wave-1/2 plan
// fills in the real overlay-injection/clamping/response-type/postMessage
// behavior described in 04-RESEARCH.md and 04-UI-SPEC.md.
//
// No-PII firewall (CLAUDE.md "No PII ever", mirrors src/signal.js's
// buildPayload() firewall discipline, SIG-05/T-04-04): this module renders
// bubbles purely from already-PII-filtered bus payloads (`inference:result`)
// and never reads `.value` / `.textContent` / `.innerHTML` / `localStorage` /
// `document.cookie` from any host-page DOM element, now or in the real
// implementation.

/**
 * SDK entry point for the response overlay layer. Real implementation
 * (Wave 1/2) will subscribe to `inference:result` and render the fixed
 * full-viewport overlay container (RESP-01). Stub is a no-op — no
 * subscription is registered yet.
 * @param {*} config
 * @param {string} sessionId
 */
export function initResponse(config, sessionId) {
  // no-op stub — Wave 1/2 fills in overlay-container creation + subscription.
}

/**
 * Positions a response bubble within safe-area-aware viewport bounds. Real
 * implementation (Wave 1/2) must handle BOTH the bbox-present path (anchored
 * placement) and the bbox-null fallback path (bottom-clamp) — the null path
 * is the ONLY path discount_offer/social_proof ever take (04-RESEARCH.md
 * Pitfall 2). Stub returns a placeholder object so callers/tests can import
 * and invoke it without a TypeError.
 * @param {{x:number,y:number,width:number,height:number}|null} bbox
 * @param {number} bubbleWidth
 * @param {number} bubbleHeight
 * @returns {{left:number, top:number}}
 */
export function clampToViewport(bbox, bubbleWidth, bubbleHeight) {
  return { left: 0, top: 0 }; // placeholder stub value — RESP-02 tests intentionally fail against this
}

/**
 * Reads an iOS safe-area-inset-* CSS env() value via a computed-style probe.
 * Real implementation (Wave 1/2) will use 04-RESEARCH.md's verbatim
 * probe-element pattern. Stub returns 0 unconditionally.
 * @param {'top'|'bottom'|'left'|'right'} side
 * @returns {number}
 */
export function safeAreaInset(side) {
  return 0; // placeholder stub value
}
