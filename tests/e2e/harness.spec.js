// tests/e2e/harness.spec.js — D-08 real-browser proof (Plan 02-04). Opens the
// actual built test-harness/index.html in a real (headless, mobile-viewport-
// emulated) browser and clicks the rewired debug-panel buttons, asserting
// the #log panel shows a receipt for each signal type. This is the layer
// that proves the debug panel's real DOM-event dispatch (D-08) genuinely
// drives signal.js's actual listeners end-to-end — happy-dom unit tests
// (tests/signal.test.js, tests/signal-spa.test.js) cannot substitute for it.
//
// IMPORTANT: `npm run build` must be run before this suite so dist/sdk.js
// reflects the latest src/signal.js and src/index.js wiring (Plans 02-02/
// 02-03). This spec does not auto-invoke the build itself — that is the
// responsibility of the run command (see verify block in 02-04-PLAN.md).
import { test, expect } from '@playwright/test';
import path from 'node:path';

const HARNESS_URL = 'file://' + path.resolve('test-harness/index.html');

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS_URL);
});

test('touch_hesitation: holding proceed-cta past the 800ms threshold produces a #log receipt', async ({ page }) => {
  await page.click('button[data-signal="touch_hesitation"]');
  // The rewired button holds for 900ms (past the 800ms threshold) before
  // dispatching touchend — Playwright's default auto-retrying expect timeout
  // comfortably covers this.
  await expect(page.locator('#log')).toContainText('"type":"touch_hesitation"');
});

test('blur_incomplete: focusing then blurring amount-input while empty produces a #log receipt', async ({ page }) => {
  await page.click('button[data-signal="blur_incomplete"]');
  await expect(page.locator('#log')).toContainText('"type":"blur_incomplete"');
});

test('scroll_reversal: scrolling past 40% depth then reversing produces a #log receipt', async ({ page }) => {
  await page.click('button[data-signal="scroll_reversal"]');
  await expect(page.locator('#log')).toContainText('"type":"scroll_reversal"');
});

test('back_intent: dispatching popstate while flowComplete is false produces a #log receipt with a PII-free allow-listed payload', async ({ page }) => {
  await page.click('button[data-signal="back_intent"]');
  await expect(page.locator('#log')).toContainText('"type":"back_intent"');

  // SIG-05 at the real-browser layer: parse the last JSON line out of #log's
  // textContent and assert the payload's key set matches back_intent's exact
  // D-07 allow-list — no PII-shaped extra key (mirrors the unit-test
  // structural allow-list assertion, but exercised against a payload that
  // traveled through the real dispatchEvent -> signal.js -> bus.js path).
  const logText = await page.locator('#log').textContent();
  const lines = logText.trim().split('\n').filter(Boolean);
  const payload = JSON.parse(lines[lines.length - 1]);

  expect(Object.keys(payload).sort()).toEqual(
    ['bbox', 'pathname', 'targetSelector', 'timestamp', 'type'].sort()
  );
  expect(payload.type).toBe('back_intent');
  expect(payload.targetSelector).toBeNull();
  expect(payload.bbox).toBeNull();
  expect(typeof payload.pathname).toBe('string');
  expect(typeof payload.timestamp).toBe('number');
});

