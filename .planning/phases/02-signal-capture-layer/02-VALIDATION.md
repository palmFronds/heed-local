---
phase: 2
slug: signal-capture-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + happy-dom 20.10.6 (unchanged from Phase 1) |
| **Config file** | `vitest.config.js` (`environment: 'happy-dom'`, already exists) |
| **Quick run command** | `npx vitest run tests/signal.test.js tests/signal-spa.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/signal.test.js tests/signal-spa.test.js`
- **After every plan wave:** Run `npx vitest run` (full suite)
- **Before `/gsd-verify-work`:** Full suite green, plus the Playwright D-08 smoke test green, plus a
  manual press-and-hold/blur/scroll/back-button walkthrough of `test-harness/index.html` in a real
  mobile viewport (mirrors Phase 1's manual-verification gate pattern)
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | — | — | Test infra + schema extension scaffolded | setup | `npx vitest run` (no failures on empty stub suites) | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SIG-01 | — | N/A | unit (`vi.useFakeTimers()`) | `npx vitest run tests/signal.test.js -t "SIG-01"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | SIG-02 | — | N/A | unit | `npx vitest run tests/signal.test.js -t "SIG-02"` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | SIG-03 | — | N/A | unit (explicit `scrollY`/`innerHeight` stubs) | `npx vitest run tests/signal.test.js -t "SIG-03"` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | SIG-05 | T-02-01 | Payload allow-list matches exactly — no PII/field-value fields (Information Disclosure) | unit (structural `Object.keys()` assertion) | `npx vitest run tests/signal.test.js -t "SIG-05"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SIG-04 | — | N/A | unit | `npx vitest run tests/signal.test.js -t "SIG-04"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | SIG-06 | — | N/A | unit (direct `maybeReattach` calls, separate file per happy-dom fake-timer/MutationObserver interaction) | `npx vitest run tests/signal-spa.test.js -t "SIG-06"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 3 | — (D-08) | — | N/A | Playwright (real browser) | `npx playwright test tests/e2e/harness.spec.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs/waves above are an anticipated structure for Nyquist sampling-continuity planning — the
planner determines the actual plan/task breakdown; this map should be treated as a coverage
checklist against Requirement IDs, not a binding task numbering.*

---

## Wave 0 Requirements

- [ ] `tests/signal.test.js` — stubs for SIG-01, SIG-02, SIG-03, SIG-04, SIG-05
- [ ] `tests/signal-spa.test.js` — stub for SIG-06 (kept in its own file — happy-dom fake-timer +
  MutationObserver interaction issue, `capricorn86/happy-dom#2097`)
- [ ] `tests/e2e/harness.spec.js` (Playwright) — stub for D-08's real-browser fidelity requirement
- [ ] `config/schema.json` — optional `signals.*` threshold fields (scroll-reversal minimum delta,
  touch-hesitation threshold override) — confirmed backward-compatible with `src/config.js`'s
  existing hard-fail validator
- [ ] `test-harness/index.html` — add scroll-height filler content so real/simulated scroll can
  genuinely cross the 40% viewport-depth threshold

*Wave 0 additions are net-new for this phase — Phase 1's `vitest.config.js` and Playwright setup
are reused unchanged.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rewired debug-panel buttons (D-08) produce real bus receipts visible in the harness's log panel, and the full 4-signal walkthrough works on a real mobile viewport | SIG-01–SIG-04, D-08 | Playwright covers dispatch fidelity, but final confirmation that the visual harness behaves correctly on a real mobile viewport (per Phase 1's precedent) needs a human in a real browser | Open `test-harness/index.html` on a real/emulated mobile viewport; press-and-hold a CTA (touch_hesitation), tap into then away from amountInput without typing (blur_incomplete), scroll down past the fee row then back up (scroll_reversal), tap back before flow completion (back_intent); confirm each produces exactly one bus receipt with a PII-free payload |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
