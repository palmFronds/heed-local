# Phase 5: Weight-Push Learning Loop - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Closes the on-device learning loop across sessions. Phase 3's `endSession(config, outcome)`
already computes an updated `{W1, b1, W2, b2}` weight array in memory and Phase 4 already wires
the exactly-once `flow:complete`/`pagehide` trigger around it — but nothing persists that update
or feeds it back in on the next page load. This phase adds:

1. A weight-push POST from the harness page to a new local receiver at session end.
2. The receiver persisting the pushed weights to a local JSON file (and never crashing on a bad
   POST or a corrupted existing file).
3. The test harness's own bootstrap script fetching that persisted file on page load and injecting
   it into `config.inference.weights` before calling `init()`/`initDemo()` — so a restart of the
   harness after a persisted file exists uses learned weights instead of `admin/weights.js`'s
   cold-start defaults.
4. A repeatable way to verify 10-20 synthetic sessions run back-to-back don't collapse the softmax
   output toward uniform or saturated.

This phase does NOT touch `src/inference.js`'s forward pass, confidence gate, or the single
gradient-step math (Phase 3, closed). It does NOT change response rendering or logging (Phase 4,
closed). It does NOT require a live Branch 1 (Phase 6) — the standalone test harness remains the
test surface, and the receiver is local dev/test tooling only, never a production CDN endpoint.

</domain>

<decisions>
## Implementation Decisions

### Cold-Start Weight Pickup
- **D-01:** `sdk.js` itself makes **no GET request**. `test-harness/index.html`'s existing inline
  bootstrap `<script>` (currently "no backend, no fetch") gains a `fetch()` to the receiver's GET
  endpoint for the persisted weights file, executed **before** calling `window.Heed.initDemo()`, and
  injects the parsed result into the config object as `config.inference.weights` if present. This
  keeps `sdk.js`'s own network surface at exactly one call — the session-end weight push — matching
  CLAUDE.md's "the only outbound network call is the weight push at session end" literally, since
  the harness (not the shipped SDK) owns the cold-start read. **Rationale:** avoids a hard-rule
  amendment; the harness is explicitly dev/test tooling, distinct from the SDK a real partner embeds.
- **D-02 (Claude's discretion, guided):** Exact shape of the harness bootstrap change (inline script
  edit vs. a small new harness-only helper function) is left to planning/execution, as long as D-01's
  fetch-before-init ordering and fallback behavior (see D-07) are preserved.

### Weight-Push Transport
- **D-03:** The `flow:complete` path (mid-session, page still alive) POSTs via `fetch()`. The
  `pagehide`/abandonment path POSTs via `navigator.sendBeacon()` instead — `fetch()` during
  `pagehide` is unreliable and can be silently dropped as the browser tears down the page;
  `sendBeacon()` is purpose-built to survive unload. Two code paths, each matched to what actually
  works at that point in the page lifecycle. This extends Phase 4's existing `flow:complete`/
  `pagehide` D-01/D-02 trigger wiring — same two entry points, this phase adds the actual POST call
  at each.

### Local Receiver
- **D-04:** The receiver is a plain Node `http` module — no Express, no new runtime dependency.
  Lives at `local-receiver/server.js` (new top-level directory, sibling to `src/`, `admin/`,
  `test-harness/`). **Rationale:** package.json currently has zero server-framework dependencies
  (only brain.js + build/test tooling); a ~40-line `http.createServer` handling one POST route and
  one GET route is well within this project's existing "hand-write it, understand every step" ethos
  (same reasoning already applied to the hand-written forward pass and to keeping brain.js out of
  the shipped bundle). Exact port number and npm script wiring (e.g. `npm run receiver`) are Claude's
  discretion at planning time.
- **D-05:** Persisted weight file location, and its `{W1, b1, W2, b2}` shape, deliberately mirrors
  `admin/weights.js`'s existing export shape — this is exactly what `config.inference.weights`
  already expects at runtime per Phase 3's `initInference`. Exact filename/path (e.g.
  `local-receiver/weights.json`) is Claude's discretion.

