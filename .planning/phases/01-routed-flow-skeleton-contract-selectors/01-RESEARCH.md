# Phase 1: Routed Flow Skeleton & Contract Selectors - Research

**Researched:** 2026-07-07
**Domain:** Next.js App Router scaffolding + shadcn/ui + Tailwind CSS for a static, client-only, 4-screen mobile flow
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `fee-row`, `min-received-row`, and the gas estimate render static placeholder text
  (e.g. a plausible fixed number or dash), not a reactive computation. Phase 1's job is DOM
  structure with correct `data-heed` attributes; wiring real-time recompute from configurable
  constants is Phase 2's job (CALC-01/02/03). Don't mix concerns — the executor should not build
  the fee-math logic in this phase.
- **D-02:** Only `?amount=X` travels between screens via URL query param. Keep it minimal — no
  additional params.
- **D-03:** The swap asset pair (ETH → USDC) is hardcoded, not carried via URL query param.
  There is no asset-selection UI in this phase.
- **D-04:** Screen 3 displays the FULL read-only summary: amount, fee row, and min-received row —
  not just the amount. Rationale: Screen 3 is a hesitation surface (per CONTRACT.md, `confirm-cta`
  is "the primary abandonment signal"). Showing only the amount gives the user nothing to pause
  on; the fee/min-received breakdown is what triggers pause-before-commit in real swap flows.
- **D-05:** Screen 3's back button returns to Screen 2 with the amount still present (re-derived
  from the same `?amount=X` param). Confirm advances to Screen 4.
- **D-06:** The done/home CTA on Screen 4 resets the flow back to Screen 1 (clean session, no
  leftover query params).

### Claude's Discretion

- Screen 1 content (wallet balance figure, which 2-3 mock asset rows, exact copy/labels) — any
  plausible-looking ETH-wallet content is fine. This screen has "low hesitation surface" per the
  spec; it exists to establish context, not to generate signal, so exact figures don't matter.
- Exact placeholder values shown on Screen 2 (D-01) — pick numbers that look plausible (e.g., a
  small fixed fee, min-received slightly below amount, a fixed gas estimate) since they'll be
  replaced by real computation in Phase 2. Reasonable to source them from the same
  configurable-constants file Phase 2 will extend, but the constants themselves and any recompute
  logic are Phase 2's responsibility.
- Exact shadcn/ui components used for inputs/buttons/cards, and any route-transition polish
  (Next.js `<Link>` vs `router.push`).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. Live fee/min-received/gas calculation
(CALC-01..04) and platform constraints (PLAT-01..04) were raised only as explicit non-goals for
this phase; they're already tracked in ROADMAP.md as Phase 2 and Phase 3.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCRN-01 | Screen 1 (Wallet Overview) shows a wallet balance, 2–3 mock asset rows, and a prominent "Swap" CTA that advances to Screen 2 | `app/page.tsx` as a Server Component with a `<Link href="/swap">` — see Architecture Patterns |
| SCRN-02 | Screen 2 (Amount Entry) shows an amount input, a fee row, a min-received row, a gas estimate, and a proceed CTA | shadcn `Input`/`Button` in a `'use client'` component under `app/swap/page.tsx`; static placeholder values per D-01 |
| SCRN-03 | Screen 3 (Confirmation) shows a read-only summary of the entered amount, a confirm CTA, and a back affordance | `app/swap/confirm/page.tsx`, Server Component reading `searchParams` prop directly (no client hook needed since no interactivity beyond navigation) |
| SCRN-04 | Screen 4 (Success) shows a success message and a done/home CTA marking flow completion | `app/swap/success/page.tsx`, static Server Component |
| SCRN-05 | Screen transitions occur via real Next.js App Router routing, not component state | File-based routing under `app/`; `<Link>`/`router.push` — see Code Examples |
| SCRN-06 | The entered amount travels between screens via URL query params (inspectable, no storage reads) | `useSearchParams`/`searchParams` page prop pattern — see Code Examples and Pitfall 1 |
| SEL-01 | Screen 2 exposes `amount-input`, `fee-row`, `min-received-row`, `proceed-cta` | Confirmed: shadcn `Input`/`Button` spread `{...props}` onto the native `<input>`/`<button>` — see Research Focus 5 findings |
| SEL-02 | Screen 3 exposes `confirm-cta`, `back-btn` | Same prop-spread pattern on shadcn `Button` |
| SEL-03 | Screen 4 exposes `flow-complete` | Plain `<div data-heed="flow-complete">` or attribute on the success container — no library involved |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

From `CLAUDE.md` (repo root, all branches) and `.claude/CLAUDE.md` (Branch 1 specific) — treated
with the same authority as locked CONTEXT.md decisions:

- **The seven `data-heed` selectors are locked.** Do not rename, do not add new ones without
  updating `CONTRACT.md` first. This phase's entire job is making all seven resolve to non-null
  elements in DevTools.
- **No PII ever.** No field values leave the browser as identity data; no cookies, no
  `localStorage` reads. The amount travels via URL query param only (per D-02/SCRN-06) — this
  satisfies the no-PII rule since query params are inspectable, non-persistent, and not identity
  data.
