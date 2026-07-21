// tests/e2e/branch1-live.spec.js — Plan 06-02 (INTEG-01, D-06/D-07 verify
// plan). Runs against a LIVE worktree'd Branch 1 (`feat/demo-platform`,
// checked out at `../heed-worktree-demo-platform` by Plan 06-01, served via
// its own `next dev` on http://localhost:3000 — the `live-branch1` Playwright
// project's `baseURL`), not the file:// static harness `tests/e2e/harness.spec.js`
// covers. This suite is the automated half of D-06's "both, not either/or"
// requirement — the Task 3 human-verify checkpoint runs the manual half.
//
// Prerequisites (both must be running before this suite is executed):
//   1. `npm run receiver` — this repo's local receiver on :4310 (serves
//      GET /sdk.js and GET /config/demo-platform-live.json, per Plan 06-01).
//   2. `cd ../heed-worktree-demo-platform && npm run dev` — Branch 1's own
//      plain `next dev` (localhost-only, NOT `dev:network` — 06-RESEARCH.md
//      Pitfall 4) on :3000, with the worktree's uncommitted layout.tsx boot
//      script (Plan 06-01 Task 3) wired in.
//
// back_intent / Pitfall 1: `feat/demo-platform`'s on-screen back button
// (`[data-heed="back-btn"]` on /confirm) calls Next.js's `router.push()`,
// which performs a client-side History API `pushState()` — this NEVER fires
// a `popstate` event, so `src/signal.js`'s SIG-04 listener has nothing to
// react to. The back_intent test below therefore uses `page.goBack()`, which
// drives genuine browser back-navigation (and does fire `popstate`), and
// deliberately never clicks the on-screen back button.
//
// This suite exercises Plan 06-01's wiring only — it adds no new SDK logic.
// Console-log assertions read the sole `console.log('[heed]', ...)` choke
// point (src/log.js writeLog()), whose entry shape is
// `{ ts, sessionId, partnerId, event, data }`; `data` carries the bus
// payload (`signal:detected`'s payload for `signal_detected` entries, etc.).
import { test, expect } from '@playwright/test';

/**
 * Dispatches a real (though programmatically constructed, isTrusted:false)
 * touchstart on the given selector, driving src/signal.js's actual
 * touchstart listener and its live-firing setTimeout hold timer (SIG-01) —
 * mirrors test-harness/index.html's simulateHold() helper, adapted for a
 * live page rather than the static harness.
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function dispatchTouchStart(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const touch = new Touch({ identifier: Date.now(), target: el, clientX: 0, clientY: 0 });
    el.dispatchEvent(
      new TouchEvent('touchstart', {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
        bubbles: true,
        cancelable: true,
      })
    );
  }, selector);
}

/**
 * Dispatches a real touchend on the given selector — used after the hold
 * threshold has already elapsed, matching the real press-and-release
 * gesture sequence (the SIG-01 timer already fired live while held; this
 * just completes the gesture cleanly, it is not what triggers the signal).
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
async function dispatchTouchEnd(page, selector) {
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.dispatchEvent(
      new TouchEvent('touchend', {
        touches: [],
        targetTouches: [],
        changedTouches: [],
        bubbles: true,
        cancelable: true,
      })
    );
  }, selector);
}

/**
 * Press-and-hold proceed-cta past the 800ms threshold (config's
 * signals.touchHesitation.thresholdMs, live config mirrors demo-platform.json).
 * @param {import('@playwright/test').Page} page
 */
async function holdProceedCtaPastThreshold(page) {
  await dispatchTouchStart(page, '[data-heed="proceed-cta"]');
  await page.waitForTimeout(900); // past the 800ms threshold (SIG-01, D-01)
  await dispatchTouchEnd(page, '[data-heed="proceed-cta"]');
}

/**
 * Parses `[heed] {...}` console lines collected via page.on('console') into
 * their `{ ts, sessionId, partnerId, event, data }` envelopes.
 * @param {string[]} logs
 * @returns {Array<{ts:number, sessionId:string, partnerId:string, event:string, data:*}>}
 */
function parseHeedEntries(logs) {
  return logs.filter((l) => l.startsWith('[heed]')).map((l) => JSON.parse(l.replace('[heed] ', '')));
}

