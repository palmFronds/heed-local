# Phase 6: Integration Verification Against Live Branch 1 - Research

**Researched:** 2026-07-20
**Domain:** Cross-branch local integration (git worktree, static file serving, Playwright E2E against a live Next.js dev server)
**Confidence:** MEDIUM-HIGH (codebase mechanics VERIFIED directly; ecosystem/tooling facts CITED via WebSearch cross-referenced against official docs; no MCP doc providers available this session — all `context7`-routed questions fell back to WebSearch per the tool-strategy fallback rule)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Use a **git worktree** to check out `feat/demo-platform` into a sibling directory so
  both branches run simultaneously without switching. Exact worktree path is Claude's discretion.
- **D-02:** `app/layout.tsx` gets a `<script>` tag added to load Heed, pointing at the local
  receiver's static-serving endpoint (D-03). **This edit is made directly in the worktree and is
  never committed** — no `git add`, no commit, on `feat/demo-platform`. Discarded once Phase 6
  verification is done.
- **D-03:** `local-receiver/server.js` (currently GET/POST `/weights` only) is **extended** with
  new static-file routes — `GET /sdk.js` (serves `dist/sdk.js`) and a config route (serves the new
  live-testing config, D-05) — rather than a second separate static-file process. One process, one
  port (`4310`). Exact route paths/names are Claude's discretion.
- **D-04:** Branch 1's real routes are `/` (Screen 1), `/swap` (Screen 2), `/confirm` (Screen 3),
  `/success` (Screen 4).
- **D-05:** A **new, separate config file** — `config/demo-platform-live.json` (name is Claude's
  discretion) — is created with `activeScreens: ["/swap", "/confirm", "/success"]` (excludes `/`).
  `config/demo-platform.json` is left untouched. `partnerOrigin` stays `http://localhost:3000`.
- **D-06:** **Both** a manual walkthrough against the live worktree'd Branch 1, AND an automated
  Playwright E2E test pointed at `http://localhost:3000`. Playwright is already a project
  devDependency, reused here.
- **D-07:** **Two plans**, not one — a **setup plan** (worktree, receiver routes, live config,
  uncommitted script-tag edit) and a separate **verify plan** (manual walkthrough + Playwright E2E).

### Claude's Discretion

- Exact worktree directory path/naming (D-01).
- Exact static-route paths/names added to `local-receiver/server.js` (D-03).
- Exact filename for the new live-testing config (D-05) — `config/demo-platform-live.json` is a
  working name, not locked.
- Exact Playwright E2E test file name/location (D-06) — follows existing `tests/e2e/`-style
  conventions.
- Exact script-tag `<script src="...">` URL/port wiring inside the worktree's `layout.tsx` edit.

### Deferred Ideas (OUT OF SCOPE)

- Merging the worktree's script-tag change into `feat/demo-platform` for real — a Branch-1-owned
  decision for a future phase/milestone, not something Phase 6 does.
- A production/CDN-hosted `sdk.js` for Branch 1 to load — out of scope per CLAUDE.md/PROJECT.md's
  harness scope boundaries; this phase is local-only, `next dev`/`localhost` verification.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INTEG-01 | Manual testing sequence from the spec passes against a live Branch 1: press-and-hold triggers hesitation, blur-without-typing triggers blur_incomplete, scroll down/up triggers scroll_reversal, back button before success triggers back_intent, log sequence is `signal_detected → inference_run → response_fired`, overlay renders above platform UI without blocking interaction, no logs fire on Screen 1 | See Architecture Patterns (runtime config injection), Common Pitfalls #1 (back_intent/`router.push()` finding — the single most important discovery this research made), Code Examples, and Validation Architecture (per-SC test mapping) |
</phase_requirements>

## Summary

Phase 6 does not write new SDK logic — Phases 1-5 already closed SIG/INF/RESP/LOG. This phase's
entire job is plumbing (git worktree + two static routes + one throwaway config + one uncommitted
`<script>` tag) plus running the spec's existing eight-step manual testing sequence against that
plumbing, both by hand and via a new Playwright spec. All of D-01 through D-07 are directly
achievable with the tools already in this repo — no new dependency is required anywhere in this
phase (confirmed: `git`, `node`'s built-in `http`, and `@playwright/test@1.61.1` are all already
present and sufficient).

