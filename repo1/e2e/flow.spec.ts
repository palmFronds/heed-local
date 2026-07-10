import { test, expect, devices } from "@playwright/test";

const iPhone14 = devices["iPhone 14"];

test.use({
  ...iPhone14,
  baseURL: "http://localhost:3000",
});

test.describe("Heed Demo Platform — Full Flow", () => {
  test("navigates all 4 screens with all 7 data-heed selectors present", async ({
    page,
  }) => {
    // ── Screen 1: Wallet Overview ──
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("12,480");

    // Click Swap CTA
    const swapBtn = page.getByRole("link", { name: /swap/i });
    await expect(swapBtn).toBeVisible();
    await swapBtn.click();
    await page.waitForURL("/swap");

    // ── Screen 2: Amount Entry & Fee Math ──
    // Verify all 4 data-heed selectors exist
    const amountInput = page.locator('[data-heed="amount-input"]');
    const feeRow = page.locator('[data-heed="fee-row"]');
    const minReceivedRow = page.locator('[data-heed="min-received-row"]');
    const proceedCta = page.locator('[data-heed="proceed-cta"]');

    await expect(amountInput).toBeVisible();
    await expect(feeRow).toBeVisible();
    await expect(minReceivedRow).toBeVisible();
    await expect(proceedCta).toBeVisible();

    // Type an amount
    await amountInput.fill("0.5");
    await expect(amountInput).toHaveValue("0.5");

    // Verify fee calculation updated
    await expect(feeRow).toContainText("ETH");
    await expect(minReceivedRow).toContainText("USDC");

    // Verify page scrolls past viewport (content overflows 844px)
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(pageHeight).toBeGreaterThan(844);

    // Click proceed
    await proceedCta.click();
    await page.waitForURL("/confirm");

    // ── Screen 3: Confirmation ──
    // Verify data-heed selectors
    const confirmCta = page.locator('[data-heed="confirm-cta"]');
    const backBtn = page.locator('[data-heed="back-btn"]');

    await expect(confirmCta).toBeVisible();
    await expect(backBtn).toBeVisible();

    // Verify the amount from Screen 2 is displayed
    await expect(page.locator("body")).toContainText("0.5");

    // Test back-navigation preserves state
    await backBtn.click();
    await page.waitForURL("/swap");
    await expect(amountInput).toHaveValue("0.5"); // State preserved!

    // Go forward again
    await proceedCta.click();
    await page.waitForURL("/confirm");

    // Confirm the swap
    await confirmCta.click();
    await page.waitForURL("/success");

    // ── Screen 4: Success ──
    const flowComplete = page.locator('[data-heed="flow-complete"]');
    await expect(flowComplete).toBeVisible();
    await expect(page.locator("h1")).toContainText("Transaction Complete");
  });

  test("shows mobile-only message on desktop viewport", async ({
    browser,
  }) => {
    // Create a context with desktop viewport
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120",
    });
    const desktopPage = await desktopContext.newPage();
    await desktopPage.goto("http://localhost:3000/");

    const fallback = desktopPage.locator("#desktop-fallback");
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText("This app is mobile-only");

    // Mobile app should be hidden
    const mobileApp = desktopPage.locator("#mobile-app");
    await expect(mobileApp).not.toBeVisible();

    await desktopContext.close();
  });

  test("makes no external network calls", async ({ page }) => {
    const externalRequests: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());
      // Allow localhost requests only
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/");
    await page.waitForTimeout(2000);

    // Navigate full flow
    await page.getByRole("link", { name: /swap/i }).click();
    await page.waitForURL("/swap");
    await page.waitForTimeout(500);

    expect(externalRequests).toHaveLength(0);
  });

  test("all 7 data-heed selectors are queryable via document.querySelector", async ({
    page,
  }) => {
    // Screen 2 selectors
    await page.goto("/swap");
    for (const selector of [
      "amount-input",
      "fee-row",
      "min-received-row",
      "proceed-cta",
    ]) {
      const el = await page.evaluate(
        (s) => document.querySelector(`[data-heed="${s}"]`) !== null,
        selector
      );
      expect(el, `[data-heed="${selector}"] should exist on /swap`).toBe(true);
    }

    // Screen 3 selectors — need an amount in context first
    await page.locator('[data-heed="amount-input"]').fill("1");
    await page.locator('[data-heed="proceed-cta"]').click();
    await page.waitForURL("/confirm");

    for (const selector of ["confirm-cta", "back-btn"]) {
      const el = await page.evaluate(
        (s) => document.querySelector(`[data-heed="${s}"]`) !== null,
        selector
      );
      expect(el, `[data-heed="${selector}"] should exist on /confirm`).toBe(
        true
      );
    }

    // Screen 4 selector
    await page.locator('[data-heed="confirm-cta"]').click();
    await page.waitForURL("/success");

    const flowComplete = await page.evaluate(
      () =>
        document.querySelector('[data-heed="flow-complete"]') !== null
    );
    expect(
      flowComplete,
      '[data-heed="flow-complete"] should exist on /success'
    ).toBe(true);
  });
});
