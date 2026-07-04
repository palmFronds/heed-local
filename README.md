# heed-harness

A self-contained synthetic harness for Heed — the real-time behavioral
intervention control layer. Built before any pilot partner is involved.

When a partner says yes, the only thing that changes is:
- Their staging URL replaces the demo platform
- The SDK deploys on their environment instead of localhost
- Real user sessions replace agent-generated ones
- The eval pipeline keeps running on live data

Everything else is already built and understood.

---

## What this is

Four branches. Each is a self-contained module. Each is built and verified
completely before the next one is started. Strict waterfall — no exceptions.

```
main                  ← skeleton only: README, CLAUDE.md, CONTRACT.md
feat/demo-platform    ← the dummy wallet app Heed sits on top of
feat/heed-sdk         ← the actual Heed product: script tag + inference + overlay
feat/agents           ← Playwright personas that generate synthetic session data
feat/eval             ← metrics, Laminar ingestion, weight update cycle
```

---

## The contract

Before any branch is initialized, the contract is locked. These are the
seven data-heed selectors that connect all three technical branches.
Branch 1 owns their existence. Branch 2 targets them in config. Branch 3
interacts with them in Playwright scripts.

Do not rename them. Changing one requires updating all three branches.

See CONTRACT.md for the full list.

---

## Waterfall sequence

Each branch has a hard gate. Nothing downstream starts until the upstream
gate passes completely.

### Branch 1 — feat/demo-platform
Mobile-only Next.js wallet flow. Four screens. No backend. No external APIs.
390px viewport only.

Gate: Manual walkthrough of all four screens with zero errors. All seven
data-heed selectors visible in DevTools. Playwright can load and navigate
the full flow in iPhone 14 emulation.

### Branch 2 — feat/heed-sdk
The Heed SDK. Vanilla JS. Single script tag. Signal capture (touch events
only), 2-layer inference net (brain.js), response overlay, config layer,
logging.

Gate: All four signal types fire manually on the demo platform and produce
correct log entries. Inference forward pass outputs a confidence score and
intent class. Response overlay renders at 390px without blocking interaction.
All six log event types appear in a complete session.

### Branch 3 — feat/agents
Playwright persona scripts. Three behavioral profiles (confident, hesitant,
abandoning) in iPhone 14 emulation. Volume runner generates 100+ sessions
headlessly.

Gate: 100 sessions complete without errors. Output NDJSON is valid.
Signal distribution is plausible: back_intent appears almost exclusively
in abandoning sessions. Response fire rate is higher in hesitant and
abandoning sessions than confident.

### Branch 4 — feat/eval
Session ingestion, metrics computation, Laminar trace storage, annotation
workflow, weight update cycle.

Gate: One complete weight update cycle run end to end. Updated weights
written back to Branch 2 config. New agent batch shows stable or improved
classification_accuracy relative to the first batch.

---

## How the branches connect at runtime

Branch 1 runs on localhost:3000
  Branch 2 SDK loads via script tag on Branch 1
    Branch 3 agents navigate Branch 1, Heed fires on their touch events
      Branch 4 reads session output, computes metrics, updates weights
        Updated weights feed back into Branch 2 config

---

## What this is not

- Not a dashboard or partner-facing UI
- Not a production CDN deployment
- Not connected to any blockchain or external service
- Not a multi-partner system
- Not federated learning
- Not a vision model pipeline

If a task implies any of the above, it is out of scope. Note it and defer it.

---

## Stack summary

| Branch | Stack |
|--------|-------|
| demo-platform | Next.js, Tailwind, Shadcn, no backend |
| heed-sdk | Vanilla JS, brain.js, no framework |
| agents | Node.js, Playwright |
| eval | Node.js, Laminar (lmnr.ai) |

---

## Getting started

1. Clone the repo
2. Install GSD globally: npx @opengsd/gsd-core@latest --claude --global
3. Restart Claude Code
4. Check out feat/demo-platform and run /gsd-new-project to begin
5. Do not touch any other branch until Branch 1's gate passes
