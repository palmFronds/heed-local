# Project Research Summary

**Project:** heed-sdk (Branch 2 of the Heed harness)
**Domain:** Embeddable vanilla-JS behavioral-intent SDK with client-side ML inference (signal capture, feedforward net, confidence-gated overlay response)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH

## Executive Summary

heed-sdk sits at the intersection of two well-understood categories: frustration-signal analytics (Hotjar, FullStory) and on-page conversion intervention (exit-intent tooling). It combines their patterns in a way neither category fully does: multi-signal capture feeding a genuine on-device neural net that classifies why a user is hesitating, then fires one of four differentiated responses, with a real (if simple) session-boundary learning loop. Research across stack, features, architecture, and pitfalls converges cleanly and validates that PROJECT.md's Active requirements are already correctly scoped, not under- or over-built relative to category norms. Two stack/architecture decisions that looked ambiguous in CLAUDE.md ("no bundler," "brain.js as the one dependency") have already been resolved and recorded in PROJECT.md's Key Decisions table: esbuild is a dev-only build tool producing one flat sdk.js with zero build step for the partner, and brain.js is used only for training/weight-export while the runtime forward pass is hand-written in sdk.js. This closes the two biggest open questions the stack and architecture research raised.

The recommended approach is a strict, bus-mediated pipeline (signal.js to bus to inference.js to renderer.js, with logger.js as a pure observer) matching the architecture research's convergent industry pattern for embeddable widgets. The inference layer, an explicit W1/b1 to ReLU to W2/b2 to softmax forward pass reading externally-produced weight arrays and never brain.js's run() as a black box, is correctly identified in both PROJECT.md and the architecture/stack research as the conceptual core deserving the deepest planning and execution effort.

The key risks are concentrated in exactly the areas PROJECT.md already calls out as deserving depth: signal-quality bugs that look fine in a happy-path demo but fail under real touch/scroll/SPA-navigation conditions (touch hesitation false-firing on scroll or bounce, MutationObserver double-firing or silent under-attachment after SPA navigation); inference-layer calibration risk (cold-start weights that are directionally correct but produce a saturated or uniform softmax, making the 0.65 confidence gate meaningless); and the structural no-PII payload shape being violated by a well-intentioned "more robust selector" refactor. None of these require new stack or architecture decisions to mitigate; they require specific acceptance criteria (multi-hop navigation tests, softmax-margin verification, movement-displacement cancellation, payload-construction code review) baked into the relevant phases' exit criteria.

## Key Findings

### Recommended Stack

The stack is essentially fixed by CLAUDE.md/PROJECT.md constraints (vanilla JS, brain.js, no framework, single-file output), and both remaining ambiguities have already been resolved and recorded in PROJECT.md: esbuild is a dev-only build tool (never shipped, never a runtime dependency) that concatenates hand-written source with exported/hardcoded weight arrays into one flat sdk.js; brain.js itself is used only for training/weight-export (likely in the local weight-push receiver's Node context or an offline script), never imported into the browser bundle, since the runtime forward pass is fully hand-written. This resolution also solves the payload-size risk the stack research flagged (brain.js's browser bundle is roughly 1.09MB unminified with no official minified build) since the shipped SDK never needs to load that bundle at all.

**Core technologies:**
- brain.js 2.0.0-beta.24 (pin exact version) - training/weight-serialization only, not runtime inference; the one allowed dependency per spec, confirmed safe (CPU-only NeuralNetwork, no gpu.js pull-in) via direct npm/registry inspection
- Vanilla JS, ES2017 target - signal capture, inference glue, overlay rendering; no framework, no runtime bundler dependency
- esbuild 0.28.1 (dev-only) - bundles hand-written source and weight data into the single dist/sdk.js artifact partners drop in via one script tag
- Vitest + happy-dom (not jsdom, which lacks TouchEvent support) - fast unit tests for signal/inference logic
- Playwright - real-browser/device-emulation integration tests against the static test harness, consistent with Branch 3's tooling

### Expected Features

PROJECT.md's Active requirements already constitute a category-validated MVP; research confirms this scope is correct, not over- or under-built.

**Must have (table stakes):**
- All 4 signal types with tuned thresholds (touch hesitation, blur-incomplete, scroll reversal, back intent) - signal diversity avoids false-positive-prone single-signal detection, matching Hotjar/FullStory's multi-signal pattern
- Confidence/severity gating before any response fires - universal category pattern, implemented here via the 0.65 softmax threshold (a stronger version of hand-tuned category norms)
- Non-blocking, dismissable overlay UI - pointer-events:none container with auto on rendered elements
- Session-scoped state only, no persistent cross-session identity - stricter than most category incumbents, correctly matching the no-PII mandate
- Config-driven selector targeting and structured, replayable event logging

