// tests/signal.test.js — RED (Wave 0) unit suites for SIG-01 through SIG-05.
// Imports src/signal.js, which does not exist yet — this whole file fails to
// resolve until Plan 02/03 create it. Do NOT add MutationObserver-dependent
// assertions here; those live in signal-spa.test.js (happy-dom#2097 — see
// 02-RESEARCH.md Pitfall 3).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { attachListeners, initSignalCapture } from '../src/signal.js';
import { collectReceived } from './fixtures/test-subscriber.js';
import demoConfig from '../config/demo-platform.json';

// Detached fixture DOM covering all 7 locked data-heed selectors from
// CONTRACT.md (see config/demo-platform.json for the exact selector strings
// signal.js resolves targets through).
function buildFixtureDom() {
  document.body.innerHTML = `
    <input data-heed="amount-input" value="" />
    <div data-heed="fee-row"></div>
    <div data-heed="min-received-row"></div>
    <button data-heed="proceed-cta">Proceed</button>
    <button data-heed="confirm-cta">Confirm</button>
    <button data-heed="back-btn">Back</button>
    <div data-heed="flow-complete" style="display: none"></div>
  `;
}

function getEl(selectorKey) {
  return document.querySelector(demoConfig.selectors[selectorKey]);
}

function dispatchTouch(el, type, touch) {
  el.dispatchEvent(
    new TouchEvent(type, {
      touches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
      targetTouches: type === 'touchend' || type === 'touchcancel' ? [] : [touch],
      changedTouches: [touch],
      bubbles: true,
      cancelable: true,
    })
  );
}

describe('SIG-01', () => {
  beforeEach(() => {
    buildFixtureDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires touch_hesitation live once a CTA is held past the 800ms threshold, while still held', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const cta = getEl('proceedCta');
    const touch = new Touch({ identifier: 1, target: cta, clientX: 0, clientY: 0 });
    dispatchTouch(cta, 'touchstart', touch);

    vi.advanceTimersByTime(801); // still held — no touchend dispatched

    const hesitations = received.filter((p) => p.type === 'touch_hesitation');
    expect(hesitations).toHaveLength(1);
  });

  it('does not fire when the CTA is released (touchend) before the 800ms threshold elapses', () => {
    // Emergent tap behavior per D-01/Pitfall 1 — no separate <300ms check exists;
    // any release before 800ms, whether at 50ms or 750ms, produces zero receipts.
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const cta = getEl('proceedCta');
    const touch = new Touch({ identifier: 1, target: cta, clientX: 0, clientY: 0 });
    dispatchTouch(cta, 'touchstart', touch);
    vi.advanceTimersByTime(200);
    dispatchTouch(cta, 'touchend', touch);
    vi.advanceTimersByTime(700); // well past 800ms total elapsed, but released early

    const hesitations = received.filter((p) => p.type === 'touch_hesitation');
    expect(hesitations).toHaveLength(0);
  });
});

describe('SIG-02', () => {
  beforeEach(() => {
    buildFixtureDom();
  });

  it('fires blur_incomplete when amountInput blurs while its value is empty', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const amountInput = getEl('amountInput');
    amountInput.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    amountInput.value = '';
    amountInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    const blurIncompletes = received.filter((p) => p.type === 'blur_incomplete');
    expect(blurIncompletes).toHaveLength(1);
  });

  it('does not fire when amountInput blurs after its value was changed to non-empty (D-03 final-value diff)', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const amountInput = getEl('amountInput');
    amountInput.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    amountInput.value = '100';
    amountInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    const blurIncompletes = received.filter((p) => p.type === 'blur_incomplete');
    expect(blurIncompletes).toHaveLength(0);
  });
});

