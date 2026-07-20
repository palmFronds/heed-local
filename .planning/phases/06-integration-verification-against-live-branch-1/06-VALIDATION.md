---
phase: 6
slug: integration-verification-against-live-branch-1
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@playwright/test` 1.61.1 (existing devDependency, already configured) |
| **Config file** | `playwright.config.js` — needs a new `projects` array entry (`live-branch1`) |
| **Quick run command** | `npx playwright test --project=live-branch1 tests/e2e/branch1-live.spec.js` (both dev servers must already be running) |
| **Full suite command** | `npx playwright test` (runs both the existing `file-harness` project and the new `live-branch1` project) |
| **Estimated runtime** | ~30-60 seconds (single-spec live project; full suite including existing `file-harness` project longer) |

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test --project=live-branch1 <specific-test-file>` (targeted, with both dev servers running)
- **After every plan wave:** Run `npx playwright test` (full suite — both `file-harness` and `live-branch1` projects)
- **Before `/gsd-verify-work`:** Full suite must be green AND manual walkthrough sign-off (human-verify checkpoint) — per D-06's "both, not either/or", this phase's gate requires both forms of coverage
- **Max feedback latency:** ~60 seconds (single live-project targeted run)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD-setup | setup | 1 | INTEG-01 | V12/V14 | New receiver routes use fixed-string `===` matching only, no dynamic path construction | manual/build | `node local-receiver/server.js` starts cleanly, `curl localhost:4310/sdk.js` returns 200 | ❌ W0 | ⬜ pending |
| TBD-verify-SC1a | verify | 2 | INTEG-01 | — | Press-and-hold `proceed-cta` on live `/swap` triggers `touch_hesitation` | e2e | `npx playwright test --project=live-branch1 -g "touch_hesitation"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC1b | verify | 2 | INTEG-01 | — | Blurring untouched `amount-input` triggers `blur_incomplete` | e2e | `npx playwright test --project=live-branch1 -g "blur_incomplete"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC1c | verify | 2 | INTEG-01 | — | Scroll down then up on `/swap` triggers `scroll_reversal` | e2e | `npx playwright test --project=live-branch1 -g "scroll_reversal"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC1d | verify | 2 | INTEG-01 | — | Real browser-back (`page.goBack()`, NOT a tap on `back-btn` — see Pitfall 1) on `/confirm` triggers `back_intent` | e2e | `npx playwright test --project=live-branch1 -g "back_intent"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC2 | verify | 2 | INTEG-01 | — | Console log order is exactly `signal_detected → inference_run → response_fired` | e2e (`page.on('console')` order assertion) | `npx playwright test --project=live-branch1 -g "SC2"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC3 | verify | 2 | INTEG-01 | — | Overlay renders above Branch 1's UI; container `pointer-events:none`, bubble `pointer-events:auto`; underlying CTA still clickable | e2e | `npx playwright test --project=live-branch1 -g "SC3"` | ❌ W0 | ⬜ pending |
| TBD-verify-SC4 | verify | 2 | INTEG-01 | — | No `[heed]` log entries fire while on `/` (Screen 1) | e2e | `npx playwright test --project=live-branch1 -g "SC4"` | ❌ W0 | ⬜ pending |
| TBD-verify-manual | verify | 2 | INTEG-01 | — | Full 8-step manual testing sequence, human-run | manual-only | N/A — human-verify checkpoint | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Exact task IDs are assigned by the planner; this table will be reconciled against real task IDs once PLAN.md files exist.*

---

## Wave 0 Requirements

- [ ] `tests/e2e/branch1-live.spec.js` — new file, covers INTEG-01's SC1-SC4
- [ ] `playwright.config.js` — needs the `projects` array addition (`file-harness` + `live-branch1`), an edit to the existing config, not a new file
- [ ] `local-receiver/server.js` — needs the two new GET routes (setup plan; hard prerequisite for the live Playwright project to have anything to test against)
- [ ] `config/demo-platform-live.json` — new file (setup plan prerequisite)
- Framework install: none — `@playwright/test` already present, no install step needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Full manual testing sequence (spec's own 8-step walkthrough) against live worktree'd Branch 1 | INTEG-01 | D-06 explicitly requires both automated AND manual coverage — the manual pass catches real-device/visual/positioning issues (overlay placement relative to Branch 1's real UI, iOS safe-area behavior) that a headless/emulated Playwright run cannot fully substitute for; matches this branch's established human-verify-checkpoint pattern (Phase 1 §01-05, Phase 4 §04-06) | With both dev servers running (Branch 1 worktree on :3000, receiver on :4310) and the script tag wired into the worktree's `layout.tsx`, walk through: press-and-hold on `/swap`'s `proceed-cta` (SC1a); blur `amount-input` untouched (SC1b); scroll down then up (SC1c); navigate to `/confirm` and use real browser-back, not the on-screen back button (SC1d — Pitfall 1); confirm console log order (SC2); confirm overlay renders above the live UI without blocking taps (SC3); confirm no `[heed]` logs on `/` (SC4) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`tests/e2e/branch1-live.spec.js`, `playwright.config.js` edit, receiver routes, live config)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