The single most important finding from reading Branch 1's actual source (not just its CONTRACT.md
description) is a genuine implementation gap that directly threatens Success Criterion 1's
back_intent sub-check: `feat/demo-platform:app/confirm/page.tsx`'s `[data-heed="back-btn"]` button
has an `onClick={() => router.push("/swap")}` handler. Next.js's client-side `router.push()` calls
`history.pushState()` internally, which **does not fire a `popstate` event** — and `src/signal.js`'s
`back_intent` capture is a plain `window.addEventListener('popstate', ...)` listener (SIG-04).
Tapping Branch 1's on-screen "Back" button will therefore **never** produce a `back_intent` signal.
The manual walkthrough and the Playwright spec must instead trigger a genuine browser-level back
navigation (the emulator's back gesture / `page.goBack()`) after reaching `/confirm`, not click the
`back-btn` element, to satisfy this sub-criterion. See Common Pitfalls #1 for the full analysis.

A second load-bearing finding: `src/index.js`'s `initDemo(overrides)` convenience function is
hard-wired to the **bundled** `config/demo-platform.json` (imported at build time) and can only
override `.inference.weights` — it structurally cannot be pointed at a different config file at
all. The worktree's inline script must therefore call `window.Heed.init(liveConfig)` directly
(the lower-level entry point `index.js` also exports), fetching the live config JSON from the
receiver's new route at runtime and passing the whole object in, mirroring but not reusing
`initDemo()`. See Code Examples.

**Primary recommendation:** Build the setup plan first (worktree + two new receiver routes + live
config + `Heed.init(liveConfig)` script tag, verified by hand that `Heed` initializes with no
console errors), then the verify plan (manual walkthrough using real back-navigation for
back_intent, then a new Playwright project/spec asserting the same four success criteria via
`page.on('console')` order assertions and `page.goBack()`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `sdk.js` bundle delivery | API/Backend (`local-receiver/server.js`, new `GET /sdk.js`) | — | Mirrors the spec's own runtime-connection description ("Repo 2's sdk.js is loaded by Repo 1 via a script tag... pointing at localhost"); this phase's receiver is the local stand-in for that localhost/CDN endpoint |
| Live-route config delivery (`activeScreens`, selectors, etc.) | API/Backend (`local-receiver/server.js`, new config route) | — | Same runtime-connection pattern: "Repo 2 fetches demo-platform.json... served as a static file from localhost" |
| SDK init, signal capture, inference, response overlay, logging | Browser/Client | — | Unchanged from Phases 1-5 — 100% client-side, no backend integration; only the config source changes (fetched live config vs. bundled demo config) |
| Next.js page markup carrying the 7 `data-heed` selectors | Frontend Server (SSR) | Browser/Client (hydration) | Branch 1's App Router pages render the selectors into the initial HTML server-side; the injected script must not assume it runs *after* hydration completes — only after the relevant DOM nodes exist in the parsed HTML (see Common Pitfalls #3) |
| Client-side route transitions (`/swap` → `/confirm` → `/success`) | Browser/Client | Frontend Server (SSR, initial paint only) | Next.js `router.push()` performs a client-side history push, not a full navigation — directly the root cause of Common Pitfalls #1 |
| E2E verification (console-log order, overlay assertions) | N/A — test automation, not a runtime tier | — | Playwright drives the Browser/Client tier from outside the page; not itself part of the shipped architecture |

## Standard Stack

No new dependency is required or recommended for this phase. Everything needed is already
installed and verified present in this environment.

### Core (all already installed — reused, not newly added)

| Tool | Version (verified) | Purpose | Why Standard |
|------|---------------------|---------|---------------|
| git | 2.50.1.windows.1 `[VERIFIED: git --version]` | Worktree creation/teardown (D-01) | Native, no plugin needed; `git worktree` has existed since Git 2.5 |
| Node.js `http` (built-in) | Node v22.20.0 `[VERIFIED: node --version]` | Static-route additions to `local-receiver/server.js` (D-03) | Matches existing D-04 (Phase 5) convention: plain `http`, no framework, no new npm dependency |
| `@playwright/test` | 1.61.1 `[VERIFIED: npx playwright --version]` | Automated E2E against `http://localhost:3000` (D-06) | Already a project devDependency (`package.json`); reused, not reinstalled |
| npm | 10.9.3 `[VERIFIED: npm --version]` | `npm install` inside the new worktree to materialize Branch 1's own dependency tree | Standard; Branch 1's `package.json` has its own independent dependency set (Next.js 16.2.10, React 19.2.4, Tailwind 4, etc.) that does not exist in this branch's `node_modules` |

### Supporting

None. This phase deliberately adds zero new npm packages (see Package Legitimacy Audit).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual two-terminal launch of `npm run receiver` + (worktree) `npm run dev` | A `concurrently`/`npm-run-all` orchestration script | Adds a new devDependency for a two-command manual-verification step that only runs during this one phase's human-verify checkpoint — not worth the dependency; two terminal panes (already the established pattern per D-06's "manual walkthrough") is simpler and matches CLAUDE.md's "no scope expansion" spirit |
| `local-receiver/server.js` extended with 2 new fixed-path GET routes (D-03, locked) | A generic `serve-static`-style catch-all static file server | Explicitly rejected by D-03's exact wording ("new static-file routes" plural, fixed, not a generic static mount) — also a generic mount would introduce a real path-traversal surface this phase doesn't need (see Don't Hand-Roll and Security Domain) |

**Installation:** None required — nothing to install.

**Version verification:** All four tools above were verified directly against this machine
(`git --version`, `node --version`, `npm --version`, `npx playwright --version`), not assumed from
training data or `package.json` ranges.

## Package Legitimacy Audit

**No new packages are introduced by this phase.** INTEG-01 is satisfied entirely by extending
existing first-party code (`local-receiver/server.js`) and reusing the already-installed
`@playwright/test` devDependency. The Package Legitimacy Gate protocol (registry checks,
postinstall-script inspection) is not applicable — there is nothing new to install.

If a future planner is tempted to add a process-orchestration package (e.g., `concurrently`) for
launching both dev servers, treat that as a new decision requiring the same gate as any other
phase — not pre-approved by this research.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────┐         ┌──────────────────────────────────┐
│  local-receiver/server.js    │         │  Branch 1 worktree (next dev,     │
│  (this branch, port 4310)    │         │  http://localhost:3000)           │
│                               │         │                                    │
│  GET  /weights   (existing)  │         │  app/layout.tsx                   │
│  POST /weights   (existing)  │         │   <script src="localhost:4310/    │
│  GET  /sdk.js    (NEW, D-03) │◄────────┼───  sdk.js"></script>  (no CORS   │
│  GET  /config/...(NEW, D-03) │  script │      check — plain <script src>)  │
│                               │  load   │   inline boot script:            │
└──────────────┬────────────────┘         │    fetch('/config/demo-platform-  │
               │ fetch() (CORS: *)         │       live.json') → fetch weights │
               │                           │       → window.Heed.init(config) │
               ▼                           │                                    │
        {selectors, activeScreens,         │   /            (Screen 1, no      │
         partnerOrigin, weightPushUrl,     │                 selectors)         │
         inference.confidenceThreshold}    │   /swap        (amount-input,     │
               │                           │                 fee-row, min-      │
               ▼                           │                 received-row,      │
   window.Heed.init(liveConfig)            │                 proceed-cta)       │
               │                           │   /confirm     (confirm-cta,       │
               ▼                           │                 back-btn)          │
   src/signal.js listeners attach          │   /success     (flow-complete)     │
   to the 7 data-heed elements             │                                    │
   (touchstart/touchend, focus/blur,       └──────────────┬─────────────────────┘
   scroll, popstate, MutationObserver)                    │ real DOM events
               │                                           │ (press-hold, blur,
               ▼                                           │  scroll, browser
   bus.publish('signal:detected', ...)                     │  back — NOT the
               │                                           │  on-screen back-btn,
               ▼                                           │  see Pitfall #1)
   src/inference.js forward pass                           │
   (W1/b1 → ReLU → W2/b2 → softmax)                        │
               │                                           │
               ▼                                           │
   bus.publish('inference:result', ...)                    │
               │                                           │
        ┌──────┴───────┐                                   │
        ▼              ▼                                   │
   src/log.js     src/response.js                           │
   writes          renders overlay bubble ─────────────────┘
   console.log     inside Branch 1's page,
   ('[heed]',...)  data-heed-overlay
        │           (pointer-events:none
        │            container, pointer-
        │            events:auto bubble)
        ▼
  Playwright page.on('console')  ◄── captured externally by the new E2E spec
  collects entries in arrival
  order → asserts signal_detected
  → inference_run → response_fired
```

### Recommended Project Structure

```
heed-local/                          (this branch, feat/heed-sdk — unchanged root)
├── local-receiver/
│   └── server.js                    # D-03: extended with GET /sdk.js + GET /config/<live-config>
├── config/
│   ├── demo-platform.json           # UNCHANGED — standalone-harness config
│   └── demo-platform-live.json      # D-05: NEW — same-shape sibling, activeScreens set
├── tests/
│   └── e2e/
│       ├── harness.spec.js          # UNCHANGED — existing file:// harness suite
│       └── branch1-live.spec.js     # D-06: NEW — Playwright spec against http://localhost:3000
├── playwright.config.js             # extended with a second `projects` entry (see Code Examples)
└── package.json                     # unchanged, or +1 convenience script (Claude's discretion)

../heed-worktree-demo-platform/      (sibling directory, OUTSIDE this repo's working tree —
│                                       D-01's git worktree checkout of feat/demo-platform)
├── app/layout.tsx                   # D-02: UNCOMMITTED edit — <script> tag added, never git add'd
└── (Branch 1's own untouched source — everything else read-only for this phase)
```

### Pattern 1: Runtime config injection via `Heed.init()`, not `Heed.initDemo()`

**What:** The worktree's inline boot script fetches the live config JSON (and, optionally,
persisted weights) from the receiver at runtime and calls the SDK's lower-level `init(config)`
entry point directly.

**When to use:** Any time the config object isn't the one statically bundled into `dist/sdk.js`
at build time. `initDemo()` is structurally incapable of this — it always starts from the bundled
`config/demo-platform.json` and can only splice in `.inference.weights`.

**Example (adapted from `test-harness/index.html`'s existing bootstrap, the closest analog):**
```javascript
// Source: this repo's src/index.js (both init() and initDemo() read directly, 2026-07-20)
// and test-harness/index.html's existing fetch-then-init bootstrap pattern.
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
        .catch(function () { return liveConfig; }); // weights fetch failing is non-fatal — cold start still works (INF-05)
    })
    .then(function (liveConfig) {
      window.Heed.init(liveConfig); // NOT initDemo() — initDemo() cannot accept a different config object at all
    })
    .catch(function (err) {
      console.error('[heed-live-boot] failed to load live config, Heed not initialized', err);
    });
})();
```

### Pattern 2: Static-route addition mirrors the existing `/weights` GET handler style

**What:** Add `GET /sdk.js` and `GET /config/<name>.json` as new `if (req.method === 'GET' && req.url === '...')` branches inside the same `http.createServer` callback in `local-receiver/server.js`, reusing `setCors(res)` (already called unconditionally at the top of the handler for every request) and the existing `fs.readFile` + `res.writeHead`/`res.end` shape already used by the `/weights` GET branch.

**When to use:** This phase's D-03 explicitly locks this approach (one process, one port).

**Example:**
```javascript
// Source: this repo's local-receiver/server.js lines 78-103 (existing /weights GET handler),
// extended with the same structural pattern for the two new static routes.
if (req.method === 'GET' && req.url === '/sdk.js') {
  fs.readFile(path.join(RECEIVER_DIR, '..', 'dist', 'sdk.js'), (err, buf) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/javascript' });
    res.end(buf);
  });
  return;
}

if (req.method === 'GET' && req.url === '/config/demo-platform-live.json') {
  fs.readFile(path.join(RECEIVER_DIR, '..', 'config', 'demo-platform-live.json'), 'utf8', (err, raw) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(raw);
  });
  return;
}
```
Both routes serve **fixed, hardcoded paths** — `req.url` is compared with `===`, never concatenated
into a filesystem path — so no path-traversal surface is introduced (see Security Domain).

### Pattern 3: Second Playwright `project`, not a second config file

**What:** Add a `projects: [...]` array to the existing `playwright.config.js` with a second entry
carrying its own `use.baseURL: 'http://localhost:3000'`, leaving the top-level `use` block (which
today implicitly defines the single default project's config) as the file:// harness project.

**When to use:** Playwright's own docs describe `projects` as exactly this use case — "if you are
constantly testing across different environments... set up a new project for that environment and
add the base URL." `[CITED: playwright.dev/docs/test-projects]` No `webServer` block is needed in
either project since both dev servers (receiver + worktree's `next dev`) are started manually per
D-06's "manual walkthrough" framing, not auto-launched by Playwright.

**Example:**
```javascript
// Source: playwright.config.js (existing file, read 2026-07-20), extended per
// playwright.dev/docs/test-projects' documented per-project use/testMatch pattern.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  reporter: 'list',
  use: {
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
```
Run just the live suite with `npx playwright test --project=live-branch1` once both dev servers are
up (matches the existing `npm run receiver` / worktree `npm run dev` two-terminal pattern already
established in this repo's tooling conventions).

### Anti-Patterns to Avoid

- **Clicking `[data-heed="back-btn"]` to test back_intent:** Does not produce a `popstate` event
  against Branch 1's actual implementation (`router.push`). Use real browser-back navigation
  instead. See Common Pitfalls #1.
- **Calling `window.Heed.initDemo(overrides)` from the worktree's script tag:** Structurally
  ignores any config you pass beyond `.weights` — it always falls back to the bundled
  `demo-platform.json`. Call `window.Heed.init(fullConfigObject)` instead.
- **Standing up a second Node process/port for static serving:** Explicitly rejected by D-03 — one
  receiver process, two new routes.
- **Committing the `layout.tsx` script-tag edit inside the worktree:** The worktree IS a checkout of
  the real `feat/demo-platform` branch ref — any `git add`/`git commit` there writes to that
  branch's real history, not a throwaway copy. D-02 requires the edit stay uncommitted and be
  discarded (`git checkout -- app/layout.tsx` or worktree removal) once verification is done.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Serving `sdk.js`/config as static files | A generic path-based static file server (`url.parse` + arbitrary `fs.readFile(requestedPath)`) | Two fixed, hardcoded `if (req.url === '/exact/path')` branches (Pattern 2) | D-03 only needs 2 known files; a generic mount adds a real path-traversal attack surface (V12) this phase doesn't need and CLAUDE.md's "no scope expansion" argues against |
| Running two dev servers together | A custom orchestration/watcher script, a new `concurrently`/`pm2` dependency | Two terminal panes (already the human-verify-checkpoint pattern from Phase 1 §01-05 and Phase 4 §04-06) | Zero new dependencies, matches D-06's explicit "manual walkthrough" framing which already implies a human is present to run both commands |
| Asserting an exact console-log order | A custom polling/log-tailing harness | Playwright's native `page.on('console', msg => logs.push(msg.text()))` collected into an array, asserted in order | `[CITED: playwright.dev/docs/api/class-consolemessage]` — this is exactly what the API is for; array push order matches real dispatch order |

**Key insight:** Every piece of "new" infrastructure this phase needs (worktree, static routes,
Playwright project) has a narrow, already-idiomatic solution one level below "write a general
tool" — the temptation to over-build (a real static file server, a process manager) should be
resisted given this phase's explicit zero-new-dependency budget and CLAUDE.md's scope-expansion
guardrail.

## Common Pitfalls

### Pitfall 1: Branch 1's on-screen "Back" button does not fire `popstate` (CRITICAL)

**What goes wrong:** Tapping `[data-heed="back-btn"]` on Branch 1's live `/confirm` screen will
never produce a `back_intent` signal, silently failing Success Criterion 1's back_intent sub-check
even though everything else (worktree, routes, config, script tag) works perfectly.

**Why it happens:** `feat/demo-platform:app/confirm/page.tsx`'s back button handler is
`onClick={() => router.push("/swap")}` `[VERIFIED: git show feat/demo-platform:app/confirm/page.tsx]`.
Next.js App Router's `useRouter().push()` performs a client-side navigation via the History API's
`pushState()`, which by spec **never dispatches a `popstate` event** — `popstate` only fires on
genuine browser back/forward navigation (the browser's own back button/gesture, `history.back()`,
`history.forward()`, `history.go()`). `src/signal.js`'s SIG-04 capture is a literal
`window.addEventListener('popstate', ...)` `[VERIFIED: src/signal.js line 345]` — it has nothing to
react to when `router.push()` runs.

**How to avoid:** For both the manual walkthrough and the Playwright spec, trigger back_intent via
a **real back navigation** after reaching `/confirm` — the browser/emulator's actual back
gesture/button (manual) or `page.goBack()` (Playwright, which drives genuine browser history
navigation and does fire `popstate` in real browsers `[CITED: general Playwright/browser History API
behavior, cross-referenced]`) — not a click on the `back-btn` element.

**Warning signs:** A Playwright test that clicks `back-btn` and then asserts on `back_intent` in
the console log will hang/timeout waiting for a log line that structurally cannot appear.

**Note for the planner:** This is a genuine mismatch between CONTRACT.md's stated intent for
`back-btn` ("Branch 3 uses: tap to trigger abandonment in abandoning persona") and Branch 1's
actual implementation. Per 06-CONTEXT.md's domain framing, Branch 1 is confirmed gate-passed and
out of scope to modify from this branch — this is not something Phase 6 fixes, only something
Phase 6's test methodology must route around. Worth a one-line flag back to the project owner as a
Branch-1 follow-up, not a Phase 6 blocker.

### Pitfall 2: `initDemo()` cannot load the new live config

**What goes wrong:** Calling `window.Heed.initDemo({weights: ...})` from the worktree's script tag
silently initializes against the bundled `config/demo-platform.json` (with `activeScreens: []`,
permissive) instead of the new live config — Success Criterion 4 ("no logs fire on Screen 1")
would then trivially and incorrectly appear to pass on every screen, masking a real gating bug.

**Why it happens:** `src/index.js`'s `initDemo(overrides)` is `overrides?.weights ? {...demoConfig,
inference: {...demoConfig.inference, weights: overrides.weights}} : demoConfig` `[VERIFIED:
src/index.js lines 71-79]` — `demoConfig` is a static `import` of `config/demo-platform.json`
resolved at `esbuild` bundle time. There is no override path for `.activeScreens`, `.selectors`,
`.partnerOrigin`, etc.

**How to avoid:** Call the lower-level `window.Heed.init(fullLiveConfigObject)` directly (Pattern 1
above), fetched at runtime from the receiver's new config route.

**Warning signs:** SC4 "passes" even when standing on `/` (Screen 1) — a red flag that the
permissive bundled config, not the live config, is active.

### Pitfall 3: Script placement relative to Branch 1's DOM content

**What goes wrong:** If the injected `<script>` tag executes before the `data-heed`-bearing DOM
nodes exist, `src/signal.js`'s initial `attachListeners()` pass finds nothing to attach to on that
first pass — SIG-06's MutationObserver-driven re-attachment should recover on the next DOM mutation
in practice, but relying on that recovery path instead of correct placement adds unnecessary risk
and possible signal loss on the very first screen the script runs on.

**Why it happens:** A plain (non-`next/script`) `<script>` tag placed in JSX before `{children}`
executes at normal HTML-parse time, before the elements after it in the document have been parsed
— independent of whether React hydration has run `[CITED: nextjs.org/docs/app/guides/scripts —
`beforeInteractive`/`afterInteractive` timing semantics, cross-referenced against general HTML
parse-order behavior for non-deferred inline/external scripts]`.

**How to avoid:** Place the `<script>` tag **after** `{children}` inside `<body>` (root layout's
existing `<div id="mobile-app">{children}</div>` structure) so the SSR'd HTML for the current
screen already exists in the DOM by the time the script runs, matching the spec's own runtime
description ("script tag in its HTML head" is the production target — for this uncommitted local
edit, end-of-body is the safer placement given the fetch-then-init boot sequence in Pattern 1 adds
async delay anyway).

**Warning signs:** No `[heed]` `signal_detected` log at all on the very first screen visited after
a fresh page load, but signals work fine after any client-side route change.

### Pitfall 4: `local-receiver/server.js` binds all interfaces by default

**What goes wrong:** `server.listen(PORT)` without an explicit host binds to `0.0.0.0` (all network
interfaces), not just `localhost` — this was already true before this phase (the `/weights` route
has carried this exposure since Phase 5), but this phase adds two more routes to the same exposed
surface (now also serving the SDK bundle and config to anything on the local network).

**Why it happens:** Node's default `http.Server.prototype.listen(port)` behavior when no `host`
argument is given.

**How to avoid:** No code change is required for this phase (matches the already-accepted local-dev
risk posture, T-05-03) — but do not run the worktree's dev server via its `dev:network` script
(`next dev -H 0.0.0.0`, confirmed present in Branch 1's `package.json`) for this phase; use the
plain `dev` script (`next dev`, localhost-only) to avoid needlessly widening the live
demo-platform's exposure at the same time.

**Warning signs:** N/A — this is a preventive note, not a symptom to detect.

### Pitfall 5: `git worktree add` on a branch that's already checked out elsewhere

**What goes wrong:** `git worktree add <path> feat/demo-platform` refuses if `feat/demo-platform` is
already checked out in another worktree.

**Why it happens:** Git's worktree model — the same branch ref cannot be checked out in two
places simultaneously `[CITED: git-scm.com/docs/git-worktree]`.

**How to avoid:** Confirmed via `git worktree list` (this research session) that only
`feat/heed-sdk` is currently checked out (as the main working tree) — `feat/demo-platform` is free
to add. Not currently a blocker, but worth a pre-flight `git worktree list` check in the setup
plan's verification step in case this changes before execution.

**Warning signs:** `git worktree add` exits non-zero with a "already checked out" message.

## Code Examples

### Full `local-receiver/server.js` route additions (Pattern 2, complete)

```javascript
// Source: local-receiver/server.js (existing file structure, read 2026-07-20) — new branches
// inserted into the same http.createServer callback, after setCors(res) and the OPTIONS
// short-circuit, alongside the existing /weights GET/POST branches. path/fs already imported.
import path from 'node:path';
const DIST_SDK_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'sdk.js');
const LIVE_CONFIG_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'demo-platform-live.json');

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

