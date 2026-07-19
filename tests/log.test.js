// tests/log.test.js — RED (Wave 0) unit suite for LOG-01, session-lifecycle
// (D-01/D-02/D-03), and activeScreens gating (D-06/D-07).
// Imports src/log.js's stub module — the stub's named exports resolve so
// this file loads and its assertions fail meaningfully instead of failing on
// module-load (Phase 1-3 precedent). A later Wave-1/2 plan implements the
// real subscription wiring, session-lifecycle guard, and activeScreens gate
// this suite locks down.
//
// D-03's sessionEnded guard is verified by mocking src/inference.js's
// endSession export (via vi.hoisted + vi.mock, Vitest's documented pattern
// for partial-module mocks) so the combined call count across BOTH
// flow:complete and pagehide can be asserted directly, in both orderings.
//
// activeScreens' pathname gate is driven via history.pushState() synthetic
// pathname swaps (04-RESEARCH.md Pitfall 3 / Phase 2's SIG-06 precedent,
// tests/signal-spa.test.js) — never real multi-route navigation, since the
// standalone test harness has no real router.
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

const { endSessionMock } = vi.hoisted(() => ({ endSessionMock: vi.fn() }));

vi.mock('../src/inference.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, endSession: endSessionMock };
});

import { initLogging, isActiveScreen } from '../src/log.js';
import { publish } from '../src/bus.js';

const CONFIG = { platformId: 'demo-platform' }; // no activeScreens -> permissive default (D-06)

// Single choke-point for reading the last console.log('[heed]', ...) call in
// this file — mirrors the "one function reads every logged entry" test-side
// discipline (parallel to src/log.js's own single writeLog() choke point).
function lastConsoleCall(spy) {
  const call = spy.mock.calls[spy.mock.calls.length - 1];
  const [prefix, jsonStr] = call;
  return { prefix, entry: JSON.parse(jsonStr) };
}

function expectEnvelope(entry, { event, sessionId }) {
  expect(entry.event).toBe(event);
  expect(entry.partnerId).toBe(CONFIG.platformId); // D-09: partnerId sourced from config.platformId
  expect(entry.sessionId).toBe(sessionId);
  expect(typeof entry.ts).toBe('number');
}

