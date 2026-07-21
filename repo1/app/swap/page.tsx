"use client";

import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

const ETH_USDC_RATE = 2485.0;
const FEE_RATE = 0.003; // 0.3%
const SLIPPAGE = 0.005; // 0.5%
const GAS_ESTIMATE_ETH = 0.0012;
const GAS_ESTIMATE_USD = 2.98;

export default function SwapPage() {
  const { swapState, setAmount } = useSwap();
  const router = useRouter();
  const amount = swapState.amount;

  const numericAmount = parseFloat(amount) || 0;
  const fee = numericAmount * FEE_RATE;
  const grossReceived = numericAmount * ETH_USDC_RATE;
  const minReceived = grossReceived * (1 - SLIPPAGE);
  const priceImpact = numericAmount > 0 ? (numericAmount * 0.01).toFixed(2) : "0.00";

  const canProceed = numericAmount > 0;

  const handleProceed = () => {
    if (canProceed) {
      router.push("/confirm");
    }
  };

  return (
    <div className="flex flex-col min-h-dvh bg-page-confirm">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.10] transition-all"
            aria-label="Back to wallet"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-white leading-tight">Swap</h1>
            <p className="text-[11px] text-white/35">ETH → USDC via Uniswap V3</p>
          </div>
        </div>
      </div>

      {/* ── From Token ── */}
      <div className="px-5 mb-2">
        <div className="glass-card rounded-2xl px-4 pt-3.5 pb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-semibold tracking-widest text-white/35 uppercase">You send</span>
            <span className="text-[11px] text-white/35">
              Balance: <span className="text-white/55 font-medium">1.42 ETH</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="token-icon bg-blue-500/10 border-blue-500/25 text-blue-400">⟠</div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-white">ETH</span>
              <span className="text-[11px] text-white/30">Ethereum</span>
            </div>
            <Input
              data-heed="amount-input"
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                  setAmount(val);
                }
              }}
              className="heed-input flex-1 text-right text-3xl font-bold font-mono bg-transparent border-none focus-visible:ring-0 h-auto py-0 text-white placeholder:text-white/20"
            />
          </div>
          {numericAmount > 0 && (
            <div className="text-right text-xs text-white/30 mt-2 font-mono">
              ≈ ${(numericAmount * ETH_USDC_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
        </div>
      </div>

      {/* ── Swap Direction Arrow ── */}
      <div className="flex justify-center -my-0.5 relative z-10">
        <div className="swap-arrow h-9 w-9 rounded-full bg-[#0a0e1a] border-2 border-white/[0.08] flex items-center justify-center shadow-lg">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-400">
            <path d="M12 5v14" />
            <path d="M19 12l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* ── To Token ── */}
      <div className="px-5 mt-2 mb-4">
        <div className="glass-card rounded-2xl px-4 pt-3.5 pb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="text-[11px] font-semibold tracking-widest text-white/35 uppercase">You receive</span>
            <span className="text-[11px] text-white/35">
              Balance: <span className="text-white/55 font-medium">4,250.00 USDC</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="token-icon bg-emerald-500/10 border-emerald-500/25 text-emerald-400">💲</div>
            <div className="flex flex-col">
              <span className="text-[15px] font-bold text-white">USDC</span>
              <span className="text-[11px] text-white/30">USD Coin</span>
            </div>
            <div className={`flex-1 text-right text-3xl font-bold font-mono py-0 ${numericAmount > 0 ? "text-emerald-400" : "text-white/20"}`}>
              {numericAmount > 0
                ? grossReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : "0.00"}
            </div>
          </div>
          {numericAmount > 0 && (
            <div className="flex items-center justify-end gap-1 mt-2">
              <span className="text-[11px] text-emerald-400/70 font-mono">+${grossReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction Details — below-fold content for scroll telemetry ── */}
      <div className="px-5 flex-1 flex flex-col gap-0 pb-32">

        {/* Rate Summary Strip */}
        <div className="glass-card rounded-2xl px-4 py-3 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-[13px] text-white/50">Exchange Rate</span>
            <span className="text-[13px] font-mono font-semibold text-white/80">
              1 ETH = {ETH_USDC_RATE.toLocaleString()} USDC
            </span>
          </div>
        </div>

        {/* Detailed Rows */}
        <div className="glass-card rounded-2xl overflow-hidden mb-3">

          {/* Fee Row — data-heed selector */}
          <div
            data-heed="fee-row"
            className="flex justify-between items-center px-4 py-3.5 border-b border-white/[0.05]"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-orange-500/15 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="text-[13px] text-white/55">Network Fee</span>
              <span className="text-[11px] text-white/25 bg-white/5 rounded px-1.5 py-0.5">0.3%</span>
            </div>
            <span className="text-[13px] font-mono font-semibold text-white/80">
              {numericAmount > 0 ? `${fee.toFixed(6)} ETH` : "—"}
            </span>
          </div>

          {/* Minimum Received Row — data-heed selector */}
          <div
            data-heed="min-received-row"
            className="flex justify-between items-center px-4 py-3.5 border-b border-white/[0.05]"
          >
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span className="text-[13px] text-white/55">Min. Received</span>
              <span className="text-[11px] text-white/25 bg-white/5 rounded px-1.5 py-0.5">0.5% slippage</span>
            </div>
            <span className="text-[13px] font-mono font-semibold text-white/80">
              {numericAmount > 0
                ? `${minReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
                : "—"}
            </span>
          </div>

          {/* Gas Estimate */}
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/[0.05]">
            <span className="text-[13px] text-white/55">Gas Estimate</span>
            <span className="text-[13px] font-mono font-semibold text-white/80">
              ~{GAS_ESTIMATE_ETH} ETH (${GAS_ESTIMATE_USD})
            </span>
          </div>

          {/* Price Impact */}
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/[0.05]">
            <span className="text-[13px] text-white/55">Price Impact</span>
            <span className={`text-[13px] font-mono font-semibold ${parseFloat(priceImpact) < 1 ? "text-emerald-400" : "text-red-400"}`}>
              {numericAmount > 0 ? `${priceImpact}%` : "—"}
            </span>
          </div>

          {/* Route */}
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/[0.05]">
            <span className="text-[13px] text-white/55">Route</span>
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-purple-400"/>
              <span className="text-[13px] text-white/80">Uniswap V3</span>
            </div>
          </div>

          {/* Slippage */}
          <div className="flex justify-between items-center px-4 py-3.5">
            <span className="text-[13px] text-white/55">Slippage Tolerance</span>
            <span className="text-[13px] font-mono font-semibold text-white/80">0.5%</span>
          </div>
        </div>

        {/* Transaction Details Card */}
        <div className="glass-card rounded-2xl px-4 py-4 mb-3">
          <h3 className="text-[12px] font-bold tracking-wider text-white/35 uppercase mb-3">
            Transaction Details
          </h3>
          <div className="space-y-2.5">
            {[
              ["Order Type", "Market Swap"],
              ["Liquidity Source", "Uniswap V3 Pool"],
              ["Expected Confirmation", "~12 seconds"],
              ["Max Slippage Protection", "Enabled"],
              ["Network", "Ethereum Mainnet"],
              ["Max Tx Cost", numericAmount > 0 ? `${(fee + GAS_ESTIMATE_ETH).toFixed(6)} ETH` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-[12px] text-white/35">{label}</span>
                <span className="text-[12px] text-white/65 font-medium">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Warning Card */}
        <div className="rounded-2xl border border-red-500/15 bg-red-500/[0.04] px-4 py-4 mb-3">
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div>
              <h4 className="text-[13px] font-semibold text-red-400/90 mb-1">Risk Disclosure</h4>
              <p className="text-[12px] text-white/35 leading-relaxed">
                Cryptocurrency transactions are irreversible. The exchange rate shown is an estimate and may differ from the final execution price due to market volatility. Network fees are paid to validators and are non-refundable.
              </p>
            </div>
          </div>
        </div>

        {/* Additional disclaimers for scroll height */}
        <div className="space-y-3 px-1">
          <p className="text-[11px] text-white/20 leading-relaxed">
            Swap routing is optimized for best execution across available liquidity pools. Actual received amount may vary based on pool depth and concurrent transactions.
          </p>
          <p className="text-[11px] text-white/20 leading-relaxed">
            This transaction requires approval of the token spending allowance. Gas fees for approval transactions are separate from the swap gas estimate shown above.
          </p>
          <p className="text-[11px] text-white/20 leading-relaxed">
            Price data is sourced from on-chain oracles and may experience brief delays during periods of high network congestion. All amounts are denominated in their respective token units.
          </p>
        </div>
      </div>

      {/* ── Fixed Bottom CTA ── */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] px-5 pb-10 pt-5 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/95 to-transparent">
        <Button
          data-heed="proceed-cta"
          className={`w-full h-14 text-[16px] font-bold rounded-2xl tracking-wide transition-all ${
            canProceed
              ? "glow-green-btn bg-emerald-500 text-[#0a0e1a] hover:bg-emerald-400"
              : "bg-white/[0.06] text-white/25 cursor-not-allowed border border-white/[0.06]"
          }`}
          onClick={handleProceed}
          disabled={!canProceed}
        >
          {canProceed ? "Proceed to Confirm" : "Enter an amount"}
        </Button>
      </div>
    </div>
  );
}
