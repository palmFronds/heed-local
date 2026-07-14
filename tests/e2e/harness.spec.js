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