describe('LOG-01', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs exactly one signal_detected entry with { type, targetSelector, bbox, timestamp } (existing shape, unchanged)', () => {
    initLogging(CONFIG, 'session-sig');
    logSpy.mockClear();

    publish('signal:detected', {
      type: 'touch_hesitation',
      targetSelector: '[data-heed="proceed-cta"]',
      bbox: { x: 1, y: 2, width: 3, height: 4 },
      timestamp: 123456,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { prefix, entry } = lastConsoleCall(logSpy);
    expect(prefix).toBe('[heed]');
    expectEnvelope(entry, { event: 'signal_detected', sessionId: 'session-sig' });
    expect(entry.data).toEqual({
      type: 'touch_hesitation',
      targetSelector: '[data-heed="proceed-cta"]',
      bbox: { x: 1, y: 2, width: 3, height: 4 },
      timestamp: 123456,
    });
  });

  it('logs exactly one inference_run entry with { intent, confidence, fires } regardless of the fires flag', () => {
    initLogging(CONFIG, 'session-inf');
    logSpy.mockClear();

    publish('inference:result', {
      intent: 'confusion',
      confidence: 0.4,
      probs: [0.4, 0.2, 0.2, 0.2],
      fires: false, // below threshold -- inference_run still logs regardless of fires (UI-SPEC)
      signalType: 'touch_hesitation',
      timestamp: Date.now(),
      bbox: null,
      targetSelector: null,
      scrollDepth: null,
      pathname: null,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { entry } = lastConsoleCall(logSpy);
    expectEnvelope(entry, { event: 'inference_run', sessionId: 'session-inf' });
    expect(entry.data.intent).toBe('confusion');
    expect(entry.data.confidence).toBe(0.4);
    expect(entry.data.fires).toBe(false);
  });

  it('logs exactly one response_fired entry with { intent, responseType, targetSelector } when response:fired is published', () => {
    initLogging(CONFIG, 'session-fired');
    logSpy.mockClear();

    publish('response:fired', {
      intent: 'price_doubt',
      responseType: 'discount_offer',
      targetSelector: null,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { entry } = lastConsoleCall(logSpy);
    expectEnvelope(entry, { event: 'response_fired', sessionId: 'session-fired' });
    expect(entry.data).toEqual({
      intent: 'price_doubt',
      responseType: 'discount_offer',
      targetSelector: null,
    });
  });

  it('logs exactly one response_dismissed entry with { responseType, dismissReason }', () => {
    initLogging(CONFIG, 'session-dismissed');
    logSpy.mockClear();

    publish('response:dismissed', {
      responseType: 'tooltip',
      dismissReason: 'manual',
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { entry } = lastConsoleCall(logSpy);
    expectEnvelope(entry, { event: 'response_dismissed', sessionId: 'session-dismissed' });
    expect(entry.data).toEqual({ responseType: 'tooltip', dismissReason: 'manual' });
  });

  it('logs exactly one flow_complete entry when flow:complete is published', () => {
    initLogging(CONFIG, 'session-complete');
    logSpy.mockClear();

    publish('flow:complete', {});

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { entry } = lastConsoleCall(logSpy);
    expectEnvelope(entry, { event: 'flow_complete', sessionId: 'session-complete' });
  });

  it('logs exactly one flow_abandoned entry when pagehide fires without a prior flow_complete', () => {
    initLogging(CONFIG, 'session-abandoned');
    logSpy.mockClear();

    window.dispatchEvent(new Event('pagehide'));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const { entry } = lastConsoleCall(logSpy);
    expectEnvelope(entry, { event: 'flow_abandoned', sessionId: 'session-abandoned' });
  });
});

describe('session-lifecycle', () => {
  beforeEach(() => {
    endSessionMock.mockClear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls endSession exactly once, with outcome true, when flow:complete fires BEFORE pagehide (D-01/D-03)', () => {
    initLogging(CONFIG, 'session-order-a');

    publish('flow:complete', {});
    window.dispatchEvent(new Event('pagehide'));

    expect(endSessionMock).toHaveBeenCalledTimes(1);
    expect(endSessionMock).toHaveBeenCalledWith(CONFIG, true);
  });

  it('calls endSession exactly once, with outcome false, when pagehide fires BEFORE flow:complete (D-02/D-03)', () => {
    initLogging(CONFIG, 'session-order-b');

    window.dispatchEvent(new Event('pagehide'));
    publish('flow:complete', {});

    expect(endSessionMock).toHaveBeenCalledTimes(1);
    expect(endSessionMock).toHaveBeenCalledWith(CONFIG, false);
  });

  it('logs exactly one of flow_complete/flow_abandoned, never both, regardless of ordering (D-03 sessionEnded guard)', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    initLogging(CONFIG, 'session-order-c');

    publish('flow:complete', {});
    window.dispatchEvent(new Event('pagehide'));

    const events = logSpy.mock.calls.map(([, jsonStr]) => JSON.parse(jsonStr).event);
    const lifecycleEvents = events.filter((e) => e === 'flow_complete' || e === 'flow_abandoned');
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]).toBe('flow_complete');
  });
});

describe('activeScreens', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    history.pushState({}, '', '/');
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('isActiveScreen returns true when the current pathname is inside config.activeScreens', () => {
    history.pushState({}, '', '/confirm');
    const config = { platformId: 'demo-platform', activeScreens: ['/confirm', '/success'] };
    expect(isActiveScreen(config)).toBe(true);
  });

  it('isActiveScreen returns false when the current pathname is OUTSIDE config.activeScreens', () => {
    history.pushState({}, '', '/');
    const config = { platformId: 'demo-platform', activeScreens: ['/confirm', '/success'] };
    expect(isActiveScreen(config)).toBe(false);
  });

  it('an absent activeScreens field is permissive (always true)', () => {
    history.pushState({}, '', '/anywhere');
    const config = { platformId: 'demo-platform' };
    expect(isActiveScreen(config)).toBe(true);
  });

  it('an empty activeScreens array is permissive (always true)', () => {
    history.pushState({}, '', '/anywhere');
    const config = { platformId: 'demo-platform', activeScreens: [] };
    expect(isActiveScreen(config)).toBe(true);
  });

  it('writeLog (via inference_run) emits nothing when the current pathname is outside config.activeScreens (D-06 gate blocks the response/logging layers only)', () => {
    history.pushState({}, '', '/'); // outside activeScreens
    const config = { platformId: 'demo-platform', activeScreens: ['/confirm'] };
    initLogging(config, 'session-gate-blocked');
    logSpy.mockClear();

    publish('inference:result', {
      intent: 'confusion',
      confidence: 0.9,
      probs: [0.9, 0.033, 0.033, 0.034],
      fires: true,
      signalType: 'touch_hesitation',
      timestamp: Date.now(),
      bbox: null,
      targetSelector: null,
      scrollDepth: null,
      pathname: null,
    });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('writeLog (via inference_run) emits when the current pathname is live-read as inside config.activeScreens (never cached, mirrors maybeReattach)', () => {
    history.pushState({}, '', '/confirm'); // inside activeScreens
    const config = { platformId: 'demo-platform', activeScreens: ['/confirm'] };
    initLogging(config, 'session-gate-open');
    logSpy.mockClear();

    publish('inference:result', {
      intent: 'confusion',
      confidence: 0.9,
      probs: [0.9, 0.033, 0.033, 0.034],
      fires: true,
      signalType: 'touch_hesitation',
      timestamp: Date.now(),
      bbox: null,
      targetSelector: null,
      scrollDepth: null,
      pathname: null,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
  });
});
