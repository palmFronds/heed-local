// personas/confident.js
// Persona 1 — Confident
//
// Profile: completes the flow without meaningful hesitation.
// Produces minimal signal. Positive outcome (flowComplete = true).
//
// Behavior:
//   - Screen 1: taps Swap CTA immediately
//   - Screen 2: types amount within 2s, no scroll reversal, taps Proceed
//   - Screen 3: pauses 500-2000ms, taps Confirm
//   - Reaches Screen 4 (flow-complete visible)

const { randomDelay, typeSlowly } = require('../utils/browser');

const BASE_URL = process.env.HEED_BASE_URL || 'http://localhost:3000';

/**
 * Run one Confident session.
 *
 * @param {import('playwright').Page} page
 * @param {{ events: Array }} logger  — logger object from attachHeedLogger
 * @returns {{ outcome: string, flowComplete: boolean }}
 */
async function runConfident(page, logger) {
  // ── Screen 1: Wallet Overview ──────────────────────────────────
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  // Tiny realistic dwell before acting (50-300ms)
  await randomDelay(50, 300);

  // Tap the Swap CTA
  await page.locator('a[href="/swap"]').first().tap();
  await page.waitForURL('**/swap', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 2: Swap ─────────────────────────────────────────────
  await randomDelay(200, 600); // brief look at the screen

  // Type amount quickly (confident user knows what they want)
  await typeSlowly(page, '[data-heed="amount-input"]', '1.5', {
    minMs: 80,
    maxMs: 200,
  });

  await randomDelay(300, 700); // brief review before proceeding

  // Tap Proceed
  const proceedBtn = page.locator('[data-heed="proceed-cta"]');
  await proceedBtn.waitFor({ state: 'visible', timeout: 10000 });
  await proceedBtn.tap();
  await page.waitForURL('**/confirm', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 3: Confirm ──────────────────────────────────────────
  // Randomized pause: 500ms – 2000ms
  await randomDelay(500, 2000);

  // Tap Confirm (no hold, just a clean tap)
  const confirmBtn = page.locator('[data-heed="confirm-cta"]');
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  await confirmBtn.tap();
  await page.waitForURL('**/success', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 4: Success ──────────────────────────────────────────
  const flowCompleteEl = page.locator('[data-heed="flow-complete"]');
  const flowComplete = await flowCompleteEl.isVisible().catch(() => false);

  await randomDelay(500, 1000); // brief success screen dwell

  return { outcome: 'complete', flowComplete };
}

module.exports = { runConfident };
