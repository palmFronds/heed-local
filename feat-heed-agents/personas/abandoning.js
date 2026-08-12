// personas/abandoning.js
// Persona 3 — Abandoning
//
// Profile: hesitates and does NOT complete the flow. Negative outcome.
// 50/50 random split between two variants per session.
//
// Variant A — abandons at Screen 2:
//   Taps amount-input, blurs without typing (blur_incomplete)
//   Scrolls to fee-row, pauses, scrolls back (scroll_reversal)
//   Taps back button → back to Screen 1
//   flowComplete = false
//
// Variant B — abandons at Screen 3:
//   Completes Screen 2 normally (types amount, taps Proceed)
//   Holds confirm-cta for 2-4s (touch_hesitation) — does NOT lift to confirm
//   Taps back-btn → back to Screen 2
//   flowComplete = false

const { randomDelay, touchHold, typeSlowly } = require('../utils/browser');

const BASE_URL = process.env.HEED_BASE_URL || 'http://localhost:3000';

// ── Variant A ─────────────────────────────────────────────────────────────────
async function runVariantA(page) {
  // Screen 1
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await randomDelay(300, 800);
  await page.locator('a[href="/swap"]').first().tap();
  await page.waitForURL('**/swap', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Screen 2: tap amount-input, dwell, blur without typing
  await randomDelay(400, 1000);
  await page.locator('[data-heed="amount-input"]').tap();
  await randomDelay(1200, 2500); // dwell in field — blur_incomplete signal

  // Tap away to blur
  await page.tap('body', { position: { x: 195, y: 120 } }).catch(() => {});
  await randomDelay(600, 1200);

  // Scroll to fee-row (scroll_reversal setup)
  const feeRow = page.locator('[data-heed="fee-row"]');
  await feeRow.scrollIntoViewIfNeeded().catch(() => {});
  await randomDelay(1000, 2200); // pause at fee row

  // Scroll back up (reversal)
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  await randomDelay(500, 900);

  // Tap back button — the back btn on swap page routes to /
  // Note: swap page does not have a data-heed back-btn, it uses the header back arrow
  // We navigate away by going back in history to simulate abandonment
  await page.goBack().catch(async () => {
    // fallback: navigate directly if goBack isn't available
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  });

  await randomDelay(300, 600);

  return { outcome: 'abandoned', flowComplete: false, variant: 'A' };
}

// ── Variant B ─────────────────────────────────────────────────────────────────
async function runVariantB(page) {
  // Screen 1
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await randomDelay(300, 700);
  await page.locator('a[href="/swap"]').first().tap();
  await page.waitForURL('**/swap', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Screen 2: complete normally (no hesitation signals)
  await randomDelay(400, 800);
  await typeSlowly(page, '[data-heed="amount-input"]', '2', {
    minMs: 90,
    maxMs: 220,
  });
  await randomDelay(400, 900);

  const proceedBtn = page.locator('[data-heed="proceed-cta"]');
  await proceedBtn.waitFor({ state: 'visible', timeout: 10000 });
  await proceedBtn.tap();
  await page.waitForURL('**/confirm', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  // Screen 3: hold confirm-cta for 2-4s (hesitation) but DON'T release to confirm
  await randomDelay(500, 1200);
  const holdMs = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
  await touchHold(page, '[data-heed="confirm-cta"]', holdMs);

  // After holding, tap back-btn (back_intent signal)
  await randomDelay(200, 600);
  const backBtn = page.locator('[data-heed="back-btn"]');
  await backBtn.waitFor({ state: 'visible', timeout: 10000 });
  await backBtn.tap();
  await page.waitForURL('**/swap', { timeout: 8000 });
  await page.waitForLoadState('networkidle');

  await randomDelay(300, 600);

  return { outcome: 'abandoned', flowComplete: false, variant: 'B' };
}

// ── Main export ───────────────────────────────────────────────────────────────
async function runAbandoning(page, logger) {
  const useVariantA = Math.random() < 0.5;
  return useVariantA ? runVariantA(page) : runVariantB(page);
}

module.exports = { runAbandoning };
