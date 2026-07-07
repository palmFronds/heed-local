# Phase 1: Routed Flow Skeleton & Contract Selectors - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase builds the four-screen swap flow as a real Next.js App Router
skeleton: all four screens exist, are reachable via routing, carry the
entered amount between screens via URL query params, and expose all seven
locked `data-heed` selectors in the DOM. Calculation logic (real-time fee /
min-received / gas math) is explicitly OUT of scope — that's Phase 2
(CALC-01 through CALC-04). Platform constraints (mobile-only guard, dark
theme enforcement, Playwright load verification) are Phase 3. This phase's
job is DOM structure and routing only — the elements exist with correct
selectors and plausible static content, not live behavior.

</domain>

<decisions>
## Implementation Decisions

### Screen 2 — placeholder values, not live calculation
- **D-01:** `fee-row`, `min-received-row`, and the gas estimate render
  static placeholder text (e.g. a plausible fixed number or dash), not a
  reactive computation. Phase 1's job is DOM structure with correct
  `data-heed` attributes; wiring real-time recompute from configurable
  constants is Phase 2's job (CALC-01/02/03). Don't mix concerns — the
  executor should not build the fee-math logic in this phase.

### URL param shape
- **D-02:** Only `?amount=X` travels between screens via URL query param.
  Keep it minimal — no additional params.
- **D-03:** The swap asset pair (ETH → USDC) is hardcoded, not carried via
  URL query param. There is no asset-selection UI in this phase.

### Screen 3 — Confirmation content
- **D-04:** Screen 3 displays the FULL read-only summary: amount, fee row,
  and min-received row — not just the amount. Rationale: Screen 3 is a
  hesitation surface (per CONTRACT.md, `confirm-cta` is "the primary
  abandonment signal"). Showing only the amount gives the user nothing to
  pause on; the fee/min-received breakdown is what triggers pause-before-
  commit in real swap flows. Omitting it makes the Confirmation screen
  behaviorally inert and undermines the realism the harness depends on.
- **D-05:** Screen 3's back button returns to Screen 2 with the amount
  still present (re-derived from the same `?amount=X` param). Confirm
  advances to Screen 4.

### Screen 4 — completion behavior
- **D-06:** The done/home CTA on Screen 4 resets the flow back to Screen 1
  (clean session, no leftover query params).

### Claude's Discretion
- Screen 1 content (wallet balance figure, which 2-3 mock asset rows,
  exact copy/labels) — any plausible-looking ETH-wallet content is fine.
  This screen has "low hesitation surface" per the spec; it exists to
  establish context, not to generate signal, so exact figures don't matter.
- Exact placeholder values shown on Screen 2 (D-01) — pick numbers that
  look plausible (e.g., a small fixed fee, min-received slightly below
  amount, a fixed gas estimate) since they'll be replaced by real
  computation in Phase 2. Reasonable to source them from the same
  configurable-constants file Phase 2 will extend, but the constants
  themselves and any recompute logic are Phase 2's responsibility.
- Exact shadcn/ui components used for inputs/buttons/cards, and any
  route-transition polish (Next.js `<Link>` vs `router.push`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Contract (locked selectors)
- `CONTRACT.md` — the seven `data-heed` selectors, which screen owns each,
  and the verification checklist Phase 1's gate is judged against.

### Branch 1 spec
- `branch spec files/repo1_dummy_platform.txt` — full Branch 1 spec:
  screen-by-screen elements, stack (Next.js App Router + Tailwind +
  shadcn/ui), viewport constraint (390px, no responsive work), waterfall
  position, and completion criteria.

### System-level context
- `branch spec files/repo0_overview.txt` — system-level overview and
  runtime connection map (how Branch 2/3 will later consume this branch's
  selectors and routes) — informs why routing must be real Next.js
  navigation, not component state.

### Project-level requirements and decisions
- `.planning/PROJECT.md` — Key Decisions table (Swap framing, URL query
  params, dark theme, configurable constants, local-first dev).
- `.planning/REQUIREMENTS.md` — SCRN-01..06, SEL-01..03 (this phase's
  requirement IDs) plus CALC/PLAT requirements (Phase 2/3, for boundary
  awareness only — do not implement them here).

</canonical_refs>

<code_context>
## Existing Code Insights

No code exists yet in this branch — this is the first phase of a fresh
Next.js project. No reusable assets, established patterns, or integration
points to reference.

</code_context>

<specifics>
## Specific Ideas

- Asset pair is fixed: ETH → USDC swap (informs Screen 1/2 copy).
- Screen 3 must show the full fee breakdown (amount, fee, min-received),
  not just the amount — see D-04 rationale above.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. Live fee/min-received/gas
calculation (CALC-01..04) and platform constraints (PLAT-01..04) were
raised only as explicit non-goals for this phase; they're already tracked
in ROADMAP.md as Phase 2 and Phase 3.

</deferred>

---

*Phase: 1-routed-flow-skeleton-contract-selectors*
*Context gathered: 2026-07-07*
