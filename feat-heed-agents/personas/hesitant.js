// personas/hesitant.js
// Persona 2 — Hesitant
//
// Profile: exhibits clear hesitation signals but ultimately completes.
// The most valuable persona for training — positive outcome + rich signals.
//
// Behavior:
//   - Screen 2: taps amount-input, pauses 3-5s before typing (touch_hesitation)
//     Optionally blurs and re-enters 0-2 times (blur_incomplete)
//     Scrolls down to fee-row, pauses, scrolls back (scroll_reversal, 70% prob)
//     Types amount, taps Proceed
//   - Screen 3: holds confirm-cta for 1.5-3s then lifts (touch_hesitation)
//   - Reaches Screen 4 (flowComplete = true)

const { randomDelay, touchHesitate, typeSlowly } = require('../utils/browser');

const BASE_URL = process.env.HEED_BASE_URL || 'http://localhost:3000';

async function runHesitant(page, logger) {
  // ── Screen 1 ───────────────────────────────────────────────────
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await randomDelay(400, 900);
  await page.locator('a[href="/swap"]').first().tap();
  await page.waitForURL('**/swap', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 2: Swap ─────────────────────────────────────────────
  await randomDelay(500, 1200);

  // Optional blur_incomplete: tap into field then away, 0-2 times
  const blurCount = Math.floor(Math.random() * 3); // 0, 1, or 2
  for (let i = 0; i < blurCount; i++) {
    await page.locator('[data-heed="amount-input"]').tap();
    await randomDelay(800, 1800); // dwell in field without typing
    // Tap elsewhere to blur
    await page.tap('body', { position: { x: 195, y: 100 } }).catch(() => {});
    await randomDelay(400, 900);
  }

  // Touch hesitation on amount-input: tap in, pause 3-5s before typing
  await page.locator('[data-heed="amount-input"]').tap();
  await randomDelay(3000, 5000); // <-- the hesitation

  // Type the amount
  await typeSlowly(page, '[data-heed="amount-input"]', '1.5', {
    minMs: 100,
    maxMs: 280,
  });

  await randomDelay(600, 1200);

  // Scroll reversal: 70% probability
  if (Math.random() < 0.70) {
    // Scroll down to fee-row
    const feeRow = page.locator('[data-heed="fee-row"]');
    await feeRow.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {});
    await feeRow.scrollIntoViewIfNeeded().catch(() => {});
    await randomDelay(1200, 2500); // pause at fee row — the "reversal dwell"

    // Scroll back up
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await randomDelay(500, 1000);
  }

  // Tap Proceed
  const proceedBtn = page.locator('[data-heed="proceed-cta"]');
  await proceedBtn.waitFor({ state: 'visible', timeout: 10000 });
  await randomDelay(300, 800);
  await proceedBtn.tap();
  await page.waitForURL('**/confirm', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 3: Confirm ──────────────────────────────────────────
  await randomDelay(600, 1500);

  // Touch hesitation on confirm-cta: hold 1.5-3 seconds then release
  const holdMs = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
  await touchHesitate(page, '[data-heed="confirm-cta"]', holdMs);

  // After hesitation resolves, do a clean tap to actually confirm
  await randomDelay(200, 500);
  const confirmBtn = page.locator('[data-heed="confirm-cta"]');
  await confirmBtn.waitFor({ state: 'visible', timeout: 10000 });
  await confirmBtn.tap();
  await page.waitForURL('**/success', { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  // ── Screen 4: Success ──────────────────────────────────────────
  const flowComplete = await page
    .locator('[data-heed="flow-complete"]')
    .isVisible()
    .catch(() => false);

  await randomDelay(600, 1200);

  return { outcome: 'complete', flowComplete };
}

module.exports = { runHesitant };
