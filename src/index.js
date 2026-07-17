// src/index.js — init() orchestrator: validate config (hard-fail) then expose the bus.
// No try/catch around validateConfig — an invalid config must stop initialization
// entirely (CFG-02) rather than fall back to defaults or partial exposure.
import { validateConfig } from './config.js';
import { publish, subscribe } from './bus.js';
import { initSignalCapture } from './signal.js';
import { initInference } from './inference.js';
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
  // Signal listeners attach only AFTER hard-fail validation passes — never
  // instrument the DOM against an unvalidated config, mirroring the note
  // above that an invalid config must stop initialization entirely (CFG-02).
  initSignalCapture(config);
  // Inference wiring attaches only AFTER hard-fail validation passes too —
  // same reasoning as initSignalCapture above: never subscribe the forward
  // pass to signal:detected against a partially-valid config.
  initInference(config);
  // Return shape stays exactly { config, publish, subscribe } — signal
  // capture and inference wiring are side-effecting, not returned values
  // (no new key added here).
  return { config, publish, subscribe };
}

/**
 * Convenience entry point for the standalone test harness — inits against the
 * bundled demo-platform config so the harness needs no backend/fetch to run.
 * @returns {{ config: object, publish: Function, subscribe: Function }}
 */
export function initDemo() {
  return init(demoConfig);
}
