<!-- GSD:project-start source:PROJECT.md -->

## Project

**heed-demo-platform (Branch 1)**

A self-contained, mobile-only (390px / iPhone 14) Next.js web app that
simulates a high-stakes crypto **swap** flow — no blockchain, no backend,
no external APIs. Every screen, input, and CTA exists to produce realistic
DOM structure that Heed (Branch 2) can instrument and that Playwright agents
(Branch 3) can drive. It is the surface the rest of the harness is built on top of.

**Core Value:** The four screens render correctly at 390px and expose all seven locked
`data-heed` selectors in a real Next.js-routed flow, so that Heed can
instrument them and agents can run through them. If everything else is ugly
but the selectors and routing are right, this branch has done its job.

### Constraints

- **Tech stack**: Next.js (App Router) + Tailwind CSS + shadcn/ui, vanilla — no extra
  frameworks. Fixed by spec so the harness stays understandable and portable to a real partner.

- **Viewport**: Renders only at 390px width; no responsive work — the app's one job is a
  faithful mobile surface, not a layout system.

- **Network**: No external calls during any session — the harness must be fully local so agent
  runs are deterministic and PII-free.

- **Selectors**: The 7 `data-heed` attributes are locked — downstream branches break if they move.
- **Scope**: Do not build instrumentation, backends, or dashboards here — waterfall gate must
  pass before scope expands.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->

## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
