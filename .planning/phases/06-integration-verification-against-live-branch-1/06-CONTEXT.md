# Phase 6: Integration Verification Against Live Branch 1 - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Runs the already-fully-built `sdk.js` (Phases 1-5, all closed) against a real, live
Branch 1 (`feat/demo-platform`) instead of the standalone static-HTML test harness, and
confirms the spec's manual testing sequence passes end-to-end. This phase adds **no new
SIG/INF/RESP/LOG code** — it is a pure integration-verification pass plus the plumbing
needed to physically run two git branches of the same repo against each other locally
(worktree, static serving, live-route config, script-tag wiring).

**Pre-discussion finding (important — verified live, not assumed):** Branch 1's own
`.planning/STATE.md` is stale — it reports "Phase 1, Ready to plan, 0%" (last GSD update
2026-07-08). But `git ls-tree`/`git show` against `feat/demo-platform` confirms the actual
code is a complete 4-screen Next.js flow (`app/page.tsx`, `app/swap/page.tsx`,
`app/confirm/page.tsx`, `app/success/page.tsx`) with **all 7 locked `data-heed` selectors
already present**: `amount-input`/`fee-row`/`min-received-row`/`proceed-cta` on
`/swap`, `back-btn`/`confirm-cta` on `/confirm`, `flow-complete` on `/success`, and no
selectors on `/` (Screen 1 — matches Success Criterion 4's exclusion). Work was done
outside the GSD workflow (commit message: "the version i got :D"), so its planning docs
never caught up. **User confirmed: treat Branch 1 as actually ready** — do not re-litigate
this in planning/research; the roadmap's "re-check Branch 1's STATE.md" warning is
satisfied by this finding, not by trusting Branch 1's STATE.md text itself.

This phase does NOT touch `src/signal.js`, `src/inference.js`, `src/response.js`, or
`src/log.js` — those are closed, verified modules. It does NOT modify the standalone
test harness (`test-harness/index.html`, `config/demo-platform.json`) in a way that would
break its existing permissive (`activeScreens: []`) local-testing behavior.

</domain>

<decisions>
## Implementation Decisions

### Cross-Branch Runtime Wiring
- **D-01:** Use a **git worktree** to check out `feat/demo-platform` into a sibling
  directory so both branches run simultaneously without switching (`git branch -a`
  confirms `feat/demo-platform` exists locally and on `origin`). Exact worktree path is
  Claude's discretion at planning time.
- **D-02:** Branch 1's `app/layout.tsx` (confirmed via `git show feat/demo-platform:app/layout.tsx`
  — currently has no Heed script tag at all) gets a `<script>` tag added to load Heed,
  pointing at the local receiver's static-serving endpoint (D-03). **This edit is made
  directly in the worktree and is never committed** — no `git add`, no commit, on
  `feat/demo-platform`. It is discarded (`git checkout` / worktree removal) once Phase 6
  verification is done. Zero risk of it landing in that branch's history.
- **D-03:** `local-receiver/server.js` (currently GET/POST `/weights` only, per Phase 5)
  is **extended** with new static-file routes — `GET /sdk.js` (serves `dist/sdk.js`) and
  a config route (serves the new live-testing config, D-05) — rather than standing up a
  second separate static-file process. One process, one port (`4310`), one
  `npm run receiver` command covers weight push + static serving for this phase.
  **Rationale:** keeps all of Phase 6's local-serving needs behind the tooling that
  already exists and is already dev-only/gitignored-output by convention; avoids a second
  ad hoc process to remember to start. Exact route paths/names are Claude's discretion.

### Live-Route Config
- **D-04:** Branch 1's real routes are `/` (Screen 1 — home/wallet overview, confirmed
  via `git show` to have zero `data-heed` selectors), `/swap` (Screen 2), `/confirm`
  (Screen 3), `/success` (Screen 4).