// Plan 04-05: response-rendering + postMessage-capture E2E coverage
// (RESP-01/02/03). Requires a fresh `npm run build` so dist/sdk.js includes
// src/response.js + src/log.js via src/index.js's updated import graph
// (D-08 sessionId wiring, Plan 04-05 Task 1) — this suite is the real-
// browser proof that the two new modules actually bundle and drive real DOM
// behavior a happy-dom unit test cannot (tests/response.test.js already
// covers the pure logic in isolation).
//
// config/demo-platform.json sets activeScreens: [] (permissive — the
// standalone harness is a single static page with no real routing,
// 04-RESEARCH.md Pitfall 3) and inference.confidenceThreshold: 0.4 (below
// every canonical cold-start signal's real softmax margin, ~0.44-0.50 per
// admin/print-softmax-margins.mjs) so the bundled cold-start weights
// reliably cross the confidence gate and fire a response in this harness —
// the default 0.65 production threshold is deliberately NOT met by the
// intentionally non-saturated cold-start margins (03-VALIDATION Success
// Criterion 2), so a demo-specific override is required to demonstrate
// RESP-01/02/03 end-to-end here.
test.describe('response overlay rendering + postMessage capture', () => {
  test('touch_hesitation: renders a tooltip bubble above the host UI without blocking host interaction', async ({
    page,
  }) => {
    await page.click('button[data-signal="touch_hesitation"]');

    // (a) overlay container exists and never blocks taps outside a rendered response.
    const overlay = page.locator('[data-heed-overlay]');
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveCSS('pointer-events', 'none');

    // (b) the rendered bubble is tappable and carries the UI-SPEC copy for its intent
    // (touch_hesitation -> confusion -> tooltip, admin/generate-weights.mjs canonical mapping).
    const bubble = page.locator('[data-heed-response]');
    await expect(bubble).toHaveAttribute('data-response-type', 'tooltip');
    await expect(bubble).toHaveCSS('pointer-events', 'auto');
    await expect(bubble).toContainText('Not sure what this means? Tap for a quick explanation.');

    // (c) the host page underneath remains interactive — the pointer-events: none
    // container lets a real tap on proceed-cta through to the host element.
    await page.locator('[data-heed="proceed-cta"]').click({ timeout: 3000 });
  });

  test('discount_offer: scroll_reversal fires an explicit-origin postMessage carrying the locked payload shape', async ({
    page,
  }) => {
    // Intercept window.postMessage calls at the source rather than relying on actual
    // cross-window delivery: this file:// harness's page origin is opaque ("null" per
    // the HTML spec), so the browser's same-origin delivery check can never match an
    // EXPLICIT non-wildcard targetOrigin (RESP-03/T-04-01 forbids '*') back to a
    // same-page 'message' listener — a same-origin-policy fact, not something this
    // suite is testing. This proves response.js CALLS postMessage with the correct
    // payload/origin, which is what RESP-03 actually requires of the SDK.
    await page.evaluate(() => {
      window.__heedPostMessages = [];
      const original = window.postMessage.bind(window);
      window.postMessage = function (data, targetOrigin, transfer) {
        window.__heedPostMessages.push({ data, targetOrigin });
        return original(data, targetOrigin, transfer);
      };
    });

    // scroll_reversal -> price_doubt -> discount_offer (admin/generate-weights.mjs canonical mapping).
    await page.click('button[data-signal="scroll_reversal"]');

    const bubble = page.locator('[data-heed-response]');
    await expect(bubble).toHaveAttribute('data-response-type', 'discount_offer');
    await expect(bubble).toContainText('Complete now and save on fees.');
    await expect(bubble.locator('button', { hasText: 'See offer' })).toBeVisible();

    const captured = await page.evaluate(() => window.__heedPostMessages);
    expect(captured.length).toBeGreaterThanOrEqual(1);
    const msg = captured[captured.length - 1];

    // T-04-01: explicit, non-wildcard target origin — never '*'.
    expect(msg.targetOrigin).not.toBe('*');
    expect(msg.targetOrigin).toBe('http://localhost:3000');

    // 04-UI-SPEC.md locked discount_offer postMessage payload shape.
    expect(msg.data.type).toBe('heed:discount_offer');
    expect(typeof msg.data.sessionId).toBe('string');
    expect(msg.data.sessionId.length).toBeGreaterThan(0);
    expect(msg.data.partnerId).toBe('demo-platform');
    expect(msg.data.intent).toBe('price_doubt');
    expect(typeof msg.data.timestamp).toBe('number');
  });
});
