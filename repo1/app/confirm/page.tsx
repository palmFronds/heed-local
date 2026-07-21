"use client";

import { useRouter } from "next/navigation";
import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";

export default function ConfirmPage() {
  const router = useRouter();
  const { swapState } = useSwap();
  const amount = swapState.amount;

  const numAmount = parseFloat(amount) || 0;
  const rate = 2485.0;
  const received = numAmount * rate;
  const networkFee = numAmount * 0.003;
  const minimumReceived = received * 0.995;

  if (!amount || amount === "0" || numAmount === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6">
        <div className="w-full text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/20">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-orange-400">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-bold text-white">No swap details</h2>
          <p className="mb-8 text-sm text-white/40">Please go back and enter an amount to swap.</p>
          <Button
            data-heed="back-btn"
            className="w-full h-12 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/70 hover:bg-white/[0.10] font-semibold"
            onClick={() => router.push("/swap")}
          >
            ← Back to Swap
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-page-confirm text-white">

      {/* ── Header ── */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            data-heed="back-btn"
            onClick={() => router.push("/swap")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.10] transition-all"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-white leading-tight">Confirm Swap</h1>
            <p className="text-[11px] text-white/35">Review details before confirming</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 flex flex-col gap-4">

        {/* ── Main Swap Summary ── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* From → To hero section */}
          <div className="px-4 py-5 flex items-center gap-4">
            {/* From */}
            <div className="flex-1">
              <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-2">Send</p>
              <div className="flex items-center gap-2.5">
                <div className="token-icon bg-blue-500/10 border-blue-500/25 text-blue-400 h-9 w-9 text-base">⟠</div>
                <div>
                  <p className="text-[22px] font-bold text-white leading-none">
                    {numAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </p>
                  <p className="text-[12px] text-white/40 font-medium">ETH</p>
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center gap-1">
              <div className="h-8 w-8 rounded-full bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/40">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>

            {/* To */}
            <div className="flex-1 text-right">
              <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-2">Receive</p>
              <div className="flex items-center justify-end gap-2.5">
                <div>
                  <p className="text-[22px] font-bold text-emerald-400 leading-none">
                    {received.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[12px] text-white/40 font-medium text-right">USDC</p>
                </div>
                <div className="token-icon bg-emerald-500/10 border-emerald-500/25 text-emerald-400 h-9 w-9 text-base">💲</div>
              </div>
            </div>
          </div>

          {/* Subtle rate line */}
          <div className="px-4 pb-4">
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.05] px-3 py-2.5 flex items-center justify-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400/60 animate-pulse"/>
              <span className="text-[12px] text-white/40 font-mono">1 ETH = 2,485.00 USDC</span>
            </div>
          </div>
        </div>

        {/* ── Details Breakdown ── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          {[
            {
              label: "Network Fee",
              value: `${networkFee.toLocaleString(undefined, { minimumFractionDigits: 6, maximumFractionDigits: 6 })} ETH`,
              muted: false,
            },
            {
              label: "Minimum Received",
              value: `${minimumReceived.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
              muted: false,
              highlight: true,
            },
            {
              label: "Price Impact",
              value: "< 0.01%",
              muted: false,
              green: true,
            },
            {
              label: "Route",
              value: "ETH → USDC (Uniswap V3)",
              muted: true,
            },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex justify-between items-center px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-white/[0.05]" : ""}`}
            >
              <span className="text-[13px] text-white/45">{row.label}</span>
              <span className={`text-[13px] font-semibold font-mono ${row.green ? "text-emerald-400" : row.highlight ? "text-white/90" : "text-white/70"}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── Warning Note ── */}
        <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] px-4 py-3 flex gap-3 items-start">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400/70 mt-0.5 shrink-0">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p className="text-[12px] text-white/35 leading-relaxed">
            This swap is irreversible. The final amount received may differ slightly due to on-chain price movement. By confirming, you accept these conditions.
          </p>
        </div>

        {/* ── Action Buttons ── */}
        <div className="flex flex-col gap-3 pb-10">
          <Button
            data-heed="confirm-cta"
            className="glow-green-btn h-14 w-full rounded-2xl bg-emerald-500 text-[16px] font-bold text-[#0a0e1a] hover:bg-emerald-400 tracking-wide"
            onClick={() => router.push("/success")}
          >
            Confirm Swap
          </Button>
        </div>
      </div>
    </div>
  );
}
