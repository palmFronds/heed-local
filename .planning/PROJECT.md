# heed-demo-platform (Branch 1)

## What This Is

A self-contained, mobile-only (390px / iPhone 14) Next.js web app that
simulates a high-stakes crypto **swap** flow — no blockchain, no backend,
no external APIs. Every screen, input, and CTA exists to produce realistic
DOM structure that Heed (Branch 2) can instrument and that Playwright agents
(Branch 3) can drive. It is the surface the rest of the harness is built on top of.

## Core Value

The four screens render correctly at 390px and expose all seven locked
`data-heed` selectors in a real Next.js-routed flow, so that Heed can
instrument them and agents can run through them. If everything else is ugly
but the selectors and routing are right, this branch has done its job.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Screen 1 (Wallet Overview): balance display, 2–3 mock asset rows, prominent "Swap" CTA that advances to Screen 2 via routing
- [ ] Screen 2 (Amount Entry + Fee Disclosure): amount input, real-time fee row, min-received row, gas estimate, proceed CTA
- [ ] Screen 3 (Confirmation): read-only summary of the entered amount, confirm CTA, back button
- [ ] Screen 4 (Success): success message and a done/home CTA marking flow completion
- [ ] All 7 locked `data-heed` selectors present and inspectable in DevTools
- [ ] Screen transitions use real Next.js App Router routing (not component state)
- [ ] Entered amount travels between screens via URL query params
- [ ] Fee / min-received / gas recompute client-side in real time from configurable constants
- [ ] Mobile-only guard: wider viewports show a plain centered "This app is mobile-only." message
- [ ] Zero external network calls of any kind
- [ ] Loads cleanly in a Playwright-controlled Chromium (iPhone 14 emulation)

### Out of Scope

- Any blockchain / wallet / external service connection — this is a synthetic surface only
- Heed instrumentation itself (signal capture, inference, overlay) — that is Branch 2's job
- Responsive / desktop layout, breakpoints — one context only, 390px
- Visual polish beyond what realistic UX behavior requires — not a design showcase
- Backend, database, auth, any `fetch`/XHR — none of it exists here
- Dashboard, production CDN deploy, multi-partner config — deferred per harness scope boundaries

## Context

- **Waterfall position:** Built FIRST. Nothing in Branch 2/3/4 begins until this branch's
  gate passes (manual walkthrough of the full flow at 390px with no errors, all 7 selectors
  present, transitions via routing, no external calls, loads in Playwright).
- **The contract:** The 7 `data-heed` selectors are locked in CONTRACT.md and consumed by
  Branch 2 (config JSON targets them) and Branch 3 (Playwright scripts interact with them).
  Renaming any selector requires updating all three branches. This branch OWNS their existence.
- **Runtime connection (later branches):** Branch 1 runs on localhost:3000; Branch 2's sdk.js
  is loaded via a script tag in the HTML head; Branch 3 points a browser at this URL.
- **What building this teaches:** SPA route transitions (why Heed later needs a
  MutationObserver + popstate listener to re-attach), why stable selectors survive class-hash
  churn, and what a real partner's staging walkthrough actually requires.

## Constraints

- **Tech stack**: Next.js (App Router) + Tailwind CSS + shadcn/ui, vanilla — no extra
  frameworks. Fixed by spec so the harness stays understandable and portable to a real partner.
- **Viewport**: Renders only at 390px width; no responsive work — the app's one job is a
  faithful mobile surface, not a layout system.
- **Network**: No external calls during any session — the harness must be fully local so agent
  runs are deterministic and PII-free.
- **Selectors**: The 7 `data-heed` attributes are locked — downstream branches break if they move.
- **Scope**: Do not build instrumentation, backends, or dashboards here — waterfall gate must
  pass before scope expands.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Flow framed as a token **Swap** (not Send) | The locked `min-received-row` selector is swap terminology; a swap gives the richest fee/min-received disclosure surface | — Pending |
| Amount passed between screens via **URL query params** | Cleanest fit for the "real routing, not component state" rule; inspectable in DevTools, survives route changes, no storage reads | — Pending |
| Fee/min-received/gas from **configurable constants** with reactive % math | Realistic real-time recompute on the key hesitation screen, with rates in one file for easy tweaking | — Pending |
| **Dark** theme | Standard crypto-wallet aesthetic; most realistic for the swap UI while staying minimal | — Pending |
| Local-first (`npm run dev`); Vercel deploy optional/deferred | localhost is sufficient for the harness; deployment is not a gate requirement | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-04 after initialization*