### `tests/e2e/branch1-live.spec.js` sketch (Playwright, all 4 SCs)

```javascript
// Source: pattern adapted from tests/e2e/harness.spec.js (existing suite, read 2026-07-20) and
// playwright.dev's documented page.on('console') collection pattern [CITED].
import { test, expect } from '@playwright/test';

test.describe('Branch 1 live integration (INTEG-01)', () => {
  test('SC4: no [heed] logs fire on Screen 1', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await page.goto('/'); // baseURL: http://localhost:3000 (live-branch1 project)
    await page.waitForTimeout(1000); // let init/attach settle
    expect(logs.some((l) => l.includes('[heed]'))).toBe(false);
  });

  test('SC1 + SC2: touch_hesitation → correct log order → SC3 overlay renders without blocking', async ({ page }) => {
    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await page.goto('/swap');

    // Real touch hold — Playwright's touchscreen API, hasTouch:true required (already set).
    const cta = page.locator('[data-heed="proceed-cta"]');
    const box = await cta.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); // baseline tap first
    // ... hold sequence via dispatched touch events / CDP as needed for >800ms press

    await expect(page.locator('[data-heed-overlay]')).toHaveCSS('pointer-events', 'none');
    await expect(page.locator('[data-heed-response]')).toHaveCSS('pointer-events', 'auto');
    await cta.click({ timeout: 3000 }); // SC3: underlying CTA still clickable through the overlay

    const heedLogs = logs.filter((l) => l.startsWith('[heed]'));
    const events = heedLogs.map((l) => JSON.parse(l.replace('[heed] ', '')).event);
    const order = events.filter((e) => ['signal_detected', 'inference_run', 'response_fired'].includes(e));
    expect(order).toEqual(['signal_detected', 'inference_run', 'response_fired']); // SC2
  });

  test('SC1 back_intent: real back navigation (NOT clicking back-btn — see Pitfall 1)', async ({ page }) => {
    await page.goto('/swap');
    await page.locator('[data-heed="amount-input"]').fill('1');
    await page.locator('[data-heed="proceed-cta"]').click();
    await expect(page).toHaveURL(/\/confirm/);

    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));
    await page.goBack(); // fires a genuine popstate — clicking back-btn would NOT

    await expect(page.locator('body')).toContainText(''); // wait for settle
    expect(logs.some((l) => l.includes('"type":"back_intent"'))).toBe(true);
  });
});
```

