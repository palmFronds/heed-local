# Phase 5: Weight-Push Learning Loop - Research

**Researched:** 2026-07-19
**Domain:** Local Node `http` persistence receiver, browser network transport (`fetch`/`sendBeacon`), atomic file I/O, cold-start config injection
**Confidence:** MEDIUM-HIGH — core mechanics verified against installed package source and Node/browser platform behavior; a few implementation gaps in existing code were found and must be closed by the plan (see Common Pitfalls #1 and #2, which block SC1/SC2 if missed)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Cold-Start Weight Pickup**
- **D-01:** `sdk.js` itself makes **no GET request**. `test-harness/index.html`'s existing inline bootstrap `<script>` (currently "no backend, no fetch") gains a `fetch()` to the receiver's GET endpoint for the persisted weights file, executed **before** calling `window.Heed.initDemo()`, and injects the parsed result into the config object as `config.inference.weights` if present. This keeps `sdk.js`'s own network surface at exactly one call — the session-end weight push — matching CLAUDE.md's "the only outbound network call is the weight push at session end" literally, since the harness (not the shipped SDK) owns the cold-start read. **Rationale:** avoids a hard-rule amendment; the harness is explicitly dev/test tooling, distinct from the SDK a real partner embeds.
- **D-02 (Claude's discretion, guided):** Exact shape of the harness bootstrap change (inline script edit vs. a small new harness-only helper function) is left to planning/execution, as long as D-01's fetch-before-init ordering and fallback behavior (see D-07) are preserved.

**Weight-Push Transport**
- **D-03:** The `flow:complete` path (mid-session, page still alive) POSTs via `fetch()`. The `pagehide`/abandonment path POSTs via `navigator.sendBeacon()` instead — `fetch()` during `pagehide` is unreliable and can be silently dropped as the browser tears down the page; `sendBeacon()` is purpose-built to survive unload. Two code paths, each matched to what actually works at that point in the page lifecycle. This extends Phase 4's existing `flow:complete`/`pagehide` D-01/D-02 trigger wiring — same two entry points, this phase adds the actual POST call at each.

**Local Receiver**
- **D-04:** The receiver is a plain Node `http` module — no Express, no new runtime dependency. Lives at `local-receiver/server.js` (new top-level directory, sibling to `src/`, `admin/`, `test-harness/`). **Rationale:** package.json currently has zero server-framework dependencies (only brain.js + build/test tooling); a ~40-line `http.createServer` handling one POST route and one GET route is well within this project's existing "hand-write it, understand every step" ethos. Exact port number and npm script wiring (e.g. `npm run receiver`) are Claude's discretion at planning time.
- **D-05:** Persisted weight file location, and its `{W1, b1, W2, b2}` shape, deliberately mirrors `admin/weights.js`'s existing export shape — this is exactly what `config.inference.weights` already expects at runtime per Phase 3's `initInference`. Exact filename/path (e.g. `local-receiver/weights.json`) is Claude's discretion.

**Malformed Weight File Handling (SC4)**
- **D-06:** Validation happens at **both** layers, independently:
  - **Receiver-side:** validates POST body shape before ever writing it to disk, and validates the on-disk file's shape before serving it on GET — on failure, keeps/serves the last known-good file rather than crashing or serving garbage.
  - **Harness-side:** the bootstrap fetch (D-01) wraps its fetch+parse in a try/catch; on any failure (network error, bad JSON, unexpected shape), it simply omits `config.inference.weights` from the config object it passes to `init()`, letting the SDK's existing `initInference` fallback (`config.inference?.weights ?? coldStartWeights`, already built and tested in Phase 3 per INF-05) take over unchanged.
  **Rationale:** SC4's wording — "does not crash the receiver or the SDK's cold-start path" — reads as two separate guarantees; belt-and-suspenders satisfies both without either layer trusting the other blindly.
- **D-07:** No new fallback logic needs to be added to `src/inference.js` for this — its existing `activeWeights = config.inference?.weights ?? coldStartWeights` (Phase 3) already does the right thing as long as the harness never passes a malformed `weights` value through, which D-06's harness-side guard ensures.

**Soak-Test Methodology (SC3)**
- **D-08:** Verified via a Node script (in the spirit of `admin/print-softmax-margins.mjs` from Phase 3), not a Playwright loop. The script calls `initInference`/`endSession` directly with varied synthetic signals and outcomes across 10-20 simulated sessions, POSTing each session's updated weights through the real local receiver (so the persistence round-trip is exercised too), and prints softmax margins for the canonical test signals before and after the run. **Rationale:** fast, deterministic, no browser required — mirrors how Phase 3 already validated cold-start weight quality with the same kind of margin-printing script, and this phase's soak test is fundamentally the same class of check (weight quality over many updates) rather than a pipeline-wiring check (which is what Playwright already covers elsewhere).

### Claude's Discretion
- Exact harness bootstrap script structure (D-02).
- Receiver port number and npm script name (D-04).
- Persisted weight file's exact path/filename (D-05).
- Exact synthetic session generation strategy for the soak-test script (D-08) — varied signal/outcome combinations to exercise, as long as results are checked via softmax margin before and after, consistent with Phase 3's established verification style.

### Deferred Ideas (OUT OF SCOPE)
- A production weight-push backend, database, or auth for the receiver — explicitly out of scope per PROJECT.md and REQUIREMENTS.md; the local receiver is dev/test tooling only, Branch 4 (heed-eval) owns real training/eval infrastructure.
- Express or any other server framework for the receiver — considered and rejected in favor of plain Node `http` (D-04) to avoid the project's first non-brain.js runtime dependency.
- SDK-native (in-`sdk.js`) cold-start fetching — considered and rejected in favor of harness-side fetching (D-01) specifically to avoid amending CLAUDE.md's "one outbound call" hard rule; worth revisiting explicitly if a future real-partner pilot needs the SDK to self-bootstrap without a harness-equivalent wrapper.

**Phase boundary (from CONTEXT.md `<domain>`):** This phase does NOT touch `src/inference.js`'s forward pass, confidence gate, or the single gradient-step math (Phase 3, closed) — the one exception explicitly identified by this research is an *additive* `return activeWeights;` statement (Common Pitfall 1 / Architecture Pattern 2), which exposes already-computed state without altering any math. It does NOT change response rendering or logging (Phase 4, closed) beyond wiring the new POST/`sendBeacon()` calls into `src/log.js`'s existing `finishSession()` choke point. It does NOT require a live Branch 1 (Phase 6).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| WEIGHT-01 | Real local weight-push receiver — minimal local server accepts the session-end POST, persists the updated weight array to a local JSON file, and `sdk.js` cold-start reads that file if present (falling back to structured-guess weights otherwise) | Architecture Patterns 1-3 (concrete `initDemo()` override, `endSession()` return-value fix, and full `local-receiver/server.js` implementation); Common Pitfalls 1-5 (the two code gaps that block SC1/SC2, the Content-Type/CORS mechanics behind D-03's transport split, the happy-dom/Vitest real-network hazard, and the `file://` opaque-origin CORS requirement); Validation Architecture's Phase Requirements → Test Map maps each of SC1-SC4 to a concrete test file/command |
</phase_requirements>

## Summary

This phase is pure plumbing around code that already exists and is closed (Phase 3's `endSession`/`initInference`, Phase 4's `flow:complete`/`pagehide` wiring in `src/log.js`). All 8 of CONTEXT.md's decisions are implementation-ready; this research fills in the concrete mechanics those decisions imply, using Node's built-in `http`/`fs` modules and browser-native `fetch`/`navigator.sendBeacon`, with zero new npm dependencies (per D-04).

Two real gaps were found while reading the existing code that the plan must address even though CONTEXT.md scopes them as "not touching `src/inference.js`'s forward pass/gradient math": (1) `endSession()` currently does not return or otherwise expose the updated `activeWeights` object it computes — `src/log.js` has nothing to POST unless this is fixed with a one-line additive return statement; (2) `test-harness/index.html`'s bootstrap calls `window.Heed.initDemo()` with no arguments and no way to inject fetched weights into the config before `init()` runs — `initDemo()` needs a small, additive override parameter. Neither change touches the forward pass, confidence gate, or gradient step; both are pure plumbing consistent with D-07's framing.

The CORS/transport mechanics matter concretely here: `fetch()` with a JSON body triggers a real CORS preflight (OPTIONS) because `application/json` is not a CORS-safelisted content type, while `navigator.sendBeacon()` with a plain string payload defaults to `text/plain` (CORS-safelisted) and skips preflight entirely — this is *why* D-03 splits the two transports, and the receiver must handle both paths' different `Content-Type` headers by always attempting `JSON.parse` on the raw body regardless of what `Content-Type` says. Direct inspection of the installed `happy-dom@20.10.6` package (this project's actual test dependency, not a generic web claim) found that `navigator.sendBeacon` in happy-dom is a thin wrapper around `window.fetch()`, and that Vitest's `happy-dom` test environment wires `globalThis.fetch` to happy-dom's own `Fetch` class — which performs **real outbound network I/O via Node's `http`/`https` modules**, not a stub. Any Vitest test that calls `fetch()`/`sendBeacon()` without mocking will attempt a genuine network call; this is the single most important test-authoring pitfall for this phase.

**Primary recommendation:** Build `local-receiver/server.js` as a ~50-line hand-written `http.createServer` (one `GET /weights`, one `POST /weights`, explicit CORS + OPTIONS handling, byte-capped body parsing, temp-file-then-rename persistence to `local-receiver/weights.json`); add one return statement to `endSession()` and one optional override parameter to `initDemo()`; wire `fetch()`/`sendBeacon()` calls into `src/log.js`'s existing `finishSession()`; and write the soak-test script as `admin/soak-test-weights.mjs`, structurally mirroring `admin/print-softmax-margins.mjs`, run against the real receiver as a two-terminal manual sequence (`npm run receiver` + `npm run soak-test`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cold-start weight GET (pre-init fetch) | Browser / Client (harness bootstrap script) | — | `test-harness/index.html`'s inline `<script>` is client-side JS in the browser; D-01 explicitly forbids this in `sdk.js` itself, so it lives in the harness page's own script, not the SDK bundle |
| Weight-push POST (`flow:complete`) | Browser / Client (`sdk.js` via `src/log.js`) | API / Backend (receiver) | Originates inside the shipped SDK bundle running in the browser; the receiver is the backend endpoint it targets |
| Weight-push beacon (`pagehide`) | Browser / Client (`sdk.js` via `src/log.js`) | API / Backend (receiver) | Same as above, different transport for the unload-teardown window |
| Weight persistence (write) | API / Backend (`local-receiver/server.js`) | Database / Storage (flat JSON file) | The receiver process owns the write; the JSON file is the storage layer, deliberately not a real database per D-04/scope |
| Weight persistence (read on GET) | API / Backend (`local-receiver/server.js`) | Database / Storage | Same receiver process serves what it persisted |
| Malformed-file validation | Split: API/Backend (receiver, on write+serve) AND Browser/Client (harness, on fetch+parse) | — | D-06 is deliberately belt-and-suspenders across both tiers — neither trusts the other |
| Soak-test verification | Dev tooling (Node script, not a runtime tier) | API / Backend (POSTs through the real receiver) | `admin/soak-test-weights.mjs` runs as a standalone Node process exercising the same receiver the browser would, per D-08 |

## Package Legitimacy Audit

**Not applicable this phase.** Per D-04, this phase deliberately introduces **zero new npm dependencies** — `local-receiver/server.js` uses only Node's built-in `http`, `fs`, and `url` modules, and `admin/soak-test-weights.mjs` uses only Node's built-in `fetch` (global since Node 18+; confirmed available — installed Node version is v22.20.0 `[VERIFIED: node --version]`) plus existing project modules (`src/inference.js`). No `npm install` step exists for this phase. If a future phase revisits this decision (e.g., adopting `write-file-atomic` from npm instead of hand-rolling the temp-file-rename pattern), run the Package Legitimacy Gate protocol against it at that time.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-in `http` | Node v22.20.0 (installed, `[VERIFIED: node --version]`) | `local-receiver/server.js` — one GET route, one POST route, manual CORS | D-04 explicitly rejects Express/any new dependency; this project's established ethos (hand-written forward pass, hand-written build purity check) already treats "write it yourself, understand every step" as the default for small surfaces |
| Node.js built-in `fs` | Node v22.20.0 | Read/write `local-receiver/weights.json`, temp-file-then-rename | No new dependency; same reasoning as above |
| Browser `fetch()` | Native (all evergreen browsers + Node 18+) | `flow:complete` weight-push POST; harness's pre-init cold-start GET | Already used nowhere else in this codebase's runtime path (CLAUDE.md's "one outbound call" — this phase is exactly that call), so no existing pattern to diverge from |
| `navigator.sendBeacon()` | Native (all evergreen browsers) | `pagehide` weight-push POST | Purpose-built for the exact unload-teardown reliability problem D-03 identifies; `fetch()` during `pagehide` is well-documented as unreliable/silently-cancelable |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| none | — | — | This phase adds no supporting libraries — see Package Legitimacy Audit above |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `http.createServer` | Express / Fastify / `micro` | Rejected by D-04 — would be this project's first server-framework dependency; a ~50-line hand-written server is well within scope for two routes |
| Hand-rolled temp-file-then-rename | `write-file-atomic` (npm) | Reasonable if the team later wants a hardened, cross-platform-tested implementation; not warranted for v1 given D-04's "hand-write it, understand every step" ethos and the fact this is single-process, low-concurrency dev tooling |
| `sendBeacon()` for `pagehide` | `fetch(url, {keepalive: true})` | `keepalive: true` fetch is a legitimate modern alternative to `sendBeacon()`, but D-03 already locked in `sendBeacon()` specifically — not re-litigated here |

**Installation:** None — no `npm install` required for this phase.

## Architecture Patterns

### System Architecture Diagram

```
 Browser tab: test-harness/index.html (file://)
 ┌───────────────────────────────────────────────────────────────┐
 │ 1. inline bootstrap <script> runs BEFORE init (D-01)           │
 │    fetch(GET http://localhost:PORT/weights)                    │
 │         │  (try/catch — network error, 404, bad JSON all       │
 │         │   fall through silently per D-06 harness-side guard) │
 │         ▼                                                       │
 │    window.Heed.initDemo({ weights })  ──────────────┐          │
 │         │  merges weights into demoConfig.inference   │        │
 │         ▼  before calling init(mergedConfig)          │        │
 │    ┌─────────────────────────────────────────────┐    │        │
 │    │ dist/sdk.js (IIFE bundle)                    │    │        │
 │    │  src/index.js init() ─▶ initInference(config) │◀───┘        │
 │    │    activeWeights = config.inference?.weights  │            │
 │    │                     ?? coldStartWeights (INF-05, unchanged)│
 │    │  ... signal capture → forward pass → response  │           │
 │    │  ... user completes or abandons flow            │          │
 │    │  src/log.js finishSession(outcome, event)       │          │
 │    │    updatedWeights = endSession(config, outcome) │──┐       │
 │    │    (NEW: endSession must return activeWeights)  │  │       │
 │    └───────────────────────────────────────────────┘   │       │
 │                                                           │       │
 │    2a. flow:complete (page alive)                         │      │
 │        fetch(POST http://localhost:PORT/weights, JSON)    │      │
 │    2b. pagehide (teardown, unreliable window)              │     │
 │        navigator.sendBeacon(http://localhost:PORT/weights, │     │
 │                              JSON.stringify(updatedWeights))│─────┘
 └───────────────────────────────────────────────────────────────┘
                              │  cross-origin (file:// → http://localhost:PORT)
                              ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ local-receiver/server.js  (plain node:http, separate process)  │
 │                                                                  │
 │  OPTIONS *  → CORS preflight short-circuit (204, no body)       │
 │  GET /weights  → read local-receiver/weights.json               │
 │                  validate shape → serve JSON, or 404 if absent  │
 │                  or last-known-good if on-disk file is corrupt  │
 │  POST /weights → accumulate body (size-capped) → JSON.parse     │
 │                  validate {W1,b1,W2,b2} shape                   │
 │                  write temp file → fs.renameSync (atomic swap)  │
 │                  malformed body → 400, NEVER crash, NEVER write │
 └───────────────────────────────────────────────────────────────┘
                              │
                              ▼
                 local-receiver/weights.json (flat file, gitignored)
```

### Recommended Project Structure
```
local-receiver/
├── server.js          # http.createServer, GET/POST /weights, CORS, validation, atomic write
└── weights.json        # persisted {W1,b1,W2,b2} — gitignored, created on first successful POST
admin/
└── soak-test-weights.mjs   # D-08 — Node script, POSTs through the real receiver across 10-20 sessions
```

### Pattern 1: `initDemo()` accepts an optional weights override (closes the D-01 gap)
**What:** `test-harness/index.html`'s bootstrap fetch happens *before* `init()`, but the harness has no access to `config/demo-platform.json`'s full shape (it's bundled inside `dist/sdk.js`, not re-exported). The cleanest fix is a small, additive parameter on the existing `initDemo()` export rather than duplicating the config in the harness's own `<script>` tag (which would drift).
**When to use:** This phase's D-01/D-02 harness cold-start injection.
**Example:**
```javascript
// src/index.js — additive change, does not alter init()'s signature or return shape
export function initDemo(overrides) {
  const config = overrides?.weights
    ? { ...demoConfig, inference: { ...demoConfig.inference, weights: overrides.weights } }
    : demoConfig;
  return init(config);
}
```
```html
<!-- test-harness/index.html bootstrap, replacing the current bare initDemo() call -->
<script>
  (async function boot() {
    var overrides = {};
    try {
      var res = await fetch('http://localhost:4310/weights');
      if (res.ok) {
        var weights = await res.json();
        overrides.weights = weights; // shape validated receiver-side; harness still wraps in try/catch (D-06)
      }
    } catch (e) {
      // network error / bad JSON — omit weights, cold-start fallback takes over (D-06/D-07)
    }
    window.Heed.initDemo(overrides);
  })();
</script>
```

### Pattern 2: `endSession()` must expose the weights it just computed (closes the D-01/SC1 gap)
**What:** `src/log.js`'s `finishSession()` calls `endSession(activeConfig, outcome)` today and discards the result — there is currently no way to read the post-update weights. This is a one-line additive change, not a change to the gradient math itself.
**When to use:** Required for SC1 (there is nothing to POST otherwise).
**Example:**
```javascript
// src/inference.js — ADD a return statement, nothing else changes
export function endSession(config, outcome) {
  if (!lastInference) return; // unchanged
  const target = buildTarget(lastInference.predictedIdx, outcome);
  activeWeights = gradientStep(lastInference.input, target, activeWeights, 0.01);
  return activeWeights; // NEW — src/log.js needs this to POST
}
```
```javascript
// src/log.js finishSession() — wire the POST/beacon in alongside the existing endSession() call
function finishSession(outcome, event) {
  if (sessionEnded) return;
  sessionEnded = true;
  writeLog(activeConfig, activeSessionId, event, {});
  const updatedWeights = endSession(activeConfig, outcome);
  if (updatedWeights && activeConfig.weightPushUrl) {
    pushWeights(activeConfig.weightPushUrl, updatedWeights, event === 'flow_abandoned');
  }
}

// Single choke-point for the transport split (D-03), mirrors writeLog()'s
// single-responsibility-function discipline.
function pushWeights(url, weights, useBeacon) {
  const body = JSON.stringify(weights);
  if (useBeacon) {
    navigator.sendBeacon(url, body); // string payload -> text/plain -> no CORS preflight (D-03)
  } else {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    }).catch(() => {}); // best-effort — a failed push must never break the host page (no-PII, no-crash discipline)
  }
}
```

### Pattern 3: Node `http` server — CORS + size-capped POST body + GET-with-fallback
**What:** The minimal correct shape for `local-receiver/server.js`.
**When to use:** D-04's plain-`http` receiver.
**Example:**
```javascript
// local-receiver/server.js — Source: pattern synthesized from Node http docs + MDN CORS docs
// (verification: research-plan seam, websearch provider, cross-checked — MEDIUM confidence)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WEIGHTS_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'weights.json');
const TMP_PATH = `${WEIGHTS_PATH}.tmp`;
const MAX_BODY_BYTES = 64 * 1024; // generous headroom over a 4x4+4x4+4+4 float JSON payload (~1-2KB)

function isValidWeights(w) {
  const isMatrix = (m) => Array.isArray(m) && m.length === 4 && m.every((r) => Array.isArray(r) && r.length === 4 && r.every((x) => typeof x === 'number' && Number.isFinite(x)));
  const isVector = (v) => Array.isArray(v) && v.length === 4 && v.every((x) => typeof x === 'number' && Number.isFinite(x));
  return w && typeof w === 'object' && isMatrix(w.W1) && isVector(w.b1) && isMatrix(w.W2) && isVector(w.b2);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // local dev tooling only — never a production endpoint (PROJECT.md, CLAUDE.md scope)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { // preflight short-circuit — fetch()'s application/json POST triggers this
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/weights') {
    fs.readFile(WEIGHTS_PATH, 'utf8', (err, raw) => {
      if (err) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'no persisted weights yet' })); return; }
      let parsed;
      try { parsed = JSON.parse(raw); } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'corrupt weights file' })); return; }
      if (!isValidWeights(parsed)) { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'invalid weights shape on disk' })); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(raw); // serve the raw bytes already validated, not a re-stringify
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/weights') {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { res.writeHead(413); res.end(); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } // works for BOTH fetch's application/json AND sendBeacon's text/plain body — parse regardless of Content-Type header
      catch { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'malformed JSON' })); return; }
      if (!isValidWeights(body)) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'invalid weights shape' })); return; }
      fs.writeFile(TMP_PATH, JSON.stringify(body), (writeErr) => {
        if (writeErr) { res.writeHead(500); res.end(); return; } // never crash — keep last known-good file untouched
        fs.rename(TMP_PATH, WEIGHTS_PATH, (renameErr) => {
          if (renameErr) { res.writeHead(500); res.end(); return; }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      });
    });
    req.on('error', () => { res.writeHead(400); res.end(); }); // malformed/aborted request stream — never crash the process
    return;
  }

  res.writeHead(404);
  res.end();
});

const PORT = process.env.PORT || 4310;
server.listen(PORT, () => console.log(`[heed-receiver] listening on http://localhost:${PORT}`));
```

### Anti-Patterns to Avoid
- **Trusting `Content-Type` to decide how to parse the POST body:** `sendBeacon()` sends `text/plain` even for a JSON string payload; `fetch()` sends `application/json`. The receiver must attempt `JSON.parse` on the raw body regardless of the header, or the `pagehide` path silently fails to persist.
- **Serving `weights.json` directly via a static file server without shape validation:** SC4 requires the receiver to fall back to the last known-good file on GET if the on-disk file is corrupt — a bare static-file GET would happily serve garbage JSON straight to the harness.
- **Re-implementing the forward pass or gradient step to "test" the weight-push loop:** This phase never touches `src/inference.js`'s math (CONTEXT.md's explicit boundary) beyond the one additive `return activeWeights;` in Pattern 2 above.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-platform atomic rename edge cases (e.g., renaming onto an open file handle on Windows) | A custom lock-file/mutex scheme | `fs.rename()`/`fs.renameSync()` temp-then-swap (already effectively atomic for this project's single-writer, low-concurrency local dev use case) | `write-file-atomic`-style edge cases (permissions, ownership, cross-device renames) are real but out of scope for a single local dev process with one writer (the receiver itself) — do not over-engineer beyond what SC1/SC4 actually require |
| Multipart/streaming JSON body parsing | A custom streaming JSON parser | Buffer the whole body (already size-capped at ~64KB, generous for a ~1-2KB weights payload) then `JSON.parse` once | The payload is small and fixed-shape; streaming parsers solve a problem this project doesn't have |

**Key insight:** Everything in this phase is small, fixed-shape, single-writer, and local-only — the temptation to reach for a "proper" solution (a real database, a lock manager, a streaming parser) should be resisted; it would contradict D-04's explicit "hand-write it, understand every step" framing and add complexity with no corresponding requirement.

## Common Pitfalls

### Pitfall 1: `endSession()` has nothing to POST unless it returns the updated weights (blocks SC1)
**What goes wrong:** `src/log.js`'s `finishSession()` calls `endSession(activeConfig, outcome)` and discards the return value (currently `undefined`) — if the plan wires a POST call using that discarded value, it will POST `undefined`/`null` instead of the actual updated weights, and SC1 ("a session-end weight-update POST is accepted... and persisted") will silently push garbage or nothing at all.
**Why it happens:** `endSession()` was designed in Phase 3, before this phase's requirement to actually transmit its result existed — it correctly mutates the module-scoped `activeWeights` but was never asked to expose it.
**How to avoid:** Add a single `return activeWeights;` as the last line of `endSession()` (see Architecture Pattern 2). This is additive only — it does not change the gradient math CONTEXT.md scopes out of this phase.
**Warning signs:** The receiver logs successful POSTs but `local-receiver/weights.json` never changes value across sessions, or the POST body is literally the string `"null"`.

### Pitfall 2: The harness bootstrap has no path to inject fetched weights into `config.inference.weights` before `init()` runs (blocks SC2)
**What goes wrong:** `test-harness/index.html` currently calls `window.Heed.initDemo()` with zero arguments; `initDemo()` in `src/index.js` currently ignores any argument and always uses the bundled `demoConfig` unmodified. Without a change to `initDemo()`'s signature, D-01's "harness fetches then injects into config before init" has no code path to actually do the injecting.
**Why it happens:** `initDemo()` was designed in Phase 1 purely as a zero-argument convenience wrapper; this phase is the first to need it to accept an override.
**How to avoid:** Add the optional-override parameter shown in Architecture Pattern 1. Keep the change additive (default/no-arg behavior must stay identical, since Phases 1-4's existing Playwright suite calls `initDemo()` with no arguments and must keep passing).
**Warning signs:** Restarting the harness after a persisted weight file exists produces identical `inference:result` probabilities to a completely fresh cold start — the fetched weights were fetched but never reached `initInference`.

### Pitfall 3: `Content-Type` mismatch between `fetch()` and `sendBeacon()` breaks one of the two POST paths
**What goes wrong:** If the receiver's POST handler does `if (req.headers['content-type'] !== 'application/json') reject`, the `pagehide` path (which sends `text/plain` by default when given a plain string) will be rejected outright — SC1 would pass for `flow_complete` sessions but silently fail for every abandoned session.
**Why it happens:** `sendBeacon(url, string)` always sends `text/plain;charset=UTF-8` unless the caller explicitly wraps the payload in a `Blob` with a custom `type` — and doing that would reintroduce the CORS preflight D-03 is specifically trying to avoid during the unreliable `pagehide` window.
**How to avoid:** Never branch on `Content-Type` in the receiver; always attempt `JSON.parse` on the raw accumulated body (see Architecture Pattern 3's POST handler).
**Warning signs:** The soak-test script (D-08), which likely uses `fetch()` directly rather than `sendBeacon()`, would never surface this bug — it would only show up via the real browser `pagehide` path, so this needs an explicit unit or manual test of the `sendBeacon` transport specifically, not just the soak-test's `fetch`-based POSTs.

### Pitfall 4: Vitest + happy-dom `fetch()`/`sendBeacon()` calls hit the real network unless explicitly mocked
**What goes wrong:** `[VERIFIED: happy-dom@20.10.6 source, node_modules/happy-dom/lib/navigator/Navigator.js and lib/fetch/Fetch.js]` — happy-dom's `sendBeacon()` is a thin wrapper around `window.fetch()`, and happy-dom's `Fetch` class performs real network I/O via Node's `http`/`https` modules. Vitest's `happy-dom` environment (this project's configured default per `vitest.config.js`) explicitly wires `globalThis.fetch` to happy-dom's implementation, not Node's native `fetch`. A unit test that calls the real `pushWeights()` function without mocking `fetch`/`sendBeacon` will attempt a genuine outbound HTTP request — slow, flaky if the receiver isn't running, and a CI hazard.
**Why it happens:** This project's existing test suite (`tests/log.test.js`, etc.) has never previously exercised any networking code — Phase 5 is the first phase where `src/log.js` makes an outbound call, so this gap has never surfaced before.
**How to avoid:** Mock `global.fetch`/`navigator.sendBeacon` via `vi.stubGlobal('fetch', vi.fn())` / `vi.stubGlobal('navigator', { sendBeacon: vi.fn() })` (or `vi.spyOn(navigator, 'sendBeacon')`) in every unit test that exercises `finishSession()`/`pushWeights()`. Never let a Vitest unit test hit `local-receiver/server.js` over a real socket — that class of test belongs in Playwright/e2e or the standalone soak-test script instead.
**Warning signs:** Test suite runtime spikes, tests fail only when `local-receiver`'s dev server isn't already running, or tests pass/fail non-deterministically depending on machine network state.

### Pitfall 5: `file://` origin makes every fetch to the receiver cross-origin with an opaque `Origin: null` header
**What goes wrong:** `test-harness/index.html` is opened via a `file://` URL (confirmed: `tests/e2e/harness.spec.js` navigates to `'file://' + path.resolve('test-harness/index.html')`). A `file://` page has an opaque origin, so every `fetch()`/`sendBeacon()` call to `http://localhost:PORT` is cross-origin by definition. If the receiver's CORS headers are missing or scoped incorrectly (e.g., requiring `credentials: 'include'` support, which wildcard origins cannot combine with), the browser will silently block the response even though the receiver processed the request correctly server-side.
**Why it happens:** This project's response layer already hit this exact class of bug in Phase 4 (`response.js`'s `postMessage` to `window.parent` is documented as non-functional under `file://`'s opaque origin) — this is the same root cause applied to a new surface.
**How to avoid:** Use `Access-Control-Allow-Origin: *` (not a specific origin string) since the caller's origin is opaque `null`; never send `Access-Control-Allow-Credentials: true` (incompatible with a wildcard origin, and unnecessary — no cookies/credentials are ever sent per CLAUDE.md's No-PII rule anyway).
**Warning signs:** The POST/GET appears to succeed in the receiver's own console logs, but the harness page's `fetch()` promise rejects with a generic `TypeError: Failed to fetch` and no further detail (opaque-origin CORS failures are famously underinformative in browser devtools).

## Code Examples

Verified patterns from installed-package inspection and platform documentation:

### Reading the exact `{W1, b1, W2, b2}` shape the persisted file must match
```javascript
// Source: direct read of admin/weights.js (this repo, Phase 3 output) — [VERIFIED: codebase inspection]
// W1: number[4][4], b1: number[4], W2: number[4][4], b2: number[4] — plain arrays, no typed arrays,
// no nesting beyond 2 levels. src/inference.js's validateWeightsShape() (already implemented, Phase 3)
// enforces exactly this shape on any config-injected weights object — the receiver's own validation
// (isValidWeights in Architecture Pattern 3) should mirror it exactly so a shape that passes the
// receiver's GET also always passes the SDK's own validateWeightsShape() downstream.
export default {
  "W1": [[0.27, 0.43, -0.05, -0.32], [-0.20, -0.22, 0.75, -0.22], [-0.21, -0.23, 0.21, 0.92], [-0.51, 0.79, 0.13, -0.20]],
  "b1": [0.32, 0.22, 0.23, 0.51],
  "W2": [[0.46, -0.21, -0.38, -0.79], [0.06, 0.73, 0.09, 0.04], [-0.37, -0.35, 0.77, -0.30], [0.38, -0.23, -0.47, 0.67]],
  "b2": [0.69, 0.00, 0.21, -0.17]
};
```
Note: `admin/weights.js` is an ES module (`export default {...}`); `local-receiver/weights.json` must be the **raw JSON object only** (no `export default` wrapper) — it is read with `fs.readFile` + `JSON.parse`/served raw, and fetched with `res.json()` in the browser, never `import`ed as a module.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `fetch()` for all unload-time beacon-style calls | `navigator.sendBeacon()` (or `fetch(url, {keepalive:true})`) for unload/teardown | Long-standing (Beacon API is a mature, widely-supported W3C spec) | This phase correctly follows current best practice via D-03 — no drift to flag |

**Deprecated/outdated:** None identified — all APIs used in this phase (`http.createServer`, `fetch`, `navigator.sendBeacon`, `fs.renameSync`) are current, stable, non-deprecated platform/runtime primitives.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Receiver port `4310` and route path `/weights` (single path, GET+POST differentiated by method) as the concrete defaults | Architecture Patterns, Code Examples | Low — D-04/D-05 explicitly leave exact port/path to Claude's discretion; any consistent choice satisfies the decisions. Flagging only because a specific number had to be picked for the code examples to be concrete. |
| A2 | `initDemo(overrides)` (Pattern 1) is the right shape for injecting fetched weights, vs. duplicating `demoConfig` inline in `test-harness/index.html` | Architecture Pattern 1 | Medium — if the planner prefers the harness to own a full duplicate config copy instead (D-02's discretion explicitly allows either), the plan should pick one and document it; duplicating risks config drift between `config/demo-platform.json` and the harness's inline copy |
| A3 | `weightPushUrl` should be OPTIONAL in `config/schema.json` (not added to the `required` array), and `src/log.js`'s push call should no-op gracefully when absent | Architecture Pattern 2 | Low-Medium — if a real partner config omits `weightPushUrl`, the SDK should not hard-fail (CFG-02 hard-fails on *invalid* shape, not on an intentionally-absent optional field); worth confirming this reading against `config/schema.json`'s existing `properties`-without-`required` pattern (e.g. `activeScreens`, `responses` are already optional this way) |
| A4 | The receiver's max POST body size cap of 64KB is a reasonable, generous ceiling for a ~1-2KB `{W1,b1,W2,b2}` payload | Architecture Pattern 3 | Low — chosen for consistency with `sendBeacon`'s own 64KiB hard limit (a coincidental but convenient shared ceiling), not because the payload is anywhere near that size |

**If this table is empty:** N/A — see rows above. All are discretion-space defaults (D-02/D-04/D-05 explicitly delegate these choices to planning), not disputed factual claims.

## Open Questions

1. **STATE.md's "multi-signal session credit assignment" research flag — is it in scope for Phase 5?**
   - What we know: STATE.md carries forward a note: *"Research flag for Phase 5 planning: multi-signal session credit assignment ('most-proximal signal' heuristic) is a reasonable default but unvalidated — should be documented as an accepted limitation, not silently implemented."* Reading `src/inference.js` directly shows this heuristic (`lastInference` tracks only the most recent signal; `endSession`/`buildTarget` reinforce/soften based on that single most-recent prediction) is **already implemented and already documented** — it is exactly Assumption A1 from `03-RESEARCH.md`, called out explicitly in STATE.md's own Phase 3 decision log (`"[Phase 03] buildTarget implements 03-RESEARCH.md Assumption A1 verbatim: one-hot reinforcement of predicted class on session abandonment..."`).
   - What's unclear: Whether this STATE.md note was ever formally closed out when Phase 3 completed, or whether it's a stale carry-over that never got cleaned up.
   - Recommendation: **This is a stale Phase 3 carry-over, not live Phase 5 scope.** CONTEXT.md is explicit that Phase 5 does not touch `src/inference.js`'s forward pass, confidence gate, or gradient math — the credit-assignment heuristic lives entirely inside that boundary and was already implemented, tested, and accepted in Phase 3. The plan does not need a task for this; STATE.md's note should simply be marked resolved/superseded when Phase 5 closes, referencing this finding.

2. **How should SC2 ("restarting the test harness ... causes `sdk.js` to load those learned weights") actually be verified, given the harness has no exposed debug hook for the currently-active weights?**
   - What we know: `inference:result` bus events already carry `probs`/`confidence`/`intent` for every fired signal — comparing the `probs` vector for a canonical signal (e.g. `touch_hesitation`) before persistence exists vs. after a restart with persisted weights would prove the injection worked, without needing a new exported getter.
   - What's unclear: Whether this should be a Playwright e2e test (real page reload, real persisted file, assert on `#log`'s `inference:result`... but `log.js` only logs a curated `{intent, confidence, fires}` subset per 04-UI-SPEC.md's Logging Contract, not the full `probs` vector) or whether the debug panel needs an additive raw `inference:result` subscription for this phase's own verification purposes.
   - Recommendation: Plan should decide whether to (a) extend the debug panel's existing `signal:detected` bus subscription to also log full `inference:result` payloads (additive, low-risk, mirrors the existing debug-panel pattern), or (b) verify SC2 exclusively via the Node-side soak-test script's `forwardPass()` comparison instead of a real-browser Playwright check. Either is defensible; the plan should pick one explicitly rather than leaving it implicit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `local-receiver/server.js`, `admin/soak-test-weights.mjs` | ✓ | v22.20.0 `[VERIFIED: node --version]` | — |
| npm | `npm run receiver` / `npm run soak-test` script wiring | ✓ | 10.9.3 `[VERIFIED: npm --version]` | — |
| Browser `fetch`/`navigator.sendBeacon` | `src/log.js`, harness bootstrap | ✓ (native, all evergreen browsers + this project's Playwright/Chromium test target) | — | — |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — this phase has no external service dependencies beyond the receiver process this phase itself builds.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.10 (`environment: 'happy-dom'` default) + Playwright 1.61.1 (real-browser e2e) |
| Config file | `vitest.config.js` (default happy-dom env); `playwright.config.js` (390px mobile viewport, no `webServer` block — `file://` navigation) |
| Quick run command | `npx vitest run tests/local-receiver.test.js` (proposed new file) |
| Full suite command | `npm test` (Vitest) + `npx playwright test` (separate command, matches existing project convention — no combined script exists yet) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEIGHT-01 (SC1) | POST accepted by receiver, persisted to local JSON file | unit (Node environment, direct request against the server via `http.request`/`fetch` to a test-bound port) | `npx vitest run tests/local-receiver.test.js -t "POST persists"` | ❌ Wave 0 |
| WEIGHT-01 (SC1) | `endSession()` returns the updated weights (Pitfall 1's fix) | unit | `npx vitest run tests/inference-endsession.test.js -t "returns"` | ❌ Wave 0 (extend existing file) |
| WEIGHT-01 (SC2) | `initDemo(overrides)` injects weights into config before `init()` (Pitfall 2's fix) | unit | `npx vitest run tests/index.test.js -t "initDemo override"` | ❌ Wave 0 (extend existing file) |
| WEIGHT-01 (SC2) | Restart loads persisted weights over a real page reload | e2e (Playwright) or Node soak-test comparison (planner's choice — see Open Question #2) | `npx playwright test tests/e2e/harness.spec.js -g "learned weights"` OR `node admin/soak-test-weights.mjs` | ❌ Wave 0 |
| WEIGHT-01 (SC3) | 10-20 session soak test doesn't collapse/saturate softmax | manual-only script gate (D-08, mirrors `admin/print-softmax-margins.mjs`'s existing non-Vitest precedent) | `node admin/soak-test-weights.mjs` | ❌ Wave 0 |
| WEIGHT-01 (SC4) | Malformed POST body → receiver responds 400, does not crash, does not write | unit | `npx vitest run tests/local-receiver.test.js -t "malformed POST"` | ❌ Wave 0 |
| WEIGHT-01 (SC4) | Corrupt on-disk file → receiver serves last known-good on GET, does not crash | unit | `npx vitest run tests/local-receiver.test.js -t "corrupt file"` | ❌ Wave 0 |
| WEIGHT-01 (SC4) | Harness fetch failure (network/bad JSON/bad shape) → falls back to cold-start, no crash | unit | `npx vitest run tests/index.test.js -t "cold-start fallback"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/local-receiver.test.js tests/inference-endsession.test.js tests/index.test.js`
- **Per wave merge:** `npm test` (full Vitest suite) + `npx playwright test` (full e2e suite)
- **Phase gate:** Full suite green (Vitest + Playwright) plus a successful `node admin/soak-test-weights.mjs` run before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/local-receiver.test.js` — new file, covers WEIGHT-01 SC1/SC4 receiver-side behavior. **Must use `// @vitest-environment node`** (per-file override) rather than the project default `happy-dom`, to avoid Pitfall 4's real-network-call hazard and to get Node's real `http`/`fs` semantics rather than happy-dom's browser-shimmed globals.
- [ ] `admin/soak-test-weights.mjs` — new file, D-08's soak-test script, structurally mirrors `admin/print-softmax-margins.mjs`. Not a Vitest test — a standalone Node script run manually/in CI as a script gate.
- [ ] Extend `tests/inference-endsession.test.js` — add a case asserting `endSession()`'s return value equals the new `activeWeights` (Pitfall 1).
- [ ] Extend `tests/index.test.js` — add cases for `initDemo(overrides)` injecting `config.inference.weights` before `init()` runs, and for `initDemo()`'s existing zero-argument call signature remaining unchanged (regression guard against Phases 1-4's existing Playwright suite, which calls it bare).
- [ ] All new `fetch`/`sendBeacon`-touching unit tests must mock the global via `vi.stubGlobal` (Pitfall 4) — no exception.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Explicitly out of scope — local dev/test receiver only, never a production endpoint (PROJECT.md, REQUIREMENTS.md Out of Scope table) |
| V3 Session Management | No | No session/cookie state on the receiver; `sessionId` is the SDK's own internal concept, unrelated to receiver auth |
| V4 Access Control | No | Single local process, single trusted developer machine — no multi-tenant access control surface |
| V5 Input Validation | Yes | Hand-written `isValidWeights()` shape validator (Architecture Pattern 3) on every POST body before write, and on every on-disk read before serving (D-06) |
| V6 Cryptography | No | No secrets, no cryptographic operations anywhere in this phase's surface |
| V12 File and Resources (not in the default V-list above, flagged anyway given this phase's file-write surface) | Yes | Fixed, hard-coded local file path (`local-receiver/weights.json`) — never derived from request input, so no path-traversal surface exists by construction |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Malicious/malformed POST body crashing the receiver process | Denial of Service | Byte-capped body accumulation (Pitfall-avoidance, Architecture Pattern 3's `MAX_BODY_BYTES`) + `try/catch` around every `JSON.parse` + `req.on('error', ...)` handler — never let an unhandled exception reach the process |
| Corrupt/tampered on-disk `weights.json` silently poisoning cold-start inference with NaN-producing weights | Tampering | Receiver re-validates the on-disk file's shape on every GET (D-06) — never trusts its own prior write blindly; SDK's existing `validateWeightsShape()` (Phase 3) is a second independent check on the harness side |
| `Access-Control-Allow-Origin: *` technically permits **any** web page open in the same browser (not just the intentional harness) to POST to `localhost:4310` while the receiver is running | Spoofing / cross-site request | Accepted risk, explicitly scoped as local-dev-only tooling (matches CLAUDE.md's "no production CDN endpoint" framing for this receiver) — flagged here for completeness, not a blocking finding; do not carry this CORS posture forward into any future production weight-push design |
| Oversized POST payload exhausting receiver memory | Denial of Service | `MAX_BODY_BYTES` cap + `req.destroy()` on overflow (Architecture Pattern 3) |

## Sources

### Primary (HIGH confidence)
- Direct inspection of `node_modules/happy-dom/lib/navigator/Navigator.js` and `node_modules/happy-dom/lib/fetch/Fetch.js` (installed version 20.10.6, this project's actual test dependency) — confirms `sendBeacon()` delegates to `window.fetch()`, and happy-dom's `Fetch` performs real network I/O via Node `http`/`https`.
- Direct inspection of `node_modules/vitest/dist/chunks/index.DC7d2Pf8.js` (installed Vitest, this project's actual test runner) — confirms the `happy-dom` environment's `populateGlobal` call includes `"fetch"` in its `additionalKeys` override list, so `globalThis.fetch` resolves to happy-dom's implementation under `environment: 'happy-dom'`.
- Direct read of this repo's own `src/inference.js`, `src/log.js`, `src/index.js`, `admin/weights.js`, `admin/print-softmax-margins.mjs`, `config/schema.json`, `config/demo-platform.json`, `test-harness/index.html`, `tests/log.test.js`, `tests/e2e/harness.spec.js`, `vitest.config.js`, `playwright.config.js`, `package.json` — all code-shape claims in this document (weight shape, existing fallback chain, existing bootstrap script, `file://` navigation, test conventions, npm script naming) are sourced from these files directly, not from training-data assumption.
- `branch spec files/repo2_heed_sdk.txt` (this project's own spec source) — confirms `weightPushUrl` config field naming and "posts to weightPushUrl" framing verbatim.
- `node --version` / `npm --version` direct shell invocation — confirmed Node v22.20.0, npm 10.9.3.

### Secondary (MEDIUM confidence)
- WebSearch (cross-checked across 2+ results per claim): Node `http.createServer` POST/GET/CORS/OPTIONS pattern; Node atomic-write temp-file-then-rename pattern; `navigator.sendBeacon()` 64KiB limit, `text/plain` default content-type, CORS-safelisted-header preflight-skip behavior (MDN-sourced via search).

### Tertiary (LOW confidence)
- None — all findings were either verified against installed package/project source directly, or cross-checked across multiple web sources and promoted to MEDIUM.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all platform-native APIs already well-understood and version-confirmed against this project's actual installed Node/npm
- Architecture: MEDIUM-HIGH — the two implementation gaps (Pitfalls 1 and 2) were found via direct source reading, not speculation; the receiver's exact code shape (Pattern 3) is a synthesized-but-standard pattern, cross-checked against web search
- Pitfalls: HIGH for happy-dom/fetch/CORS-origin findings (direct package source inspection); MEDIUM for sendBeacon Content-Type/CORS behavior (web-sourced, cross-checked, matches MDN's documented spec behavior)

**Research date:** 2026-07-19
**Valid until:** 2026-08-18 (30 days — stable platform APIs, no fast-moving dependencies in this phase's surface)
