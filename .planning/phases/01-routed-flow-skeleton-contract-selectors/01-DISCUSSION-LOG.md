# Phase 1: Routed Flow Skeleton & Contract Selectors - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 1-routed-flow-skeleton-contract-selectors
**Areas discussed:** Screen 2 placeholder values, URL param shape, Screen 3 & 4 behavior

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Screen 1 content | Wallet balance / mock asset rows on the entry screen | |
| Screen 2 placeholder values | Static text vs. inline dummy formula for fee-row/min-received-row/gas | ✓ |
| URL param shape | `?amount=X` only vs. richer params (e.g. asset symbol) | ✓ |
| Screen 3 & 4 behavior | Confirmation summary depth; Screen 4 CTA behavior | (raised via free text, not initially selected) |

**User's choice:** Selected "Screen 2 placeholder values" and "URL param shape" explicitly; explained Screen 1 doesn't matter (Claude's discretion). Answered all three areas (including Screen 3/4) in a single free-text response rather than going through per-area question loops.

---

## Screen 2 placeholder values

**User's choice:** Static placeholder text only. Phase 1 just needs the elements to exist with the right `data-heed` attributes — live calculation is Phase 2's job (CALC-01..04), don't mix concerns.

## URL param shape

**User's choice:** `?amount=X` only — keep it minimal. Screen 3 only needs to show what was entered. Asset symbol is hardcoded (ETH/USDC swap), doesn't need to travel via URL.

## Screen 3 & 4 behavior

Initial proposal (Claude): Screen 3 shows only the amount; back→Screen 2 preserving amount; confirm→Screen 4; Screen 4 done/home resets to Screen 1.

**User's adjustment:** Screen 3 should show the FULL summary — amount, fee row, and min-received — not just the amount, and read-only.

**Notes/rationale (user-provided):** "The confirmation screen is a hesitation surface. A user who sees only the amount has less to pause on than a user who sees the full breakdown including fees. The fee disclosure is what triggers pause-before-commit in real swap flows. If it's not on Screen 3, the Confirmation screen is behaviorally inert and the `confirm-cta` hesitation signal loses its realism." Everything else in the proposal (back→Screen 2 preserving amount, confirm→Screen 4, Screen 4 CTA resets to Screen 1) was confirmed as-is.

---

## Claude's Discretion

- Screen 1 wallet balance figure, which 2-3 mock asset rows, exact copy/labels — any plausible ETH-wallet content works; this screen has low hesitation surface per the Branch 1 spec.
- Exact placeholder numeric values shown on Screen 2 (fee, min-received, gas) — just need to look plausible; will be replaced by real computation in Phase 2.
- Exact shadcn/ui components and route-transition implementation details (`<Link>` vs `router.push`).

## Deferred Ideas

None — discussion stayed within phase scope. CALC-01..04 (live calculation) and PLAT-01..04 (platform constraints) were referenced only as explicit non-goals for this phase; both are already tracked as later phases in ROADMAP.md.