- **No external API calls during a session.** No `fetch`/XHR anywhere in this app. All screen
  content (balance, fee, min-received, gas) is static/hardcoded in Phase 1.
- **No framework dependencies beyond the fixed stack.** `.claude/CLAUDE.md` fixes the stack as
  Next.js (App Router) + Tailwind CSS + shadcn/ui, vanilla — no extra frameworks, no state
  management library, no animation library. (The root CLAUDE.md's "vanilla JS only, no
  React" rule is scoped to Branch 2/heed-sdk, not this branch — Branch 1's own constraints file
  explicitly names Next.js + Tailwind + shadcn/ui as the fixed stack.)
- **No cross-branch contamination.** This branch (`feat/demo-platform`) has its own
  `node_modules`, `package.json`, and `.planning/`. Do not import from or reference Branch 2/3/4
  code or config.
- **No scope expansion.** Do not build a dashboard, backend API, CDN deployment, or anything
  beyond the 4-screen flow. If a task implies any of these, stop and flag it.
- **Waterfall is absolute.** This is Phase 1 of Branch 1, the first branch in the whole harness —
  no upstream dependency exists, so this constraint doesn't block starting, but the plan must
  produce a real, gate-passable completion (all 7 selectors + routing + no network calls +
  clean Playwright load) since nothing in Branch 2/3/4 can start until this branch's gate passes.
- **GSD owns `.planning/`.** Do not manually edit `STATE.md`, `ROADMAP.md`, or `PLAN.md` files —
  this is a note for the planner/executor, not a code constraint.
- **Viewport is 390px only, no responsive work in this phase.** (Full guard-banner UX for wider
  viewports is Phase 3's PLAT-01; this phase should still author styles that render correctly at
  390px width without doing responsive breakpoint work.)

## Summary

This phase scaffolds a brand-new Next.js App Router project (v16.2.10, verified current) with
Tailwind CSS v4 (v4.3.2) and shadcn/ui (CLI package `shadcn`, v4.13.0 — note the older
`shadcn-ui` package is deprecated), and builds four routed screens (`/`, `/swap`,
`/swap/confirm`, `/swap/success`) that carry a single `?amount=X` query parameter forward and
back. There is no backend, no database, no calculation logic — every dynamic value in this phase
is either a hardcoded placeholder or the raw `amount` string read back from the URL. The only
genuinely non-trivial technical risk is Next.js's Suspense-boundary requirement around
`useSearchParams` in Client Components during production builds, and confirming that shadcn/ui's
component primitives forward `data-heed` attributes onto the actual native DOM element (not a
wrapper) — both are resolved definitively below with source-level verification.

**Primary recommendation:** Scaffold with `create-next-app` using TypeScript + Tailwind + App
Router + `src/` directory defaults, initialize shadcn/ui immediately after, add `button`,
`input`, and `card` components via the CLI (never hand-write them), and build the 4 routes as
plain nested folders under `app/swap/` with Screen 2 as the only Client Component (it needs
`useState` for the amount input) — everything else can be a Server Component reading `searchParams`
directly, which sidesteps the Suspense-boundary requirement entirely for Screens 3 and 4.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Screen routing / navigation (SCRN-05) | Frontend Server (SSR) | Browser / Client | App Router pages are Server Components by default and render on the dev server first; Next.js's client router then handles subsequent transitions in-browser without full reloads |
| URL query param carry (SCRN-06, D-02) | Browser / Client | Frontend Server (SSR) | Screen 2 must read/write the param interactively (`useSearchParams`, Client Component); Screens 3/4 can read the same param server-side via the `searchParams` page prop with zero client JS |
| DOM structure & `data-heed` selectors (SEL-01/02/03) | Browser / Client | — | What matters is the final rendered DOM the browser exposes — irrelevant whether the JSX that produced it ran on the server or client, so long as the attribute survives to hydration unchanged |
| Static placeholder content (balance, fee, min-received, gas — D-01) | Frontend Server (SSR) | — | No interactivity required; can render entirely server-side as plain Server Components, keeping client JS bundle small |
| Component library (shadcn/ui primitives) | Browser / Client | Frontend Server (SSR) | Interactive primitives (`Button` with `onClick`, `Input` with `onChange`) require `'use client'`; purely presentational ones (`Card`) can stay Server Components |
| Styling / dark theme / 390px constraint (PLAT-03, deferred formal gate to Phase 3) | Browser / Client | Frontend Server (SSR) | CSS is compiled at build time (server/build tier) but applied and enforced in the browser |
| Dev server hosting | Frontend Server (SSR) | — | `next dev` is the only "server" in this project — there is no API/backend tier at all, by design (CLAUDE.md: no backend, no fetch/XHR) |

No **API/Backend**, **CDN/Static**, or **Database/Storage** tier applies to this phase — the
project's constraints explicitly forbid a backend, and there are no external assets or persisted
data of any kind.

## Standard Stack

