# Stack Research

**Domain:** Embeddable vanilla-JS behavioral-signal SDK with client-side ML inference (heed-sdk, Branch 2)
**Researched:** 2026-07-10
**Confidence:** MEDIUM-HIGH (brain.js facts verified directly against npm registry + official README; build/testing-tooling facts corroborated by multiple web sources but not primary-doc-verified)

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| brain.js | 2.0.0-beta.24 (current `latest` on npm, published 2024-07-09) | Feedforward neural network — training, weight serialization, cold-start weight loading | The one dependency mandated by CLAUDE.md/PROJECT.md. Confirmed on npm registry: `NeuralNetwork` class with `train()`, `run()`, `toJSON()`, `fromJSON()`. `gpu.js` is only a `peerDependency` (`^2.16.0`), not a hard dependency — plain CPU `NeuralNetwork` usage never pulls in `gpu.js` or the native `headless-gl` module, so it's safe in a browser-only, no-Node-native-deps context. **Note:** package has been parked at the `2.0.0-beta.24` tag for ~2 years with no newer release — see "What NOT to Use" and Gaps below. |
| Vanilla JS (ES2017+ target) | n/a | Signal capture, inference glue, overlay rendering | Fixed by spec — no framework allowed. `ES2017` (`async/await`, `Array.includes`) is a safe minimum target for modern mobile Safari/Chrome without needing a transpiler; avoid ES2020+ features (`?.`, `??`) unless the build step down-levels them, since iOS Safari versions vary across partner traffic. |
| esbuild (build-time only) | 0.28.1 | Concatenate `sdk.js` source + vendored/imported brain.js into one IIFE file, minify | See "Bundler" section below — this is the single most important stack decision to get right given CLAUDE.md's "no bundler" rule. Recommendation: esbuild is a **dev-only build tool**, never a runtime dependency; the *shipped* artifact is still the single `<script>` file the partner drops in, with zero build step on their side. This is the standard 2025/2026 way to produce exactly that shape of artifact (`esbuild entry.js --bundle --format=iife --global-name=Heed --minify --outfile=sdk.js`). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| terser | 5.49.0 | Second-pass minification after esbuild bundling | Only if payload size matters more than build speed — terser's minifier is smaller (but slower) than esbuild's built-in one. Given this SDK builds rarely (not a hot dev loop), a two-stage `esbuild --bundle` → `terser` pipeline is reasonable if the brain.js payload pushes total size high enough to care. Optional, not required for v1. |
| Vitest | 4.1.10 | Unit test runner for signal.js / inference.js logic | Standard 2025/2026 JS test runner; fast, ESM-native, works with plain Node scripts (no framework needed to use it). |
| happy-dom | 20.10.6 | DOM environment for Vitest unit tests | **Use this, not jsdom** — see "What NOT to Use". happy-dom implements `TouchEvent` natively (confirmed: alongside `PopStateEvent`, `MouseEvent`, `FocusEvent`, `KeyboardEvent`), which is required to unit-test `touchstart`/`touchend`, `popstate`, and `blur` handlers at all. jsdom does not implement the Touch Events API (open, long-unresolved GitHub issue `jsdom/jsdom#1508`). |
| Playwright / @playwright/test | 1.61.1 | Real-browser integration testing against the static test harness HTML | Use for the "manual testing sequence" style checks (press-and-hold → hesitation, scroll down/up → reversal, back button → back_intent) with real device/touch emulation (`hasTouch: true`, iPhone viewport preset). happy-dom/Vitest catch logic bugs fast in CI; Playwright catches real-DOM/real-event-timing bugs jsdom-family tools can't (this is also what Branch 3 already uses, so test infrastructure and mental model are shared across branches). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| esbuild CLI | Build-time bundling + minification | Zero-config for this use case; `--bundle --format=iife --minify --outfile=sdk.js`. Not shipped to partners — `devDependencies` only. |
| Vitest + happy-dom | Fast unit-level signal/inference tests | Run these in watch mode during development; they're the tight feedback loop for the forward-pass math and event-threshold logic. |
| Playwright | Slower, high-fidelity integration tests | Run against the standalone static test harness (and later, live Branch 1) — this is the layer that actually proves touch/scroll/popstate wiring works in a real mobile browser context. |

## Installation

