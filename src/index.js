// src/index.js — init() orchestrator: validate config (hard-fail) then expose the bus.
// No try/catch around validateConfig — an invalid config must stop initialization
// entirely (CFG-02) rather than fall back to defaults or partial exposure.
import { validateConfig } from './config.js';
import { publish, subscribe } from './bus.js';
import { initSignalCapture } from './signal.js';
import { initInference, validateWeightsShape } from './inference.js';
import { initLogging } from './log.js';
import { initResponse } from './response.js';
import schema from '../config/schema.json';
import demoConfig from '../config/demo-platform.json';

export { publish, subscribe };

/**
 * Validate rawConfig and, only if valid, expose the bus interface alongside it.
 * Throws synchronously on any config violation — nothing below the
 * validateConfig call ever runs against a partially-valid config object.
 * @param {*} rawConfig
 * @returns {{ config: object, publish: Function, subscribe: Function }}
 */
export function init(rawConfig) {
  const config = validateConfig(rawConfig, schema);
  // D-08: sessionId is generated exactly once per page load, here — the
  // single choke point index.js owns — and threaded into both log.js and
  // response.js below. Native crypto.randomUUID(), no fallback (verified
  // available even over file:// in this project's Playwright/Chromium test
  // environment, 04-RESEARCH.md Code Examples). Never returned from init();
  // it stays internal module state passed to the two initializers only.
  // Code review CR-02: the weights-shape deep check must run BEFORE any
  // side-effecting wiring below. config/schema.json only declares
  // `inference.weights` as `type: "object"` (any shape passes), so
  // validateConfig() above cannot catch a malformed weights matrix — only
  // initInference()'s internal validateWeightsShape() call could, but that
  // ran too late (after initSignalCapture already attached real DOM
  // listeners). Calling the same hard-fail check here, up front, restores
  // the "never instrument the DOM against an unvalidated config" invariant
  // for this case too.
  if (config.inference?.weights) validateWeightsShape(config.inference.weights);
  const sessionId = crypto.randomUUID();
  // Signal listeners attach only AFTER hard-fail validation passes — never
  // instrument the DOM against an unvalidated config, mirroring the note
  // above that an invalid config must stop initialization entirely (CFG-02).
  initSignalCapture(config);
  // log.js owns session-lifecycle wiring (flow:complete / pagehide /
  // sessionEnded guard / endSession) — initialized before initInference so
  // log.js's 'signal:detected' subscription registers first on the shared
  // EventTarget bus (src/bus.js dispatches same-event-type listeners in
  // registration order, synchronously). This makes log.js write
  // signal_detected before inference's handler runs its inference:result
  // cascade, correcting INTEG-01 SC2's required ordering (signal_detected ->
  // inference_run -> response_fired). It also remains before initResponse,
  // preserving the existing invariant that logging's subscriptions are
  // registered before the first inference:result could ever arrive
  // (04-RESEARCH.md Assumption A1) — inference_run (log.js's
  // inference:result listener, registered here) still precedes
  // response_fired (response.js's, registered last below).
  initLogging(config, sessionId);
  // Inference wiring attaches only AFTER hard-fail validation passes too —
  // same reasoning as initSignalCapture above: never subscribe the forward
  // pass to signal:detected against a partially-valid config.
  initInference(config);
  initResponse(config, sessionId);
  // Return shape stays exactly { config, publish, subscribe } — signal
  // capture, inference, logging, and response wiring are all side-effecting,
  // not returned values (no new key added here).
  return { config, publish, subscribe };
}

/**
 * Convenience entry point for the standalone test harness — inits against the
 * bundled demo-platform config. Optionally accepts an `overrides.weights`
 * object (fetched by the harness's own bootstrap script, D-01) to inject
 * learned weights into config.inference.weights before init() runs — the SDK
 * bundle itself still makes no cold-start GET (D-01); the override is
 * supplied by the caller, not fetched here.
 * @param {{weights?: object}} [overrides]
 * @returns {{ config: object, publish: Function, subscribe: Function }}
 */
export function initDemo(overrides) {
  // Non-mutating merge: demoConfig (and its .inference) are shallow-copied,
  // never mutated in place, so a bare initDemo() call afterward is unaffected
  // by a prior overrides call (05-RESEARCH.md Pitfall 2).
  const config = overrides?.weights
    ? { ...demoConfig, inference: { ...demoConfig.inference, weights: overrides.weights } }
    : demoConfig;
  return init(config);
}