## State of the Art

Not applicable in the usual sense — this phase reuses this repo's own already-established
conventions (Node `http`, Playwright, `esbuild`) rather than adopting new ecosystem patterns. No
"old approach → current approach" shift is relevant to document here.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recommended live config's `inference.confidenceThreshold` should mirror `demo-platform.json`'s `0.4` (not the production default `0.65`) so cold-start weight margins reliably cross the gate and SC1's "overlay renders" sub-check is observable regardless of which weights are loaded | Common Pitfalls, Code Examples | If wrong (planner/user wants `0.65` to test production-realistic thresholds), the response overlay may never render against cold-start weights, and SC1's overlay/SC3 checks would need pre-seeded high-confidence learned weights (`local-receiver/weights.json` from Phase 5) instead — a real but avoidable planning gap, not a code bug |
| A2 | `page.goBack()` fires a genuine `popstate` event against a Next.js App Router page the same way real browser back-navigation does | Common Pitfalls #1, Code Examples | If Next.js's client-side router intercepts `popstate` in a way that suppresses re-dispatch to page-level listeners (not found in research this session, but not directly verified against Next.js 16's router internals either), the Playwright back_intent test would need a different trigger (e.g., a raw `page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')))` as a fallback) |
| A3 | A plain (non-module) `<script src>` tag load is exempt from CORS entirely, so the receiver's existing wildcard `Access-Control-Allow-Origin: *` is sufficient for both the script load AND the `fetch()`-based config/weights loading from the worktree's real `http://localhost:3000` origin | Architecture Patterns, Common Pitfalls | Low risk — if wrong, the symptom (a CORS console error on the config/weights `fetch()` calls, not the script load itself) would be immediately visible in the manual walkthrough's first run, and the fix is already in place (`setCors()` already sets a permissive wildcard) |