```bash
# Core (the one product dependency)
npm install brain.js@2.0.0-beta.24

# Build tooling (dev-only, never shipped)
npm install -D esbuild@0.28.1 terser@5.49.0

# Test tooling (dev-only, never shipped)
npm install -D vitest@4.1.10 happy-dom@20.10.6 @playwright/test@1.61.1
```

## The "no bundler" constraint — read this before deciding tooling

CLAUDE.md states: *"No bundler. One file, no dependencies except brain.js."* This needs to be resolved into two separable claims before picking tools:

1. **The shipped artifact must be one file, requiring no build step for the partner.** This is unambiguous and every recommendation above satisfies it — a partner still just drops in `<script src="sdk.js"></script>`.
2. **Whether the *heed-sdk team* is allowed to run a build tool to *produce* that one file.** This is genuinely ambiguous from the text alone. Getting brain.js's code and the hand-written SDK source into a *single* `sdk.js` file requires *some* mechanical concatenation step, because brain.js is an npm package with its own dist output — there's no way to "just write one file" that also contains a third-party library's compiled code, unless that code is manually copy-pasted in.

Two paths, both legitimate, pick one explicitly with the project owner before Phase 1 execution:

- **Path A (recommended): esbuild bundle at build time.** Treat "no bundler" as describing the *runtime/consumer* experience (matches how virtually every embeddable analytics SDK — Segment, PostHog, Plausible — actually ships: hand-authored source, bundled once, distributed as a single flat file). esbuild is a single dev dependency, standard, fast, and this is what "single-file vanilla-JS SDK" means in practice across the industry in 2025/2026.
- **Path B (literal, zero build tooling): manual vendoring.** Download `brain.js`'s prebuilt `dist/browser.js` (confirmed available via unpkg/jsdelivr, exposes global `brain`), paste its contents at the top of `sdk.js`, hand-write the SDK code below it in an IIFE, and (optionally) run it through `terser` alone as a pure minifier (not a module bundler) if some minification is still wanted. This produces one file with literally no bundler, at the cost of manual, error-prone updates whenever brain.js's vendored copy needs to change.

**Recommendation: Path A.** It's the actual 2025/2026 standard, it's what "ship as one script tag" means to every SDK team that has solved this problem before, and it avoids manually maintaining a 1MB+ vendored blob in-repo. Flag this as a decision to confirm explicitly in ROADMAP/Phase 1 planning, since CLAUDE.md's wording is a real ambiguity, not a settled fact.

## brain.js payload size — a finding that affects scope, not just tooling

Confirmed by direct download: brain.js's official browser bundle (`dist/browser.js`, what `unpkg`/`jsdelivr` serve) is **~1.09MB unminified**, and there is **no official minified (`.min.js`) build published**. That bundle includes `NeuralNetwork`, `NeuralNetworkGPU`, `Recurrent`/`LSTM`/`GRU`, convolution layers, autoencoders, and cross-validation utilities — none of which this project's 4-input/4-hidden/4-output feedforward net needs.

