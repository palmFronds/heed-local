---
phase: 1
slug: config-layer-bus-standalone-test-harness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-11
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + happy-dom 20.10.6 |
| **Config file** | none yet — Wave 0 installs (`vitest.config.js`, `environment: 'happy-dom'`) |
| **Quick run command** | `npx vitest run tests/config.test.js tests/bus.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/config.test.js tests/bus.test.js`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green, plus a manual open of `test-harness/index.html` confirming `document.querySelectorAll('[data-heed]').length === 7` in DevTools
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 0 | — | — | Test infra scaffolded | setup | `npm install -D vitest@4.1.10 happy-dom@20.10.6 esbuild@0.28.1` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CFG-01 | — | N/A | unit | `npx vitest run tests/config.test.js -t "CFG-01"` | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CFG-02 | T-01-01 | Malformed config hard-fails, no fallback (V5 Input Validation) | unit | `npx vitest run tests/config.test.js -t "CFG-02"` | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | BUS-01 | T-01-02 | Bus private to module scope, not bound to document/window (Information Disclosure) | unit | `npx vitest run tests/bus.test.js -t "BUS-01"` | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 2 | TEST-01 | — | N/A | smoke/manual | manual browser check (`document.querySelectorAll('[data-heed]').length === 7`) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — does not exist yet (fully greenfield repo)
- [ ] `vitest.config.js` — `environment: 'happy-dom'`
- [ ] `tests/config.test.js` — covers CFG-01, CFG-02
- [ ] `tests/bus.test.js` — covers BUS-01 (decoupled-fixture pattern — no direct import between publisher and subscriber test modules)
- [ ] Framework install: `npm install -D vitest@4.1.10 happy-dom@20.10.6 esbuild@0.28.1`
- [ ] `test-harness/index.html` — does not exist yet; TEST-01's deliverable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Test harness exposes all 7 `data-heed` selectors and every signal type can be synthetically triggered via the bus | TEST-01 | Requires a real browser DOM + visual/interactive confirmation of the debug trigger panel; a Playwright smoke test is a nice-to-have but not required for this phase's minimum bar | Open `test-harness/index.html` in a browser, run `document.querySelectorAll('[data-heed]').length === 7` in DevTools, click each synthetic-trigger button and confirm the bus fires the corresponding signal event (visible via console log or a debug listener) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
