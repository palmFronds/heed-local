// utils/browser.js
// Shared Playwright browser/context factory.
// All personas use this to get a correctly-configured iPhone 14 context.

const { chromium } = require('playwright');

// iPhone 14 device profile (matches Playwright's built-in device)
const IPHONE_14 = {
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
};

/**
 * Launch a browser and return { browser, context, page }.
 * Caller is responsible for calling browser.close() when done.
 *
 * @param {{ headless?: boolean }} options
 */
async function launchMobileBrowser({ headless = true } = {}) {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext(IPHONE_14);
  const page = await context.newPage();
  return { browser, context, page };
}

/**
 * Simple utility: sleep for a random ms between [min, max].
 */
function randomDelay(min, max) {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simulate a touch hesitation on an element:
 *   touchstart → pause for holdMs → touchend
 *
 * @param {import('playwright').Page} page
 * @param {string} selector   — data-heed selector string
 * @param {number} holdMs     — how long to hold (ms)
 */
async function touchHesitate(page, selector, holdMs) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'visible', timeout: 8000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`touchHesitate: no bounding box for ${selector}`);

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Dispatch touchstart, hold for holdMs, then dispatch touchend.
  // Using page.evaluate so we stay in the browser context without triggering
  // a real Playwright click (which would navigate the page immediately).
  await page.evaluate(
    ({ x, y, holdMs }) => {
      return new Promise((resolve) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return resolve();

        el.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
        }));

        setTimeout(() => {
          el.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true, cancelable: true,
            changedTouches: [new Touch({ identifier: 1, target: el, clientX: x, clientY: y })],
          }));
          resolve();
        }, holdMs);
      });
    },
    { x, y, holdMs }
  );
}

/**
 * Simulate a touch hold that does NOT end (for abandon variant B).
 * Fires touchstart, waits holdMs, then fires touchend WITHOUT navigating.
 * Caller should then tap back-btn.
 */
async function touchHold(page, selector, holdMs) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'visible', timeout: 8000 });
  const box = await el.boundingBox();
  if (!box) throw new Error(`touchHold: no bounding box for ${selector}`);

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.evaluate(
    ({ x, y, holdMs }) => {
      return new Promise((resolve) => {
        const el = document.elementFromPoint(x, y);
        if (!el) return resolve();

        el.dispatchEvent(new TouchEvent('touchstart', {
          bubbles: true, cancelable: true,
          touches: [new Touch({ identifier: 2, target: el, clientX: x, clientY: y })],
        }));

        setTimeout(() => {
          // End without triggering click — move slightly off target first
          el.dispatchEvent(new TouchEvent('touchend', {
            bubbles: true, cancelable: true,
            changedTouches: [new Touch({ identifier: 2, target: el, clientX: x + 60, clientY: y + 60 })],
          }));
          resolve();
        }, holdMs);
      });
    },
    { x, y, holdMs }
  );
}

/**
 * Type into a selector character-by-character at a realistic speed.
 *
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @param {{ minMs?: number, maxMs?: number }} options
 */
async function typeSlowly(page, selector, text, { minMs = 80, maxMs = 200 } = {}) {
  const el = page.locator(selector);
  await el.waitFor({ state: 'visible', timeout: 15000 });
  await el.tap();
  for (const char of text) {
    await page.keyboard.type(char);
    await randomDelay(minMs, maxMs);
  }
}

module.exports = { launchMobileBrowser, randomDelay, touchHesitate, touchHold, typeSlowly, IPHONE_14 };