> Package names below were discovered via WebSearch and training knowledge, not an authoritative
> source lookup tool (Context7 was unavailable in this session) — tagged `[ASSUMED]` per
> provenance rules. Version numbers were confirmed via `npm view <pkg> version`
> `[VERIFIED: npm registry]`, run 2026-07-07. Cross-check each package name against the Package
> Legitimacy Audit below before installing.

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` [ASSUMED name / VERIFIED: npm registry version] | 16.2.10 | App Router framework, file-based routing, dev server | Fixed by `.claude/CLAUDE.md` stack constraint; App Router is required for SCRN-05 (real routing, not component state) |
| `react` / `react-dom` [ASSUMED name / VERIFIED version] | 19.2.7 | UI rendering runtime | Next.js 16's peer dependency requires React `^19.0.0` (confirmed via `npm view next peerDependencies`) |
| `tailwindcss` + `@tailwindcss/postcss` [ASSUMED name / VERIFIED version] | 4.3.2 | Utility-first styling, dark theme, fixed-width layout | Fixed by stack constraint; v4's CSS-first config (no `tailwind.config.js` needed) is the current default for new projects |
| `shadcn` (CLI) [ASSUMED name / VERIFIED version] | 4.13.0 | Component scaffolding CLI — generates owned source files, not a runtime dependency itself | Fixed by stack constraint; note the package is named `shadcn`, **not** `shadcn-ui` (that name is deprecated, last published at 0.9.5) |
| `@radix-ui/react-slot` [ASSUMED name / VERIFIED version] | pulled in transitively by shadcn `Button`/other components when `asChild` is used | Implements the `asChild` composition pattern | Not installed manually — added automatically when the CLI generates a component that uses it |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `class-variance-authority` [ASSUMED/VERIFIED] | 0.7.x (latest per shadcn scaffolds) | Variant-based className composition for shadcn components (e.g. `Button`'s `variant`/`size` props) | Pulled in automatically by shadcn `add button` — do not add manually or duplicate logic |
| `clsx` + `tailwind-merge` [ASSUMED/VERIFIED, tailwind-merge 3.x current per shadcn CLI deps] | latest | Conditional className merging without Tailwind class conflicts (the `cn()` helper shadcn scaffolds into `lib/utils.ts`) | Used inside every shadcn component's `className={cn(...)}` call |
| `@playwright/test` [ASSUMED/VERIFIED] | 1.61.1 | Browser automation / E2E — used for this phase's own dev-loop verification of "loads cleanly under Playwright", formal PLAT-04 gate is Phase 3 | Add as a devDependency now if the plan wants an automated check alongside manual DevTools verification; otherwise defer entirely to Phase 3 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Tailwind CSS v4 | Tailwind CSS v3 | v3 requires a `tailwind.config.js` + content globs and is the version most existing tutorials show; v4 is simpler for a greenfield project (single `@import "tailwindcss"` line, CSS-first `@theme`) and is what `create-next-app` now scaffolds by default — no reason to downgrade |
| shadcn/ui components (owned source) | A pre-built component library (MUI, Chakra, Mantine) | Explicitly fixed by `.claude/CLAUDE.md` — shadcn/ui is "already familiar from website" per spec and its copy-into-project model makes `data-heed` attribute placement fully inspectable/verifiable in source, unlike a black-box npm component library |
| `useSearchParams` (Client Component) on every screen | `searchParams` page prop (Server Component) wherever possible | Server Component approach avoids the Suspense-boundary requirement and ships less client JS — use it for Screens 3/4 which have no `onChange`/`onClick`-driven param reads; reserve `useSearchParams` for Screen 2 where the value must react to the input field |

**Installation:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
npx shadcn@latest init
npx shadcn@latest add button input card
```

**Version verification:** Confirmed via `npm view <pkg> version` on 2026-07-07 — `next@16.2.10`,
`react@19.2.7`, `tailwindcss@4.3.2`, `shadcn@4.13.0`, `@playwright/test@1.61.1`. `next@16.2.10`'s
declared peer dependency range for React is `^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0`,
so React 19.2.7 is compatible.

## Package Legitimacy Audit

