# Feature Research

**Domain:** Client-side behavioral-intent-detection / conversion-optimization SDK (hesitation detection → on-device classification → overlay intervention)
**Researched:** 2026-07-10
**Confidence:** MEDIUM (web-sourced, cross-checked across 2+ independent vendors per claim; no library/API docs involved — this is a market/pattern research question, not an API-surface question)

## Feature Landscape

The category this project sits in has two established neighbors: **frustration-signal / session-replay analytics** (Hotjar, FullStory, Microsoft Clarity — detect friction, surface it to a human analyst) and **on-page conversion intervention** (exit-intent popup tools, on-site personalization engines — detect friction, act on it automatically, no human in the loop). Heed is the second category, but pulls its *signal vocabulary* from the first. That distinction matters for what's table stakes here: this research validates against "intervention SDKs," using "analytics SDKs" as the source of proven signal-detection patterns.

### Table Stakes (Users Expect These)

Features already covered by PROJECT.md's requirements are marked ✓; gaps are marked with a note.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Multiple independent signal types, not one | Every frustration-detection product in the category (Hotjar: rage click, dead click, U-turn, excessive scroll; FullStory: Rage Click, Dead Click, Error Click, Thrashed Cursor) ships 3-4+ distinct signal types because no single behavior reliably means "friction" — they triangulate. Heed's 4 signals (touch hesitation, blur-incomplete, scroll reversal, back intent) matches this pattern in kind and count. | MEDIUM | ✓ Already in PROJECT.md. This is correctly scoped, not over-scoped — cutting to 1-2 signal types would be *below* category norm. |
| Threshold/debounce tuning on every signal, not raw event firing | Hotjar's rage click is not "any repeated click" — it's a tuned threshold (5 clicks/500ms). Untuned raw-event signals are noisy and produce false positives that erode trust in the product fast. | LOW | ✓ PROJECT.md has this for touch hesitation (800ms vs <300ms) and scroll reversal (40% depth threshold). Confirms these are the right kind of parameter, not scope creep. |
| Confidence/severity gating before any user-facing action fires | Category-wide pattern: FullStory's Ragehooks and every popup tool gate on *combined* signals or thresholds before acting, specifically because a single ambiguous signal firing an intervention is worse than missing one — it interrupts a user who wasn't actually confused. | LOW-MEDIUM | ✓ PROJECT.md's 0.65 confidence threshold gate on the softmax output is exactly this pattern, implemented via model output rather than a hand-tuned combination rule — a stronger version of the category norm. |
| Combining/correlating signals rather than acting on one in isolation | Mobile exit-intent tooling explicitly recommends 2+ signals combined (e.g., scroll-depth-passed AND idle) because single mobile signals are noisier than desktop cursor-exit tracking — there's no mobile equivalent of "mouse leaves viewport top." | MEDIUM | Worth flagging: Heed's inference net takes a *single* signal event as input per forward pass (per the 4-node input layer mapping to signal type + geometry/timing features), not a rolling window of multiple recent signals. This is a reasonable v1 simplification given the "prove the net is real" emphasis, but the category norm suggests session-level signal correlation (e.g., "hesitation THEN scroll reversal in the same session") is where real products go next — see Differentiators. |
| Non-blocking, dismissable intervention UI | Universal in the intervention category — a popup or overlay that traps the user or can't be dismissed is treated as a bug/dark-pattern, not a feature. | LOW | ✓ PROJECT.md's `pointer-events: none` container with `auto` only on rendered elements, plus explicit `response_dismissed` log event, matches this. |
| Session-scoped state, not persistent user tracking | Frustration/intervention tools operate per-session by default; persistent cross-session user profiles are an opt-in enterprise feature, not baseline. | LOW | ✓ Matches Heed's `sessionId`-scoped logging and no-cookie/no-localStorage constraint — this is actually *stricter* than most category incumbents (which do use cookies for session stitching), which is appropriate given the explicit no-PII mandate. |
| Config-driven targeting (which elements/selectors trigger which signals) | Every tool in this space (Hotjar heatmap exclusions, FullStory's "prevent element from being classified as rage/dead click," popup trigger builders) exposes an allowlist/denylist config layer so the same SDK generalizes across host pages without code changes. | MEDIUM | ✓ PROJECT.md's `config/schema.json` + per-partner config JSON targeting `data-heed` selectors matches this pattern precisely — this is the right architecture, not gold-plating. |
| Structured, replayable event log | Every analytics/intervention SDK emits a structured event stream (signal → decision → action → outcome) so behavior is debuggable and auditable after the fact. | LOW | ✓ PROJECT.md's `{ ts, sessionId, partnerId, event, data }` log with the `signal_detected → inference_run → response_fired → response_dismissed → flow_complete/flow_abandoned` lifecycle is squarely table stakes and well-specified. |

### Differentiators (Competitive Advantage)

Heed's core value proposition, per PROJECT.md, is a genuine on-device neural net (not a rules engine) that classifies *intent type*, not just "friction detected." These are the features that would separate it from category incumbents if pushed further — useful context for what's *appropriately* differentiating in v1 vs. what's a v2 idea.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Intent *classification*, not just friction *detection* | Hotjar/FullStory tell you "something went wrong here" (rage click, dead click) but not *why* — the human analyst infers cause from the replay. Heed's 4-class softmax (confusion / price_doubt / trust_gap / flow_friction) closes that inference gap automatically, in real time, without a human. This is the genuine differentiator in the category — most competitors stop at signal detection. | HIGH | ✓ Correctly the "conceptual core" per PROJECT.md's own framing. This is the right thing to invest the deepest planning/execution effort in — validates the project's stated emphasis. |
| Response *type* mapped to inferred cause, not one generic nudge | Category incumbents that do intervene (exit-intent tools, on-site personalization) mostly fire one generic response type (a popup, a discount). Heed maps 4 distinct response types to 4 distinct inferred causes (tooltip for confusion, nudge_copy for flow_friction, discount_offer for price_doubt, social_proof for trust_gap) — a much finer-grained action taxonomy than typical. | MEDIUM | ✓ In PROJECT.md. Reasonable differentiator; keep the mapping tight (each response type should correspond 1:1 to the class it's cold-start-wired to, which the spec already does). |
| On-device learning that improves over time (not just static cold-start rules) | On-device personalization research confirms the category-standard pattern is: lightweight local model + periodic model-improvement sync, *not* raw data leaving the device. Heed's session-end weight push (not per-event) matches this exactly and is architecturally sound relative to how real edge-personalization systems work. | HIGH | ✓ In PROJECT.md, and validated by research as the correct shape (local inference + infrequent aggregate sync), not a naive approach. |
| Structural (not policy-based) PII avoidance | Session-replay/PII research is unambiguous: masking-after-capture is weaker than a payload that *cannot* structurally contain PII. Heed's bbox+timestamp-only payload shape is the stronger of the two approaches used in the category — most competitors mask field values after capturing them; Heed never captures them. | LOW (given the constraint is already load-bearing in the architecture) | Worth stating explicitly in product framing / to a partner evaluating Heed: "we don't redact PII, we never have it" is a materially stronger privacy claim than what most session-replay vendors can say, and is a genuine differentiator worth surfacing beyond just an internal engineering constraint. |
| Session-level signal correlation (sequence-aware, not single-event) | Not in scope for v1 per PROJECT.md (4-node input is a single signal event), but this is the clear "v1.x" direction once the single-event net is proven: e.g. hesitation immediately followed by scroll-reversal is a stronger trust_gap/price_doubt signal than either alone, mirroring how mobile exit-intent tooling combines signals for reliability. | HIGH | Flag for roadmap: do not build this in v1 (the spec is explicit that inference-layer depth on the *single-event* net is the priority), but note it as the natural v1.x extension once the basic net + weight-push loop is validated. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Fabricated urgency/scarcity in `discount_offer` and `nudge_copy` copy (fake countdown timers, "3 people are viewing this," inflated claims) | Feels like it should lift conversion — common in the exit-intent/discount-popup vendor ecosystem and easy to bolt onto a config-driven copy layer | FTC dark-pattern enforcement (2024-2026 data: 75.7% of audited sites use at least one dark pattern) explicitly targets false urgency and confirmshaming as illegal/actionable; this is a legal and trust liability, not just a UX nitpick, and would undermine the entire "reduce abandonment through genuine assistance" premise | Config schema for `discount_offer`/`social_proof` response types should require real, partner-supplied values (an actual discount code, actual review counts) — never SDK-fabricated numbers. `social_proof` content should come from partner config, not be synthesized. Decline/dismiss copy should stay neutral ("No thanks" / "×"), never shaming. |
| Session replay / full DOM recording alongside the signal bus | Natural "while we're capturing behavior anyway" scope creep — Hotjar/FullStory's core product *is* session replay, so it's the obvious "more data = more useful" instinct | Directly violates the hard no-PII / no-field-value constraint and the "signal payloads are bbox+timestamp only" architecture; DOM recording captures exactly the field values and identity signals this project is designed to structurally exclude | Stay with geometry/timing-only signal payloads; if a partner wants replay-level debugging, that's a different (out-of-scope) product, not a Heed feature |
| Cross-session / cross-device user profiles for "smarter" personalization | Would make weight-learning converge faster per-user and feels like standard personalization-engine practice (e.g. e-commerce recommendation engines) | Requires persistent identity (cookies, device fingerprinting, or account linking) — directly conflicts with "no cookies, no localStorage reads, no user identity" hard constraint; also expands scope into exactly the "multi-partner system" territory CLAUDE.md flags as explicitly deferred | Keep learning session-scoped; the session-end weight push already provides cross-*session* (not cross-*user*) improvement at the aggregate-model level, which is the correct scope boundary |
| A dashboard / analyst UI for reviewing fired signals and outcomes | Every competitor in the analytics half of this category (Hotjar, FullStory) leads with a dashboard, so it feels like an obvious "of course we need this too" | Explicitly out of scope per CLAUDE.md ("if a task implies building a dashboard... stop") and PROJECT.md's Out of Scope section; also not needed to prove the inference layer works — the structured console.log stream is sufficient for this branch's goals | `console.log('[heed]', JSON.stringify(entry))` structured logging is the correct-for-this-branch substitute; a dashboard is legitimately a later-branch or later-product concern |
| Server-side / cloud inference fallback "for accuracy" | Reasonable-sounding hedge — bigger models on a server could out-classify a tiny 4-4-4 net | Defeats the entire premise: research confirms server round-trip latency (100ms+) is incompatible with a sub-second-to-few-second hesitation window: this is *why* on-device inference is the correct architecture, not an accuracy tradeoff to reconsider. Any external API call during a session is also a hard constraint violation. | Trust the small on-device net; if classification accuracy is a real concern later, invest in better cold-start weights or session-level feature engineering (see differentiator above), not a network round-trip |
| Desktop mouse-based signals (cursor thrashing, hover-based dead clicks) ported in for "completeness" | FullStory's Thrashed Cursor and hover-based frustration signals are proven category patterns, so it's tempting to add mouse equivalents alongside the touch signals | Explicitly out of scope — PROJECT.md's constraint is mobile-only, touch-events-only, 390px viewport with iOS safe-area insets; adding mouse/hover handling doubles signal-layer surface area for a platform this product isn't targeting | If/when a desktop variant is ever considered, treat it as a separate config/signal-set addition later, not a v1 requirement |

## Feature Dependencies

```
Signal capture (4 types)
    └──requires──> Event bus (signal.js -> inference.js)
                       └──requires──> Inference net (forward pass + confidence gate)
                                          └──requires──> Response overlay (4 types)
                                                             └──enhances──> Weight-push learning loop (session-end)

Config layer (schema + per-partner targeting)
    └──requires──> Locked data-heed selector contract (CONTRACT.md)

SPA re-attachment (MutationObserver + popstate)
    └──enhances──> Signal capture (keeps it working across client-side navigation)

Cold-start domain-knowledge weights
    └──enhances──> Inference net (bootstraps useful classification before any learning has occurred)
    └──conflicts with──> Persistent cross-session/cross-user weight state stored client-side (would reintroduce identity-adjacent persistence; the spec correctly routes this through the local weight-push receiver instead, not localStorage)

Structural no-PII payload shape (bbox+timestamp only)
    └──conflicts with──> Session replay / DOM recording (anti-feature)
    └──conflicts with──> Cross-session user profiles (anti-feature)
```

### Dependency Notes

- **Response overlay requires Inference net requires Event bus requires Signal capture:** this is a strict linear pipeline per session-event — matches PROJECT.md's phase emphasis on inference depth, since everything downstream of it (response selection) is gated by its output.
- **Weight-push learning loop enhances (not requires) the rest of the pipeline:** the net functions correctly with cold-start weights alone; the learning loop is a session-boundary enhancement, not a blocking dependency — correctly reflected in PROJECT.md treating it as a separate requirement from the forward-pass implementation.
- **Cold-start weights conflict with any persistent client-side storage of learned state:** the spec's local weight-push receiver (server-side file, not browser storage) is the correct way to resolve this — it closes the learning loop without violating the no-localStorage constraint.
- **Structural no-PII payload shape conflicts with both major anti-features above (session replay, cross-session profiles):** this is the load-bearing architectural choice that keeps the whole product in-bounds; any future feature request that would require capturing field values or persistent identity should be checked against this dependency first.

## MVP Definition

PROJECT.md's Active requirements already constitute a well-scoped MVP; mapped here for confirmation against category norms rather than to propose changes.

### Launch With (v1)

- [ ] All 4 signal types (touch hesitation, blur incomplete, scroll reversal, back intent) — category pattern requires signal diversity to avoid false-positive-prone single-signal detection
- [ ] 2-layer feedforward net with real forward pass (not a lookup table) — the stated differentiator; must be genuine to deliver the project's core value
- [ ] Confidence threshold gate before any response fires — matches category-wide "don't act on ambiguous signals" norm
- [ ] All 4 response types (tooltip, nudge_copy, discount_offer, social_proof) mapped to the 4 intent classes — the finer-grained-response differentiator
- [ ] Structural no-PII payload (bbox + timestamp only) — the strongest-in-category privacy posture; must not be diluted
- [ ] Config-driven selector targeting — required for the SDK to generalize beyond the dummy platform
- [ ] Structured event logging across the full lifecycle — required for debuggability and to prove signal→inference→response wiring works
- [ ] Session-end weight push with cold-start fallback — closes the learning loop, the second half of the "genuine ML, not a rules engine" claim

### Add After Validation (v1.x)

- [ ] Session-level signal correlation (sequence-aware input, not single-event) — natural next step once the single-event net is proven; mirrors how mature exit-intent tooling combines multiple signals for reliability
- [ ] Richer cold-start weight tuning informed by real session data collected via the weight-push receiver
- [ ] Additional response-type/intent-class pairs if real usage reveals gaps in the 4x4 mapping

### Future Consideration (v2+)

- [ ] Desktop/mouse-based signal set — explicitly out of scope for this mobile-only harness; would double signal-layer surface area
- [ ] Cross-partner aggregate model improvement (federated-learning-adjacent) — explicitly deferred per CLAUDE.md scope boundaries
- [ ] Any dashboard/analyst UI over the structured log stream — explicitly deferred per CLAUDE.md

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| 4 signal types | HIGH | MEDIUM | P1 |
| Real forward-pass net (not lookup table) | HIGH | HIGH | P1 |
| Confidence threshold gate | HIGH | LOW | P1 |
| 4 response types mapped to intent classes | HIGH | MEDIUM | P1 |
| Structural no-PII payload shape | HIGH (trust/legal) | LOW (architectural, not incremental) | P1 |
| Config-driven selector targeting | HIGH | MEDIUM | P1 |
| Structured event logging | MEDIUM (dev/debug value) | LOW | P1 |
| Session-end weight push + cold-start fallback | HIGH | MEDIUM-HIGH | P1 |
| SPA re-attachment (MutationObserver) | MEDIUM (only matters if host is an SPA) | MEDIUM | P1 (already scoped in PROJECT.md) |
| Session-level signal correlation | MEDIUM-HIGH | HIGH | P2/P3 (v1.x) |
| Desktop/mouse signal set | LOW (out of platform scope) | MEDIUM | P3 (defer) |
| Dashboard/analyst UI | MEDIUM (would help debugging) | HIGH | P3 (explicitly deferred) |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Hotjar / FullStory (analytics category) | Exit-intent / popup tools (intervention category) | Heed's Approach |
|---------|-------------------------------------------|------------------------------------------------------|------------------|
| Signal detection | Rage click (5 clicks/500ms), dead click (no effect within seconds), thrashed cursor, U-turns — surfaced to a human analyst via replay/heatmap | Cursor-exit (desktop), or composited proxies on mobile (back-button, scroll velocity, idle timer, tab blur) — fire a single popup | Touch hesitation, blur-incomplete, scroll reversal, back intent — geometry/timing-only, feeds an automated classifier, no human in the loop |
| Response to signal | None automated — a human reviews the replay and decides what to fix in the product | Single generic intervention (popup, usually a discount/email capture) regardless of *why* the user seemed to be leaving | 4 distinct response types selected by inferred intent class — the differentiator |
| Privacy approach | Mask/redact PII at or after capture (session replay tools capture rich DOM data, then apply masking rules) | Typically no special privacy architecture — popups don't need behavioral payloads | Structurally excludes PII from the payload — nothing to mask because nothing sensitive is ever captured |
| Learning/adaptation | None — static thresholds (5 clicks/500ms is fixed across all customers) | None — static trigger rules per popup campaign | On-device net that updates weights per session outcome, closing an actual learning loop |
| Multi-signal combination | Signals are catalogued separately; correlation is manual (a human watching the replay connects rage click + dead click) | Explicitly recommended by category best practice (2+ signals combined) but implemented as hand-tuned boolean rules, not learned | Single-event classification in v1 (each signal independently triggers an inference pass); session-level correlation is a stated v1.x extension, not hand-tuned boolean rules but net-driven when built |

## Sources

- [Hotjar: How to Use Rage Clicks To Improve User Experience](https://www.hotjar.com/blog/rage-clicks/)
- [Polaris Growth: A simple way to detect rage clicks with Hotjar](https://www.polarisgrowth.com/en/blog/a-simple-way-to-detect-rageclicks-with-hotjar)
- [Hotjar: 4 Ways to Use Rage Click Maps to Reduce Friction](https://www.hotjar.com/heatmaps/rage-click-maps/)
- [Webeyez: Hotjar Frustration Signals — A Practical Guide for Conversion Optimization](https://webeyez.com/insights/guides/hotjar-frustration-signals-guide)
- [FullStory Help Center: Rage Clicks, Error Clicks, Dead Clicks, and Thrashed Cursor — Frustration Signals](https://help.fullstory.com/hc/en-us/articles/360020624154-Rage-Clicks-Error-Clicks-Dead-Clicks-and-Thrashed-Cursor-Frustration-Signals)
- [FullStory: What are Rage Clicks? How to Identify Frustrated Users](https://www.fullstory.com/blog/rage-clicks/)
- [FullStory Help Center: Ragehooks](https://help.fullstory.com/hc/en-us/articles/360052984354-Ragehooks)
- [PushOwl: Mobile Exit-Intent Popups — How They Work, 12 Examples & Conversion Stats](https://www.pushowl.com/blog/mobile-exit-intent-popups)
- [Gleam: How Exit Intent Popups Detect User Exit Behavior](https://gleam.io/faq/captures/how-exit-intent-technology-works)
- [Wisepops: Everything You Need to Know about Mobile Exit Intent](https://wisepops.com/blog/mobile-exit-intent)
- [Iterathon: Edge AI & On-Device Inference 2026 — Implementation Guide for Developers](https://iterathon.tech/blog/edge-ai-on-device-inference-2026-implementation-guide)
- [Medium (Kamalmeet Singh): Personalization on the Edge](https://medium.com/@kamalmeet/personalization-on-the-edge-313846bebe0f)
- [hoop.dev: Real-Time PII Masking in Session Replay](https://hoop.dev/blog/real-time-pii-masking-in-session-replay/)
- [JustAnalytics: GDPR-Safe Session Replay — A Field Guide to PII Masking and Lawful Basis](https://justanalytics.app/blog/gdpr-session-replay-pii-masking-guide)
- [LogRocket Blog: How PMs can use session replay without violating user privacy](https://blog.logrocket.com/product-management/privacy-safe-session-replay-guide/)
- [XICTRON: Avoid Dark Patterns — A Fair Checkout in 2026](https://www.xictron.com/en/blog/avoid-dark-patterns-fair-checkout-2026/)
- [Pandectes: Dark Patterns in 2026 — What the FTC's New Rules Mean](https://pandectes.io/blog/dark-patterns-in-2026-what-the-ftcs-new-rules-mean/)
- [Cookie-Script: Dark Patterns 2026 — The FTC's New Click-to-Cancel Rule Applied to Banners](https://cookie-script.com/privacy-laws/dark-patterns-2026-the-ftc-new-click-to-cancel-rule)
- [Medium (Hash Block): Running Machine Learning Models Directly in the Browser with TensorFlow.js](https://medium.com/@connect.hashblock/running-machine-learning-models-directly-in-the-browser-with-tensorflow-js-798cfdd6ede4)
- [Medium (Sonali Nogja): AI in the Browser — TensorFlow.js, WebGPU, and the Future of On-Device Inference](https://medium.com/@sonali.nogja.08/ai-in-the-browser-tensorflow-js-webgpu-and-the-future-of-on-device-inference-42b4cc33ea26)
- Cross-referenced against `.planning/PROJECT.md` (Branch 2 requirements, current as of 2026-07-09)

---
*Feature research for: client-side behavioral-intent-detection / conversion-optimization SDK (Heed, Branch 2 — heed-sdk)*
*Researched: 2026-07-10*
