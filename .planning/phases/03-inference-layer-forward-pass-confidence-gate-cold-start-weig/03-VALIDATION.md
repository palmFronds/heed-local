---
phase: 3
slug: inference-layer-forward-pass-confidence-gate-cold-start-weights
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 + happy-dom 20.10.6 (unchanged from Phase 1/2) |
| **Config file** | `vitest.config.js` (already exists — this phase's tests are pure-function unit tests, no DOM interaction needed) |
| **Quick run command** | `npx vitest run tests/inference.test.js tests/inference-endsession.test.js` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~4 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/inference.test.js tests/inference-endsession.test.js`
- **After every plan wave:** Run `npx vitest run` (full suite, including Phase 1/2's existing tests)
- **Before `/gsd-verify-work`:** Full suite green, plus a manual step printing the full softmax
  vector for the 4 canonical cold-start inputs + one deliberately ambiguous input (Success
  Criterion 2's own literal instruction) and visually confirming margins are neither saturated
  (~1.0) nor uniform (~0.25 each)
- **Max feedback latency:** 4 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | — | — | brain.js@2.0.0-beta.24 pinned exact version, dev-only | setup | `npm ls brain.js` shows exact pinned version | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 0 | INF-05 | — | N/A | unit | `npx vitest run tests/inference.test.js -t "INF-05"` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 1 | INF-01 | — | N/A | unit | `npx vitest run tests/inference.test.js -t "INF-01"` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | INF-02 | — | N/A | unit | `npx vitest run tests/inference.test.js -t "INF-02"` | ❌ W0 | ⬜ pending |
| 03-02-03 | 02 | 1 | INF-03 | — | N/A | unit | `npx vitest run tests/inference.test.js -t "INF-03"` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | INF-04 | T-03-01 | Weight update fires exactly once per session, never per-event (bounded learning update, not an unbounded live-training surface) | unit (module-state before/after diffing) | `npx vitest run tests/inference-endsession.test.js -t "INF-04"` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | — | — | Manual softmax-margin gate | manual | Print softmax vectors for 4 canonical + 1 ambiguous input; visually confirm real margins | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs/waves above are an anticipated structure for Nyquist sampling-continuity planning — the
planner determines the actual plan/task breakdown; this map should be treated as a coverage
checklist against Requirement IDs, not a binding task numbering.*

---

## Wave 0 Requirements

- [ ] `tests/inference.test.js` — stubs for INF-01, INF-02, INF-03, INF-05
- [ ] `tests/inference-endsession.test.js` — stub for INF-04 (kept separate, mirroring Phase 2's
  precedent of isolating distinct-concern test suites)
- [ ] `brain.js@2.0.0-beta.24` devDependency install (pinned exact version) — this phase's own
  Wave-0 prerequisite; no prior phase installed it
- [ ] `admin/generate-weights.mjs` — dev-side script that trains cold-start weights via brain.js
  (leaky-relu training-time activation per the empirically-validated recipe in 03-RESEARCH.md) and
  exports them into `admin/weights.js`
- [ ] `package.json` — add `"generate-weights": "node admin/generate-weights.mjs"` script
- [ ] `config/schema.json` — optional `inference.{confidenceThreshold,weights}` fields (mirrors
  Phase 2's `signals.*` precedent — additive, backward-compatible)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Softmax margin quality for the 4 canonical cold-start mappings + 1 ambiguous input | Success Criterion 2 (ROADMAP) | The acceptance bar is qualitative ("a real margin — not saturated or uniform") and is Success Criterion 2's own literal instruction ("printing the full softmax vector... shows the correct class winning with a real margin") — a human should read the actual numbers at least once before the phase closes, even though 03-RESEARCH.md's empirical recipe (leaky-relu training, 15/15 reproducible, margins 0.21-0.35) gives strong prior confidence | Run the cold-start weight generation script or a small print-the-vectors script feeding the 4 canonical one-hot inputs plus one ambiguous (e.g. all-zero or split) input through `forwardPass`; read the printed softmax vectors and confirm the correct class wins with margin roughly in the 0.15-0.40 range, not ~1.0 or ~0.25 for all four |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 4s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