| Package | Registry | Age (latest publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|----------------------|-----------|--------------|---------|-------------|
| `next` | npm | 2026-07-01 | 38.4M/wk | github.com/vercel/next.js | SUS (`too-new`) | Approved — flag is a false-positive from a recent version bump on a 38M/wk-download, officially-repo'd package; no `checkpoint:human-verify` warranted, noted for completeness |
| `react` | npm | 2026-06-01 | 141.6M/wk | github.com/facebook/react | OK | Approved |
| `react-dom` | npm | 2026-06-01 | 133.6M/wk | github.com/facebook/react | OK | Approved |
| `tailwindcss` | npm | 2026-06-29 | 118.4M/wk | github.com/tailwindlabs/tailwindcss | SUS (`too-new`) | Approved — same false-positive pattern as `next` |
| `shadcn` | npm | 2026-07-03 | 5.6M/wk | github.com/shadcn-ui/ui | SUS (`too-new`) | Approved — same false-positive pattern; confirmed this is the correct current CLI package (the older `shadcn-ui` name is deprecated at 0.9.5, do not use) |
| `class-variance-authority` | npm | 2024-11-26 | 54.4M/wk | github.com/joe-bell/cva | OK | Approved |
| `clsx` | npm | 2024-04-23 | 102.6M/wk | github.com/lukeed/clsx | OK | Approved |
| `tailwind-merge` | npm | 2026-05-10 | 69.2M/wk | github.com/dcastil/tailwind-merge | OK | Approved |
| `lucide-react` | npm | 2026-07-01 | 80.8M/wk | github.com/lucide-icons/lucide | SUS (`too-new`) | Approved if icons are used at all — same false-positive pattern; this phase's UI hint doesn't require icons, treat as optional |
| `@radix-ui/react-slot` | npm | 2026-06-15 | 164.3M/wk | github.com/radix-ui/primitives | SUS (`too-new`) | Approved — auto-installed transitively by shadcn `add`, not a direct install decision |

**Packages removed due to `[SLOP]` verdict:** none.
**Packages flagged as suspicious `[SUS]`:** `next`, `tailwindcss`, `shadcn`, `lucide-react`,
`@radix-ui/react-slot` — all five are flagged solely on the `too-new` heuristic (a version was
published within the lookback window), not on any indicator of a hallucinated or malicious
package. Every one has a legitimate, long-established source repository under a well-known GitHub
org and weekly download counts in the tens or hundreds of millions. **No `checkpoint:human-verify`
is warranted for these five** — the "too-new" signal is a known false-positive pattern for
actively-maintained, high-velocity official packages, and the planner should note this in the
plan rather than insert a blocking checkpoint. If the planner wants extra caution, a single
lightweight `checkpoint:human-verify` before `npm install` (confirming `package.json` matches
this table) is sufficient — no per-package checkpoints needed.

## Architecture Patterns

### System Architecture Diagram

```
Browser (localhost:3000)
  │
  │  GET /                     (Screen 1 — Wallet Overview)
  ▼
┌─────────────────────────────┐
│ Next.js dev server (SSR)    │
│  app/page.tsx  (Server Comp)│──renders──▶ HTML with balance, asset
└─────────────────────────────┘             rows, "Swap" <Link href="/swap">
  │
  │  user taps "Swap" ──▶ client-side route transition (no full reload)
  ▼
┌─────────────────────────────┐
│ app/swap/page.tsx           │
│ ('use client', useState)    │──renders──▶ amount-input, fee-row,
│                              │             min-received-row, gas estimate
└─────────────────────────────┘             (all static placeholders per D-01)
  │
  │  user enters amount, taps proceed-cta
  │  ──▶ router.push(`/swap/confirm?amount=${amount}`)
  ▼
┌─────────────────────────────┐
│ app/swap/confirm/page.tsx   │
│ (Server Comp, reads         │──renders──▶ read-only amount + fee +
│  searchParams prop)         │             min-received summary,
└─────────────────────────────┘             confirm-cta, back-btn
  │                     │
  │ confirm-cta         │ back-btn
  ▼                     ▼
┌───────────────────┐  ┌──────────────────────────────┐
│ app/swap/success/  │  │ router.back() or              │
│ page.tsx            │  │ router.push(`/swap?amount=…`) │
│ flow-complete +      │  └──────────────────────────────┘
│ done/home CTA        │        (returns to Screen 2,
└───────────────────┘         amount still in URL — D-05)
  │
  │  done/home CTA ──▶ router.push('/')  (clean, no query params — D-06)
  ▼
back to Screen 1
```

Every arrow above is a real Next.js navigation (route change), not a state toggle — satisfying
SCRN-05. The only query param crossing any arrow is `amount` (D-02) — satisfying SCRN-06.

### Recommended Project Structure
```
app/
├── layout.tsx           # root layout — dark theme class, 390px constraint wrapper
├── page.tsx              # Screen 1: Wallet Overview (Server Component)
├── globals.css           # single @import "tailwindcss" line + any @theme overrides
└── swap/
    ├── page.tsx           # Screen 2: Amount Entry ('use client' — needs useState/onChange)
    ├── confirm/
    │   └── page.tsx        # Screen 3: Confirmation (Server Component, reads searchParams prop)
    └── success/
        └── page.tsx         # Screen 4: Success (Server Component, static)
components/
└── ui/                    # shadcn-generated: button.tsx, input.tsx, card.tsx (owned source)
lib/
├── utils.ts               # shadcn's cn() helper (clsx + tailwind-merge)
└── swap-constants.ts       # placeholder fee/min-received/gas values (D-01) — Phase 2 extends this
```

### Pattern 1: Client Component reads the amount it just typed (Screen 2)
**What:** Screen 2 needs `useState` to control the input and build the outgoing URL; it does
**not** need `useSearchParams` to read an *incoming* amount (nothing carries an amount into
Screen 2 in the forward direction — only the back-navigation from Screen 3 does, per D-05).
**When to use:** Any screen where the user actively edits a value that then becomes part of the
next URL.
**Example:**
```tsx
// Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params (pattern adapted)
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function SwapAmountForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Pre-fill if returning from Screen 3's back-btn (D-05)
  const [amount, setAmount] = useState(searchParams.get('amount') ?? '')

  return (
    <>
      <Input
        data-heed="amount-input"
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <div data-heed="fee-row">Fee: 0.30%</div>
      <div data-heed="min-received-row">Min received: {/* placeholder, D-01 */}</div>
      <Button
        data-heed="proceed-cta"
        onClick={() => router.push(`/swap/confirm?amount=${encodeURIComponent(amount)}`)}
      >
        Proceed
      </Button>
    </>
  )
}
```
Because this component calls `useSearchParams`, it must be wrapped in a `<Suspense>` boundary in
`app/swap/page.tsx` — see Pitfall 1.

### Pattern 2: Server Component reads the amount for a read-only screen (Screen 3 & 4)
**What:** Screens 3 and 4 only display the amount and offer navigation — no `onChange` handlers —
so they can be plain Server Components that read the Next.js-provided `searchParams` page prop
directly, avoiding the client-hook Suspense requirement entirely.
**When to use:** Any route that needs the query string only to render content, not to react to
live user input on that screen.
**Example:**
```tsx
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/page (searchParams prop, pattern adapted)
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string }>
}) {
  const { amount } = await searchParams
  return (
    <>
      <p>Amount: {amount}</p>
      <div data-heed="fee-row">Fee: 0.30%</div>
      <div data-heed="min-received-row">Min received: {/* placeholder */}</div>
      <a data-heed="back-btn" href={`/swap?amount=${amount}`}>Back</a>
      <a data-heed="confirm-cta" href="/swap/success">Confirm</a>
    </>
  )
}
```
Note: in current Next.js (App Router since v15), the `searchParams` page prop is a `Promise` and
must be awaited — this is a breaking change from Next.js 14 and earlier where it was a plain
object. Confirm the scaffolded Next.js version's convention when writing task steps.

### Pattern 3: `data-heed` attributes pass straight through shadcn/ui primitives
**What:** shadcn/ui's `Button` and `Input` components (verified against the current upstream
source, `apps/v4/registry/new-york-v4/ui/{button,input}.tsx` on `shadcn-ui/ui`) spread all
received props — including arbitrary `data-*` attributes — directly onto the native `<button>` /
`<input>` element via `{...props}`, as long as `asChild` is left at its default `false`.
**When to use:** Every locked selector in this phase (`amount-input`, `proceed-cta`,
`confirm-cta`, `back-btn`) can be passed as a plain `data-heed="..."` prop on the shadcn
component itself — no need to drop to raw HTML elements or reach into a wrapper.
**Example:**
```tsx
// Source: https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/button.tsx (verified)
function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}   // <-- data-heed="proceed-cta" lands here, on the native <button>
    />
  )
}
```
`Input` follows the identical pattern, spreading `{...props}` onto a native `<input>`. This
resolves Research Focus 5 with certainty: **no locked selector will land on a wrapper element**,
provided `asChild` is not used on the elements that carry `data-heed` attributes.

