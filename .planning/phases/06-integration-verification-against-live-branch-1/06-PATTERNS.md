# Phase 6: Integration Verification Against Live Branch 1 - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 6 (2 modified, 4 new; 1 of the new files lives in an external worktree)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `local-receiver/server.js` (extended, D-03) | service/route (dev-only static server) | request-response (static file serving) | itself — existing `GET /weights` branch, same file | exact (extend in place) |
| `config/demo-platform-live.json` (new, D-05) | config | file-I/O (static JSON read at request time) | `config/demo-platform.json` | exact (same-shape sibling) |
| `playwright.config.js` (edited) | config | request-response (test runner config) | itself — existing file, add `projects` array | exact (extend in place) |
| `tests/e2e/branch1-live.spec.js` (new, D-06) | test (e2e) | event-driven (DOM events → console log assertions) | `tests/e2e/harness.spec.js` | exact (same role, same assertion style, different transport — real DOM events vs. dispatchEvent) |
| `app/layout.tsx` (worktree `feat/demo-platform`, uncommitted, D-02) | provider/bootstrap (script injection) | request-response (script tag load) + event-driven (fetch-then-init boot) | `test-harness/index.html`'s inline `<script>` boot block (lines 156-189) | role-match (harness bootstrap is the same "fetch weights/config then init Heed" job, different host document) |
| worktree `npm install` step (setup, not a file) | n/a | n/a | n/a | n/a — tooling step, no code pattern needed |

## Pattern Assignments

### `local-receiver/server.js` (extend in place, service/request-response)

**Analog:** itself — `local-receiver/server.js` lines 1-19 (header/imports) and lines 67-103 (existing `GET /weights` handler)

**Imports pattern** (lines 1-19, already present — new code reuses these, does not add new imports beyond `path`/`fileURLToPath` which are already imported):
```javascript
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_WEIGHTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'weights.json');
```
D-03's two new routes should compute their own fixed constants the same way, e.g.:
```javascript
const DIST_SDK_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'sdk.js');
const LIVE_CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'demo-platform-live.json');
```

**CORS pattern** (lines 37-46) — `setCors(res)` is already called unconditionally at the top of the request handler (line 68) for every request, including the two new routes; no new CORS code is needed, just rely on the existing call:
```javascript
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**Core GET-route pattern to copy** (lines 78-103, existing `GET /weights` branch — the exact shape the two new branches should mirror: `if (req.method === 'GET' && req.url === '<exact path>')`, `fs.readFile`, `err` → `404` short-circuit, success → `writeHead(200, {'Content-Type': ...})` + `res.end(...)`, then `return`):
```javascript
if (req.method === 'GET' && req.url === '/weights') {
  fs.readFile(weightsPath, 'utf8', (err, raw) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no persisted weights yet' }));
      return;
    }
    // ... shape validation (not needed for sdk.js/config routes — they're not weights)
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(raw);
  });
  return;
}
```
New routes (add as additional `if` branches inside the same `http.createServer` callback, after the existing `OPTIONS` short-circuit and before the `GET /weights` branch or after — order among GET branches doesn't matter since `req.url` is compared exactly):
```javascript
if (req.method === 'GET' && req.url === '/sdk.js') {
  fs.readFile(DIST_SDK_PATH, (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(buf);
  });
  return;
}

