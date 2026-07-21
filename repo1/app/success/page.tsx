"use client";

import { useRouter } from "next/navigation";
import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";

export default function SuccessPage() {
  const router = useRouter();
  const { swapState, resetSwap } = useSwap();

  const ethAmount = swapState.amount || "0";
  const numEth = parseFloat(ethAmount || "0");
  const usdcAmount = (numEth * 2481.37).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const usdValue = (numEth * 2481.37).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function handleDone() {
    resetSwap();
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-page px-5">

      {/* Confetti particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="confetti-particle absolute block h-1.5 w-1.5 rounded-full"
            style={{
              left: `${5 + i * 5.8}%`,
              animationDelay: `${i * 0.15}s`,
              backgroundColor:
                i % 4 === 0
                  ? "#4ade80"
                  : i % 4 === 1
                    ? "#22c55e"
                    : i % 4 === 2
                      ? "#86efac"
                      : "#a7f3d0",
            }}
          />
        ))}
      </div>

      <div
        data-heed="flow-complete"
        className="success-card-in flex w-full flex-col items-center gap-6 py-10"
      >
        {/* Animated checkmark ring */}
        <div className="checkmark-ring relative flex h-28 w-28 items-center justify-center rounded-full">
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full border border-emerald-500/20" />
          <svg
            className="checkmark-icon h-14 w-14"
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="checkmark-path"
              d="M14 27L22 35L38 17"
              stroke="#4ade80"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <div className="text-center">
          <h1 className="text-[26px] font-bold tracking-tight text-white">
            Transaction Complete
          </h1>
          <p className="mt-1.5 text-[14px] text-white/40 leading-relaxed">
            Your transaction was confirmed on Ethereum
          </p>
        </div>

        {/* Swap Summary Card */}
        <div className="glass-card w-full rounded-2xl overflow-hidden">
          {/* Amount hero */}
          <div className="px-5 py-5 border-b border-white/[0.06]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-1">Sent</p>
                <p className="text-[20px] font-bold text-white">{ethAmount} <span className="text-white/50 font-semibold text-[15px]">ETH</span></p>
              </div>
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold tracking-widest text-white/30 uppercase mb-1">Received</p>
                <p className="text-[20px] font-bold text-emerald-400">{usdcAmount} <span className="text-emerald-400/60 font-semibold text-[15px]">USDC</span></p>
              </div>
            </div>
          </div>

          {/* Details rows */}
          <div className="divide-y divide-white/[0.05]">
            {[
              {
                label: "Status",
                value: (
                  <span className="flex items-center gap-1.5 font-semibold text-emerald-400 text-[13px]">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Confirmed
                  </span>
                ),
              },
              { label: "Network", value: <span className="text-[13px] text-white/70 font-medium">Ethereum Mainnet</span> },
              { label: "Gas Paid", value: <span className="text-[13px] text-white/70 font-medium">~$2.14</span> },
              { label: "USD Value", value: <span className="text-[13px] text-white/70 font-medium">${usdValue}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-5 py-3">
                <span className="text-[12px] text-white/35">{label}</span>
                {value}
              </div>
            ))}
          </div>
        </div>

        {/* Transaction Hash stub */}
        <div className="w-full rounded-xl bg-white/[0.03] border border-white/[0.05] px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] text-white/25">Tx Hash</span>
          <span className="text-[11px] font-mono text-white/35 tracking-wide">0x3f4a…b9e2</span>
        </div>

        {/* CTA */}
        <Button
          className="glow-green-btn w-full h-14 rounded-2xl bg-emerald-500 text-[16px] font-bold text-[#0a0e1a] hover:bg-emerald-400 tracking-wide"
          onClick={handleDone}
        >
          Done
        </Button>

        <p className="text-[11px] text-white/20 text-center">
          Return to wallet
        </p>
      </div>
    </div>
  );
}