**Should have (differentiators, already in scope):**
- Intent classification (4-class softmax), not just friction detection - the genuine category differentiator vs. Hotjar/FullStory's undifferentiated flagging
- Response type mapped 1:1 to inferred cause, not one generic nudge
- On-device learning loop (session-end weight push, not per-event) - matches validated edge-personalization patterns
- Structural (not policy-based) PII avoidance - a materially stronger privacy claim than most session-replay competitors

**Defer (v2+, do not build now):**
- Session-level signal correlation (sequence-aware, multi-signal input) - natural v1.x extension once the single-event net is proven
- Desktop/mouse signal set - explicitly out of mobile-only scope
- Any dashboard/analyst UI - explicitly deferred per CLAUDE.md
- Fabricated urgency/scarcity copy in discount_offer/social_proof - anti-feature; content must come from partner config, never SDK-synthesized (FTC dark-pattern risk)

### Architecture Approach

A strict bus-mediated pipeline where signal.js, inference.js, renderer.js, and logger.js never import each other directly. All communication flows through a single pub/sub bus (EventTarget-based), matching convergent industry practice for embeddable third-party widgets. This makes each layer independently testable (signal.js against the static harness without inference.js existing; inference.js against synthetic vectors without real signals) and enforces the config layer as the single source of truth for data-heed selectors, never hardcoded in logic files.

**Major components:**
1. signal.js - attaches/detaches DOM listeners on config-selected elements, applies timing/threshold logic per signal type, owns SPA re-attachment (MutationObserver + popstate + WeakSet idempotency), emits normalized {type, targetSelector, bbox, timestamp} events
2. bus.js - tiny EventTarget-based pub/sub singleton; the only channel between layers, no signal ever crosses it to the network
3. inference.js - explicit hand-written forward pass (W1/b1 to ReLU to W2/b2 to softmax) reading externally-produced weight arrays, confidence threshold gate, session-end weight update and push; the conceptual core, deserving the deepest planning
4. renderer.js - single overlay div lifecycle, clampToViewport(), the 4 response templates, postMessage for discount fulfillment; never touches host DOM outside its own overlay
5. logger.js - pure bus observer emitting the structured {ts, sessionId, partnerId, event, data} record; the only place console.log is called
6. config.js - schema validation (hard-fail on invalid config) and selector/copy source of truth, read-only after init
7. Weight-push receiver - isolated dev-only local server, decoupled from src/, never bundled into dist/sdk.js

### Critical Pitfalls

1. Touch hesitation timer fires on scroll attempts or iOS elastic bounce - add roughly 8-10px movement-displacement cancellation and clear the timer on touchcancel, not just touchend; test explicitly near scroll boundaries where bounce coincides with touch.
2. MutationObserver + popstate re-attachment double-fires or silently stops attaching after SPA navigation - key the WeakSet idempotency guard on the DOM element itself (not pathname), coalesce observer and popstate firings for one navigation into one re-attachment pass, and don't rely on popstate alone since pushState-driven forward navigation never fires it.
3. Confidence gate is meaningless without verifying cold-start softmax isn't saturated or uniform - after implementing cold-start weights, print the full softmax vector for all 4 canonical signals plus one deliberately ambiguous input; confirm a real margin around 0.65 in both directions, not just "highest class matches intent."
4. targetSelector becomes a PII leak vector if ever computed dynamically - must be read directly from the static data-heed attribute, never via ancestor-walking or content-derived selector fallbacks; audit the logging layer specifically for accidental raw event.target/element.value leaks.
5. Overlay pointer-events isolation implemented backwards or incompletely - none on the container blocks the host page if forgotten; auto must be explicitly set on every individual response element (all 4 types), not assumed inherited; verify both directions (host tappable underneath, response tappable itself) as a stated acceptance criterion.
6. Session-end single-example weight updates (LR 0.01) can drift/collapse confidence over repeated dev sessions - no batching, no replay buffer; run 10-20 synthetic sessions through the local harness and print before/after softmax outputs to confirm no collapse toward uniform or saturated output.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Config Layer, Bus, and Standalone Test Harness
**Rationale:** Everything downstream depends on validated config and a working pub/sub bus; the standalone static-HTML test harness unblocks all signal/inference work without waiting on live Branch 1 (already a recorded decision).
**Delivers:** config.js + config/schema.json + config/demo-platform.json (hard-fail validation), bus.js, test-harness/index.html exposing all 7 locked data-heed selectors, index.js init skeleton.
**Addresses:** Config-driven selector targeting (table stakes); locked selector contract dependency.
**Avoids:** Anti-pattern of hardcoding data-heed selectors in logic files; soft-fail config validation.

