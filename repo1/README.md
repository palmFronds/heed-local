# Heed Demo Platform (Repo 1)

This directory contains the **Heed Demo Platform**, a self-contained, mobile-only Next.js application that simulates a high-stakes cryptocurrency wallet transaction flow. 

This platform serves as the **host environment** (Repo 1) for the Heed SDK (Repo 2). It does not have a real backend, database, or crypto integration; its sole purpose is to provide a realistic, stable DOM structure for the Heed SDK to instrument and monitor for behavioral hesitation signals.

---

## 🔌 The "Connector" (The Contract)

The most important aspect of this codebase is the **7 locked HTML selectors**. These selectors act as the hard contract (the "connector") between this dummy platform and the future Heed SDK. 

The SDK will anchor its behavioral listeners and UI overlays strictly to these attributes. **Do not rename or remove these attributes without cross-branch coordination.**

| Selector | Screen | Element | Purpose for SDK |
|----------|--------|---------|-----------------|
| `[data-heed="amount-input"]` | `/swap` | Amount `<Input>` | Detects *Blur Incomplete* (user taps in but leaves without typing). |
| `[data-heed="fee-row"]` | `/swap` | Fee `<div>` | Target for Scroll Reversal (user scrolls past fee and retreats). |
| `[data-heed="min-received-row"]`| `/swap` | Min received `<div>` | Additional context anchor. |
| `[data-heed="proceed-cta"]` | `/swap` | Proceed `<Button>` | Primary anchor for *Touch Hesitation* (user presses and holds the button in doubt). |
| `[data-heed="confirm-cta"]` | `/confirm` | Confirm `<Button>` | Secondary anchor for Touch Hesitation. |
| `[data-heed="back-btn"]` | `/confirm` | Back `<Button>` | Primary anchor for *Back Intent* (user leaves confirmation screen). |
| `[data-heed="flow-complete"]` | `/success` | Success `<div>` | Tells the SDK the flow was completed (Session success label for neural net). |

---

## 🛠️ The Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** [Shadcn UI](https://ui.shadcn.com/) (Radix Primitives)
- **Testing:** Playwright (E2E Automated Browser Testing)
- **Fonts:** Locally hosted Geist Sans & Mono (Zero external network calls)

---

## 🏗️ How it was Built (Architectural Constraints)

To ensure this dummy platform acts identically to a secure financial app, it was built under strict constraints:

1. **Mobile-Only Viewport Lock:** The app forces a `390px` width (iPhone 14 dimensions) via CSS media queries. If viewed on a desktop viewport wider than 430px, it immediately hides the app and displays a "This app is mobile-only" fallback message.
2. **Network Silence:** There are absolutely zero external API calls or outbound fetch requests. Even the Google Fonts were downloaded and bundled locally (`app/fonts/`) to simulate a secure, air-gapped financial environment.
3. **State Persistence:** The swap amount is held in React Context (`SwapProvider`). Navigation uses native Next.js routing (`router.push()`), and clicking the back button successfully restores the user's previously entered amount.
4. **Scroll Overflow:** The `swap` screen was intentionally designed with extensive "Risk Warning" disclosures below the fold. This forces the screen height well past `844px`, allowing the SDK to test its *Scroll Reversal* behavioral signal.

---

## 📁 Folder Structure

```text
demo-platform/
├── app/                      # Next.js App Router (All Pages)
│   ├── fonts/                # Locally bundled .woff2 font files
│   ├── swap/                 # Screen 2: Amount Entry & Disclosures
│   ├── confirm/              # Screen 3: Transaction Review
│   ├── success/              # Screen 4: Completion Screen
│   ├── globals.css           # Tailwind base & Viewport lock CSS
│   ├── layout.tsx            # Root HTML shell & Desktop Fallback
│   ├── page.tsx              # Screen 1: Wallet Overview
│   └── providers.tsx         # React Context for State Persistence
├── components/ui/            # Shadcn UI Components
│   ├── button.tsx            
│   ├── card.tsx              
│   └── input.tsx             
├── e2e/                      # Playwright E2E Tests
│   └── flow.spec.ts          # Automated verification of the 7 selectors
├── playwright.config.ts      # Test config (Forces Chromium + iPhone 14)
└── package.json              # Dependencies & Scripts
```

---

## 🚀 How to Run & Test

First, ensure you have run `npm install` to generate the `node_modules` folder.

**Local Development (Computer):**
```bash
npm run dev
```
*Opens at `http://localhost:3000`. Use Chrome DevTools (F12) Device Emulation to view as an iPhone.*

**Network Development (Phone Testing):**
```bash
npm run dev:network
```
*Binds to `0.0.0.0`. Allows you to connect to your computer's local IP address (e.g., `http://192.168.X.X:3000`) directly from your mobile phone.*

**Automated Testing:**
```bash
npx playwright test --reporter=list
```
*Spins up a headless Chromium browser and verifies that all 4 screens can be navigated, state persists, no external networks are called, and all 7 `data-heed` selectors are queryable.*
