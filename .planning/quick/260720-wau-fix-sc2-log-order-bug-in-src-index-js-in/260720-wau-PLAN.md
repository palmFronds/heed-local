---
phase: quick
plan: 260720-wau
type: execute
wave: 1
depends_on: []
files_modified:
  - src/index.js
  - tests/e2e/branch1-live.spec.js
autonomous: true
requirements:
  - INTEG-01
must_haves:
  truths:
    - "For a triggered signal on live Branch 1, the [heed] console log order is exactly signal_detected -> inference_run -> response_fired (INTEG-01 SC2)."
    - "The SC3 test fills a valid amount so [data-heed=\"proceed-cta\"] is genuinely enabled before the overlay click-through assertion runs."
    - "npx playwright test --project=live-branch1 passes green for all seven tests in branch1-live.spec.js."
  artifacts:
    - src/index.js
    - tests/e2e/branch1-live.spec.js
  key_links:
    - "src/index.js init() call ordering determines EventTarget registration order on the shared bus, which determines log line ordering."
---

<objective>
Fix two bugs surfaced by the Plan 06-02 Task 3 human-verify checkpoint when running
the live-branch1 Playwright suite against a real worktree'd Branch 1:

1. SC2 log-order (real SDK bug): src/index.js's init() registers inference's
   signal:detected handler before log.js's, so the synchronous EventTarget dispatch
   cascade emits inference_run and response_fired BEFORE signal_detected. Required
   order (INTEG-01 SC2): signal_detected -> inference_run -> response_fired.

2. SC3 test gap (test-only bug): the SC3 test holds proceed-cta without ever filling
   [data-heed="amount-input"]. On the real Branch 1 app the CTA stays disabled
   ("Enter an amount") until an amount is entered, so Playwright's click times out.

Purpose: Turn the live-branch1 suite green so the Task 3 human-verify sign-off can
proceed on a real basis. The SC2 fix corrects a genuine ordering defect in the SDK
init sequence; the SC3 fix makes the test precondition match live Branch 1 behavior.

Output: Corrected src/index.js init() ordering and a corrected SC3 test, verified by
the live-branch1 Playwright project passing.
</objective>

<context>
@.planning/STATE.md
@src/index.js
@src/log.js
@src/inference.js
@src/response.js
@tests/e2e/branch1-live.spec.js

Ground truth (already diagnosed — do NOT re-investigate from scratch):

- src/bus.js's subscribe() does target.addEventListener(type, wrapped) on a plain
  EventTarget. Native EventTarget invokes same-event-type listeners in REGISTRATION
  ORDER, synchronously; a nested dispatchEvent (a handler publishing another event)
  resolves fully before the outer dispatch loop advances to its next listener.

- Current src/index.js init() order: initSignalCapture -> initInference -> initLogging
  -> initResponse. Both initInference (src/inference.js:252) and initLogging
  (src/log.js:136) subscribe to 'signal:detected'. Because initInference registers
  first, inference's handler runs first on a real signal and synchronously cascades
  the whole inference:result chain (response_fired + log writes) before control
  returns to log.js's signal:detected handler, which writes signal_detected LAST.

- inference:result has two listeners: log.js (src/log.js:140, writes inference_run)
  registered during initLogging, and response.js (src/response.js:281, fires the
  response -> response_fired) registered during initResponse. Since initLogging runs
  before initResponse, inference_run already logs before response_fired — that
  relative order is correct and must be preserved.

