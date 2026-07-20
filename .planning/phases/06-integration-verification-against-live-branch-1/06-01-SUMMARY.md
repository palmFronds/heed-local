---
phase: 06-integration-verification-against-live-branch-1
plan: 01
subsystem: infra
tags: [git-worktree, http, static-serving, next.js, esbuild, integration]

# Dependency graph
requires:
  - phase: 05-weight-push-learning-loop
    provides: local-receiver/server.js (GET/POST /weights), dist/sdk.js build pipeline
provides:
  - "config/demo-platform-live.json — live-route config gating activeScreens to [/swap, /confirm, /success]"
  - "local-receiver/server.js extended with GET /sdk.js and GET /config/demo-platform-live.json fixed-path static routes"
  - "freshly rebuilt dist/sdk.js served by the receiver"
  - "../heed-worktree-demo-platform/ — git worktree of feat/demo-platform with Branch 1's own deps installed"
  - "uncommitted app/layout.tsx script-tag wiring in the worktree calling window.Heed.init(liveConfig)"
affects: [06-02-verify-plan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Fixed-path === URL matching for new static GET routes (no path built from req.url) — V12 path-traversal avoidance"
    - "Config-shape mirroring: new config is a byte-identical sibling except activeScreens"
    - "Runtime config injection via window.Heed.init(liveConfig), never initDemo() — the only way to load a non-bundled config"

key-files:
  created:
    - config/demo-platform-live.json
    - ../heed-worktree-demo-platform/ (external git worktree, feat/demo-platform)
  modified:
    - local-receiver/server.js
    - ../heed-worktree-demo-platform/app/layout.tsx (uncommitted, external)

key-decisions:
  - "Live config's inference.confidenceThreshold set to 0.4 (matches existing demo-platform.json precedent) per 06-RESEARCH.md Open Question 1, so cold-start weight margins reliably cross the gate"
  - "Script tags placed after the <div id=\"mobile-app\">{children}</div> block (Pitfall 3) so SSR'd DOM exists before signal listeners attach"
  - "window.Heed.init(liveConfig) used instead of initDemo() — initDemo() is hard-wired to the bundled permissive config and cannot load activeScreens gating (Pitfall 2)"

patterns-established:
  - "Dev-only receiver stays a single process/port even as static-serving responsibilities grow — new routes are plain if-branches inside the same http.createServer callback"

requirements-completed: []  # INTEG-01 is fully satisfied only after 06-02 (verification); this plan is setup/plumbing only

coverage:
  - id: D1
    description: "Receiver serves dist/sdk.js at GET /sdk.js with Content-Type application/javascript"
    verification:
      - kind: integration
        ref: "manual curl against running npm run receiver: GET /sdk.js -> 200, 14070 bytes"
        status: pass
    human_judgment: false
  - id: D2
    description: "Receiver serves the live config at GET /config/demo-platform-live.json with activeScreens excluding /"
    verification:
      - kind: integration
        ref: "manual curl against running npm run receiver: GET /config/demo-platform-live.json -> 200, activeScreens == [\"/swap\",\"/confirm\",\"/success\"]"
        status: pass
    human_judgment: false
  - id: D3
    description: "feat/demo-platform git worktree exists at ../heed-worktree-demo-platform with Branch 1's own dependency tree installed"
    verification:
      - kind: other
        ref: "git -C ../heed-worktree-demo-platform rev-parse --abbrev-ref HEAD == feat/demo-platform; test -d node_modules/next"
        status: pass
    human_judgment: false
  - id: D4
    description: "Worktree's app/layout.tsx carries an uncommitted script tag loading /sdk.js and calling window.Heed.init(liveConfig), never staged/committed"
    verification:
      - kind: other
        ref: "grep checks on layout.tsx content; git -C worktree status --porcelain shows ' M app/layout.tsx'; git diff --cached is empty"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-07-20
status: complete
---

# Phase 6 Plan 1: Cross-branch runtime wiring for live Branch 1 integration Summary

**Stood up a git worktree of `feat/demo-platform`, extended the local receiver with two fixed-path static routes (`GET /sdk.js`, `GET /config/demo-platform-live.json`), and wired an uncommitted `Heed.init(liveConfig)` boot script into the worktree's `app/layout.tsx` — pure plumbing, no SDK behavior changes.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-20T23:45:45Z
- **Tasks:** 3
- **Files modified:** 2 in this repo (`local-receiver/server.js`, `config/demo-platform-live.json`); 1 external uncommitted (`../heed-worktree-demo-platform/app/layout.tsx`); 1 external worktree directory created

## Accomplishments
- Created `../heed-worktree-demo-platform` as a git worktree checkout of `feat/demo-platform`, with Branch 1's own independent dependency tree (`next@16.2.10`, `react@19.2.4`, etc.) installed via `npm install` run inside the worktree
- Added `config/demo-platform-live.json` as a same-shape sibling of `config/demo-platform.json`, gating `activeScreens` to `["/swap", "/confirm", "/success"]` (excludes Screen 1) while keeping `partnerOrigin`, `weightPushUrl`, `inference.confidenceThreshold: 0.4`, `selectors`, and `signals` identical
- Extended `local-receiver/server.js` with two new fixed-path `GET` routes (`/sdk.js`, `/config/demo-platform-live.json`), both matching `req.url` with `===` against a literal string and reading a hardcoded constant path — no path-traversal surface introduced
- Rebuilt `dist/sdk.js` via `npm run build` (postbuild purity check passed) so the served bundle reflects current `src/`
- Verified both new routes live: started the receiver, confirmed `GET /sdk.js` returns 200 with the 14070-byte bundle and `GET /config/demo-platform-live.json` returns 200 with the correct gated `activeScreens`
- Added an uncommitted `<script>` tag + inline boot script to the worktree's `app/layout.tsx`, placed after `<div id="mobile-app">{children}</div>` inside `<body>`, that loads the SDK, fetches the live config (and optionally persisted weights, non-fatal on failure), calls `window.Heed.init(liveConfig)` (not `initDemo()`), and sets `window.__heedReady = true`

## Task Commits

Each task-produced code change was committed atomically where the change is tracked in this repo:

1. **Task 1: Create the feat/demo-platform git worktree and install Branch 1's dependencies** — no commit in this repo; the worktree and its `node_modules` are external to `heed-local`'s tracked tree (verified via `git worktree list`, `git -C ../heed-worktree-demo-platform status --porcelain` clean)
2. **Task 2: Create the live-route config and extend the receiver with two fixed-path static GET routes** — `b49ae51` (feat)
3. **Task 3: Add the uncommitted Heed script tag + boot script to the worktree's app/layout.tsx** — no commit anywhere (D-02 requires this stay uncommitted on `feat/demo-platform`; verified `git -C ../heed-worktree-demo-platform status --porcelain app/layout.tsx` shows ` M` and `git diff --cached` is empty)

**Plan metadata:** committed separately below (docs commit)

## Files Created/Modified
- `config/demo-platform-live.json` - live-route config, activeScreens gated to [/swap, /confirm, /success]
- `local-receiver/server.js` - two new fixed-path GET routes (/sdk.js, /config/demo-platform-live.json), header comment extended
- `dist/sdk.js` - rebuilt (gitignored build artifact, not committed)
- `../heed-worktree-demo-platform/` (external) - new git worktree of feat/demo-platform, node_modules installed
- `../heed-worktree-demo-platform/app/layout.tsx` (external, uncommitted) - script tag + boot script added after {children}

## Decisions Made
- `inference.confidenceThreshold: 0.4` retained in the live config (not the production default `0.65`) per 06-RESEARCH.md Open Question 1's recommendation — matches existing `demo-platform.json` precedent so cold-start weight margins reliably cross the response-firing gate for Plan 06-02's verification
- Script tags placed after the `<div id="mobile-app">{children}</div>` block rather than before it, per Pitfall 3, so the SSR'd DOM for the current screen exists before `initSignalCapture`'s first `attachListeners()` pass runs
- `window.Heed.init(liveConfig)` called directly (not `initDemo()`), the only entry point capable of loading a config object other than the bundled `demo-platform.json`

## Deviations from Plan

None - plan executed exactly as written. One minor self-correction during execution: Task 2's own automated verification regex (`/path\.join\([^)]*req\.url/`) initially false-positived against a header comment that literally contained the string `path.join(base, req.url)` as illustrative text (not code) — the comment wording was adjusted to avoid the literal pattern while preserving the same meaning; no functional code changed.

## Issues Encountered
None beyond the comment-wording false-positive noted above (resolved immediately, not a functional issue).

## User Setup Required
None - no external service configuration required. Both new dev servers (`npm run receiver` on :4310, worktree's `npm run dev` on :3000) are started manually per D-06's established two-terminal pattern; no automation needed for this plan.

## Next Phase Readiness
- All of Plan 06-01's `must_haves` truths verified: receiver serves both new routes correctly, the worktree is live-runnable on `feat/demo-platform` with deps installed, and the worktree's `layout.tsx` carries the uncommitted `Heed.init(liveConfig)` wiring with nothing staged/committed
- Plan 06-02 (manual walkthrough + Playwright E2E against `http://localhost:3000`) can now start both dev servers and verify INTEG-01's four success criteria against this wiring
- Known pre-existing gap carried forward from 06-RESEARCH.md Pitfall 1 (out of this plan's scope, informational only): Branch 1's on-screen `[data-heed="back-btn"]` uses `router.push()`, which does not fire `popstate` — Plan 06-02's back_intent verification must use real back-navigation (`page.goBack()` / browser back gesture), not a click on `back-btn`

---
*Phase: 06-integration-verification-against-live-branch-1*
*Completed: 2026-07-20*

## Self-Check: PASSED

All claimed files exist (`config/demo-platform-live.json`, `local-receiver/server.js`, `../heed-worktree-demo-platform/app/layout.tsx`) and the Task 2 commit (`b49ae51`) is present in git history.
