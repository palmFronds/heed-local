// playwright.config.js — first Playwright config in the project (Plan 02-04,
// D-08). No webServer block: tests/e2e/harness.spec.js navigates directly via
// a file:// URL built from test-harness/index.html, consistent with the
// harness's no-server, no-Branch-1 design (mirrors Phase 1's 01-05-PLAN.md
// manual "double-click the file" verification precedent).
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    // 390px matches STACK.md's iOS target viewport.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
});
