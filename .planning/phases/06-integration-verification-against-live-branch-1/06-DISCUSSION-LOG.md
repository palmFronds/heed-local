# Phase 6: Integration Verification Against Live Branch 1 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 6-Integration Verification Against Live Branch 1
**Areas discussed:** Branch 1 real status (pre-discussion finding), Cross-branch wiring mechanics, activeScreens for live routes, Verification methodology, Plan shape, Static serving mechanics, Script-tag commit handling

---

## Pre-discussion: Branch 1 real status

Before framing gray areas, checked `feat/demo-platform`'s `.planning/STATE.md` directly
per the roadmap's explicit "re-check Branch 1's STATE.md" warning. Found it stale
(reports "Phase 1, Ready to plan, 0%") while `git show`/`git ls-tree` against the branch
confirmed a complete 4-screen flow with all 7 `data-heed` selectors present.

| Option | Description | Selected |
|--------|-------------|----------|
| It's actually ready | Treat Branch 1 as live/gate-passed for Phase 6 purposes despite stale STATE.md | ✓ |
| Looks done but unverified | Boot Branch 1 and sanity-check before discussing Phase 6 | |
| Known WIP, not ready | Stay prep-only, don't assume testable yet | |

**User's choice:** "It's actually ready"
**Notes:** Confirms the roadmap's external-dependency blocker is resolved; Phase 6 planning/execution can proceed treating Branch 1 as live.

---

## Cross-branch wiring mechanics

| Option | Description | Selected |
|--------|-------------|----------|
| Git worktree | Worktree for feat/demo-platform, script tag on throwaway commit, receiver serves static files | ✓ (refined below) |

**User's choice (free text):** "Git worktree for Branch 1. Add a worktree pointing at feat/demo-platform so both branches run simultaneously without switching. Branch 2 serves dist/sdk.js and config/demo-platform.json via the existing local receiver. Branch 1's layout.tsx gets the script tag added on a throwaway commit — not merged, just for integration verification."
**Notes:** Follow-up question resolved "throwaway commit" to "uncommitted only" (see below) and "existing local receiver" to "extend it with new static routes" (see below), since the receiver as built only handles `/weights`.

---

## activeScreens for live routes

| Option | Description | Selected |
|--------|-------------|----------|
| Separate live-testing config | New `config/demo-platform-live.json` with real routes; standalone harness config untouched | ✓ |
| Update demo-platform.json in place | Would break standalone harness's permissive gating | |

**User's choice:** "Separate live-testing config. Don't break the standalone harness. Create config/demo-platform-live.json with activeScreens: [\"/swap\", \"/confirm\", \"/success\"] — / excluded because Screen 1 has no selectors. The standalone harness keeps its permissive config untouched."
**Notes:** Confirmed via `git show` that `/` (Screen 1) has zero `data-heed` selectors, matching Success Criterion 4.

---

## Verification methodology

| Option | Description | Selected |
|--------|-------------|----------|
| Manual walkthrough only | Matches spec's "manual testing sequence" framing | |
| Playwright E2E only | Repeatable automated gate | |
| Both | Manual first for visual/positioning, then Playwright for repeatability | ✓ |

**User's choice:** "Both — manual walkthrough first to confirm visual behavior, then a Playwright E2E pointed at localhost:3000 for repeatability. The manual pass catches things Playwright misses (overlay visual positioning, iOS safe area). The automated pass makes the gate reproducible."

---

## Plan shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single verification-checkpoint plan | Mirrors Phase 1/4's human-verify-checkpoint pattern | |
| Two plans (setup + verify) | Isolates wiring failures from verification failures | ✓ |

**User's choice:** "Two plans — setup plan (worktree, script tag, live config) and separate verify plan (manual walkthrough + Playwright E2E). Keeps wiring failures isolated from verification failures."

---

## Static serving mechanics (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the receiver | Add GET /sdk.js and GET /config routes to local-receiver/server.js | ✓ |
| Separate static server | Second process just for static files, receiver stays weight-push-only | |

**User's choice:** "Extend the receiver"

---

## Script-tag commit handling (follow-up)

| Option | Description | Selected |
|--------|-------------|----------|
| Uncommitted only | Edit layout.tsx in worktree, never commit, discard when done | ✓ |
| Commit, then revert | Real commit + follow-up revert for an audit trail | |

**User's choice:** "Uncommitted only"

---

## Claude's Discretion

- Exact worktree directory path/naming.
- Exact static-route paths/names added to `local-receiver/server.js`.
- Exact filename for the new live-testing config (`config/demo-platform-live.json` is a working name).
- Exact Playwright E2E test file name/location — follow existing repo conventions.
- Exact script-tag `<script src="...">` URL/port wiring inside the worktree's `layout.tsx` edit.

## Deferred Ideas

- Merging the worktree's script-tag change into `feat/demo-platform` for real — out of scope, a Branch-1-owned decision for a future phase/milestone.
- A production/CDN-hosted `sdk.js` for Branch 1 to load — out of scope per harness scope boundaries; this phase is local-only verification.