if (req.method === 'GET' && req.url === '/config/demo-platform-live.json') {
  fs.readFile(LIVE_CONFIG_PATH, 'utf8', (err, raw) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(raw);
  });
  return;
}
```

**Fallback/error handling pattern** (line 194-195, already present, applies to any unmatched route including a typo'd path to the new routes):
```javascript
res.writeHead(404);
res.end();
```

**Convention notes carried from analog:** V12 security note already established in this file (no code needed) — routes must use exact `===` string comparison on `req.url`, never `path.join(base, req.url)`, to avoid introducing a path-traversal surface (see D-03/Pattern 2 in RESEARCH.md). The file's header comment style ("NEVER imported by src/ and NEVER bundled into dist/sdk.js") should be extended, not replaced, to mention the two new dev-only static routes.

**Factory/isMain pattern** (lines 55, 198-217) — unchanged; the two new routes live inside the existing `createReceiver()` factory body, no new exported function needed unless the planner wants `isValidWeights`-style testability (not required here since these routes have no shape validation).

---

### `config/demo-platform-live.json` (new, config, file-I/O)

**Analog:** `config/demo-platform.json` (full file, 28 lines) — copy this file's exact shape and mirror every top-level key; the only value that changes is `activeScreens`.

**Full pattern to copy and diff against:**
```json
{
  "platformId": "demo-platform",
  "completionSelector": "[data-heed=\"flow-complete\"]",
  "activeScreens": [],
  "partnerOrigin": "http://localhost:3000",
  "weightPushUrl": "http://localhost:4310/weights",
  "inference": {
    "confidenceThreshold": 0.4
  },
  "selectors": {
    "amountInput": "[data-heed=\"amount-input\"]",
    "feeRow": "[data-heed=\"fee-row\"]",
    "minReceivedRow": "[data-heed=\"min-received-row\"]",
    "proceedCta": "[data-heed=\"proceed-cta\"]",
    "confirmCta": "[data-heed=\"confirm-cta\"]",
    "backBtn": "[data-heed=\"back-btn\"]",
    "flowComplete": "[data-heed=\"flow-complete\"]"
  },
  "signals": {
    "touchHesitation": { "thresholdMs": 800 },
    "scrollReversal": { "depthThresholdPct": 0.4, "minReversalDeltaPx": 50 }
  }
}
```
**Diff for the live config (per D-05 / RESEARCH.md Open Question 1 recommendation):** change only `"activeScreens": []` → `"activeScreens": ["/swap", "/confirm", "/success"]`. Keep `partnerOrigin: "http://localhost:3000"` (already correct — matches Branch 1's `next dev` default port, verified via `git show feat/demo-platform:package.json`'s `"dev": "next dev"` script). Keep `inference.confidenceThreshold: 0.4` (matches existing precedent so cold-start weight margins reliably cross the gate — RESEARCH.md Open Question 1). Keep `platformId`, `completionSelector`, `weightPushUrl`, `selectors`, `signals` byte-identical.

**Validation note:** this file's shape must still satisfy `config/schema.json` (referenced by `src/index.js`'s `validateConfig(rawConfig, schema)` at init time) since the worktree's script tag will call `window.Heed.init(liveConfig)` directly with this file's parsed contents — do not add or omit keys relative to the analog.

---

### `playwright.config.js` (edit in place, config, request-response)

**Analog:** itself — full existing file (17 lines)

**Current shape to extend, not replace:**
```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
});
```
**Pattern to apply (D-06's second project, per RESEARCH.md Pattern 3):** move the existing top-level `use` block's behavior into a `projects` array so both the existing `file-harness` behavior and the new `live-branch1` project (with its own `baseURL`) coexist:
```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  },
  projects: [
    { name: 'file-harness', testMatch: 'harness.spec.js' },
    { name: 'live-branch1', testMatch: 'branch1-live.spec.js', use: { baseURL: 'http://localhost:3000' } },
  ],
});
```
No `webServer` block in either project — both dev servers (`npm run receiver` + worktree's `npm run dev`) are started manually per D-06's "manual walkthrough" framing, matching this repo's existing no-auto-launch convention (the current config has no `webServer` either).

---

### `tests/e2e/branch1-live.spec.js` (new, test/e2e, event-driven)

**Analog:** `tests/e2e/harness.spec.js` (full file, 156 lines) — same role (Playwright e2e asserting `[heed]`-tagged signal/log behavior), same assertion idioms, different navigation target (real `http://localhost:3000` routes instead of a `file://` static harness) and different event-triggering mechanism (real touch/scroll/focus/history-navigation via Playwright APIs instead of clicking debug-panel buttons that call `dispatchEvent`).

**Imports pattern** (lines 1-16 of analog):
```javascript
import { test, expect } from '@playwright/test';
import path from 'node:path';

const HARNESS_URL = 'file://' + path.resolve('test-harness/index.html');
```
For the live spec, no `HARNESS_URL`/`path` import is needed — navigation is relative to the `live-branch1` project's `baseURL`, e.g. `await page.goto('/')`, `await page.goto('/swap')`.

**beforeEach / readiness-wait pattern** (lines 18-28 of analog) — the harness waits on a custom `window.__heedReady` flag before dispatching signal events, to avoid a race between async init and event dispatch:
```javascript
test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS_URL);
  await page.waitForFunction(() => window.__heedReady === true);
});
```
The live spec's worktree boot script (see `app/layout.tsx` pattern below) should set the same `window.__heedReady = true` flag after `window.Heed.init(liveConfig)` resolves, so the live spec can reuse this exact `waitForFunction` idiom per-test (not in a shared `beforeEach`, since different tests navigate to different routes — `/`, `/swap`, `/confirm`).

