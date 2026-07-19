# Phase 5: Weight-Push Learning Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 5-Weight-Push Learning Loop
**Areas discussed:** Cold-start weight pickup, Weight-push transport, Local receiver, Soak-test methodology, Malformed weight file handling

---

## Cold-Start Weight Pickup

| Option | Description | Selected |
|--------|-------------|----------|
| Harness fetches, SDK stays fetch-free | test-harness/index.html's bootstrap script GETs the weights file and injects it into config before calling initDemo(); sdk.js's own network surface stays at exactly the session-end POST | ✓ |
| SDK itself does a GET at init() | sdk.js fetches weightPushUrl (or a sibling GET) as part of init() — adds a second real network call beyond the session-end POST, would require amending CLAUDE.md's hard rule | |
| Receiver writes back into config/demo-platform.json | No new runtime fetch, but "restart the harness" would actually require a rebuild first | |

**User's choice:** Harness fetches, SDK stays fetch-free (recommended option)
**Notes:** Keeps CLAUDE.md's "the only outbound network call is the weight push at session end" literally true — the harness (dev/test tooling) does the cold-start read, not the shipped SDK.

---

## Weight-Push Transport

| Option | Description | Selected |
|--------|-------------|----------|
| fetch() for flow:complete, sendBeacon() for pagehide | Two code paths, each matched to what actually works at that point in the page lifecycle — sendBeacon() survives unload, fetch() doesn't reliably | ✓ |
| sendBeacon() for both paths | One transport everywhere, simpler, but never sees the receiver's response even mid-session | |
| fetch() for both paths | Simplest single implementation, but pagehide/abandoned path may sometimes fail to deliver in real mobile browsers | |

**User's choice:** fetch() for flow:complete, sendBeacon() for pagehide (recommended option)
**Notes:** Extends Phase 4's existing flow:complete/pagehide trigger wiring (D-01/D-02 in 04-CONTEXT.md) with the actual POST call at each.

---

## Local Receiver

| Option | Description | Selected |
|--------|-------------|----------|
| Plain Node http module, local-receiver/server.js | No new dependency — matches project's existing zero-server-framework footprint and "hand-write it, understand every step" ethos | ✓ |
| Express, local-receiver/server.js | Faster to write, but adds the project's first-ever runtime npm dependency outside brain.js | |

**User's choice:** Plain Node http module (recommended option)
**Notes:** package.json currently has only brain.js + build/test tooling as dependencies; a ~40-line http.createServer is well within scope.

---

## Soak-Test Methodology (Success Criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Node script driving inference.js + receiver directly | Calls initInference/endSession N times with varied synthetic signals/outcomes, POSTs through the real receiver, prints softmax margins before/after — mirrors Phase 3's admin/print-softmax-margins.mjs | ✓ |
| Playwright script driving the real harness UI in a loop | Higher-fidelity (exercises full pipeline including real fetch/sendBeacon), but slower and more complex to script reliably in a loop | |

**User's choice:** Node script driving inference.js + receiver directly (recommended option)
**Notes:** Fast, deterministic, no browser needed — same class of check (weight quality over many updates) as Phase 3's cold-start weight validation.

---

## Malformed Weight File Handling (Success Criterion 4)

| Option | Description | Selected |
|--------|-------------|----------|
| Both layers validate independently | Receiver validates on POST and GET, keeps/serves last known-good on failure; harness-side fetch+parse also try/catches and falls back to omitting config.inference.weights entirely, letting the SDK's existing coldStartWeights fallback take over | ✓ |
| Receiver-only validation | Receiver is single source of truth; no second line of defense against a hand-edited or crash-corrupted file on disk | |
| Harness/SDK-side validation only | Receiver persists whatever it's given; all correctness logic lives in one place on the harness side | |

**User's choice:** Both layers validate independently (recommended option)
**Notes:** SC4's wording ("does not crash the receiver OR the SDK's cold-start path") reads as two separate guarantees — belt-and-suspenders satisfies both without either layer trusting the other blindly.

---

## Claude's Discretion

- Exact harness bootstrap script structure (inline script edit vs. small new helper function).
- Receiver port number and npm script name (e.g. `npm run receiver`).
- Persisted weight file's exact path/filename.
- Exact synthetic session generation strategy for the soak-test script — varied signal/outcome combinations, as long as verified via softmax margin before/after.

## Deferred Ideas

- A production weight-push backend, database, or auth for the receiver — out of scope per PROJECT.md/REQUIREMENTS.md; local receiver is dev/test tooling only.
- Express or any other server framework for the receiver — rejected in favor of plain Node http.
- SDK-native (in-sdk.js) cold-start fetching — rejected in favor of harness-side fetching to avoid amending CLAUDE.md's hard rule; worth revisiting if a future real-partner pilot needs the SDK to self-bootstrap without a harness-equivalent wrapper.