### Anti-Patterns to Avoid
- **Reaching for `asChild` on a `data-heed`-tagged element:** If a future phase wraps
  `proceed-cta` in `<Button asChild><Link>...</Link></Button>`, the `data-heed` prop must be
  placed on the inner `<Link>` (which becomes the actual rendered root via `Slot`), not on
  `Button` itself, or it will be lost. Not needed in this phase (no `asChild` usage required for
  SCRN-01..06 / SEL-01..03), but worth flagging for anyone touching this code later.
- **Storing the amount in `localStorage`/`sessionStorage`/component state alone:** Violates
  SCRN-05 (real routing) and the no-PII/no-storage-reads rule in CLAUDE.md. The URL query string
  is the only allowed channel (D-02).
- **Building fee/min-received/gas math in this phase:** Explicitly deferred by D-01 to Phase 2
  (CALC-01/02/03). Keep Screen 2/3 values as literal strings or values pulled from a constants
  file with no recompute logic attached.
- **Using the `pages/` directory or any `useRouter` import from `next/router`:** That's the
  Pages Router API. This project uses the App Router exclusively (`next/navigation` for
  `useRouter`/`useSearchParams`/`usePathname`) — mixing the two APIs is a common and confusing
  mistake for anyone with Pages Router muscle memory.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Styled button/input/card markup | Custom `<button>`/`<input>`/`<div>` with hand-written Tailwind classes and variant logic | shadcn/ui `Button`, `Input`, `Card` (via `npx shadcn add`) | Fixed by stack constraint; also gets `cn()`-based variant merging and accessible defaults (focus rings, disabled states) for free |
| className conflict resolution (e.g. two `p-4`/`p-2` both applied) | Manual string concatenation of Tailwind classes | `cn()` helper (clsx + tailwind-merge), scaffolded by shadcn's `init` into `lib/utils.ts` | Prevents silent Tailwind class-order bugs; already the pattern every shadcn component uses internally |
| Query-string construction/parsing (`amount=5&foo=bar` etc.) | Manual string splitting/regex on `window.location.search` | `useSearchParams()` (Client) or the `searchParams` page prop (Server), both backed by the standard `URLSearchParams` interface | Handles encoding/decoding, multiple values, and is what the Next.js router itself uses — writing a parser by hand risks mismatched encoding vs. what `<Link>`/`router.push` produce |

