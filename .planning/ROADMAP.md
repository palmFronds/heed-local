# Roadmap: heed-demo-platform (Branch 1)

## Overview

Branch 1 builds the synthetic swap-flow surface the rest of the Heed harness runs
on top of. The journey starts by standing up the full 4-screen walkthrough with
real Next.js App Router routing and all seven locked `data-heed` selectors in
place — the contract Branch 2 and Branch 3 depend on. From there, the amount
entry screen is brought to life with real-time, client-side fee/min-received/gas
math. The final phase hardens the app against every platform constraint in the
spec — 390px-only rendering, zero network calls, dark theme — and verifies it
loads cleanly under Playwright's iPhone 14 emulation, which is the condition for
this branch's waterfall gate to pass.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Routed Flow Skeleton & Contract Selectors** - All four screens exist, are reachable via real Next.js routing, pass the amount via URL query params, and expose all 7 locked `data-heed` selectors
- [ ] **Phase 2: Real-Time Fee Calculation** - Screen 2's fee, min-received, and gas figures recompute live from configurable constants, entirely client-side
- [ ] **Phase 3: Platform Hardening & Gate Verification** - The app enforces 390px-only rendering, zero network calls, a consistent dark theme, and loads cleanly under Playwright/iPhone 14 emulation

## Phase Details

### Phase 1: Routed Flow Skeleton & Contract Selectors
**Goal**: All four screens exist and are reachable via real Next.js App Router navigation, with the swap amount carried between screens via URL query params, and all seven locked `data-heed` selectors present in the DOM.
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: SCRN-01, SCRN-02, SCRN-03, SCRN-04, SCRN-05, SCRN-06, SEL-01, SEL-02, SEL-03
**Success Criteria** (what must be TRUE):
  1. Starting from Screen 1 (Wallet Overview), a user sees a balance display, 2-3 mock asset rows, and a prominent "Swap" CTA that navigates to Screen 2's route.
  2. Screen 2 renders an amount input, a fee row, a min-received row, a gas estimate, and a proceed CTA; entering an amount and tapping proceed navigates to Screen 3 with the amount visible in the URL query string.
  3. Screen 3 shows a read-only summary of the entered amount alongside confirm and back controls; back returns to Screen 2 with the amount still present, confirm advances to Screen 4.
  4. Screen 4 shows a success message and a done/home CTA marking flow completion.
  5. In DevTools, `document.querySelector` resolves a non-null element for all 7 `data-heed` selectors on their respective screens, per CONTRACT.md's verification checklist.
**Plans**: TBD
**UI hint**: yes

### Phase 2: Real-Time Fee Calculation
**Goal**: Users see fee, minimum-received, and gas figures update live as they type an amount on Screen 2, computed entirely client-side from configurable constants.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: CALC-01, CALC-02, CALC-03, CALC-04
**Success Criteria** (what must be TRUE):
  1. Changing the amount on Screen 2 updates the fee row instantly, computed from a configurable fee-rate constant.
  2. The min-received row updates instantly to reflect amount minus fee minus a configurable slippage constant.
  3. A gas estimate appears on Screen 2, sourced from a configurable constant.
  4. With the browser Network tab open, no request fires as a result of typing into the amount field.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Platform Hardening & Gate Verification
**Goal**: The app behaves as a faithful, isolated, mobile-only synthetic surface and passes the Branch 1 waterfall gate.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04
**Success Criteria** (what must be TRUE):
  1. Viewing the app at any width other than 390px shows a plain centered "This app is mobile-only." message with no responsive layout.
  2. Walking through all 4 screens end-to-end with the Network tab open shows zero external requests at any point.
  3. All four screens render with a consistent dark theme across backgrounds, text, and components.
  4. The app loads without console errors in a Playwright-controlled Chromium instance under iPhone 14 emulation, and all 7 `data-heed` selectors verify per CONTRACT.md's checklist.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Routed Flow Skeleton & Contract Selectors | 0/TBD | Not started | - |
| 2. Real-Time Fee Calculation | 0/TBD | Not started | - |
| 3. Platform Hardening & Gate Verification | 0/TBD | Not started | - |
