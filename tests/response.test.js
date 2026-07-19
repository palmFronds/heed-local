// tests/response.test.js — RED (Wave 0) unit suite for RESP-01/02/03, D-05.
// Imports src/response.js's stub module — the stub's named exports resolve
// so this file loads and its assertions fail meaningfully instead of failing
// on module-load (Phase 1-3 precedent: a missing named export fails the
// WHOLE test file). A later Wave-1/2 plan implements the real overlay
// injection / clampToViewport / 4 response types / postMessage behavior this
// suite locks down.
//
// clampToViewport() is exercised as a PURE function with explicit bbox/null
// arguments (04-RESEARCH.md Pitfall 5 — happy-dom has no real layout engine;
// getBoundingClientRect() always returns zeroed rects). window.innerWidth/
// innerHeight are stubbed via Object.defineProperty, never via a real
// element measurement.
//
// Auto-dismiss-timer cases (vi.useFakeTimers) live ONLY in this file, kept
// separate from any file that also drives initSignalCapture/MutationObserver
// (04-RESEARCH.md Pitfall 4 — happy-dom#2097 fake-timer/MutationObserver
// interaction risk).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initResponse, clampToViewport } from '../src/response.js';
import { publish, subscribe } from '../src/bus.js';

const CONFIG = { platformId: 'demo-platform', partnerOrigin: 'http://localhost:3000' };

// Single choke-point for building synthetic inference:result payloads in
// this file — mirrors src/signal.js's buildPayload() single-construction-
// point discipline, applied here to test fixtures instead of source code.
function inferenceResult(overrides = {}) {
  return {
    intent: 'confusion',
    confidence: 0.9,
    probs: [0.9, 0.033, 0.033, 0.034],
    fires: true,
    signalType: 'touch_hesitation',
    timestamp: Date.now(),
    bbox: { x: 10, y: 10, width: 40, height: 40 },
    targetSelector: '[data-heed="proceed-cta"]',
    scrollDepth: null,
    pathname: null,
    ...overrides,
  };
}

describe('RESP-01', () => {
  it('injects a single pointer-events:none fixed overlay container into document.body, renders the response element with pointer-events:auto, and leaves host DOM outside the overlay untouched', () => {
    const sentinel = document.createElement('div');
    sentinel.id = 'host-sentinel';
    sentinel.textContent = 'host content';
    document.body.appendChild(sentinel);

    initResponse(CONFIG, 'session-1');
    publish('inference:result', inferenceResult());

    const containers = document.querySelectorAll('[data-heed-overlay]');
    expect(containers).toHaveLength(1);
    expect(containers[0].style.pointerEvents).toBe('none');

    const responseEls = containers[0].querySelectorAll('[data-heed-response]');
    expect(responseEls).toHaveLength(1);
    expect(responseEls[0].style.pointerEvents).toBe('auto');

    // Host DOM outside the overlay is untouched — the sentinel is unchanged.
    expect(document.getElementById('host-sentinel').textContent).toBe('host content');
  });
});

describe('RESP-02', () => {
  const ORIGINAL_WIDTH = window.innerWidth;
  const ORIGINAL_HEIGHT = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: ORIGINAL_WIDTH, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: ORIGINAL_HEIGHT, configurable: true });
  });

  it('bbox-present path: clamps left within the 16px safe edge and places the bubble below the anchor (bbox.bottom + 8px) when it fits', () => {
    const bbox = { x: 20, y: 100, width: 40, height: 40 };
    const { left, top } = clampToViewport(bbox, 200, 80);

    expect(left).toBe(20); // clamp(16, bbox.x=20, 390-200-16=174) === 20
    expect(top).toBe(148); // bbox.bottom(140) + GAP(8) === 148, fits under safeBottom(784)
  });

  it('bbox-present path: flips ABOVE the anchor when the below placement would overflow the safe bottom bound', () => {
    const bbox = { x: 20, y: 750, width: 40, height: 40 }; // near the bottom of an 800px viewport
    const { top } = clampToViewport(bbox, 200, 80);

    // below = 750+40+8=798; +bubbleHeight(80)=878 > safeBottom(784) -> flip above
    expect(top).toBe(662); // bbox.top(750) - GAP(8) - bubbleHeight(80)
  });

  it('bbox-NULL fallback path: left-aligns at the safe edge and bottom-clamps — the ONLY path discount_offer/social_proof ever take (Pitfall 2)', () => {
    const { left, top } = clampToViewport(null, 200, 80);

    expect(left).toBe(16); // no anchor -> left-aligned at the safe edge
    expect(top).toBe(704); // safeBottom(784) - bubbleHeight(80)
  });

  it('bbox-NULL fallback path never renders off-screen even when the bubble is taller than the available viewport (last-resort top clamp)', () => {
    const { top } = clampToViewport(null, 200, 900); // taller than the 800px viewport
    expect(top).toBe(16); // clamped up to the safe top bound, never negative/off-screen
  });
});