### Phase 2: Signal Capture Layer (all 4 signal types)
**Rationale:** Signal quality gates everything downstream - bad signal data poisons cold-start-vs-learned weight comparisons later; must be solid before inference is built on top.
**Delivers:** signal.js with touch hesitation, blur-incomplete, scroll reversal, back-intent, and SPA re-attachment (MutationObserver + popstate + WeakSet).
**Addresses:** All 4 signal types (table stakes), payload PII structural shape.
**Avoids:** Pitfall 1 (touch hesitation false positives), Pitfall 5 (SPA double-firing/missed re-attachment), Pitfall 6 (targetSelector PII leak). Include multi-hop navigation test (3+ hops) and movement-displacement cancellation as explicit exit criteria.

### Phase 3: Inference Layer (forward pass, confidence gate, cold-start weights)
**Rationale:** Explicitly the conceptual core per PROJECT.md and user direction; deserves dedicated, deeper planning separate from the more mechanical signal/response layers.
**Delivers:** inference.js (hand-written W1/b1 to ReLU to W2/b2 to softmax), weights.js (cold-start domain-knowledge arrays), confidence threshold gate (0.65).
**Uses:** brain.js for training/weight-export only (per recorded decision); esbuild bundles the result.
**Implements:** Explicit forward pass reading externally-trained weights; avoids calling run() as a black box.
**Avoids:** Pitfall 7 (softmax saturation/uniformity) - print full softmax vectors for all 4 canonical + 1 ambiguous input as an exit criterion, not a later discovery.

### Phase 4: Response Overlay + Logging Layer
**Rationale:** Depends on inference output shape being settled; renderer is a pure consumer of inference:result.
**Delivers:** renderer.js (overlay div, clampToViewport(), 4 response templates, postMessage with explicit target origin), logger.js (bus-subscriber-only structured logging).
**Addresses:** All 4 response types mapped to intent classes (differentiator); structured event logging (table stakes).
**Avoids:** Pitfall 4 (pointer-events isolation both directions), wildcard postMessage target origin, scattered console.log calls.

### Phase 5: Weight-Push Learning Loop (local receiver + cold-start/learned round-trip)
**Rationale:** Enhances rather than blocks the rest of the pipeline (net functions correctly on cold-start weights alone); correctly sequenced last since it depends on inference.js's weight-update logic and needs the full pipeline in place to generate realistic session outcomes to test against.
**Delivers:** weight-receiver/server.js (validates weight shape before persisting), session-end POST from inference.js, cold-start-vs-learned-weight read path in inference.js init.
**Addresses:** On-device learning loop closes across sessions (differentiator).
**Avoids:** Pitfall 2 (single-bit label credit assignment - document as accepted limitation), Pitfall 3 (LR/weight drift - run 10-20 synthetic noisy sessions as an exit check), unvalidated weight file corrupting subsequent cold-starts.

### Phase 6: Integration Verification Against Live Branch 1
**Rationale:** The true integration gate per PROJECT.md's manual testing sequence; requires Branch 1 gate-passed, tracked as its own phase since it's decoupled from Phases 1-5 by design.
**Delivers:** Verified manual testing sequence end-to-end (signal_detected to inference_run to response_fired log chain, overlay non-blocking, no Screen-1 firing) against a live Branch 1.

### Phase Ordering Rationale