### Malformed Weight File Handling (SC4)
- **D-06:** Validation happens at **both** layers, independently:
  - **Receiver-side:** validates POST body shape before ever writing it to disk, and validates the
    on-disk file's shape before serving it on GET — on failure, keeps/serves the last known-good
    file rather than crashing or serving garbage.
  - **Harness-side:** the bootstrap fetch (D-01) wraps its fetch+parse in a try/catch; on any
    failure (network error, bad JSON, unexpected shape), it simply omits `config.inference.weights`
    from the config object it passes to `init()`, letting the SDK's existing `initInference`
    fallback (`config.inference?.weights ?? coldStartWeights`, already built and tested in Phase 3
    per INF-05) take over unchanged.
  **Rationale:** SC4's wording — "does not crash the receiver or the SDK's cold-start path" — reads
  as two separate guarantees; belt-and-suspenders satisfies both without either layer trusting the
  other blindly.
- **D-07:** No new fallback logic needs to be added to `src/inference.js` for this — its existing
  `activeWeights = config.inference?.weights ?? coldStartWeights` (Phase 3) already does the right
  thing as long as the harness never passes a malformed `weights` value through, which D-06's
  harness-side guard ensures.

### Soak-Test Methodology (SC3)
- **D-08:** Verified via a Node script (in the spirit of `admin/print-softmax-margins.mjs` from
  Phase 3), not a Playwright loop. The script calls `initInference`/`endSession` directly with
  varied synthetic signals and outcomes across 10-20 simulated sessions, POSTing each session's
  updated weights through the real local receiver (so the persistence round-trip is exercised too),
  and prints softmax margins for the canonical test signals before and after the run.
  **Rationale:** fast, deterministic, no browser required — mirrors how Phase 3 already validated
  cold-start weight quality with the same kind of margin-printing script, and this phase's soak test
  is fundamentally the same class of check (weight quality over many updates) rather than a
  pipeline-wiring check (which is what Playwright already covers elsewhere).

### Claude's Discretion
- Exact harness bootstrap script structure (D-02).
- Receiver port number and npm script name (D-04).
- Persisted weight file's exact path/filename (D-05).
- Exact synthetic session generation strategy for the soak-test script (D-08) — varied
  signal/outcome combinations to exercise, as long as results are checked via softmax margin before
  and after, consistent with Phase 3's established verification style.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 5 Requirement & Spec Source