**Core assertion pattern — console/log receipt, not `#log` DOM panel** (analog uses a DOM `#log` panel at lines 30-46; RESEARCH.md's Code Examples section — already vetted against this repo's real `src/log.js` console-log format — is the correct pattern for the live spec instead, since Branch 1's pages have no `#log` element):
```javascript
test('touch_hesitation: holding proceed-cta past the 800ms threshold produces a receipt', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  await page.goto('/swap');
  await page.waitForFunction(() => window.__heedReady === true);
  // ... real touch-hold sequence via page.touchscreen / dispatched TouchEvents
  expect(logs.some((l) => l.includes('"type":"touch_hesitation"'))).toBe(true);
});
```

**Structural payload allow-list assertion pattern to reuse verbatim** (analog lines 48-69, `back_intent` test) — copy this key-set assertion shape for the live spec's own `back_intent` test, substituting `page.goBack()` for the debug-button click per RESEARCH.md Pitfall 1 (clicking Branch 1's on-screen `back-btn` does NOT fire `popstate` — must use real back navigation):
```javascript
expect(Object.keys(payload).sort()).toEqual(
  ['bbox', 'pathname', 'targetSelector', 'timestamp', 'type'].sort()
);
expect(payload.type).toBe('back_intent');
```

**Overlay-rendering assertion pattern to reuse verbatim** (analog lines 89-110, `response overlay rendering` describe block — same `[data-heed-overlay]`/`[data-heed-response]` selectors, same `pointer-events` CSS assertions, same "underlying CTA still clickable through the overlay" check apply unchanged against Branch 1's real `proceed-cta`):
```javascript
const overlay = page.locator('[data-heed-overlay]');
await expect(overlay).toHaveCSS('pointer-events', 'none');
const bubble = page.locator('[data-heed-response]');
await expect(bubble).toHaveCSS('pointer-events', 'auto');
await page.locator('[data-heed="proceed-cta"]').click({ timeout: 3000 });
```

**No-signal-on-Screen-1 pattern (SC4, new — no direct analog in `harness.spec.js` since the standalone harness has no route-gating concept; RESEARCH.md's sketch is the pattern to use):**
```javascript
test('SC4: no [heed] logs fire on Screen 1', async ({ page }) => {
  const logs = [];
  page.on('console', (msg) => logs.push(msg.text()));
  await page.goto('/');
  await page.waitForTimeout(1000);
  expect(logs.some((l) => l.includes('[heed]'))).toBe(false);
});
```

---

### `app/layout.tsx` (worktree `feat/demo-platform`, uncommitted edit, provider/bootstrap)

**Analog:** `test-harness/index.html`'s inline bootstrap `<script>` block, lines 156-189 (this branch's own tree) — closest existing analog for "fetch cold-start data, then call a `window.Heed.*` init function." Branch 1's actual current `app/layout.tsx` (read via `git show feat/demo-platform:app/layout.tsx`, full file, 44 lines) is the edit target and has zero existing Heed wiring to build on.

**Branch 1's current file shape (edit target, verified via `git show feat/demo-platform:app/layout.tsx`):**
```tsx
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-background text-foreground">
        <div id="desktop-fallback">
          <p>This app is mobile-only.</p>
        </div>
        <div id="mobile-app">
          <SwapProvider>{children}</SwapProvider>
        </div>
      </body>
    </html>
  );
}
```
Per RESEARCH.md Pitfall 3, the injected `<script>` must go **after** `{children}`/the `<div id="mobile-app">` block, still inside `<body>`, so the SSR'd HTML for the current screen already exists in the DOM before the script runs:
```tsx
<body className="min-h-dvh bg-background text-foreground">
  <div id="desktop-fallback">
    <p>This app is mobile-only.</p>
  </div>
  <div id="mobile-app">
    <SwapProvider>{children}</SwapProvider>
  </div>
  <script src="http://localhost:4310/sdk.js"></script>
  <script
    dangerouslySetInnerHTML={{
      __html: `
        (function boot() {
          fetch('http://localhost:4310/config/demo-platform-live.json')
            .then(function (res) { return res.json(); })
            .then(function (liveConfig) {
              return fetch('http://localhost:4310/weights')
                .then(function (res) { return res.ok ? res.json() : null; })
                .then(function (weights) {
                  if (weights) liveConfig.inference = Object.assign({}, liveConfig.inference, { weights: weights });
                  return liveConfig;
                })
                .catch(function () { return liveConfig; });
            })
            .then(function (liveConfig) {
              window.Heed.init(liveConfig);
              window.__heedReady = true;
            })
            .catch(function (err) {
              console.error('[heed-live-boot] failed to load live config, Heed not initialized', err);
            });
        })();
      `,
    }}
  />
</body>
```
**Adapted from `test-harness/index.html` lines 156-189 boot pattern (this branch, same fetch-then-init shape):**
```javascript
(function boot() {
  var overrides = {};
  fetch('http://localhost:4310/weights')
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (weights) { if (weights) overrides.weights = weights; })
    .catch(function () {})
    .finally(function () {
      window.Heed.initDemo(overrides);
      window.__heedReady = true;
    });
})();
```
**Critical deviation from the analog (per RESEARCH.md Pitfall 2):** the live boot script must call `window.Heed.init(liveConfig)` — the lower-level entry point exported by `src/index.js` (see below) — **not** `window.Heed.initDemo(overrides)`. `initDemo()` is hard-wired to the bundled `config/demo-platform.json` and can only splice in `.weights`; it structurally cannot load `config/demo-platform-live.json`'s `activeScreens` gating, which SC4 depends on.

**`src/index.js` entry points referenced (read-only, this branch, lines 22-59 for `init()`, lines 71-79 for `initDemo()`):** confirms `init(rawConfig)` is the correct call — it runs `validateConfig` then wires signal/inference/logging/response against whatever config object is passed, with no bundled-config fallback, unlike `initDemo()`.

**JSX/TSX conventions to follow (from the file itself):** this is a Next.js App Router Server Component (`export default function RootLayout`, no `"use client"` directive) — a plain `<script src="...">` tag and a `dangerouslySetInnerHTML` inline script are both valid inside a Server Component's returned JSX (they render as literal `<script>` tags in the emitted HTML); do not import `next/script` (`next/script`'s `beforeInteractive`/`afterInteractive` strategies change execution timing in ways RESEARCH.md Pitfall 3 specifically warns against for this use case — a plain tag placed after `{children}` is the safer, simpler choice already reasoned about in RESEARCH.md).