- **D-05:** A **new, separate config file** — `config/demo-platform-live.json` (exact
  name Claude's discretion) — is created with `activeScreens: ["/swap", "/confirm",
  "/success"]` (excludes `/`, satisfying Success Criterion 4). `config/demo-platform.json`
  (the standalone-harness config) is **left untouched** — it must keep `activeScreens: []`
  permissive, since the standalone harness's `file://` pathname never matches a real route
  (Phase 4 D-07) and changing this would silently break Phases 1-5's existing local test
  workflow. `partnerOrigin` in the new live config should stay `http://localhost:3000`
  (already the value in the existing config — Branch 1's `next dev` default port, already
  correct, confirmed via `git show feat/demo-platform:package.json`).

### Verification Methodology
- **D-06:** **Both**, not either/or. First a **manual walkthrough** against the live
  worktree'd Branch 1 (matches the spec's own "manual testing sequence" framing and this
  branch's established human-verify-checkpoint pattern from Phase 1's 01-05 and Phase 4's
  04-06) — catches things automation misses (overlay visual positioning relative to
  Branch 1's real UI, iOS safe-area behavior on a real page). Then an **automated
  Playwright E2E test** pointed at `http://localhost:3000` (Branch 1's worktree'd dev
  server) makes the four roadmap success criteria a repeatable regression gate, not a
  one-time manual check that silently rots. Playwright is already a project devDependency
  (`@playwright/test`), reused here, not newly introduced.

### Plan Shape
- **D-07:** **Two plans**, not one combined plan — a **setup plan** (worktree creation,
  receiver static-route extension, live config file, uncommitted script-tag edit) and a
  separate **verify plan** (manual walkthrough + Playwright E2E against the four SC's).
  **Rationale:** isolates wiring/plumbing failures from actual verification failures —
  if the setup plan's worktree or serving doesn't work, that's a distinct, earlier failure
  mode from "the SDK doesn't behave correctly against a live platform," and keeping them
  separate makes it clear which one broke.

### Claude's Discretion
- Exact worktree directory path/naming (D-01).
- Exact static-route paths/names added to `local-receiver/server.js` (D-03).
- Exact filename for the new live-testing config (D-05) — `config/demo-platform-live.json`
  is a working name, not locked.
- Exact Playwright E2E test file name/location (D-06) — follows existing `e2e/`-style or
  `tests/`-style conventions already established in this codebase; planner should check.
- Exact script-tag `<script src="...">` URL/port wiring inside the worktree's
  `layout.tsx` edit (D-02/D-03), as long as it points at the receiver's new static route.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 Requirement & Roadmap Source
- `.planning/REQUIREMENTS.md` — INTEG-01 (this phase's sole requirement ID).
- `.planning/ROADMAP.md` §"Phase 6: Integration Verification Against Live Branch 1" — the
  4 success criteria this phase must satisfy, and the external-dependency flag (now
  resolved per this discussion's pre-discussion finding — see `<domain>`).
- `branch spec files/repo0_overview.txt` — "How the repos connect at runtime" section
  (script-tag loading, config served as static file, `partnerOrigin`/CORS framing) and
  "WEEK 2 — Repo 2" gate description ("manual signal test sequence passes for all 4
  signal types").
- `branch spec files/repo2_heed_sdk.txt` — original spec source for the manual testing
  sequence this phase verifies.
- CLAUDE.md — "No cross-branch contamination" hard rule; D-02's uncommitted-only script-tag
  approach is specifically designed to respect this while still achieving the runtime
  connection the overview spec describes (a script-tag load is not a source import).

### Branch 1 (`feat/demo-platform`) — verified live via git, not assumed
- `feat/demo-platform:app/layout.tsx` — root layout; D-02's script-tag edit target.
  Confirmed via `git show feat/demo-platform:app/layout.tsx` to currently have zero Heed
  wiring.
- `feat/demo-platform:app/page.tsx`, `app/swap/page.tsx`, `app/confirm/page.tsx`,
  `app/success/page.tsx` — the 4 live screens; confirmed via `git show` to carry all 7
  locked `data-heed` selectors (see `<domain>` for the exact mapping).
- `feat/demo-platform:package.json` — `dev` script is `next dev` (default port 3000,
  matches existing `partnerOrigin` value already set in `config/demo-platform.json`).

### Existing Code (Phases 1-5 output, this phase does not modify)
- `local-receiver/server.js` — D-03 extends this file with new GET routes; read its
  existing `/weights` GET/POST implementation and CORS handling
  (`setCors()`) before adding routes, to match its established conventions (plain Node
  `http`, no framework, per Phase 5 D-04).
- `config/demo-platform.json` — the standalone-harness config; D-05 explicitly does NOT
  modify this file. Read it to see the exact shape the new live config (D-05) should
  mirror (`platformId`, `completionSelector`, `partnerOrigin`, `weightPushUrl`,
  `inference.confidenceThreshold`, `selectors`, `signals`).
- `src/index.js` — `initDemo(overrides)`; likely the entry point the worktree's
  `layout.tsx` script tag needs to call after loading `sdk.js` (mirrors
  `test-harness/index.html`'s existing bootstrap pattern from Phase 5).
- `package.json` scripts — `build` (esbuild → `dist/sdk.js`), `receiver` (`node
  local-receiver/server.js`) — both reused as-is this phase; no new top-level script
  needed unless the planner decides a worktree-launch helper is worth adding.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `local-receiver/server.js`'s `createReceiver()` factory and `setCors()` — the static
  routes (D-03) should follow the same handler-inside-`http.createServer` structure and
  reuse `setCors()` for the new GET routes (Branch 1's real `http://localhost:3000`
  origin, not `null`, so CORS still needs to be permitted for the script/config fetch).
- `test-harness/index.html`'s inline bootstrap `<script>` (Phase 5) — the closest existing
  analog for what the worktree's `layout.tsx` script tag needs to do: fetch/load
  `sdk.js`, then call an init function with a config object.
- `admin/check-bundle-purity.mjs` (`postbuild` script) — confirms `dist/sdk.js` is already
  a clean, dependency-free single-file bundle ready to be served as-is; no new build step
  needed for D-03's static serving.

### Established Patterns
- Plain named-function exports only, no classes (Phases 1-5 convention) — applies to any
  new functions added to `local-receiver/server.js` for D-03.
- Dev-only tooling stays clearly commented as such (`local-receiver/server.js`'s existing
  header comment: "NEVER imported by src/ and NEVER bundled into dist/sdk.js") — new static
  routes should carry the same framing.
- Config-shape mirroring (`config/demo-platform.json`'s exact field set) — D-05's new live
  config should be a same-shape sibling, not a redesigned schema.

### Integration Points
- `local-receiver/server.js` — where D-03's new GET routes are added.
- `feat/demo-platform` worktree's `app/layout.tsx` — where D-02's uncommitted script tag
  goes.
- `config/` directory — where D-05's new live-testing config file is added.
- Playwright config (`playwright.config.ts`) — D-06's new E2E test needs to point at
  `http://localhost:3000` (Branch 1's worktree) rather than the existing
  `test-harness/index.html` `file://` target other Playwright specs in this repo use;
  planner should check `playwright.config.ts` and existing `e2e`/`tests` specs for the
  established `baseURL`/project conventions before adding a new one.

</code_context>

<specifics>
## Specific Ideas

No specific UI/copy references — this phase verifies existing, already-locked visual/copy
behavior (Phase 4's `04-UI-SPEC.md`) against a new live surface; it does not introduce new
UI or copy.

</specifics>

<deferred>
## Deferred Ideas

- Merging the worktree's script-tag change into `feat/demo-platform` for real (i.e. Branch
  1 permanently loading Heed) — explicitly out of scope per D-02; that would be a Branch-1
  (Repo 1)-owned decision for a future phase/milestone, not something Phase 6 does.
- A production/CDN-hosted `sdk.js` for Branch 1 to load — explicitly out of scope per
  CLAUDE.md/PROJECT.md's harness scope boundaries; this phase is local-only, `next
  dev`/`localhost` verification.

None of the discussion strayed outside Phase 6's scope (running the already-built SDK
against a live Branch 1 and verifying the manual testing sequence — no new signal/
inference/response/logging behavior).

</deferred>

---

*Phase: 6-Integration Verification Against Live Branch 1*
*Context gathered: 2026-07-20*
