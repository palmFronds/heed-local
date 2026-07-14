// tests/signal-spa.test.js — RED (Wave 0) SPA re-attachment suite for SIG-06.
// Imports src/signal.js, which does not exist yet — this whole file fails to
// resolve until Plan 03. Kept in its own file, separate from signal.test.js,
// so its assertions never share a file with vi.useFakeTimers() — happy-dom
// has a known MutationObserver + Vitest fake-timer interaction issue
// (capricorn86/happy-dom#2097, see 02-RESEARCH.md Pitfall 3). NO
// vi.useFakeTimers() call anywhere in this file.
//
// All cases below use blur_incomplete (synchronous, no timer) rather than
// touch_hesitation (which needs a real 800ms wait) as the idempotency probe —
// SIG-01's timer behavior is already covered by signal.test.js.
import { describe, it, expect, beforeEach } from 'vitest';
import { attachListeners, maybeReattach, initSignalCapture } from '../src/signal.js';
import { collectReceived } from './fixtures/test-subscriber.js';
import demoConfig from '../config/demo-platform.json';

// Detached fixture DOM covering all 7 locked data-heed selectors — mirrors
// signal.test.js's fixture so both files exercise the same selector set.
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

function fireEmptyBlur(el) {
  el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
  el.value = '';
  el.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
}

describe('SIG-06', () => {
  beforeEach(() => {
    buildFixtureDom();
    history.pushState({}, '', '/');
  });

  it('re-attaches exactly once per genuine SPA navigation across 3+ consecutive route swaps, with no duplicate signal firing', () => {
    initSignalCapture(demoConfig);

    const received = [];
    collectReceived((payload) => received.push(payload));

    for (let i = 1; i <= 3; i += 1) {
      // Simulate a route swap: new subtree, new pathname (history.pushState,
      // not popstate — matches how SPA routers like Next.js navigate; see
      // 02-RESEARCH.md Pattern 1), then the same maybeReattach() gate both
      // the MutationObserver callback and the popstate listener funnel
      // through in the real implementation.
      buildFixtureDom();
      history.pushState({}, '', `/screen-${i}`);
      maybeReattach(demoConfig);

      fireEmptyBlur(getEl('amountInput'));
    }

    // 3 navigations, one blur each — exactly 3 receipts total, never more:
    // each navigation's element gets exactly one fresh listener, no stacking.
    const blurIncompletes = received.filter((p) => p.type === 'blur_incomplete');
    expect(blurIncompletes).toHaveLength(3);
  });

  it('attaches a fresh listener to the NEW element after a route swap, but does not double-attach when maybeReattach runs again on an unchanged pathname (WeakSet keyed on element identity, not selector string)', () => {
    attachListeners(demoConfig);
    const oldAmountInput = getEl('amountInput');

    const received = [];
    collectReceived((payload) => received.push(payload));

    // Route swap: old element is discarded, a new element with the same
    // selector but a different object identity takes its place.
    buildFixtureDom();
    history.pushState({}, '', '/screen-2');
    maybeReattach(demoConfig);
    const newAmountInput = getEl('amountInput');
    expect(newAmountInput).not.toBe(oldAmountInput);

    // Re-run maybeReattach several times on the SAME (unchanged) pathname —
    // each must be a no-op, not a second attachment on newAmountInput. A
    // Set<string> keyed on selector string (instead of WeakSet<Element>)
    // would incorrectly skip the fresh element as "already seen" — this is
    // the silent under-attachment failure mode Success Criterion 6 calls out;
    // a duplicate-listener bug would instead show up as >1 receipt below.
    maybeReattach(demoConfig);
    maybeReattach(demoConfig);

    fireEmptyBlur(newAmountInput);

    const blurIncompletes = received.filter((p) => p.type === 'blur_incomplete');
    expect(blurIncompletes).toHaveLength(1); // exactly one listener wired, not stacked, not missing
  });

  it('fires a dispatched blur sequence only once per element after multiple maybeReattach calls with no pathname change (no double-listener accumulation)', () => {
    initSignalCapture(demoConfig);

    const received = [];
    collectReceived((payload) => received.push(payload));

    const amountInput = getEl('amountInput');

    // Call maybeReattach several times with no pathname change in between —
    // each call must be a no-op against the already-wired amountInput.
    maybeReattach(demoConfig);
    maybeReattach(demoConfig);
    maybeReattach(demoConfig);

    fireEmptyBlur(amountInput);

    const blurIncompletes = received.filter((p) => p.type === 'blur_incomplete');
    expect(blurIncompletes).toHaveLength(1);
  });
});