---

## Shared Patterns

### Fixed-path GET route matching (security-relevant, V12)
**Source:** `local-receiver/server.js` lines 78, 105 (existing `GET`/`POST /weights` branches)
**Apply to:** Both new routes in `local-receiver/server.js` (D-03)
```javascript
if (req.method === 'GET' && req.url === '/sdk.js') { /* ... */ }
```
Never build a filesystem path from `req.url` — always compare the full literal string with `===`, matching the existing file's established convention and avoiding a path-traversal surface a generic static-file mount would introduce.

### CORS wildcard (already applies to all routes, no new code)
**Source:** `local-receiver/server.js` lines 37-46, called unconditionally at line 68
**Apply to:** All routes, including the two new ones — no per-route CORS code needed.

### Config-shape mirroring
**Source:** `config/demo-platform.json` (full file)
**Apply to:** `config/demo-platform-live.json` — same key set, same nesting, only `activeScreens` differs.

### `init()` vs `initDemo()` entry-point choice
**Source:** `src/index.js` lines 22-79
**Apply to:** `app/layout.tsx`'s worktree boot script — must call `init(liveConfig)`, never `initDemo(overrides)`, because the live config is not the bundled `demo-platform.json`.

### Playwright console-log-order assertion idiom
**Source:** `tests/e2e/harness.spec.js`'s payload-shape assertion pattern (lines 61-68) + RESEARCH.md's `page.on('console')` array-collection sketch
**Apply to:** `tests/e2e/branch1-live.spec.js` — collect `page.on('console', msg => logs.push(msg.text()))` into an array per test, filter for `[heed]`-prefixed lines, assert order/content.

## No Analog Found

None — all 6 files/edits in this phase's scope have a usable analog (5 exact/role-match analogs in this branch's own tree, 1 read directly from the `feat/demo-platform` branch ref via `git show` per the task's instructions).

## Metadata

**Analog search scope:** `local-receiver/`, `config/`, `test-harness/`, `tests/e2e/`, `src/index.js`, `playwright.config.js` (this branch's tree, `feat/heed-sdk`), plus `feat/demo-platform:app/layout.tsx` and `feat/demo-platform:package.json` read via `git show` (no local worktree existed yet at pattern-mapping time).
**Files scanned:** 7 read in full (all ≤ 280 lines, single-pass reads, no re-reads).
**Pattern extraction date:** 2026-07-20