- Config/bus/harness first because every other phase either reads config or needs the harness to test against, and the harness decouples this branch from Branch 1's build status (already a recorded project decision).
- Signal capture before inference because inference correctness is only verifiable against real signal payloads; inference correctness is undermined if input signal quality is already compromised (per Pitfall 1/5/6 mapping to the signal capture phase).
- Inference gets its own phase, separate from signal capture and response rendering, because it's explicitly the conceptual core requiring the deepest planning depth - this matches both PROJECT.md's stated emphasis and the architecture research's separation of a pure/fast predict path from a stateful/infrequent learn path.
- Response rendering and logging after inference because both are pure consumers of inference:result - matches the architecture's one-way dependency chain (signal to bus to inference to renderer/logger).
- Weight-push loop last among the SDK-internal phases because it's an "enhances, not requires" dependency per the feature dependency graph - the net works on cold-start weights alone, so the learning loop can be built and tested once the rest of the pipeline is stable and generating real session data to feed it.
- Live-Branch-1 integration verification is its own final phase because it's gated on external dependency readiness (Branch 1's gate), separate from anything under this branch's own control.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Inference Layer):** Cold-start weight magnitude tuning (not just directional correctness) has no established recipe in the research - needs experimentation/validation during planning, not just implementation. Also confirm brain.js's train() single-example/single-iteration usage matches the intended "one online update at session end" semantics, since misuse could accidentally iterate to convergence on one example.
- **Phase 5 (Weight-Push Learning Loop):** Session-end update behavior under noisy multi-signal sessions (which class to credit) has no settled best practice - research recommends a heuristic (most-proximal signal) but this should be explicitly designed and documented, not assumed.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Config/Bus/Harness):** Config validation and pub/sub bus are well-documented, convergent patterns (EventTarget-based bus, schema hard-fail) with no open questions.
- **Phase 2 (Signal Capture):** Touch/scroll/blur/popstate event handling patterns are well-documented (MDN, WebKit); the specific pitfalls (movement-displacement cancellation, WeakSet keying) are already fully specified in research.
- **Phase 4 (Response Overlay + Logging):** pointer-events isolation and postMessage security patterns are standard, well-documented CSS/DOM behavior with clear correct implementations already identified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | brain.js facts verified directly against npm registry, official README, and direct bundle download; build/testing tooling corroborated by multiple web sources but not primary-doc-verified. Both major ambiguities (bundler, brain.js usage) already resolved in PROJECT.md. |
| Features | MEDIUM | Web-sourced, cross-checked across 2+ independent vendors per claim; no library/API docs involved since this is a market-pattern question, not an API-surface question. |
| Architecture | MEDIUM | No single canonical spec exists for this SDK sub-genre; findings are convergent industry practice cross-referenced across MDN, WebKit, brain.js source, and third-party-widget engineering write-ups. |
| Pitfalls | MEDIUM (LOW for brain.js/small-sample training dynamics specifically) | Cross-checked across multiple independent sources per topic; brain.js-specific API behavior and small-sample continual-learning dynamics have no official "gotchas" doc - reasoning is generalized from feedforward-net and continual-learning literature. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- Cold-start weight magnitude tuning: No source specifies concrete weight values that produce a well-calibrated (not saturated, not uniform) softmax for this exact 4-4-4 architecture - must be worked out empirically during Phase 3 planning/execution with the softmax-margin verification check as the acceptance gate.
- brain.js train() single-update semantics: Unverified whether train() with iterations set to 1 on a single example produces the intended one-step gradient update vs. accidentally iterating to convergence on that one example - needs a direct check against brain.js's source/behavior during Phase 3 or 5 planning, not assumed from the README alone (LOW confidence source area).
- Multi-signal session credit assignment: The "most-proximal signal" heuristic for Phase 5 is a reasonable default but not validated against any real usage data - should be explicitly documented as an accepted limitation in the phase's plan, not silently implemented.
- Shadow DOM vs. plain div for overlay CSS isolation: Architecture research flags plain-div overlay styling as adequate for harness scope but not CSS-cascade-safe for a real partner; PROJECT.md's spec already commits to a plain div, so this is noted as a known v2 consideration, not a v1 gap to resolve now.

## Sources

### Primary (HIGH confidence)
- npm registry API (registry.npmjs.org/brain.js) - direct query, 2026-07-10
- brain.js README (raw GitHub fetch)
- Direct download/inspection of brain.js@2.0.0-beta.24 dist/browser.js and dist/index.js via unpkg
- MDN: MutationObserver, Window popstate event, Window postMessage()
- WebKit blog: Designing Websites for iPhone X (viewport-fit=cover / env(safe-area-inset-*))
- .planning/PROJECT.md (this repo) - authoritative spec all research validates against

### Secondary (MEDIUM confidence)
- Hotjar/FullStory blog and help-center documentation on rage-click/dead-click/frustration-signal detection
- Exit-intent/mobile-popup vendor write-ups (PushOwl, Gleam, Wisepops)
- FTC dark-pattern enforcement coverage (Pandectes, Cookie-Script, XICTRON) - 2026 data
- CSS-Tricks, dev.to, and engineering-blog write-ups on embeddable widget architecture, event-bus patterns, and pointer-events isolation
- Continual/online learning catastrophic-forgetting literature (thesai.org, arXiv) applied generally, not brain.js-specific

### Tertiary (LOW confidence)
- brain.js train() single-example update semantics - inferred from README API surface, not confirmed via source-level behavior testing; flagged as a gap above
- Small-sample/session-end training dynamics for this exact 4-4-4 architecture - generalized from broader neural-net literature, no domain-specific validation

---
*Research completed: 2026-07-10*
*Ready for roadmap: yes*