describe('RESP-03', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tooltip for confusion with the exact anchored copy', () => {
    initResponse(CONFIG, 'session-1');
    publish('inference:result', inferenceResult({ intent: 'confusion' }));

    const responseEl = document.querySelector('[data-heed-overlay] [data-heed-response]');
    expect(responseEl.textContent).toContain('Not sure what this means? Tap for a quick explanation.');
  });

  it('renders nudge_copy for flow_friction with the exact brief-reassurance copy', () => {
    initResponse(CONFIG, 'session-1');
    publish('inference:result', inferenceResult({ intent: 'flow_friction' }));

    const responseEl = document.querySelector('[data-heed-overlay] [data-heed-response]');
    expect(responseEl.textContent).toContain('Almost there — one more step to finish.');
  });

  it('renders social_proof for trust_gap (back_intent path, no bbox) with the exact static reassurance copy', () => {
    initResponse(CONFIG, 'session-1');
    publish(
      'inference:result',
      inferenceResult({
        intent: 'trust_gap',
        signalType: 'back_intent',
        bbox: null,
        targetSelector: null,
        pathname: '/confirm',
      })
    );

    const responseEl = document.querySelector('[data-heed-overlay] [data-heed-response]');
    expect(responseEl.textContent).toContain('Thousands of people completed this safely today.');
  });

  it('renders discount_offer for price_doubt (scroll_reversal path, no bbox), fires postMessage with the exact payload shape and a non-wildcard origin equal to config.partnerOrigin, and performs no fulfillment logic', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});

    initResponse(CONFIG, 'session-42');
    publish(
      'inference:result',
      inferenceResult({
        intent: 'price_doubt',
        signalType: 'scroll_reversal',
        bbox: null,
        targetSelector: null,
        scrollDepth: 0.5,
      })
    );

    const responseEl = document.querySelector('[data-heed-overlay] [data-heed-response]');
    expect(responseEl.textContent).toContain('Complete now and save on fees.');
    expect(responseEl.textContent).toContain('See offer');

    // Exactly one postMessage call — no additional fulfillment-side-effect
    // calls anywhere in response.js; Heed only signals the offer moment
    // exists, it never grants/applies the discount itself.
    expect(postMessageSpy).toHaveBeenCalledTimes(1);
    const [payload, targetOrigin] = postMessageSpy.mock.calls[0];
    expect(payload).toEqual({
      type: 'heed:discount_offer',
      sessionId: 'session-42',
      partnerId: CONFIG.platformId,
      intent: 'price_doubt',
      timestamp: expect.any(Number),
    });
    expect(targetOrigin).toBe(CONFIG.partnerOrigin);
    expect(targetOrigin).not.toBe('*'); // RESP-03's explicit "never wildcard origin" requirement
  });
});

describe('D-05', () => {
  it('dismisses the currently-showing bubble with dismissReason "replaced" BEFORE rendering a new one, when a second above-threshold inference:result arrives while a bubble is showing', () => {
    const dismissed = [];
    let responseCountAtDismissTime = null;
    subscribe('response:dismissed', (payload) => {
      dismissed.push(payload);
      const container = document.querySelector('[data-heed-overlay]');
      responseCountAtDismissTime = container ? container.querySelectorAll('[data-heed-response]').length : 0;
    });

    initResponse(CONFIG, 'session-1');
    publish('inference:result', inferenceResult({ intent: 'confusion' }));

    const containerAfterFirst = document.querySelector('[data-heed-overlay]');
    expect(containerAfterFirst.querySelectorAll('[data-heed-response]')).toHaveLength(1);

    publish('inference:result', inferenceResult({ intent: 'flow_friction' }));

    expect(dismissed).toHaveLength(1);
    expect(dismissed[0].dismissReason).toBe('replaced');
    // The old bubble was already removed by the time response:dismissed
    // fired — the new bubble had not yet been appended at that moment.
    expect(responseCountAtDismissTime).toBe(0);

    const containerAfterSecond = document.querySelector('[data-heed-overlay]');
    expect(containerAfterSecond.querySelectorAll('[data-heed-response]')).toHaveLength(1); // never stacked
  });
});

describe('auto-dismiss timers (UI-SPEC Animation contract)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('auto-dismisses a tooltip bubble after 6000ms with dismissReason "timeout"', () => {
    const dismissed = [];
    subscribe('response:dismissed', (payload) => dismissed.push(payload));

    initResponse(CONFIG, 'session-1');
    publish('inference:result', inferenceResult({ intent: 'confusion' }));

    vi.advanceTimersByTime(6000);

    expect(dismissed.some((d) => d.dismissReason === 'timeout')).toBe(true);
    const container = document.querySelector('[data-heed-overlay]');
    expect(container.querySelectorAll('[data-heed-response]')).toHaveLength(0);
  });

  it('discount_offer does NOT auto-dismiss after 6000ms — it persists until manual/CTA dismissal, since it is a decision point, not a passive notice', () => {
    vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    const dismissed = [];
    subscribe('response:dismissed', (payload) => dismissed.push(payload));

    initResponse(CONFIG, 'session-1');
    publish(
      'inference:result',
      inferenceResult({ intent: 'price_doubt', signalType: 'scroll_reversal', bbox: null, targetSelector: null, scrollDepth: 0.5 })
    );

    vi.advanceTimersByTime(10000);

    expect(dismissed.filter((d) => d.dismissReason === 'timeout')).toHaveLength(0);
    const container = document.querySelector('[data-heed-overlay]');
    expect(container.querySelectorAll('[data-heed-response]')).toHaveLength(1);
  });
});
