# CLAUDE.md — heed-harness

This file tells you what this repo is, what the rules are, and what not
to touch. Read it before doing anything else in a session.

---

## What this repo is

A four-branch waterfall build of the Heed synthetic harness. Each branch
is a self-contained module. The branches are built in strict dependency
order. Nothing downstream is started until the upstream branch's gate
passes completely.

The full system spec lives in the five text files that were used to
initialize this repo:
- repo0_overview.txt — system-level overview and runtime connection map
- repo1_dummy_platform.txt — Branch 1 spec
- repo2_heed_sdk.txt — Branch 2 spec
- repo3_heed_agents.txt — Branch 3 spec
- repo4_heed_eval.txt — Branch 4 spec

GSD's .planning/ directory on each branch carries the phase-level context.
Read the relevant spec file and the active .planning/STATE.md before
generating any plan or writing any code.

---

## The contract — do not violate

These seven selectors connect Branch 1, Branch 2, and Branch 3.
They are locked. Do not rename them. Do not add new ones without
updating CONTRACT.md and all three branches.

  [data-heed="amount-input"]
  [data-heed="fee-row"]
  [data-heed="min-received-row"]
  [data-heed="proceed-cta"]
  [data-heed="confirm-cta"]
  [data-heed="back-btn"]
  [data-heed="flow-complete"]

---

## Hard rules — always active

**No PII ever.** Signal payloads contain bbox coordinates and timestamps
only. No field values. No user identity. No cookies. No localStorage reads.
If a task would cause any of these to leave the browser, stop and flag it.

**No external API calls during a session.** The only outbound network call
is the weight push at session end. If you are adding any other fetch() or
XHR anywhere in the SDK, stop and flag it.

**No framework dependencies in the SDK.** Branch 2 (heed-sdk) is vanilla
JavaScript only. No React. No Vue. No bundler. One file, no dependencies
except brain.js.

**No cross-branch contamination.** Each branch has its own node_modules,
its own package.json, its own .planning/ directory. Do not import across
branches. Do not share state across branches except via the weight file
written by Branch 4 into Branch 2's config.

**No scope expansion.** If a task implies building a dashboard, a backend
API, a production CDN deployment, federated learning, a vision model
pipeline, or a multi-partner system — stop. Note it and defer it.
The harness must be complete and verified before scope expands.

**Waterfall is absolute.** Do not begin work on a branch until the
upstream branch's gate has passed. If asked to work on Branch 2 before
Branch 1's gate has passed, decline and say why.

---

## What GSD manages — do not edit manually

Once /gsd-new-project is run on a branch, GSD owns .planning/ on that
branch. Do not manually edit STATE.md, ROADMAP.md, or any PLAN.md file.
Use GSD commands to update state. If something looks wrong in .planning/,
run /gsd-health before touching anything.

---

## Per-branch context

When starting a session on a specific branch:
1. Read the branch spec file (repo1_, repo2_, etc.)
2. Run /gsd-progress to see where you are
3. Do not assume context from a previous session — restore it explicitly

---

## What main holds

Main has three files only: README.md, CLAUDE.md, CONTRACT.md.
No code lives on main. Do not add anything else to main.