- `.planning/REQUIREMENTS.md` — WEIGHT-01 (this phase's sole requirement ID).
- `.planning/ROADMAP.md` §"Phase 5: Weight-Push Learning Loop" — the 4 success criteria this phase
  must satisfy (POST accepted + persisted; restart loads learned weights; 10-20 session soak test
  doesn't collapse softmax; malformed file doesn't crash receiver or SDK).
- `branch spec files/repo2_heed_sdk.txt` — "Weight update" section (`weightPushUrl` field,
  "posts to weightPushUrl" framing) and Config layer's key-fields list.
- `.planning/PROJECT.md` — Key Decisions table entry: "Real local weight-push receiver that
  persists and reloads weights ... teaches weight serialization and cold-start-vs-learned-weight
  handling."
- CLAUDE.md — "No external API calls during a session. The only outbound network call is the
  weight push at session end." — the hard rule D-01 is designed to satisfy literally.

### Existing Code (Phases 1-4 output)
- `src/inference.js` — `endSession(config, outcome)` (computes the in-memory weight update this
  phase persists) and `initInference(config)`'s `activeWeights = config.inference?.weights ??
  coldStartWeights` (the existing fallback D-07 relies on unchanged). Read both before implementing.
- `admin/weights.js` — the `{W1, b1, W2, b2}` shape the persisted weight file (D-05) must match.
- `admin/print-softmax-margins.mjs` — the existing margin-printing pattern the soak-test script
  (D-08) should follow structurally.
- `src/index.js` — `initDemo()`, currently loads `config/demo-platform.json` via static ESM import
  with the comment "bundled demo-platform config so the harness needs no backend/fetch to run" —
  this comment becomes inaccurate after D-01 and should be updated during implementation.
- `test-harness/index.html` — the inline bootstrap `<script>` (currently calls
  `window.Heed.initDemo()` directly with the comment "no backend, no fetch") is where D-01's fetch
  gets added.
- `src/log.js` / whichever module owns `flow:complete`/`pagehide` wiring from Phase 4 (D-01/D-02/D-03
  in `04-CONTEXT.md`) — this phase adds the actual POST/`sendBeacon()` call (D-03 above) at those
  same two trigger points, not new trigger detection.
- `config/schema.json` — needs a `weightPushUrl` field added (referenced in the spec's config
  key-fields list but not yet present in the schema); `config/demo-platform.json` needs a concrete
  value pointing at the local receiver.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/inference.js` `endSession()` / `activeWeights` — already produces the exact weight object
  this phase pushes; no inference-layer changes needed, only a caller that POSTs the result.
- `admin/weights.js` — canonical shape reference for the persisted file and the receiver's
  validation logic.
- `admin/print-softmax-margins.mjs` — structural template for the soak-test script (D-08).

### Established Patterns
- Plain named-function exports only, no classes, no default exports (Phase 1-4 convention) —
  applies to any new `local-receiver/` and harness bootstrap code too, even though the receiver is
  Node-side dev tooling, not part of the shipped bundle.
- Single choke-point + why-comment discipline (`bus.js` `publish()`, `signal.js` `buildPayload()`,
  `inference.js`'s payload construction) — the receiver's file-write and file-read points, and the
  harness's config-injection point, should each be a single named function following the same
  discipline.
- Config-injected value wins over bundled default (`config.inference?.weights ?? coldStartWeights`,
  Phase 3 INF-05) — D-01's harness-injected learned weights flow through this exact existing
  mechanism unchanged.

### Integration Points
- `test-harness/index.html` inline script — where D-01's pre-init fetch happens.
- `src/index.js` `initDemo()` — the function receiving the (possibly weight-augmented) config object.
- Whichever module owns Phase 4's `flow:complete`/`pagehide` session-lifecycle wiring — where D-03's
  `fetch()`/`sendBeacon()` calls get added alongside the existing `endSession()` calls.
- `config/schema.json` + `config/demo-platform.json` — need `weightPushUrl` added (schema) and set
  (demo config) to point at the new local receiver.

</code_context>

<specifics>
## Specific Ideas

No specific UI/copy references — this phase is pure plumbing (network I/O, file persistence,
cold-start injection). No visual surface changes; nothing here interacts with `04-UI-SPEC.md`.

</specifics>

<deferred>
## Deferred Ideas

- A production weight-push backend, database, or auth for the receiver — explicitly out of scope
  per PROJECT.md and REQUIREMENTS.md; the local receiver is dev/test tooling only, Branch 4
  (heed-eval) owns real training/eval infrastructure.
- Express or any other server framework for the receiver — considered and rejected in favor of
  plain Node `http` (D-04) to avoid the project's first non-brain.js runtime dependency.
- SDK-native (in-`sdk.js`) cold-start fetching — considered and rejected in favor of harness-side
  fetching (D-01) specifically to avoid amending CLAUDE.md's "one outbound call" hard rule; worth
  revisiting explicitly if a future real-partner pilot needs the SDK to self-bootstrap without a
  harness-equivalent wrapper.

None of the discussion strayed outside Phase 5's scope (weight persistence, push transport,
cold-start pickup, and soak-test verification only — inference math, response rendering, logging,
and live Branch 1 integration remain closed/deferred to their respective phases).

</deferred>

---

*Phase: 5-Weight-Push Learning Loop*
*Context gathered: 2026-07-19*
