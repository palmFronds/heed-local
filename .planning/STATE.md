---
gsd_state_version: '1.0'
status: planning
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-04)

**Core value:** The four screens render correctly at 390px and expose all seven locked `data-heed` selectors in a real Next.js-routed flow, so Heed can instrument them and agents can run through them.
**Current focus:** Phase 1 - Routed Flow Skeleton & Contract Selectors

## Current Position

Phase: 1 of 3 (Routed Flow Skeleton & Contract Selectors)
Plan: Not yet planned
Status: Ready to plan
Last activity: 2026-07-04 — ROADMAP.md and STATE.md created from REQUIREMENTS.md

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: - min
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Flow framed as a token **Swap** (not Send) — richest fee/min-received disclosure surface for the locked selector set.
- Amount passed between screens via **URL query params** — satisfies "real routing, not component state."
- Fee/min-received/gas from **configurable constants** with reactive % math — one file to tweak, realistic real-time recompute.
- **Dark** theme applied consistently across all four screens.
- Local-first (`npm run dev`); Vercel deploy optional/deferred — not a gate requirement.

### Pending Todos

None yet.

### Blockers/Concerns

None yet. Waterfall reminder: this branch's gate (all 7 selectors present, routing via Next.js, no external calls, clean Playwright load at 390px) must pass in full before Branch 2 (heed-sdk) begins.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Deployment | DEPLOY-01: Optional Vercel deployment | Deferred to v2 | Roadmap creation (2026-07-04) |

## Session Continuity

Last session: 2026-07-04
Stopped at: ROADMAP.md and STATE.md created; REQUIREMENTS.md traceability updated
Resume file: None