describe('SIG-03', () => {
  beforeEach(() => {
    buildFixtureDom();
    // happy-dom has no real layout engine (02-RESEARCH.md Pitfall 5) — scrollY
    // and innerHeight must be stubbed explicitly rather than derived from
    // window.scrollTo().
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('fires scroll_reversal after crossing the 40% depth threshold then reversing by at least the min delta', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    // Cross 40% of 800px viewport (320px) — go well past to 400px (50%).
    window.scrollY = 400;
    window.dispatchEvent(new Event('scroll'));

    // Reverse by the configured min delta (50px per demo-platform.json).
    window.scrollY = 340;
    window.dispatchEvent(new Event('scroll'));

    const reversals = received.filter((p) => p.type === 'scroll_reversal');
    expect(reversals).toHaveLength(1);
  });

  it('does not fire when the reversal delta is smaller than the configured minimum (D-05 hysteresis)', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    window.scrollY = 400;
    window.dispatchEvent(new Event('scroll'));

    // Jitter/momentum micro-bounce — well under the 50px min delta.
    window.scrollY = 390;
    window.dispatchEvent(new Event('scroll'));

    const reversals = received.filter((p) => p.type === 'scroll_reversal');
    expect(reversals).toHaveLength(0);
  });
});

describe('SIG-04', () => {
  beforeEach(() => {
    buildFixtureDom();
  });

  it('fires back_intent on popstate while the cached flowComplete flag is false', () => {
    // May require initSignalCapture wiring to seed/observe the cached flag —
    // kept minimal and RED per the plan; Plan 02/03 flip this green.
    initSignalCapture(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    const backIntents = received.filter((p) => p.type === 'back_intent');
    expect(backIntents).toHaveLength(1);
  });

  it('does not fire on popstate once the flowComplete element has appeared in the DOM', () => {
    initSignalCapture(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const flowComplete = getEl('flowComplete');
    flowComplete.style.display = 'block'; // simulate the completion screen appearing

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    const backIntents = received.filter((p) => p.type === 'back_intent');
    expect(backIntents).toHaveLength(0);
  });
});

describe('SIG-05', () => {
  beforeEach(() => {
    buildFixtureDom();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const NO_PII_KEYS = ['value', 'text', 'id', 'class', 'amount'];

  it('touch_hesitation payload contains exactly the allow-listed keys, geometry/timing only', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const cta = getEl('proceedCta');
    const touch = new Touch({ identifier: 1, target: cta, clientX: 0, clientY: 0 });
    dispatchTouch(cta, 'touchstart', touch);
    vi.advanceTimersByTime(801);

    const payload = received.find((p) => p.type === 'touch_hesitation');
    expect(Object.keys(payload).sort()).toEqual(['bbox', 'targetSelector', 'timestamp', 'type']);
    for (const key of NO_PII_KEYS) expect(payload).not.toHaveProperty(key);
  });

  it('blur_incomplete payload contains exactly the allow-listed keys — no value key, even when the fixture element carried a non-empty value at another point in its lifecycle', () => {
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    const amountInput = getEl('amountInput');
    amountInput.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    amountInput.value = 'some amount'; // non-empty at one point in the lifecycle
    amountInput.value = ''; // final value at blur time is empty — D-03 fires
    amountInput.dispatchEvent(new FocusEvent('blur', { bubbles: true }));

    const payload = received.find((p) => p.type === 'blur_incomplete');
    expect(Object.keys(payload).sort()).toEqual(['bbox', 'targetSelector', 'timestamp', 'type']);
    for (const key of NO_PII_KEYS) expect(payload).not.toHaveProperty(key);
  });

  it('scroll_reversal payload contains exactly the allow-listed keys per D-07 (scrollDepth, no targetSelector/bbox value)', () => {
    Object.defineProperty(window, 'innerHeight', { value: 800, writable: true, configurable: true });
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
    attachListeners(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    window.scrollY = 400;
    window.dispatchEvent(new Event('scroll'));
    window.scrollY = 340;
    window.dispatchEvent(new Event('scroll'));

    const payload = received.find((p) => p.type === 'scroll_reversal');
    expect(Object.keys(payload).sort()).toEqual(['bbox', 'scrollDepth', 'targetSelector', 'timestamp', 'type']);
    for (const key of NO_PII_KEYS) expect(payload).not.toHaveProperty(key);
  });

  it('back_intent payload contains exactly the allow-listed keys per D-07 (pathname, no targetSelector/bbox value)', () => {
    initSignalCapture(demoConfig);
    const received = [];
    collectReceived((payload) => received.push(payload));

    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));

    const payload = received.find((p) => p.type === 'back_intent');
    expect(Object.keys(payload).sort()).toEqual(['bbox', 'pathname', 'targetSelector', 'timestamp', 'type']);
    for (const key of NO_PII_KEYS) expect(payload).not.toHaveProperty(key);
  });
});