Implications for the roadmap:
- Even after `esbuild --bundle --minify` + `terser`, expect the brain.js portion of the final `sdk.js` to still be the dominant share of file size (dead-code elimination on a CJS/UMD library with no ESM build is limited — see "Version Compatibility" below). Budget for a payload in the hundreds-of-KB range, not tens-of-KB, unless the team decides to hand-roll the network entirely and drop brain.js's `run()` from the runtime path (see next point).
- PROJECT.md's requirement that **"forward pass implemented explicitly (W1/b1 → ReLU → W2/b2 → softmax) — not abstracted behind a black-box call"** is actually compatible with a *much* lighter architecture: use brain.js only for the training/weight-update side (`train()`, `toJSON()`) — plausibly server-side or in the local weight-push receiver — and hand-write the forward pass in vanilla JS in `sdk.js`, reading the raw `weights`/`biases` arrays out of a `fromJSON()`-shaped blob without loading brain.js into the browser at all. This would satisfy "brain.js is the dependency used for the network" (training/serialization) while keeping the *shipped* `sdk.js` small, and it directly satisfies the "not abstracted behind a black-box call" requirement, since the runtime inference path would be genuinely hand-written. **This is a scope/architecture decision, not just a stack pick — flag it to the project owner rather than deciding silently**, because the milestone context is explicit that brain.js runs "client-side for real-time inference," which reads as wanting brain.js's `run()` in the browser. Both are defensible reads of the two source documents; they should be reconciled explicitly before Phase 1 lands the inference module's shape.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| brain.js | Hand-rolled forward pass only, no library at all | If, per the point above, the team decides brain.js is only needed for training/serialization (which can run in the local weight-push receiver, a Node context), the *browser* SDK could drop brain.js entirely and just implement `run()` by hand against a raw weights JSON. Smaller payload, same math. Not recommended as the default because PROJECT.md's constraints list brain.js as "the one allowed dependency" and the milestone context says it runs client-side — but worth revisiting once the inference module design is settled. |
| esbuild (build-time bundling) | Manual concatenation/vendoring (Path B above) | If the project owner reads "no bundler" literally and wants zero build tooling of any kind, including dev-only. Slower to iterate, harder to keep brain.js version in sync, but produces an artifact with a genuinely simpler mental model ("this file is exactly what you'd get from cat-ing two files together"). |
| Vitest + happy-dom | Vitest + jsdom | Only if a specific DOM API is needed that happy-dom doesn't yet support and jsdom does (rare, and not the case for touch/blur/scroll/popstate — happy-dom covers all four). Do not default to jsdom for this project given the confirmed TouchEvent gap. |
| terser (optional 2nd pass) | esbuild's built-in minifier only | If build speed matters more than the last few KB of payload, or if the team decides brain.js's size dominates enough that terser's marginal gain isn't worth a second build step. Reasonable default for v1 — add terser later if payload size becomes a measured problem. |
| Playwright | Cypress, WebdriverIO | Branch 3 (heed-agents) is already built on Playwright per the harness spec — reusing it here for Branch 2's own integration tests keeps tooling consistent across branches and lets test patterns/utilities potentially be shared conceptually (not code — branches don't cross-import per CLAUDE.md). |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| jsdom for touch-event unit tests | Does not implement the Touch Events API (`TouchEvent` construction/dispatch is unsupported — confirmed via long-open GitHub issue `jsdom/jsdom#1508`). Tests that try to dispatch real `TouchEvent`s either throw or silently fall back to a generic, non-representative `Event`, producing false-negative or false-positive coverage on exactly the signal this project cares most about (touch hesitation). | happy-dom (confirmed native `TouchEvent`, `PopStateEvent` support) for unit tests; Playwright with device emulation for integration tests. |
| `dist/index.js` (brain.js's Node/CJS build) in the browser | It does a hard `require('gpu.js')` at the top of the file — that's a Node-style `require`, not browser-safe, and pulls in the GPU peer dependency unconditionally. Using this file (instead of `dist/browser.js`) in a browser bundle will break or silently balloon the dependency graph. | `dist/browser.js` (the UMD bundle brain.js's own `unpkg`/`browser` package.json fields point to) as the import source when bundling for the browser. |
| Any bundler that assumes a Node runtime target by default (e.g. default webpack config, default Rollup Node-resolve setup without a browser target) | Wrong runtime target risks polyfilling Node built-ins into the bundle (Buffer, process, etc.) that this SDK will never need and that bloat the single-file payload further. | esbuild with an explicit browser-appropriate `target` (e.g. `es2017`) and no Node platform flag — esbuild defaults sanely for this case and is lighter-weight to configure correctly than webpack/Rollup for a single-entry-point library build. |
| Treating brain.js's `2.0.0-beta.24` as "a beta that will stabilize soon" | It has carried the `beta.24` tag as `latest` on npm since 2024-07-09 (roughly two years with no newer publish, per npm registry query on 2026-07-10) — there is no evidence of active version churn to plan around, but also no evidence of a maintained "stable 2.0" ever landing. Treat it as the de facto stable release it functions as, not as a placeholder for an imminent breaking change. | Pin the exact version (`2.0.0-beta.24`, not a `^` range) so a surprise future publish doesn't change API surface or bundle size mid-project. |

## Stack Patterns by Variant

**If the team decides brain.js's `run()` should execute in the browser (client-side inference, per the milestone context's literal wording):**
- Import brain.js's browser build through the esbuild bundle (Path A above).
- Accept the size cost documented above; budget accordingly in Phase 1/2 planning.
- The "forward pass implemented explicitly" requirement can still be honored by writing the SDK's own inference code to call the individual pieces (or by cross-checking a hand-rolled forward pass against `net.run()` output during development/testing) rather than only ever calling the opaque `.run()`.

**If the team decides brain.js is training/serialization tooling only (used in the local weight-push receiver, a Node context) and the browser SDK hand-rolls the forward pass:**
- brain.js becomes a receiver-side/dev dependency, not a browser bundle dependency at all.
- The shipped `sdk.js` payload shrinks dramatically (no 1MB+ UMD bundle to trim).
- `fromJSON()`'s weight/bias arrays are still the cold-start contract between the receiver and the SDK — this doesn't change the wire format, only where `.run()` executes.
- This reads as a deviation from "brain.js for real-time inference" in the milestone context, so treat it as a decision requiring explicit confirmation, not a default.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| brain.js@2.0.0-beta.24 | Node.js (any recent LTS) for `train()`/build tooling; any modern mobile browser (Safari iOS 14+, Chrome Android) for `dist/browser.js` at runtime | No official ESM build (`module` field is absent in package.json) — this means esbuild/Rollup tree-shaking on brain.js itself will be limited; expect to import/bundle the whole `dist/browser.js` (or `index.js` for Node-side use) rather than cherry-picking `NeuralNetwork` alone at the dead-code-elimination level. |
| brain.js@2.0.0-beta.24 | gpu.js@^2.16.0 (peerDependency, optional) | Only needed if `NeuralNetworkGPU` is used. Do not install gpu.js at all for this project — plain `NeuralNetwork` (CPU) is the correct class per PROJECT.md's explicit forward-pass requirement, and skipping gpu.js avoids its native `headless-gl` build complexity entirely. |
| esbuild@0.28.1 | Node.js 18+ | No special interaction with brain.js beyond standard CJS/UMD bundling; no known compatibility issues found. |
| happy-dom@20.10.6 | Vitest@4.1.10 | Vitest 4.x supports happy-dom as a first-class `environment` option (`environment: 'happy-dom'` in config, or a per-file `@vitest-environment happy-dom` comment for mixed suites) — this is the currently recommended pairing for DOM-touching unit tests as of the versions checked. |

## Sources

- npm registry API (`registry.npmjs.org/brain.js`, `registry.npmjs.org/brain.js/latest`) — direct query, 2026-07-10. Confidence: HIGH. Verified: `latest` = `2.0.0-beta.24`, publish date 2024-07-09, `dependencies: {"thaw.js": "^2.1.4"}`, `peerDependencies: {"gpu.js": "^2.16.0"}`, `main: dist/index.js`, `browser`/`unpkg`: `dist/browser.js`.
- `https://raw.githubusercontent.com/BrainJS/brain.js/master/README.md` — direct fetch, 2026-07-10. Confidence: HIGH. Verified: `NeuralNetwork` constructor options, `train`/`run`/`toJSON`/`fromJSON` API surface, `NeuralNetworkGPU` GPU/CPU fallback behavior.
- Direct download + inspection of `https://unpkg.com/brain.js@2.0.0-beta.24/dist/browser.js` and `.../dist/index.js` — 2026-07-10. Confidence: HIGH (primary artifact inspection). Verified: browser bundle is UMD, ~1.09MB unminified, exposes global `brain`; Node bundle `require()`s `gpu.js` and is CJS, not browser-safe; jsdelivr flat file listing confirms no `.min.js` variant exists in the published package.
- npm registry `latest` version queries for `vitest`, `happy-dom`, `playwright`/`@playwright/test`, `esbuild`, `terser` — direct query, 2026-07-10. Confidence: HIGH (primary registry data) for version numbers; MEDIUM for usage-pattern claims layered on top (sourced from web search, see below).
- Web search: jsdom Touch Events API support (`jsdom/jsdom#1508`), happy-dom `TouchEvent`/`PopStateEvent` support, esbuild IIFE bundling patterns, terser-vs-esbuild minification tradeoffs, Plausible/Segment single-file SDK distribution patterns — 2026-07-10. Confidence: MEDIUM (web search, cross-referenced across 2-3 sources per claim, not primary-doc-verified in this pass).

---
*Stack research for: heed-sdk (Branch 2) — embeddable vanilla-JS behavioral-signal SDK with brain.js-based client-side inference*
*Researched: 2026-07-10*
