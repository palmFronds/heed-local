---
phase: 5
slug: weight-push-learning-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 (`environment: 'happy-dom'` default) + Playwright 1.61.1 (real-browser e2e) |
| **Config file** | `vitest.config.js` (default happy-dom env); `playwright.config.js` (390px mobile viewport, no `webServer` block — `file://` navigation) |
| **Quick run command** | `npx vitest run tests/local-receiver.test.js tests/inference-endsession.test.js tests/index.test.js` |
| **Full suite command** | `npm test` (Vitest) + `npx playwright test` (separate command — matches existing project convention, no combined script exists) |
| **Estimated runtime** | ~30s (Vitest quick run) / ~2min (full Vitest + Playwright) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/local-receiver.test.js tests/inference-endsession.test.js tests/index.test.js`
- **After every plan wave:** Run `npm test` (full Vitest suite) + `npx playwright test` (full e2e suite)
- **Before `/gsd-verify-work`:** Full suite green (Vitest + Playwright) plus a successful `node admin/soak-test-weights.mjs` run
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-0X | 01 | 0 | WEIGHT-01 (SC1) | — | `tests/local-receiver.test.js` stubs authored (RED) | unit | `npx vitest run tests/local-receiver.test.js` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC1) | T-DOS-01 | Receiver POST /weights persists valid body to local JSON file | unit | `npx vitest run tests/local-receiver.test.js -t "POST persists"` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC1) | — | `endSession()` returns the updated `activeWeights` object | unit | `npx vitest run tests/inference-endsession.test.js -t "returns"` | ❌ W0 (extends existing file) | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC2) | — | `initDemo(overrides)` injects fetched weights into config before `init()` | unit | `npx vitest run tests/index.test.js -t "initDemo override"` | ❌ W0 (extends existing file) | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC2) | — | Restart after persisted file exists loads learned weights, not cold-start defaults | e2e or Node soak-comparison (planner picks one explicitly — RESEARCH.md Open Question #2) | `npx playwright test tests/e2e/harness.spec.js -g "learned weights"` OR `node admin/soak-test-weights.mjs` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC3) | — | 10-20 synthetic sessions run back-to-back without softmax collapse (uniform or saturated) on canonical test signals | manual-only script gate (mirrors `admin/print-softmax-margins.mjs` non-Vitest precedent) | `node admin/soak-test-weights.mjs` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC4) | T-DOS-01 | Malformed POST body → receiver responds 400, does not crash, does not write | unit | `npx vitest run tests/local-receiver.test.js -t "malformed POST"` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC4) | T-TAMPER-01 | Corrupt on-disk file → receiver serves last known-good on GET, does not crash | unit | `npx vitest run tests/local-receiver.test.js -t "corrupt file"` | ❌ W0 | ⬜ pending |
| 05-0X-0X | TBD | 1+ | WEIGHT-01 (SC4) | — | Harness fetch failure (network/bad JSON/bad shape) → falls back to cold-start weights, no crash | unit | `npx vitest run tests/index.test.js -t "cold-start fallback"` | ❌ W0 | ⬜ pending |

*Exact Task IDs/Plan IDs/Waves are placeholders — the planner assigns final IDs; this map's Req→Test coverage must be preserved 1:1 in the resulting PLAN.md files.*

---

## Wave 0 Requirements

- [ ] `tests/local-receiver.test.js` — new file, RED stubs for WEIGHT-01 SC1/SC4 receiver-side behavior. **Must use `// @vitest-environment node`** (per-file override) rather than the project default `happy-dom`, to get Node's real `http`/`fs` semantics and avoid triggering a real network call via happy-dom's `fetch`-backed globals.
- [ ] `admin/soak-test-weights.mjs` — new file, D-08's soak-test script, structurally mirrors `admin/print-softmax-margins.mjs`. Not a Vitest test — a standalone Node script.
- [ ] Extend `tests/inference-endsession.test.js` — add a case asserting `endSession()`'s return value equals the updated `activeWeights` (RESEARCH.md Pitfall 1 fix).
- [ ] Extend `tests/index.test.js` — add cases for `initDemo(overrides)` injecting `config.inference.weights` before `init()` runs, and a regression case confirming `initDemo()`'s existing zero-argument call signature is unchanged (guards Phases 1-4's existing Playwright suite, which calls it bare).
- [ ] All new `fetch`/`sendBeacon`-touching unit tests must mock the global via `vi.stubGlobal` (RESEARCH.md Pitfall 4) — no exception; happy-dom's `sendBeacon`/`fetch` perform real network I/O otherwise.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| 10-20 session soak test doesn't collapse/saturate softmax | WEIGHT-01 (SC3) | Statistical/quality judgment over many runs, not a single pass/fail assertion — mirrors Phase 3's existing `admin/print-softmax-margins.mjs` precedent of a script-gate rather than a Vitest assertion | Run `node admin/soak-test-weights.mjs`; inspect printed softmax margins for canonical test signals before/after the run; confirm no class collapses toward uniform (~0.25 each) or full saturation (~1.0) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