**If this table is empty:** N/A — see above.

## Open Questions

1. **Should `config/demo-platform-live.json`'s `inference.confidenceThreshold` be `0.4` (matches
   existing demo config, guarantees a visible response with cold-start weights) or `0.65`
   (production default, requires pre-seeded learned weights from Phase 5's receiver)?**
   - What we know: `0.4` is the already-established pattern in `config/demo-platform.json`,
     explicitly chosen (per `tests/e2e/harness.spec.js`'s own comments) because cold-start margins
     sit around `0.44-0.50`, below `0.65`.
   - What's unclear: whether the phase intends to demonstrate the SDK against literally-default
     production settings, or just prove the wiring/rendering pipeline works end-to-end (which is
     what SC1-SC4 actually ask for).
   - Recommendation: use `0.4`, matching the existing precedent — SC1-SC4 are about wiring/plumbing
     correctness, not threshold-tuning validation (that's Phase 3/5's territory, already closed).

2. **Does `router.push()`'s lack of a `popstate` event apply identically across Next.js 16's App
   Router in every browser this phase might manually test in (not just Chromium/WebKit under
   Playwright)?**
   - What we know: `pushState()` never fires `popstate` per the History API spec, browser-engine-
     independent — this is not a Next.js-specific or browser-specific behavior.
   - What's unclear: nothing significant; flagged only because it wasn't independently re-verified
     against Next.js 16.2.10's specific router implementation in this session (no MCP docs provider
     available to fetch Next.js's router source/changelog directly).
   - Recommendation: treat as settled (standard History API behavior); if the Playwright
     back_intent test unexpectedly fails even with `page.goBack()`, that would be the first thing
     to re-investigate.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| git | D-01 worktree creation | ✓ | 2.50.1.windows.1 | — |
| Node.js | receiver, build, worktree's `next dev` | ✓ | v22.20.0 | — |
| npm | `npm install` inside the worktree | ✓ | 10.9.3 | — |
| `@playwright/test` | D-06 automated E2E | ✓ | 1.61.1 (already installed) | — |
| Branch 1's own dependency tree (`next@16.2.10`, `react@19.2.4`, etc.) | Running `next dev` inside the worktree | ✗ (not yet installed anywhere — no worktree exists yet) | — | No fallback needed: `npm install` inside the new worktree resolves this; it is a one-time, expected setup step, not a missing-tool blocker |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** Branch 1's dependency tree isn't installed yet anywhere on
this machine (no worktree currently exists) — resolved by a normal `npm install` step inside the
new worktree directory as part of the setup plan; this is expected, not a gap.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `@playwright/test` 1.61.1 (existing devDependency, already configured) |
| Config file | `playwright.config.js` — needs a new `projects` array entry (`live-branch1`), see Code Examples |
| Quick run command | `npx playwright test --project=live-branch1 tests/e2e/branch1-live.spec.js` (both dev servers must already be running) |
| Full suite command | `npx playwright test` (runs both the existing `file-harness` project and the new `live-branch1` project) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INTEG-01 (SC1a) | Press-and-hold `proceed-cta` triggers `touch_hesitation` on live `/swap` | e2e | `npx playwright test --project=live-branch1 -g "touch_hesitation"` | ❌ Wave 0 — `tests/e2e/branch1-live.spec.js` |
| INTEG-01 (SC1b) | Blurring untouched `amount-input` triggers `blur_incomplete` | e2e | `npx playwright test --project=live-branch1 -g "blur_incomplete"` | ❌ Wave 0 |
| INTEG-01 (SC1c) | Scroll down then up on `/swap` triggers `scroll_reversal` | e2e | `npx playwright test --project=live-branch1 -g "scroll_reversal"` | ❌ Wave 0 |
| INTEG-01 (SC1d) | Real browser-back on `/confirm` (NOT clicking `back-btn` — Pitfall 1) triggers `back_intent` | e2e | `npx playwright test --project=live-branch1 -g "back_intent"` | ❌ Wave 0 |
| INTEG-01 (SC2) | Console log sequence reads `signal_detected → inference_run → response_fired`, no missing/reordered steps | e2e (`page.on('console')` array-order assertion) | `npx playwright test --project=live-branch1 -g "SC2"` | ❌ Wave 0 |
| INTEG-01 (SC3) | Overlay renders above Branch 1's UI, `pointer-events:none` container + `pointer-events:auto` bubble, underlying CTA still clickable | e2e | `npx playwright test --project=live-branch1 -g "SC3"` | ❌ Wave 0 |
| INTEG-01 (SC4) | No `[heed]` log entries fire while on `/` (Screen 1) | e2e | `npx playwright test --project=live-branch1 -g "SC4"` | ❌ Wave 0 |
| INTEG-01 (all) | Manual walkthrough — the spec's own eight-step "manual testing sequence," human-run | manual-only | N/A — human-verify checkpoint (this branch's established pattern, Phase 1 §01-05 / Phase 4 §04-06) | N/A — justified: D-06 explicitly requires both automated AND manual coverage; the manual pass catches real-device/visual/positioning issues (overlay placement relative to Branch 1's real UI, iOS safe-area behavior) that a headless/emulated Playwright run cannot fully substitute for |

### Sampling Rate

- **Per task commit:** `npx playwright test --project=live-branch1 <specific-test-file>` (targeted, with both dev servers running)
- **Per wave merge:** `npx playwright test` (full suite — both projects)
- **Phase gate:** Manual walkthrough sign-off (human-verify checkpoint) AND full Playwright suite green, per D-06's "both, not either/or"

### Wave 0 Gaps

- [ ] `tests/e2e/branch1-live.spec.js` — new file, covers INTEG-01's SC1-SC4 (see Code Examples for a starting sketch)
- [ ] `playwright.config.js` — needs the `projects` array addition (`file-harness` + `live-branch1`), no new file, an edit to the existing config
- [ ] `local-receiver/server.js` — needs the two new GET routes (setup plan, not verify plan, but a hard prerequisite for the live Playwright project to have anything to test against)
- [ ] `config/demo-platform-live.json` — new file (setup plan prerequisite)
- Framework install: none — `@playwright/test` already present, no install step needed

## Security Domain

`security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"` per
`.planning/config.json` — this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth surface introduced or touched this phase |
| V3 Session Management | No | `sessionId` generation (`crypto.randomUUID()`) is unchanged Phase-4 code; not modified this phase |
| V4 Access Control | No | No access-control boundary introduced |
| V5 Input Validation | Partial | The two new receiver GET routes compare `req.url` with `===` against fixed literal strings only — never build a filesystem path from request input — so there is no user-controlled path to validate in the first place (stronger than "validated," structurally exempt) |
| V6 Cryptography | No | Not touched |
| V12 Files and Resources | Yes | Both new routes serve exactly one hardcoded file each (`dist/sdk.js`, `config/demo-platform-live.json`) — no directory listing, no wildcard path segment, no `path.join(base, req.url)` pattern that a generic static server would need and that would require explicit traversal-guarding |
| V14 Configuration | Yes (existing, extended) | The receiver's `Access-Control-Allow-Origin: *` (already present, `setCors()`) now also covers two additional read-only, non-sensitive dev assets; the existing accepted-risk posture (T-05-03: no credentials ever sent, local-dev-only) extends unchanged. `server.listen(PORT)` binds `0.0.0.0` by default (pre-existing, not newly introduced) — mitigation is process posture (dev-only, never deployed), not a code change this phase; see Common Pitfalls #4 for the one actionable note (don't use Branch 1's `dev:network` script this phase) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a static-file route | Tampering / Information Disclosure | Not applicable by construction — both new routes use fixed-string `===` matching on `req.url`, never a dynamic `fs.readFile(path.join(base, req.url))` pattern (Pattern 2, Don't Hand-Roll) |
| Overly permissive CORS on a dev-only endpoint | Information Disclosure (low severity here) | Accepted existing risk (T-05-03) — the served assets (`sdk.js`, the live config JSON) carry no secrets/credentials/PII; wildcard origin is appropriate for a local dev-only, non-production, non-deployed receiver |
| Accidental commit of the uncommitted `layout.tsx` script-tag edit (D-02) | Tampering (of Branch 1's real git history) | Discipline, not code: `git checkout -- app/layout.tsx` (or full worktree removal) at the end of the verify plan; never `git add`/`git commit` inside the worktree during this phase |

## Sources

### Primary (HIGH confidence — direct codebase/repo inspection this session)

- `local-receiver/server.js` — existing `/weights` GET/POST handler shape, `setCors()`, `createReceiver()` factory
- `src/index.js` — `init()`/`initDemo()` exact implementation (the `initDemo()` limitation finding)
- `src/signal.js` — SIG-04 `popstate` listener implementation (the back_intent finding)
- `src/log.js`, `src/response.js`, `src/bus.js` — log-order guarantee via synchronous `EventTarget.dispatchEvent`, subscription registration order (`initLogging` before `initResponse` in `index.js`)
- `config/schema.json`, `config/demo-platform.json` — exact config shape the new live config must mirror
- `test-harness/index.html`, `tests/e2e/harness.spec.js`, `playwright.config.js` — existing bootstrap/test conventions
- `CONTRACT.md` — the 7 locked selectors and their documented (vs. actual) intended usage
- `git show feat/demo-platform:app/layout.tsx`, `app/swap/page.tsx`, `app/confirm/page.tsx`, `app/success/page.tsx`, `app/page.tsx`, `package.json` — Branch 1's actual live implementation, verified directly via `git show` against the branch ref (not assumed from CONTRACT.md's description alone) — this is the source of the Pitfall 1 finding
- `branch spec files/repo0_overview.txt`, `repo2_heed_sdk.txt` — original runtime-connection description and the exact 8-step manual testing sequence this phase verifies
- Direct environment probes: `git --version`, `node --version`, `npm --version`, `npx playwright --version`, `git worktree list`, `git branch -a`

### Secondary (MEDIUM confidence — WebSearch cross-referenced against official doc URLs returned in results)

- `[CITED: playwright.dev/docs/test-projects]` — per-project `use`/`baseURL` configuration pattern
- `[CITED: playwright.dev/docs/api/class-consolemessage]` — `page.on('console')` collection pattern
- `[CITED: playwright.dev/docs/emulation]` — device descriptor (`devices['iPhone ...']`) bundling of viewport/hasTouch/isMobile
- `[CITED: nextjs.org/docs/app/guides/scripts]` — `next/script` strategy timing (`beforeInteractive`/`afterInteractive`) used as the basis for the plain-`<script>`-tag placement reasoning
- `[CITED: git-scm.com/docs/git-worktree]` — `git worktree add`/`remove` semantics
- `[CITED: developer.mozilla.org CORS docs, cross-referenced]` — script-tag-vs-fetch CORS applicability

### Tertiary (LOW confidence — general web results, not independently re-verified against a primary spec/doc in this session)

- General blog/community posts on Node `http.createServer` static-file patterns (MIME type mapping) — used only to confirm `application/javascript` as the conventional Content-Type; this is low-stakes (any reasonable JS MIME type works for a `<script src>` load)
- General community discussion of `page.goBack()`/History API `popstate` interaction — flagged as Assumption A2/Open Question 2 rather than presented as fully verified

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all versions directly probed on this machine
- Architecture: HIGH — based on direct reading of this repo's actual source (both branches) via `git show`, not assumed
- Pitfalls: HIGH for #1/#2 (both directly verified against source code), MEDIUM for #3-#5 (reasoned from cited docs + codebase, not independently reproduced in a live browser this session)

**Research date:** 2026-07-20
**Valid until:** 2026-08-19 (30 days — this phase's findings are tied to this specific commit of `feat/demo-platform`; if Branch 1's `confirm/page.tsx` back-button implementation changes before Phase 6 executes, Pitfall 1's finding must be re-verified)
