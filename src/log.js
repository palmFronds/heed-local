// src/log.js — structured logging + session-lifecycle wiring
// (LOG-01, D-01/D-02/D-03/D-06/D-07/D-08/D-09).
// This module owns the sole `console.log('[heed]', ...)` call site in the
// codebase (locked by 04-UI-SPEC.md) AND owns session-lifecycle wiring
// (flow:complete / pagehide / sessionEnded guard / endSession) — co-located
// here rather than index.js because this module already subscribes to
// flow:complete to log it, avoiding a second subscription (04-RESEARCH.md
// Pattern 3 / Assumption A1).
//
// No-PII firewall (CLAUDE.md "No PII ever", mirrors src/signal.js's
// buildPayload() firewall discipline, SIG-05/T-04-04): this module only ever
// writes already-PII-filtered bus payload fields (`inference:result`,
// `signal:detected`, `response:fired`, `response:dismissed`) into a log
// entry, and never reads `.value` / `.textContent` / `.innerHTML` /
// `localStorage` / `document.cookie` from any host-page DOM element.
import { subscribe } from './bus.js';
import { endSession } from './inference.js';

// D-03: module-level guard making endSession fire exactly once per session,
// regardless of whether flow:complete or pagehide arrives first. Reset on
// every initLogging() call (fresh session), mirroring src/inference.js's
// lastInference reset-on-reinit convention.
let sessionEnded = false;
// Mutable module state re-resolved EVERY initLogging() call so the
// once-registered subscription handlers below always read the CURRENT
// config/sessionId, not one frozen from whichever call first registered them
// (mirrors src/inference.js's activeConfig/activeWeights pattern, CR-01).
let activeConfig = null;
let activeSessionId = null;
// Guards the one-time subscribe()/addEventListener() registrations (mirrors
// src/inference.js line 134/245 and src/signal.js line 312/330) — repeat
// initLogging() calls must never accumulate duplicate handlers.
let initialized = false;

/**
 * D-06/D-07: gates logging (and, via response.js, response rendering) on the
 * live `window.location.pathname` against `config.activeScreens`. Reads
 * pathname FRESH on every call — never cache/hoist (mirrors
 * src/signal.js's maybeReattach live-read discipline; caching would silently
 * break a same-page SPA route swap). Absent/empty activeScreens is a
 * permissive default (always true) — no gate configured.
 * @param {*} config
 * @returns {boolean}
 */
export function isActiveScreen(config) {
  const list = config.activeScreens;
  if (!Array.isArray(list) || list.length === 0) return true; // no gate configured — permissive default
  return list.includes(window.location.pathname); // LIVE read, never cached
}

/**
 * The sole choke point that calls `console.log('[heed]', ...)` anywhere in
 * the codebase (LOG-01, locked by 04-UI-SPEC.md). Builds the locked
 * `{ ts, sessionId, partnerId, event, data }` envelope (D-09: partnerId
 * sourced from config.platformId) and gates on isActiveScreen(config) before
 * writing (D-06) — every event handler below routes through this function;
 * never an inline console.log at a subscribe site.
 * @param {*} config
 * @param {string} sessionId
 * @param {string} event
 * @param {*} data
 */
export function writeLog(config, sessionId, event, data) {
  if (!isActiveScreen(config)) return; // D-06 — no log fires outside activeScreens
  const entry = { ts: Date.now(), sessionId, partnerId: config.platformId, event, data };
  console.log('[heed]', JSON.stringify(entry));
}

/**
 * D-01/D-02/D-03: the single session-end trigger reachable from either
 * lifecycle path (flow:complete OR pagehide). The sessionEnded guard makes
 * this a no-op on whichever path arrives second, preventing endSession's
 * documented non-idempotent double-count (src/inference.js lines 281-304).
 * @param {boolean} outcome - true if flowComplete, false if abandoned
 * @param {string} event - 'flow_complete' | 'flow_abandoned'
 */
function finishSession(outcome, event) {
  if (sessionEnded) return; // D-03: whichever path arrives first wins, the other is a no-op
  sessionEnded = true;
  writeLog(activeConfig, activeSessionId, event, {});
  endSession(activeConfig, outcome);
}

/**
 * SDK entry point for the logging layer. Subscribes to
 * signal_detected/inference_run/response_fired/response_dismissed/
 * flow:complete and registers a `pagehide` listener, owning the sessionEnded
 * guard + endSession() call (D-01/D-02/D-03). Safe to call repeatedly —
 * config/sessionId and the sessionEnded guard are re-resolved/reset every
 * call, but the actual subscriptions/listener are registered at most once.
 * @param {*} config
 * @param {string} sessionId
 */
export function initLogging(config, sessionId) {
  activeConfig = config;
  activeSessionId = sessionId;
  sessionEnded = false; // reset-on-reinit, matches src/inference.js's lastInference convention

  if (initialized) return; // never stack duplicate subscriptions/listeners
  initialized = true;

  subscribe('signal:detected', (payload) => {
    writeLog(activeConfig, activeSessionId, 'signal_detected', payload);
  });

  subscribe('inference:result', (payload) => {
    // Only intent/confidence/fires are logged for inference_run (04-UI-SPEC.md
    // Logging Contract) — logs regardless of the fires flag (below-threshold
    // predictions are still observability-relevant).
    writeLog(activeConfig, activeSessionId, 'inference_run', {
      intent: payload.intent,
      confidence: payload.confidence,
      fires: payload.fires,
    });
  });

  subscribe('response:fired', (payload) => {
    writeLog(activeConfig, activeSessionId, 'response_fired', payload);
  });

  subscribe('response:dismissed', (payload) => {
    writeLog(activeConfig, activeSessionId, 'response_dismissed', payload);
  });

  subscribe('flow:complete', () => finishSession(true, 'flow_complete'));

  window.addEventListener('pagehide', () => {
    if (!sessionEnded) finishSession(false, 'flow_abandoned');
  });
}