test.describe('Branch 1 live integration (INTEG-01)', () => {
  test('SC4: no [heed] logs fire on Screen 1 (/)', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/');
    await page.waitForFunction(() => window.__heedReady === true);
    await page.waitForTimeout(1000); // let init/attach settle — Screen 1 has no data-heed elements to attach to

    expect(logs.some((l) => l.includes('[heed]'))).toBe(false);
  });

  test('touch_hesitation: press-and-hold proceed-cta past 800ms produces a signal_detected receipt', async ({
    page,
  }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);

    await holdProceedCtaPastThreshold(page);

    await expect
      .poll(() => logs.some((l) => l.includes('"type":"touch_hesitation"')))
      .toBe(true);
  });

  test('blur_incomplete: focusing then blurring untouched amount-input produces a signal_detected receipt', async ({
    page,
  }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);

    const input = page.locator('[data-heed="amount-input"]');
    await input.focus();
    await input.blur(); // left empty at blur time — D-03 fires on empty-at-blur

    await expect
      .poll(() => logs.some((l) => l.includes('"type":"blur_incomplete"')))
      .toBe(true);
  });

  test('scroll_reversal: scrolling past 40% depth then reversing produces a signal_detected receipt', async ({
    page,
  }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);

    await page.evaluate(() => {
      window.scrollTo(0, window.innerHeight * 0.5); // past the 40% depth threshold
      window.dispatchEvent(new Event('scroll'));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      window.scrollTo(0, window.innerHeight * 0.5 - 100); // reverse by >50px (D-05 minimum delta)
      window.dispatchEvent(new Event('scroll'));
    });

    await expect
      .poll(() => logs.some((l) => l.includes('"type":"scroll_reversal"')))
      .toBe(true);
  });

  test('back_intent: real browser-back navigation from /confirm produces a PII-free allow-listed signal_detected receipt', async ({
    page,
  }) => {
    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);
    await page.locator('[data-heed="amount-input"]').fill('1');
    await page.locator('[data-heed="proceed-cta"]').click();
    await expect(page).toHaveURL(/\/confirm/);
    await page.waitForFunction(() => window.__heedReady === true);

    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    // Real browser back-navigation (fires a genuine popstate) — deliberately
    // NOT a tap on the on-screen back button (see file header, Pitfall 1).
    await page.goBack();

    await expect
      .poll(() => logs.some((l) => l.includes('"type":"back_intent"')))
      .toBe(true);

    const entry = parseHeedEntries(logs).find((e) => e.event === 'signal_detected' && e.data?.type === 'back_intent');
    expect(entry).toBeTruthy();
    const payload = entry.data;

    expect(Object.keys(payload).sort()).toEqual(['bbox', 'pathname', 'targetSelector', 'timestamp', 'type'].sort());
    expect(payload.type).toBe('back_intent');
    expect(payload.targetSelector).toBeNull();
    expect(payload.bbox).toBeNull();
    expect(typeof payload.pathname).toBe('string');
    expect(typeof payload.timestamp).toBe('number');
  });

  test('SC2: console log order for a triggered signal is exactly signal_detected -> inference_run -> response_fired', async ({
    page,
  }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);

    await holdProceedCtaPastThreshold(page);

    await expect.poll(() => logs.some((l) => l.includes('"event":"response_fired"'))).toBe(true);

    const events = parseHeedEntries(logs)
      .map((e) => e.event)
      .filter((e) => ['signal_detected', 'inference_run', 'response_fired'].includes(e));

    expect(events).toEqual(['signal_detected', 'inference_run', 'response_fired']);
  });

  test('SC3: response overlay renders above Branch 1 UI without blocking underlying interaction', async ({
    page,
  }) => {
    await page.goto('/swap');
    await page.waitForFunction(() => window.__heedReady === true);
    await page.locator('[data-heed="amount-input"]').fill('1');

    await holdProceedCtaPastThreshold(page);

    const overlay = page.locator('[data-heed-overlay]');
    await expect(overlay).toHaveCount(1);
    await expect(overlay).toHaveCSS('pointer-events', 'none');

    const bubble = page.locator('[data-heed-response]');
    await expect(bubble).toHaveCSS('pointer-events', 'auto');

    // Underlying CTA is still tappable THROUGH the overlay (SC3) — the
    // pointer-events:none container lets a real click reach the host element.
    await page.locator('[data-heed="proceed-cta"]').click({ timeout: 3000 });
  });
});
