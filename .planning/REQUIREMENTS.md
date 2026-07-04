# Requirements: heed-demo-platform (Branch 1)

**Defined:** 2026-07-04
**Core Value:** The four screens render correctly at 390px and expose all seven locked `data-heed` selectors in a real Next.js-routed flow, so Heed can instrument them and agents can run through them.

## v1 Requirements

Requirements for Branch 1. Each maps to roadmap phases.

### Screens & Routing

- [ ] **SCRN-01**: Screen 1 (Wallet Overview) shows a wallet balance, 2–3 mock asset rows, and a prominent "Swap" CTA that advances to Screen 2
- [ ] **SCRN-02**: Screen 2 (Amount Entry) shows an amount input, a fee row, a min-received row, a gas estimate, and a proceed CTA
- [ ] **SCRN-03**: Screen 3 (Confirmation) shows a read-only summary of the entered amount, a confirm CTA, and a back affordance
- [ ] **SCRN-04**: Screen 4 (Success) shows a success message and a done/home CTA marking flow completion
- [ ] **SCRN-05**: Screen transitions occur via real Next.js App Router routing, not component state
- [ ] **SCRN-06**: The entered amount travels between screens via URL query params (inspectable, no storage reads)

### Contract Selectors

- [ ] **SEL-01**: Screen 2 exposes `data-heed="amount-input"`, `data-heed="fee-row"`, `data-heed="min-received-row"`, and `data-heed="proceed-cta"`, all inspectable in DevTools
- [ ] **SEL-02**: Screen 3 exposes `data-heed="confirm-cta"` and `data-heed="back-btn"`, both inspectable in DevTools
- [ ] **SEL-03**: Screen 4 exposes `data-heed="flow-complete"`, inspectable in DevTools

### Calculation

- [ ] **CALC-01**: The fee row recomputes in real time as the amount changes, using a configurable constant fee rate
- [ ] **CALC-02**: The min-received row recomputes in real time (amount minus fee and configurable slippage)
- [ ] **CALC-03**: A gas estimate is displayed on Screen 2, sourced from configurable constants
- [ ] **CALC-04**: All fee/min-received/gas calculation happens client-side with no network call

### Platform Constraints

- [ ] **PLAT-01**: The app renders only at 390px width; wider viewports show a plain centered "This app is mobile-only." message with no responsive layout
- [ ] **PLAT-02**: The app makes zero external network calls of any kind during the flow
- [ ] **PLAT-03**: A dark theme is applied consistently across all four screens
- [ ] **PLAT-04**: The app loads cleanly in a Playwright-controlled Chromium instance under iPhone 14 emulation

## v2 Requirements

Deferred to future work. Tracked but not in the current roadmap.

### Deployment

- **DEPLOY-01**: Optional Vercel deployment so agents can reach the app without localhost tunneling

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Blockchain / wallet / external service connection | Synthetic surface only — no real transactions |
| Heed instrumentation (signal capture, inference, overlay) | That is Branch 2's job, not this branch's |
| Responsive / desktop layout, breakpoints | One context only — 390px mobile viewport |
| Backend, database, auth, any `fetch`/XHR | None of it exists here; the app is fully static/client-side |
| Visual polish beyond realistic UX behavior | Not a design showcase; realism over aesthetics |
| Dashboard, production CDN deploy, multi-partner config | Deferred per harness scope boundaries |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCRN-01 | — | Pending |
| SCRN-02 | — | Pending |
| SCRN-03 | — | Pending |
| SCRN-04 | — | Pending |
| SCRN-05 | — | Pending |
| SCRN-06 | — | Pending |
| SEL-01 | — | Pending |
| SEL-02 | — | Pending |
| SEL-03 | — | Pending |
| CALC-01 | — | Pending |
| CALC-02 | — | Pending |
| CALC-03 | — | Pending |
| CALC-04 | — | Pending |
| PLAT-01 | — | Pending |
| PLAT-02 | — | Pending |
| PLAT-03 | — | Pending |
| PLAT-04 | — | Pending |

**Coverage:**
- v1 requirements: 17 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 17 ⚠️

---
*Requirements defined: 2026-07-04*
*Last updated: 2026-07-04 after initial definition*
