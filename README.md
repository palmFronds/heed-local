# heed-local
The point of this is a self-contained harness that proves Heed works, generates labeled behavioral data, and prepares you to deploy on a real partner platform - built entirely before any pilot conversation happens. This README defines the system overview: what it is, why it exists, the four branches, the waterfall sequence, and the scope boundaries.

Tentatively, the master structure will look as follows
```
heed-harness/
├── main              ← skeleton only: README + contract file
├── feat/demo-platform  ← Branch 1: the dummy wallet app
├── feat/heed-sdk       ← Branch 2: the actual Heed product
├── feat/agents         ← Branch 3: Playwright persona scripts
└── feat/eval           ← Branch 4: metrics + Laminar + weight update
```
Each branch is its own isolated module. You complete and verify one branch fully before the next branch is even initialized. Intentionally so since this is meant to be designed with the waterflow process in mind.
