# Pitfalls Research

**Domain:** Client-side ML-driven UX intervention SDK (embeddable analytics + on-device inference: touch/blur/scroll/popstate signal capture → 2-layer feedforward net → confidence-gated overlay response)
**Researched:** 2026-07-10
**Confidence:** MEDIUM (web-search-derived, cross-checked across multiple independent sources per topic; brain.js-specific API behavior and small-sample training dynamics are LOW — no official brain.js "gotchas" doc exists, reasoning is generalized from feedforward-net and continual-learning literature)

## Critical Pitfalls

### Pitfall 1: Touch hesitation timer fires on scroll attempts and iOS elastic bounce, not just hesitation

**What goes wrong:**
The touchstart timer (800ms threshold) starts counting the moment a finger touches `[data-heed="confirm-cta"]` or `[data-heed="proceed-cta"]`. If the user is actually trying to scroll past the element (finger down, then drags), or if iOS Safari's rubber-band bounce is in effect near the top/bottom of the page, the timer can still be running when touchend/touchcancel eventually fires, misclassifying a scroll or a bounce as `touch_hesitation`.

**Why it happens:**
A naive implementation only listens for touchstart → timer → touchend, without also tracking finger displacement or cancelling on touchmove past a small pixel delta. Movement-based disambiguation (a ~5-10px threshold before a touch is "no longer a hold") is a well-established but easy-to-skip step, because a demo/happy-path test (press-and-hold, don't move) never exercises it.

**How to avoid:**
- Track touch position on touchstart; on every touchmove, compare against the origin — if displacement exceeds ~8-10px, cancel the hesitation timer and do not fire `touch_hesitation`.
- Always clear the timer on touchcancel (iOS fires this on interruptions like an incoming call banner or the OS gesture-nav edge swipe), not just touchend.
- Since this SDK is mobile-only and targets a 390px iOS viewport, explicitly test near-edge elements (e.g. `fee-row` scroll target close to the top of the scrollable area) where elastic bounce is most likely to coincide with a touch.

**Warning signs:**
`signal_detected` log entries for `touch_hesitation` firing during manual scroll-testing on Screen 2/3, or firing when the tester's stated intent was "I was scrolling, not holding."

**Phase to address:**
Signal capture phase (touch hesitation signal implementation) — must be caught before the inference layer is built on top of it, since bad signal data poisons cold-start-vs-learned weight comparisons later.

---

### Pitfall 2: Single `flowComplete` bit provides no credit assignment across 4 intent classes

**What goes wrong:**
The weight update fires once per session using one binary label (`flowComplete`) to update a softmax over 4 classes (`confusion, price_doubt, trust_gap, flow_friction`). If a session emits multiple signal types before ending (e.g. both `scroll_reversal` and `touch_hesitation` fired, then the user abandoned), the single outcome bit cannot say which signal actually drove the outcome — the update reinforces or penalizes all classes that fired during the session equally, blurring the very domain-knowledge mapping (`touch_hesitation→confusion`, `blur_incomplete→flow_friction`, `scroll_reversal→price_doubt`, `back_intent→trust_gap`) the cold-start weights were designed to encode.

**Why it happens:**
Binary outcome labels are cheap to obtain (no manual labeling), so they get reached for by default. The mismatch between a coarse label and a fine-grained multi-class target is a classic label-noise setup — it works fine as a toy/demo but degrades any attempt at multi-session learning that isn't purely illustrative.

**How to avoid:**
- Treat the session-end update as illustrative of the *mechanism* (forward pass, backprop, weight persistence) rather than a claim that the net will converge to something better than the hand-coded cold start after a handful of dev/test sessions — this matches the spec's own framing ("not a lookup table wearing a neural network's clothes" is about correctness of the forward pass, not about label quality).
- If multiple signal types fire in one session, pick the update target as the class tied to the *last* (most proximal to the outcome) signal fired, not all classes that fired — this is a defensible, cheap heuristic that at least avoids diffusing gradient across unrelated classes.
- Log which signal(s) fired per session alongside `flowComplete` so the local weight-push receiver (and later Branch 4 eval work) can audit *why* a given update happened, even though only the label matters for the actual gradient step in this branch.

**Warning signs:**
After several dev sessions, the learned weight file drifts response confidence away from the cold-start domain mapping in ways that don't match manual intuition (e.g. `scroll_reversal` starts triggering `trust_gap` responses instead of `price_doubt`).

**Phase to address:**
Inference layer phase (weight update / cold-start design) — this is the conceptual core of the branch per the spec, and the label-noise risk should be documented as a known, accepted limitation rather than silently discovered later.

---

### Pitfall 3: Session-end single-example weight updates at LR 0.01 cause drift away from the hand-coded cold-start mapping over repeated dev sessions

**What goes wrong:**
Per-example (non-batched) gradient updates are the textbook setup for catastrophic forgetting — each new update can overwrite previously-encoded structure rather than averaging over many examples. Because this SDK updates once per session with no replay buffer and no held-out validation, there is nothing to detect when a run of noisy dev/test sessions (deliberately abandoning, deliberately completing, in whatever order the tester happens to click through the local test harness) pushes the net toward degenerate behavior — e.g. one class's output collapsing toward the confidence threshold on every input, or the opposite (softmax staying near-uniform, chronically failing the 0.65 gate).

**Why it happens:**
Research on continual/online learning consistently shows that a larger learning rate combined with single-example (non-batched) updates increases forgetting; LR 0.01 is a reasonable-sounding default but there is no built-in mechanism in this design (no regularization toward the cold-start prior, no replay, no batching) to counteract it, and the "closes the learning loop" requirement in the spec makes it tempting to treat convergence as automatic once the plumbing works.

**How to avoid:**
- Explicitly test the failure mode in the local weight-push receiver work: run 10-20 synthetic sessions with mixed/noisy outcomes through the local test harness and confirm confidence scores don't collapse (e.g. print softmax outputs before/after each update, not just the final class).
- Consider clamping or resetting to cold-start weights if a sanity check (e.g. cold-start test vectors) starts failing after online updates — cheap and appropriate given this branch's dev/test scope (no production training infra is in scope here, per Branch 4 ownership).
- Do not conflate "the weight-push mechanism works end-to-end" (file gets written, gets reloaded) with "the model has learned something useful" — the spec's manual testing sequence validates the former; the latter is explicitly out of this branch's evaluation scope.

**Warning signs:**
Confidence values consistently just above or just below 0.65 regardless of input after a handful of session-end updates; two different signal types producing nearly identical output distributions.

**Phase to address:**
Inference layer phase (weight update implementation) and the local weight-push receiver phase — the receiver's persistence step is the last point where a sanity check can be cheaply inserted before "closing the loop" ships.

---

### Pitfall 4: Overlay `pointer-events` isolation implemented backwards or incompletely, either blocking the host page or making the overlay itself untappable

**What goes wrong:**
Two symmetric failure modes: (a) forgetting `pointer-events: none` on the full-viewport container means the injected div silently intercepts every tap anywhere it covers, breaking the underlying flow — this directly fails the spec's own manual test criterion ("overlay renders above platform UI without blocking interaction"); (b) setting `pointer-events: none` on the container but forgetting `pointer-events: auto` on the *rendered response elements* (tooltip, discount_offer CTA, social_proof dismiss button) means nothing in the overlay is clickable at all, because `none` on a parent disables pointer interaction for all descendants unless explicitly overridden per-element.

**Why it happens:**
`pointer-events: none` cascades to children by default — it's easy to set it once on the container and assume overriding one child element with `auto` is sufic, but every interactive element added later (a new response type, a dismiss button) needs the override applied individually, and this is easy to miss when adding the 4th response type after the first 3 were tested.

**How to avoid:**
- Set `pointer-events: none` on the outer full-viewport container at injection time; explicitly set `pointer-events: auto` on every response element as part of the response-rendering code path itself (not as an afterthought), so adding response type N always includes it.
- Test isolation with the two-sided check explicitly: (1) with the overlay visible, can you still tap `proceed-cta` underneath it in an area with no response rendered — yes, must be tappable; (2) can you tap the response's own dismiss/action button — yes, must be tappable. Both need verification, not just one.
- `clampToViewport()` interacts with this: response elements must stay fully inside the 390px viewport / iOS safe-area insets, or a response placed partially off-screen could visually appear tappable but sit outside the interactive area a user can actually reach.

**Warning signs:**
DevTools shows the overlay div covering the CTA and the manual test ("overlay renders... without blocking interaction") fails silently — taps register but nothing under the overlay responds; or a rendered tooltip/discount_offer never receives a click/dismiss event in logs.

**Phase to address:**
Overlay/response rendering phase — should include an explicit pointer-events isolation check as an acceptance criterion, not just visual rendering.

---

### Pitfall 5: MutationObserver + popstate re-attachment either double-fires signals or silently stops attaching after SPA navigation

**What goes wrong:**
Two failure modes in the SPA re-attachment logic: (a) if the WeakSet idempotency check is keyed only on pathname rather than on the actual DOM node, a client-side route change that re-renders the same route (same pathname, new DOM nodes — common with Next.js re-mounts) causes the WeakSet to think elements are already tracked when they're actually fresh nodes, so listeners never get (re-)attached and signals silently stop firing on the new page; (b) if the MutationObserver callback re-runs attachment logic without checking the WeakSet correctly (e.g. checking it after already adding to it, or a race between the observer callback and the popstate handler both firing on the same navigation), the same element gets a listener attached twice, producing duplicate `signal_detected → inference_run → response_fired` log triples for a single physical interaction.

**Why it happens:**
MutationObserver and popstate can both fire for the same logical navigation event (a popstate-triggered route change also mutates the DOM, triggering the observer), so gating "only on pathname change" without deduplicating the two triggers, or without keying idempotency on the DOM node itself rather than the route, produces either double-attachment or under-attachment depending on ordering.

**Why it happens (secondary):** `history.pushState()`/`replaceState()` do not themselves fire a `popstate` event — only actual back/forward browser navigation does. If Next.js client-side routing under Branch 1 uses `pushState` for forward navigation (typical App Router behavior), a naive implementation that only re-attaches on `popstate` will miss forward navigations entirely, leaving newly-rendered screens without signal listeners until a MutationObserver fallback catches the DOM change.

**How to avoid:**
- Key the WeakSet on the DOM element reference itself (attach-time), not on pathname — pathname only decides *when* to re-scan the DOM for matching selectors, not whether a specific element already has a listener.
- Disconnect (or scope) the MutationObserver's re-scan logic so that a single navigation event triggers exactly one re-attachment pass, even if both a popstate event and a batch of mutation records arrive for the same transition (debounce or coalesce within a microtask/short timeout).
- Do not rely on `popstate` alone to detect all route changes — the spec's design (MutationObserver on `document.body` + popstate, both gated on pathname change) already accounts for this by using the observer as the primary detection mechanism and popstate specifically for the `back_intent` signal semantics, not general re-attachment; keep those two concerns separate in the implementation so a `pushState`-only forward navigation still triggers a MutationObserver-based re-scan.

**Warning signs:**
Duplicate log triples for a single tap; signals that stop firing entirely after 2-3 SPA navigations in the local test harness; the manual testing sequence passing on first navigation to Screen 2/3 but failing after navigating back and forward again.

**Phase to address:**
SPA re-attachment phase — should include a specific multi-navigation test (navigate forward, back, forward again, minimum 3 hops) as an acceptance criterion, since single-navigation testing will not surface this class of bug.

---

### Pitfall 6: `targetSelector` in the signal payload accidentally becomes a PII leak vector if it's ever built dynamically instead of using the static `data-heed` value

**What goes wrong:**
The spec locks payload shape to `{ type, targetSelector, bbox, timestamp }` with `targetSelector` presumably being the static `data-heed` attribute value (e.g. `"amount-input"`). The leak risk appears if any future convenience refactor computes `targetSelector` via a generic DOM-path-building helper (e.g. `element.closest('[data-heed]')` chained with a full CSS-path fallback for robustness) instead of reading the fixed attribute directly — a full DOM path or a selector built from `aria-label`/`placeholder`/nearby text content can incorporate live field values or user-typed content, especially on the amount-input element where the current value could leak into a computed accessible-name-based selector.

**Why it happens:**
Generic "get me a selector for this element" utilities (common in analytics/session-replay tooling, per general industry patterns) are built for robustness against markup changes and often fall back to content-derived selectors when a stable attribute isn't found — a reasonable default in most analytics SDKs, but a directly disallowed behavior in this spec's no-PII constraint.

**How to avoid:**
- `targetSelector` must be read directly from the fixed `data-heed` attribute of the matched element — never derived by walking up/down the DOM or falling back to any content-based selector strategy.
- If an element is missing its `data-heed` attribute at runtime (contract violation from Branch 1's side), the signal should simply not fire (matches CONTRACT.md's documented behavior: "listener silently skips it — no errors, but no signal capture either") rather than falling back to a synthesized selector.
- Audit the `console.log('[heed]', JSON.stringify(entry))` logging layer specifically — logging the raw DOM `event.target` object (rather than the extracted `{type, targetSelector, bbox, timestamp}` payload) is an easy accidental leak since `event.target` carries the live element, including its current `value` if it's an input.

**Warning signs:**
Any code path that calls `element.value`, `element.textContent`, `element.innerText`, `getAttribute` on anything other than `data-heed`, or builds a selector string via ancestor traversal.

**Phase to address:**
Signal capture phase (payload construction) — should include an explicit code-level check/lint or manual review step confirming payload construction only ever reads `bbox`, `timestamp`, and the static `data-heed` value, never element content or computed paths.

---

### Pitfall 7: Confidence threshold gate (0.65) is meaningless without verifying the cold-start softmax isn't already saturated or already uniform

**What goes wrong:**
A 2-layer net (4→4 ReLU→4 softmax) initialized with hand-coded "domain-knowledge" weights could plausibly produce either near-uniform outputs (~0.25 each, never clearing 0.65, so no response ever fires) or overconfident saturated outputs (>0.99 on the "intended" class for every input, so the threshold gate does nothing to distinguish ambiguous cases) depending entirely on how the cold-start weight magnitudes are chosen — the spec specifies *what* the cold-start mapping should encode (touch_hesitation→confusion, etc.) but not the weight magnitudes needed to produce a sensible confidence distribution.

**Why it happens:**
Hand-coding "structured guess" weights for a forward-pass-correctness demonstration is a different design goal than hand-coding weights that produce a well-calibrated confidence distribution — it's easy to satisfy the former (the right class gets the highest score) while failing the latter (the margin between classes is either razor-thin or absurdly large).

**How to avoid:**
- After implementing cold-start weights, run all 4 canonical signal types through the forward pass and print the full softmax vector (not just the argmax) — confirm the intended class clears 0.65 with a visible margin over the next-highest class, and confirm at least one deliberately-ambiguous or off-domain input does *not* clear 0.65 (proves the gate is doing real work, not passing everything).
- Treat this as part of the "inference layer gets dedicated, deeper planning" emphasis already called out in the spec — the confidence gate is only meaningful if the cold-start weight magnitudes were deliberately tuned, not just directionally correct.

**Warning signs:**
Every manual test signal produces a confidence >0.95 (gate provides no discrimination) or no signal ever clears 0.65 (gate blocks everything, `response_fired` never appears in logs).

**Phase to address:**
Inference layer phase (cold-start weight design) — verification should be a stated exit criterion for this phase, not discovered during the end-to-end manual testing sequence.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Gate `touch_hesitation` on timing only, skip movement-displacement check | Faster to implement, passes happy-path manual test | False positives on scroll/bounce interactions poison later signal data and any downstream inference tuning | Never — this is core signal-quality, not an edge case, given the domain is explicitly mobile/touch |
| Update weights on every fired class in a multi-signal session instead of just the most-proximal one | Simpler code, no need to track "which signal was closest to the outcome" | Diffuses gradient credit across unrelated classes, degrading the cold-start mapping faster than a single noisy example would alone | Acceptable only for the initial mechanism-proving pass; should be flagged as a known limitation, not silently shipped as "the" learning approach |
| Skip a cold-start softmax sanity check (print/verify output distribution) before wiring up the confidence gate | Saves a manual verification step | Ships a gate that either never fires or always fires, invisible until the full manual testing sequence, wasting a debugging cycle late in the branch | Never — cheap to check, expensive to debug later |
| Build `targetSelector` via a generic "closest matching selector" helper instead of reading `data-heed` directly | Slightly more robust to markup drift | Direct violation of the no-PII constraint if the helper ever falls back to content-derived selectors | Never |
| Attach MutationObserver + popstate re-attachment without a multi-hop navigation test | Faster to demo (single navigation looks correct) | Double-firing or missed re-attachment only surfaces after 2-3 SPA navigations, exactly the kind of bug that survives a rushed manual test pass | Never — must be part of the phase's exit criteria |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| brain.js (`NeuralNetwork`) | Treating `.train()`'s batch-oriented API as equivalent to the spec's "update once at session end with one example" — `.train()` is designed for iterating to convergence over a dataset, not a single online update | Either call `.train()` with a single-example array and `iterations: 1` (or use the stream/pipe API brain.js exposes for incremental feeding) — confirm which produces the intended single-step gradient update, since misuse could accidentally iterate to convergence on one example (effectively memorizing it) |
| Next.js client-side routing (Branch 1) | Assuming `popstate` fires on every SPA navigation | `pushState`/`replaceState`-driven forward navigation does not fire `popstate` — rely on the MutationObserver as the general re-attachment trigger; reserve `popstate` specifically for the `back_intent` signal semantics |
| Local weight-push receiver | Treating the receiver as a trusted, closed-loop system and skipping input validation on the POST payload since "it's just dev tooling" | Even a local dev receiver should validate the weight array shape/dimensions before persisting — a malformed write corrupts the file `sdk.js` reads on next cold-start, breaking every subsequent session until the file is manually fixed |
| `discount_offer` response → host page (`postMessage`) | Sending with `targetOrigin: '*'` since it's "just a local dev/demo platform" | Always specify the exact target origin, even in dev — the habit compounds risk if the pattern is copy-pasted toward a real partner integration later; validate `event.origin` on the receiving side too if the host ever needs to acknowledge the message back |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| MutationObserver configured with `subtree: true, childList: true` on `document.body` with no throttling | Excessive callback invocations on any host-page re-render (not just navigation), even when Branch 1's own React/Next.js re-renders unrelated parts of the tree | Debounce the re-attachment scan (short timeout / microtask coalescing) so a burst of mutations from one render pass triggers one scan, not N | Noticeable on any host page with frequent re-renders (form validation state, animations) — Branch 1's Screen 2 (amount input, live fee calculation) is exactly this kind of page |
| touchmove listener registered as non-passive when it doesn't call `preventDefault` | Scroll janks on iOS since the browser must wait for the handler before committing to native scroll | Register touch listeners needed only for hesitation-timer cancellation as `{ passive: true }` — only use non-passive if the SDK ever needs to block default touch behavior (it shouldn't, since it must never interfere with the host page) | Visible immediately on iOS Safari during scroll-heavy testing (Screen 2's fee/min-received rows, which the spec explicitly targets for `scroll_reversal`) |
| Re-injecting/re-querying the full-viewport overlay div on every response fire instead of reusing the single div created at init | Layout thrash / flicker if a response type causes the whole overlay to remount rather than swap its rendered content | Create the overlay container once at init (per spec: "single fixed full-viewport div injected at init"); response rendering should only mutate its children, never recreate the container | Becomes visible once more than one response type has been implemented and tested back-to-back |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `postMessage` from `discount_offer` sent with wildcard target origin | Any origin that can obtain a reference to the window (e.g. via an iframe embed of the partner page, or a malicious script sharing the window) can intercept the offer-fired message | Always pass the actual host origin as `targetOrigin`; obtain it once at SDK init (e.g. from `window.location.origin`) rather than hardcoding or wildcarding |
| Config schema validation implemented as a soft warning instead of a hard fail | A malformed `config/demo-platform.json` (e.g. a selector typo) could cause silent mis-targeting rather than an obvious startup failure, wasting debugging time and risking signals attached to the wrong element | Per spec, config validation must hard-fail on invalid schema — treat this as non-negotiable, not a "nice to have" |
| Weight file persisted by the local receiver is read back into `sdk.js` without validating array shape/values | A corrupted or partially-written weight file (e.g. process killed mid-write) silently produces garbage inference output with no error, since the forward pass will run on malformed matrices without throwing in JS unless shapes are checked | Validate weight array dimensions match the expected 4→4→4 architecture before using loaded weights; fall back to cold-start structured-guess weights if validation fails, matching the spec's own fallback design intent |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No cooldown/one-at-a-time state on response firing | Multiple response types could theoretically fire in rapid succession (e.g. `touch_hesitation` on `confirm-cta` followed quickly by `back_intent`), stacking overlays or flickering between them | Track "a response is currently displayed" state and suppress new response renders until the current one is dismissed or times out — not explicitly called out in the spec but implied by "single fixed full-viewport div" |
| `clampToViewport()` clamps position but not collision with the element that triggered the signal | A tooltip clamped to stay within the 390px viewport could end up rendered directly on top of the CTA it's meant to explain, obscuring it | Clamp position with awareness of the trigger element's bounding box (already available via the signal's `bbox`), not just the viewport edges |
| Discount/nudge copy responses that fire on legitimate fast interactions due to threshold miscalibration | A user who is simply reading carefully (not hesitating) before tapping "confirm" gets interrupted by an overlay, which reads as the SDK being presumptuous rather than helpful | Validate the 800ms/40%/threshold defaults against realistic "reading, not hesitating" interaction timing during manual testing, not just against the deliberately-scripted hesitation persona |

## "Looks Done But Isn't" Checklist

- [ ] **Touch hesitation signal:** Often missing touchmove-based cancellation — verify a slow scroll gesture over `confirm-cta`/`proceed-cta` does NOT emit `touch_hesitation`.
- [ ] **Overlay isolation:** Often missing per-response-element `pointer-events: auto` — verify every one of the 4 response types (tooltip, nudge_copy, discount_offer, social_proof) is individually tappable/dismissible, not just visually rendered.
- [ ] **SPA re-attachment:** Often works on the first navigation only — verify signals still fire correctly after navigating forward → back → forward again (minimum 3 hops) through the local test harness or live Branch 1.
- [ ] **Signal payload PII audit:** Often looks clean in the happy path but leaks via logging — verify `console.log('[heed]', ...)` output for every event type never contains a field value, full DOM path, or raw `event.target`/`element.value`.
- [ ] **Cold-start confidence calibration:** Often "technically correct" (highest-scoring class matches intent) but miscalibrated — verify the full softmax vector (not just the winning class) for all 4 canonical signals shows a real margin over 0.65, and at least one off-domain/ambiguous input does not clear the gate.
- [ ] **Weight persistence round-trip:** Often verified only as "file gets written" — verify `sdk.js` actually reads the persisted file back on a fresh page load (not the same session) and produces different inference output than the cold-start weights would, proving the read path works, not just the write path.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Touch hesitation false positives from scroll/bounce | LOW | Add movement-displacement cancellation and touchcancel handling; no data migration needed since signals aren't persisted beyond the session |
| Weight drift from noisy session-end updates | LOW | Delete/reset the persisted local weight JSON file to fall back to cold-start structured-guess weights; re-run controlled test sessions |
| Overlay blocking host page interaction | LOW | Single CSS property fix (`pointer-events: none` on container) — but re-verify all 4 response types remain individually tappable after the fix |
| Double-firing signals after SPA navigation | MEDIUM | Requires reworking the WeakSet keying strategy from pathname-based to element-based, plus adding the multi-hop navigation test that should have caught it — touches the SPA re-attachment module directly |
| PII leak via a computed/dynamic `targetSelector` | MEDIUM | Requires auditing every call site that constructs the signal payload, replacing any dynamic selector logic with direct `data-heed` attribute reads, and re-verifying via the logging layer that no leak remains |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| Touch hesitation false positives (scroll/bounce) | Signal capture phase | Manual test: slow scroll over hesitation-target elements does not emit `touch_hesitation` |
| Single-bit label credit assignment across 4 classes | Inference layer phase | Design review: documented rationale for how multi-signal sessions map to a single update target |
| Session-end LR/weight drift, no batching or replay | Inference layer phase | Synthetic multi-session test: confidence distribution doesn't collapse after 10-20 noisy updates |
| Overlay pointer-events isolation | Overlay/response rendering phase | Manual test: host CTA tappable through overlay AND every response element individually tappable |
| MutationObserver/popstate double-firing or missed re-attachment | SPA re-attachment phase | Multi-hop navigation test (forward → back → forward, 3+ hops) with log-count verification |
| `targetSelector` PII leak via dynamic selector building | Signal capture phase (payload construction) | Code review / lint: payload construction only reads `bbox`, `timestamp`, static `data-heed` value |
| Confidence gate saturation/uniformity from untuned cold-start weights | Inference layer phase (cold-start design) | Print full softmax vector for all 4 canonical + 1 ambiguous input; confirm real margin around 0.65 |

## Sources

- [JavaScript touch events and mobile-specific considerations — Borstch](https://borstch.com/blog/javascript-touch-events-and-mobile-specific-considerations)
- [Detect long touch pressure — CodePen](https://codepen.io/eleviven/pen/eYmwzLp)
- [How to Detect Long Touch Pressure with JavaScript — javaspring.net](https://www.javaspring.net/blog/how-to-detect-a-long-touch-pressure-with-javascript-for-android-and-iphone/)
- [Scroll, Press, and Tap: A Guide of Android Gesture Detection — Medium](https://medium.com/@robinhoo990512/scroll-press-and-tap-a-guide-of-android-gesture-detection-eb63104c526c)
- [Long Tap — Grokipedia](https://grokipedia.com/page/long_tap)
- [7 Common Pitfalls in Training Neural Networks and How to Avoid Them — Medium](https://medium.com/data-and-beyond/7-common-pitfalls-in-training-neural-networks-and-how-to-avoid-them-9c50867a2c0f)
- [Neural Network For Small Datasets — Meegle](https://www.meegle.com/en_us/topics/neural-networks/neural-network-for-small-datasets)
- [Mitigating Catastrophic Forgetting in Continual Learning — thesai.org](https://thesai.org/Downloads/Volume16No4/Paper_14-Mitigating_Catastrophic_Forgetting_in_Continual_Learning.pdf)
- [Reducing Catastrophic Forgetting in Online Class Incremental Learning Using Self-Distillation — arXiv](https://arxiv.org/html/2409.11329v1)
- [brain.js GitHub repository](https://github.com/BrainJS/brain.js/)
- [brain.js README](https://github.com/BrainJS/brain.js/blob/master/README.md)
- [pointer-events — CSS-Tricks](https://css-tricks.com/almanac/properties/p/pointer-events/)
- [CSS pointer-events to allow clicks on underlying elements — Robert's talk](https://robertnyman.com/2010/03/22/css-pointer-events-to-allow-clicks-on-underlying-elements/)
- [Shadow DOM CSS Isolation: How to Embed a Widget Without Breaking the Host Page — DEV Community](https://dev.to/issuecapture/shadow-dom-css-isolation-how-to-embed-a-widget-without-breaking-the-host-page-4oio)
- [SPA Memory Leaks: Catch Them Before Users Rage-Refresh — Medium](https://medium.com/@Quaxel/spa-memory-leaks-catch-them-before-users-rage-refresh-41ac7d11a373)
- [MutationObserver opportunity for memory leak — whatwg/dom Issue #482](https://github.com/whatwg/dom/issues/482)
- [Understanding popstate event in Single Page Applications (SPAs) — frontendgeek.com](https://www.frontendgeek.com/blogs/understanding-popstate-in-single-page-applications-spas)
- [Window: popstate event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event)
- [Back button not triggering popstate event listener — vercel/next.js Discussion #75454](https://github.com/vercel/next.js/discussions/75454)
- [PII Anonymization in Session Replay — hoop.dev](https://hoop.dev/blog/pii-anonymization-in-session-replay-protect-compliance-and-user-privacy/)
- [How PMs can use session replay without violating user privacy — LogRocket Blog](https://blog.logrocket.com/product-management/privacy-safe-session-replay-guide/)
- [Securing Cross-Window Communication: A Guide to postMessage — bindbee.dev](https://bindbee.dev/blog/secure-cross-window-communication)
- [Window: postMessage() method — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage)
- [Unchecked Origin in postMessage Vulnerability — SecureFlag Knowledge Base](https://knowledge-base.secureflag.com/vulnerabilities/broken_authorization/unchecked_origin_in_postmessage_vulnerability.html)
- [JavaScript SDK Design Guide — hueitan/javascript-sdk-design (GitHub)](https://github.com/hueitan/javascript-sdk-design)
- [JavaScript SDK Design Guide — sdk-design.js.org](https://sdk-design.js.org/)
- [On Third-Party Javascript - The Principles — RisingStack Engineering](https://blog.risingstack.com/on-third-party-javascript-the-principles/)
- [iOS mobile scroll in Web + React — Medium (Turo Engineering)](https://medium.com/turo-engineering/ios-mobile-scroll-in-web-react-1d92d910604b)
- [How to Disable iOS Safari Elastic Scrolling — codestudy.net](https://www.codestudy.net/blog/disable-ios-safari-elastic-scrolling/)
- Project-specific analysis grounded in `.planning/PROJECT.md` (Branch 2 spec) and `CONTRACT.md` (locked `data-heed` selectors) for this repository

---
*Pitfalls research for: client-side ML-driven UX intervention SDK (Heed heed-sdk, Branch 2)*
*Researched: 2026-07-10*
