// src/log.js — structured logging + session-lifecycle wiring
// (LOG-01, D-01/D-02/D-03/D-06/D-07/D-08/D-09).
// STUB (Wave 0, Plan 04-02): minimal bodies only, so tests/log.test.js's
// import resolves and its assertions fail meaningfully instead of failing on
// module-load (same reasoning as src/response.js's stub header). A later
// Wave-1/2 plan fills in the real event-subscription, activeScreens gating,
// and session-lifecycle (flow:complete / pagehide / sessionEnded guard /
// endSession) behavior described in 04-RESEARCH.md Pattern 3.
//
// No-PII firewall (CLAUDE.md "No PII ever", mirrors src/signal.js's
// buildPayload() firewall discipline, SIG-05/T-04-04): this module only ever
// writes already-PII-filtered bus payload fields (`inference:result`,
// `signal:detected`, `response:fired`, `response:dismissed`) into a log
// entry, and never reads `.value` / `.textContent` / `.innerHTML` /
// `localStorage` / `document.cookie` from any host-page DOM element, now or
// in the real implementation.

/**
 * SDK entry point for the logging layer. Real implementation (Wave 1/2)
 * will subscribe to signal_detected/inference_run/response_fired/
 * response_dismissed/flow:complete and register a `pagehide` listener,
 * owning the sessionEnded guard + endSession() call (D-01/D-02/D-03). Stub
 * is a no-op — no subscription/listener is registered yet.
 * @param {*} config
 * @param {string} sessionId
 */
export function initLogging(config, sessionId) {
  // no-op stub — Wave 1/2 fills in subscriptions + session-lifecycle wiring.
}

/**
 * D-06/D-07: gates logging/response rendering on the live
 * `window.location.pathname` against `config.activeScreens`. Real
 * implementation (Wave 1/2) must live-read pathname on every call (never
 * cache — mirrors src/signal.js's maybeReattach live-read discipline) and
 * treat an absent/empty activeScreens as permissive (always true). Stub
 * always returns true so callers are never blocked pre-implementation.
 * @param {*} config
 * @returns {boolean}
 */
export function isActiveScreen(config) {
  return true; // placeholder stub value — activeScreens tests intentionally fail against this
}

/**
 * The sole choke point that will call `console.log('[heed]', ...)`
 * (LOG-01, locked by 04-UI-SPEC.md — no other module ever logs directly).
 * Real implementation (Wave 1/2) builds `{ ts, sessionId, partnerId, event,
 * data }` and gates on isActiveScreen(config) before writing. Stub is a
 * no-op — no console.log call is made yet.
 * @param {*} config
 * @param {string} sessionId
 * @param {string} event
 * @param {*} data
 */
export function writeLog(config, sessionId, event, data) {
  // no-op stub — Wave 1/2 fills in the real console.log('[heed]', ...) call.
}
