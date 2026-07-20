// playwright.config.js — first Playwright config in the project (Plan 02-04,
// D-08). No webServer block: tests/e2e/harness.spec.js navigates directly via
// a file:// URL built from test-harness/index.html, consistent with the
// harness's no-server, no-Branch-1 design (mirrors Phase 1's 01-05-PLAN.md
// manual "double-click the file" verification precedent).
//
// Plan 06-02 (D-06/D-07 verify plan) adds a second project, `live-branch1`,
// targeting the live worktree'd Branch 1 (`../heed-worktree-demo-platform`,
// `feat/demo-platform`, run via its own `next dev` on http://localhost:3000)
// instead of the file:// static harness. The top-level `use` block below
// (390px viewport, hasTouch, isMobile) stays shared across both projects;
// `live-branch1` only adds its own `baseURL`. No webServer block in either
// project — both dev servers (this repo's `npm run receiver` on :4310, and
// the worktree's `npm run dev` on :3000) are started manually per D-06's
// manual-walkthrough framing, matching this repo's existing no-auto-launch
// convention (06-RESEARCH.md Pattern 3).
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
  projects: [
    {
      name: 'file-harness',
      testMatch: 'harness.spec.js',
    },
    {
      name: 'live-branch1',
      testMatch: 'branch1-live.spec.js',
      use: { baseURL: 'http://localhost:3000' },
    },
  ],
});