- No other init-order dependency exists: the src/index.js:49-52 invariant ("logging
  wired before response.js so its subscriptions register before the first
  inference:result could arrive") is preserved by keeping initResponse last. No
  module reads init-time state that depends on the OLD relative order of initInference
  vs initLogging (confirmed by reading log.js/inference.js/response.js init functions).

CLAUDE.md rules in force: no PII, no new external API calls, vanilla JS only in src/,
single-file SDK, no scope expansion. These fixes touch only call ordering and a test
precondition — none of these rules are affected.

Do NOT touch or mark approved the 06-02-PLAN.md Task 3 human-verify checkpoint; that
sign-off is a separate human decision made after these fixes.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Reorder src/index.js init() so logging registers its signal:detected handler before inference</name>
  <files>src/index.js</files>
  <action>
    In init(), move the initLogging(config, sessionId) call so it runs BEFORE
    initInference(config), while keeping initResponse(config, sessionId) LAST. The
    resulting call order must be: initSignalCapture(config); initLogging(config,
    sessionId); initInference(config); initResponse(config, sessionId).

    This makes log.js's 'signal:detected' subscription register first on the shared
    EventTarget bus, so on a real signal log.js writes signal_detected before
    inference's handler runs its inference:result cascade. inference_run (log.js's
    inference:result listener, registered during initLogging) still precedes
    response_fired (response.js's, registered during the still-last initResponse), so
    the full order becomes signal_detected -> inference_run -> response_fired.

    Update the surrounding comments to reflect the new ordering rationale rather than
    the old one: initLogging now runs before initInference specifically so log.js's
    signal:detected subscription registers first (correcting INTEG-01 SC2 ordering),
    and it remains before initResponse (preserving the existing 04-RESEARCH.md
    Assumption A1 invariant that logging is wired before response firing). Do not
    change the weights-shape validation, sessionId generation, initSignalCapture
    position, or the returned { config, publish, subscribe } shape.
  </action>
  <verify>
    <automated>node -e "const s=require('fs').readFileSync('src/index.js','utf8'); const iL=s.indexOf('initLogging(config, sessionId)'); const iI=s.indexOf('initInference(config)'); const iR=s.indexOf('initResponse(config, sessionId)'); if(!(iI>-1&&iL>-1&&iR>-1&&iL<iI&&iI<iR)){console.error('BAD ORDER',{iL,iI,iR});process.exit(1)} console.log('order ok: logging < inference < response')"</automated>
  </verify>
  <done>
    init() calls initLogging before initInference, and initResponse remains the last
    of the four init calls. The returned shape and all other init() behavior are
    unchanged.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fill a valid amount in the SC3 test so proceed-cta is enabled before the click-through assertion</name>
  <files>tests/e2e/branch1-live.spec.js</files>
  <action>
    In the 'SC3: response overlay renders above Branch 1 UI without blocking
    underlying interaction' test (around line 224), before calling
    holdProceedCtaPastThreshold(page), fill a valid amount into the amount input so
    Branch 1's own form validation enables [data-heed="proceed-cta"]. Add
    await page.locator('[data-heed="amount-input"]').fill('1'); immediately after the
    window.__heedReady wait and before the hold call — mirroring the exact precedent
    already used by the passing back_intent test at line 176
    (page.locator('[data-heed="amount-input"]').fill('1') followed by clicking
    proceed-cta), which proves fill('1') enables the live Branch 1 CTA.

    Leave the rest of the test intact: the overlay/pointer-events assertions
    ([data-heed-overlay] pointer-events none, [data-heed-response] pointer-events
    auto) and the final click({ timeout: 3000 }) on proceed-cta stay as the
    meaningful overlay-non-blocking (click-through) check. Only the enabling
    precondition is made real. Do not add or modify any other test.
  </action>
  <verify>
    <automated>node -e "const s=require('fs').readFileSync('tests/e2e/branch1-live.spec.js','utf8'); const i=s.indexOf('SC3: response overlay'); const end=s.indexOf('.click({ timeout: 3000 })', i); const block=s.slice(i, end); const hold=block.indexOf('holdProceedCtaPastThreshold'); const fill=block.indexOf('amount-input'); if(!(fill>-1 && hold>-1 && fill<hold)){console.error('SC3 must fill amount-input BEFORE holdProceedCtaPastThreshold',{fill,hold});process.exit(1)} console.log('SC3 fills amount-input before hold ok')"</automated>
  </verify>
  <done>
    The SC3 test fills [data-heed="amount-input"] with a valid amount before holding
    proceed-cta, so the CTA is genuinely enabled when the click-through assertion runs.
    No other test in the file is changed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Run the live-branch1 Playwright suite and confirm all tests pass</name>
  <files>tests/e2e/branch1-live.spec.js</files>
  <action>
    With both dev servers already running (receiver on :4310 via npm run receiver, and
    Branch 1's next dev on :3000 from ../heed-worktree-demo-platform — do NOT start or
    stop them), run the live-branch1 Playwright project from this repo root and confirm
    the full suite is green, paying particular attention to the SC2 (log order) and
    SC3 (overlay click-through) tests that were previously failing.

    If SC2 still fails, re-check Task 1's call ordering. If SC3 still fails, confirm
    fill('1') actually enables the live CTA (inspect the live Branch 1 amount-input's
    enabling condition) and adjust the input value/event sequence to match. Do not
    weaken any assertion to force a pass — the tests must pass on real behavior.
  </action>
  <verify>
    <automated>npx playwright test --project=live-branch1</automated>
  </verify>
  <done>
    npx playwright test --project=live-branch1 exits 0 with all seven tests passing,
    including SC2 (order exactly signal_detected -> inference_run -> response_fired)
    and SC3 (proceed-cta click-through succeeds within the 3000ms timeout).
  </done>
</task>

</tasks>

<verification>
- src/index.js init() order is initSignalCapture -> initLogging -> initInference ->
  initResponse; returned shape unchanged.
- SC3 test fills [data-heed="amount-input"] before holding proceed-cta.
- npx playwright test --project=live-branch1 passes all tests.
- No src/ change introduces PII, external API calls, framework deps, or scope
  expansion (only call ordering changed).
</verification>

<success_criteria>
- INTEG-01 SC2: live [heed] console log order is exactly signal_detected ->
  inference_run -> response_fired.
- INTEG-01 SC3: overlay renders with correct pointer-events and the underlying
  proceed-cta is clickable through the overlay (CTA now enabled via a filled amount).
- Full live-branch1 suite green.
- 06-02-PLAN.md Task 3 human-verify checkpoint left untouched (not marked approved).
</success_criteria>

<output>
Create `.planning/quick/260720-wau-fix-sc2-log-order-bug-in-src-index-js-in/260720-wau-SUMMARY.md` when done
</output>