**Key insight:** This phase has almost no genuine business logic — its entire value is *correct,
inspectable DOM structure wired to real routing*. Every "don't hand-roll" item above exists
because a hand-rolled version would either violate a locked constraint (styling stack) or
introduce a subtle bug in exactly the mechanism two other branches (Heed SDK, Playwright agents)
depend on (selector placement, query-string round-tripping).

## Common Pitfalls

### Pitfall 1: Production build fails with "Missing Suspense boundary with useSearchParams"
**What goes wrong:** Any Client Component that calls `useSearchParams()` and is part of a
statically-prerendered route will cause `next build` to fail (not `next dev` — it works fine in
dev, which is why this is easy to miss).
**Why it happens:** Next.js needs to know how much of the route can be prerendered as static HTML
vs. must fall back to client-side rendering for the dynamic, request-time part.
**How to avoid:** Wrap any component that calls `useSearchParams()` in `<Suspense fallback={...}>`
in its parent page/layout. In this phase, that means Screen 2's amount form (Pattern 1) needs a
Suspense wrapper in `app/swap/page.tsx`; Screens 3/4 avoid the problem entirely by using the
Server Component `searchParams` prop pattern (Pattern 2) instead.
**Warning signs:** `npm run dev` works perfectly; `npm run build` throws a build-time error
mentioning `useSearchParams` and Suspense. Always run a production build at least once during this
phase, not just `next dev`, to catch this before it surfaces downstream.

### Pitfall 2: `searchParams` page prop is a `Promise` in current Next.js, not a plain object
**What goes wrong:** Code copied from older tutorials (`function Page({ searchParams }) { const
amount = searchParams.amount }`) will fail — `searchParams.amount` is `undefined` because
`searchParams` is a `Promise<{...}>` that must be awaited.
**Why it happens:** Next.js (App Router, since v15) made `params`/`searchParams` async to support
better streaming/partial prerendering.
**How to avoid:** Always `const { amount } = await searchParams` inside an `async function Page(...)`.
**Warning signs:** `amount` reads as `undefined` even though the URL clearly has `?amount=5`;
TypeScript will actually catch this at compile time if the page prop is typed as
`Promise<{ amount?: string }>` rather than `{ amount?: string }`.

### Pitfall 3: `data-heed` attribute silently dropped by a custom wrapper component
**What goes wrong:** If Screen 2's amount input is wrapped in an extra custom component (e.g. a
`<FormField>` abstraction) that doesn't forward `...rest` props to the underlying shadcn `Input`,
`data-heed="amount-input"` never reaches the DOM and `document.querySelector` returns `null`.
**Why it happens:** Not every custom React component author remembers to spread unknown props
down to the DOM-producing child — this is a general React composition footgun, not specific to
shadcn/ui (shadcn's own components handle it correctly, per Pattern 3).
**How to avoid:** Keep this phase's component tree shallow — apply `data-heed` directly on the
shadcn primitive (`<Input data-heed="amount-input" ... />`), not on a custom wrapper around it.
If a wrapper is introduced later, it must explicitly forward all `data-*` props.
**Warning signs:** DevTools `document.querySelector('[data-heed="..."]')` returns `null` on a
screen where the element is visibly present — inspect the actual rendered DOM in the Elements
panel to see which element (if any) the attribute landed on.

### Pitfall 4: Tailwind v4 not purging/generating expected classes because content is outside default scan paths
**What goes wrong:** In Tailwind v4, class detection is automatic (no `content: []` array to
maintain) but still scans based on where `@import "tailwindcss"` is referenced from and the
project's file structure; classes used only in dynamically-constructed strings (e.g.
`` `bg-${color}-500` ``) are never detected.
**Why it happens:** Tailwind statically scans source text for complete class name strings — it
cannot execute template literals.
**How to avoid:** Not a concern for this phase since no dynamic class-name construction is needed
(fixed dark theme, no per-asset color variation specified) — write complete class names as
literal strings everywhere.
**Warning signs:** A class visually "should" apply based on a template literal but doesn't render
— check the Elements panel for whether the class is present in the compiled CSS at all.

## Code Examples

### Root layout enforcing dark theme + centered 390px content column
```tsx
// Source: pattern derived from Tailwind CSS v4 docs (https://tailwindcss.com/docs/guides/nextjs) + Next.js layout conventions
// app/layout.tsx
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-foreground flex justify-center">
        <div className="w-[390px] min-h-screen">{children}</div>
      </body>
    </html>
  )
}
```
This constrains all four screens to a 390px column regardless of actual browser window width —
satisfying this phase's "renders correctly at 390px" requirement without building the full
PLAT-01 guard-banner logic (that's Phase 3's job; this is just the layout shell).

### `globals.css` — Tailwind v4 minimal setup
```css
/* Source: https://tailwindcss.com/docs/guides/nextjs */
@import "tailwindcss";
```

