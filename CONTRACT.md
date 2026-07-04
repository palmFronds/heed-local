# CONTRACT.md

The seven data-heed selectors that connect Branch 1, Branch 2, and Branch 3.

Established before any branch code is written. Locked permanently.
Changing one selector requires updating all three branches simultaneously.
Do not rename. Do not add new selectors without updating this file first.

---

## The selectors

  [data-heed="amount-input"]
  Screen 2 — amount entry field
  Branch 1 owns: input element on the swap screen
  Branch 2 targets: touch_hesitation, blur_incomplete signals
  Branch 3 uses: typing, blur, hold interactions

  [data-heed="fee-row"]
  Screen 2 — fee disclosure row
  Branch 1 owns: div showing calculated fee beneath amount input
  Branch 2 targets: scroll_reversal signal (user scrolls to this then retreats)
  Branch 3 uses: scroll down to this element, then scroll back up

  [data-heed="min-received-row"]
  Screen 2 — minimum received row
  Branch 1 owns: div showing minimum received amount
  Branch 2 targets: scroll_reversal signal
  Branch 3 uses: scroll interactions on this element

  [data-heed="proceed-cta"]
  Screen 2 — proceed button
  Branch 1 owns: button that routes to Screen 3
  Branch 2 targets: touch_hesitation signal (hold without tapping)
  Branch 3 uses: tap to proceed, or hold then release for hesitation

  [data-heed="confirm-cta"]
  Screen 3 — confirm button
  Branch 1 owns: button that routes to Screen 4 (success)
  Branch 2 targets: touch_hesitation signal (the primary abandonment signal)
  Branch 3 uses: hold then release (hesitant), hold then back (abandoning)

  [data-heed="back-btn"]
  Screen 3 — back button
  Branch 1 owns: button that routes back to Screen 2
  Branch 2 targets: back_intent signal
  Branch 3 uses: tap to trigger abandonment in abandoning persona

  [data-heed="flow-complete"]
  Screen 4 — success element
  Branch 1 owns: element present on the success screen
  Branch 2 targets: completionSelector — sets flowComplete = true
  Branch 3 uses: presence confirms session outcome = complete

---

## How the contract is consumed

Branch 1 (feat/demo-platform):
  Every element above must exist in the DOM with its exact data-heed
  attribute. Selectors must be on element attributes, not class names.
  They must survive Next.js builds and Tailwind purges unchanged.

Branch 2 (feat/heed-sdk):
  config/demo-platform.json lists these selectors under signals.*.targets
  and completionSelector. The SDK attaches listeners to matching elements.
  If an element is missing from the DOM, the listener silently skips it —
  no errors, but no signal capture either. Verify in DevTools.

Branch 3 (feat/agents):
  Playwright scripts reference these selectors directly. If a selector
  changes in Branch 1, the Playwright script breaks. This is intentional —
  it surfaces the breakage immediately rather than silently generating
  wrong data.

---

## Verification checklist (Branch 1 gate)

Before Branch 1's gate can pass, confirm in DevTools:

  document.querySelector('[data-heed="amount-input"]')     // not null
  document.querySelector('[data-heed="fee-row"]')          // not null
  document.querySelector('[data-heed="min-received-row"]') // not null
  document.querySelector('[data-heed="proceed-cta"]')      // not null
  document.querySelector('[data-heed="confirm-cta"]')      // not null
  document.querySelector('[data-heed="back-btn"]')         // not null
  document.querySelector('[data-heed="flow-complete"]')    // not null

All seven must return elements, not null. Run these in the browser console
on the correct screen for each selector — confirm-cta and back-btn only
exist on Screen 3, flow-complete only exists on Screen 4.
