import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    // tests/e2e/**/*.spec.js is Playwright's suite (Plan 02-04, D-08) — it
    // imports { test, expect } from '@playwright/test', not vitest, and
    // otherwise collides with Vitest's default *.spec.js include glob.
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
  },
});