### Screen 4 — success/completion element and reset-to-Screen-1 CTA (D-06)
```tsx
// app/swap/success/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function SuccessPage() {
  return (
    <div data-heed="flow-complete">
      <p>Swap complete.</p>
      <Button asChild>
        <Link href="/">Done</Link>
      </Button>
    </div>
  )
}
```
Note `<Link href="/">` with no query string naturally satisfies D-06 (clean session, no leftover
params) — no explicit param-clearing logic needed.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Pages Router (`pages/`, `next/router`) | App Router (`app/`, `next/navigation`) | App Router stable since Next.js 13 (2022), now the default `create-next-app` recommendation | This project must use `next/navigation` hooks, not `next/router` — mixing them is a common source of confusion in AI-generated or tutorial-derived code |
| `searchParams` as plain object page prop | `searchParams` as `Promise<...>`, must `await` | Next.js 15 (late 2024) made `params`/`searchParams` async | Any Server Component reading `searchParams` needs `async function Page(...)` + `await searchParams` |
| Tailwind v3 (`tailwind.config.js` + `content: []` globs) | Tailwind v4 (CSS-first `@import "tailwindcss"`, `@theme` in CSS, zero-config content detection) | Tailwind v4 stable release; `create-next-app` now scaffolds v4 by default for new projects | No `tailwind.config.js` to maintain in this phase; theme customization (dark mode variables) happens in `globals.css` via `@theme` if needed |
| `shadcn-ui` npm package | `shadcn` npm package | Package renamed; `shadcn-ui` deprecated at 0.9.5 | Must run `npx shadcn@latest ...`, not `npx shadcn-ui@latest ...` — older tutorials/blog posts will show the old name |

**Deprecated/outdated:**
- `shadcn-ui` (npm package name): superseded by `shadcn`. Using the old name still technically
  installs something (0.9.5) but it is stale and not what current shadcn documentation describes.
- Synchronous `searchParams`/`params` page props: removed as of Next.js 15; any generated code
  must treat them as `Promise`s.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Exact package names (`next`, `react`, `tailwindcss`, `shadcn`, `@radix-ui/react-slot`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@playwright/test`) are the correct, currently-maintained identifiers for these libraries | Standard Stack, Package Legitimacy Audit | Low — all five "SUS" flags resolved to legitimate, extremely high-download packages with matching GitHub org repos when cross-checked; a wrong name would fail `npm view`/`npm install` immediately and be caught at scaffold time |
| A2 | `create-next-app`'s current default prompt set and flags (`--typescript --tailwind --eslint --app --src-dir --import-alias`) match v16.2.10 exactly | Standard Stack, Installation | Low-Medium — flags are stable across recent major versions; worst case a prompt appears interactively instead of being skipped, which the executor can answer manually |
| A3 | shadcn/ui's `new-york-v4` registry variant (fetched from `apps/v4/registry/new-york-v4/ui/{button,input}.tsx` on GitHub) is representative of what `npx shadcn@latest add` currently scaffolds into a fresh project | Architecture Patterns (Pattern 3), Pitfall 3 | Low — the core `{...props}` spread pattern verified here is extremely stable shadcn/ui convention across all style variants and versions; even if the exact file path differs, the spread-props behavior is consistent |
| A4 | Tailwind v4's zero-config content detection requires no explicit configuration for this phase's simple, literal-class-name usage | Pitfall 4, Code Examples | Low — this phase uses no dynamic class construction, so the one known v4 detection gap doesn't apply |

## Open Questions

1. **Should this phase add `@playwright/test` as a devDependency now, or defer entirely to Phase 3?**
   - What we know: PLAT-04 (formal "loads cleanly under Playwright + iPhone 14 emulation" gate)
     is explicitly Phase 3's requirement, not this phase's. This phase's own success criteria only
     require DevTools-verifiable selectors and manual routing verification.
   - What's unclear: Whether the planner wants an early smoke-test script in this phase to catch
     regressions before Phase 3 formalizes it, or whether that would be scope creep per D-01's
     "don't mix concerns" spirit.
   - Recommendation: Skip installing Playwright in this phase. Manual DevTools verification
     (per CONTRACT.md's checklist) is sufficient for this phase's gate; let Phase 3 own the
     Playwright tooling installation and its own PLAT-04 verification.

2. **Exact dark-theme mechanism: Tailwind's `dark` class strategy vs. shadcn's CSS-variable theme?**
   - What we know: PROJECT.md locks "dark theme applied consistently" as a decision; shadcn's
     `init` CLI, by default, scaffolds CSS variables for both light and dark themes into
     `globals.css` and toggles via a `.dark` class on `<html>` or `<body>`.
   - What's unclear: Whether this phase should scaffold both light/dark variable sets (shadcn's
     default) and simply hardcode the `dark` class permanently, or strip the light-mode variables
     entirely since there's no light/dark toggle anywhere in this app's scope.
   - Recommendation: Accept shadcn's default dual-theme CSS variable scaffold (simplest, requires
     no customization) and just hardcode `className="dark"` on `<html>` in the root layout
     (as shown in Code Examples) — light-mode variables sit unused in the CSS but cost nothing at
     runtime. Formal enforcement/testing of "dark theme consistently applied" is PLAT-03 (Phase 3);
     this phase only needs the class present.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev server, npm/npx | ✓ | v22.20.0 | — |
| npm | Package installation | ✓ | 10.9.3 | — |
| npx | Running `create-next-app`/`shadcn` CLIs without global install | ✓ | 10.9.3 | — |
| Git | Version control (repo already initialized) | ✓ | repo is a git repo per environment info | — |

No missing dependencies. This phase has no database, no Docker, no external service
dependencies — consistent with the project's explicit "no backend" constraint.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No authentication anywhere in this branch's scope |
| V3 Session Management | No | No sessions, no cookies — the only "session state" is the URL query string, which is inherently visible/non-sensitive by design |
| V4 Access Control | No | No access-controlled resources — every screen is publicly reachable, by design (synthetic demo surface) |
| V5 Input Validation | Yes | Constrain the amount `<Input>` with `type="number"` / `inputMode="decimal"` and treat the value as an opaque display string when read back from `searchParams` — do not `eval`/interpolate it into HTML outside of React's normal JSX text interpolation (which auto-escapes) |
| V6 Cryptography | No | No secrets, no encryption needed — nothing in this phase handles sensitive data |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Reflected XSS via unsanitized `amount` query param rendered into the DOM | Tampering | Not a practical risk here: React JSX text interpolation (`{amount}`) auto-escapes by default; the only risk would be using `dangerouslySetInnerHTML` with the raw param, which this phase has no reason to do — avoid it |
| Arbitrary/garbage `amount` values (non-numeric strings, extremely long strings) breaking layout or downstream Heed/Playwright selector logic | Tampering / Denial of Service (cosmetic, not security-critical here) | Use `type="number"` on the input to constrain client-side entry; since Phase 1 does no calculation on the value (D-01), a malformed value can only affect *display*, not computation — acceptable for this phase's scope; Phase 2's calculation logic should validate/clamp before doing math |
| Client-side-only trust boundary (anyone can hand-edit the URL to `?amount=999999999` or `?amount=<script>`) | Spoofing / Tampering | Acceptable and expected for this synthetic, no-backend demo surface — there is no server-side state or privileged action the URL param could escalate into; this is explicitly a feature (Branch 3's Playwright agents and manual testers are expected to manipulate the URL directly) |

No further security hardening is warranted for this phase given the project's explicit
"no backend, no auth, no persisted data, no PII" boundaries (CLAUDE.md).

## Sources

### Primary (HIGH confidence)
- `npm view next version` / `npm view next peerDependencies` / `npm view react version` /
  `npm view tailwindcss version` / `npm view shadcn version` / `npm view shadcn-ui version` /
  `npm view @tailwindcss/postcss version` / `npm view @playwright/test version` — direct registry
  queries, run 2026-07-07.
- `gsd-tools query package-legitimacy check --ecosystem npm ...` — direct tool verdicts for all
  10 candidate packages, run 2026-07-07.
- https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/button.tsx —
  fetched and read directly, confirms `{...props}` spread and `asChild` → `Slot.Root` behavior.
- https://raw.githubusercontent.com/shadcn-ui/ui/main/apps/v4/registry/new-york-v4/ui/input.tsx —
  fetched and read directly, confirms `{...props}` spread onto native `<input>`.
- https://nextjs.org/docs/app/api-reference/functions/use-search-params — fetched directly
  (`version: 16.2.10`, `lastUpdated: 2026-03-03` per page frontmatter), confirms Suspense
  boundary requirement and exact API shape.

### Secondary (MEDIUM confidence)
- WebSearch results citing https://nextjs.org/docs/app/api-reference/cli/create-next-app,
  https://ui.shadcn.com/docs/installation/next, https://tailwindcss.com/docs/guides/nextjs,
  https://www.radix-ui.com/primitives/docs/guides/composition — official doc URLs surfaced and
  summarized via WebSearch (Context7 MCP tool unavailable in this session; fell back to
  WebSearch per tool-strategy fallback protocol).
- WebSearch results on Playwright device emulation (playwright.dev/docs/emulation) for the
  iPhone 14 emulation pattern referenced in Common Pitfalls / State of the Art context.

### Tertiary (LOW confidence)
- None — every claim in this document is either tool-verified, sourced from an official docs URL
  reachable via WebSearch/WebFetch, or explicitly logged in the Assumptions Log above.

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — versions verified directly against the npm registry; package identities
  cross-checked against official docs URLs and GitHub source, though originally surfaced via
  WebSearch/training (see Assumptions Log A1).
- Architecture: HIGH — the `data-heed`-through-shadcn pass-through question (this phase's single
  highest-risk unknown) was resolved by reading the actual upstream component source, not
  inferred from documentation prose.
- Pitfalls: HIGH — both Next.js pitfalls (Suspense boundary, async `searchParams`) are directly
  quoted/confirmed from the official Next.js docs page fetched in this session.

**Research date:** 2026-07-07
**Valid until:** 2026-08-06 (30 days — this is a fast-moving stack (Next.js/Tailwind/shadcn all
ship frequently) but the specific APIs relied on here — App Router file conventions,
`useSearchParams`, prop-spreading in shadcn primitives — are stable, load-bearing conventions
unlikely to break within a normal planning/execution window)
