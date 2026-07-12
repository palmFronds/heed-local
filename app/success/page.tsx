"use client";

import { useRouter } from "next/navigation";
import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";

export default function SuccessPage() {
  const router = useRouter();
  const { swapState, resetSwap } = useSwap();

  const ethAmount = swapState.amount || "0";
  const usdcAmount = (parseFloat(ethAmount || "0") * 2481.37).toFixed(2);

  function handleDone() {
    resetSwap();
    router.push("/");
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0a0a0f] px-4">
      {/* Confetti particles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <span
            key={i}
            className="confetti-particle absolute block h-1.5 w-1.5 rounded-full"
            style={{
              left: `${8 + i * 7.5}%`,
              animationDelay: `${i * 0.18}s`,
              backgroundColor:
                i % 3 === 0
                  ? "#22c55e"
                  : i % 3 === 1
                    ? "#4ade80"
                    : "#86efac",
            }}
          />
        ))}
      </div>

      <div
        data-heed="flow-complete"
        className="flex w-full max-w-[390px] flex-col items-center gap-6 py-12"
      >
        {/* Animated checkmark */}
        <div className="checkmark-ring relative flex h-28 w-28 items-center justify-center rounded-full">
          <svg
            className="checkmark-icon h-14 w-14"
            viewBox="0 0 52 52"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              className="checkmark-path"
              d="M14 27L22 35L38 17"
              stroke="#22c55e"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* Heading */}
        <h1 className="text-center text-2xl font-bold tracking-tight text-white">
          Transaction Complete
        </h1>

        {/* Summary */}
        <p className="text-center text-sm leading-relaxed text-zinc-400">
          You swapped{" "}
          <span className="font-semibold text-white">{ethAmount} ETH</span> for{" "}
          <span className="font-semibold text-green-400">
            {usdcAmount} USDC
          </span>
        </p>

        {/* Subtle divider */}
        <div className="h-px w-2/3 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

        {/* Details card */}
        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Status</span>
            <span className="flex items-center gap-1.5 font-medium text-green-400">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              Confirmed
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Network</span>
            <span className="text-zinc-300">Ethereum</span>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
            <span>Gas fee</span>
            <span className="text-zinc-300">~$2.14</span>
          </div>
        </div>

        {/* Done button */}
        <Button
          className="mt-2 h-12 w-full rounded-xl bg-green-500 text-base font-semibold text-black transition-colors hover:bg-green-400"
          onClick={handleDone}
        >
          Done
        </Button>
      </div>

      {/* CSS animations */}
      <style>{`
        /* Checkmark ring pulse */
        .checkmark-ring {
          background: radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%);
          box-shadow: 0 0 40px rgba(34,197,94,0.15);
          animation: ring-pulse 2.4s ease-in-out infinite;
        }

        @keyframes ring-pulse {
          0%, 100% {
            box-shadow: 0 0 20px rgba(34,197,94,0.12), 0 0 60px rgba(34,197,94,0.06);
          }
          50% {
            box-shadow: 0 0 30px rgba(34,197,94,0.25), 0 0 80px rgba(34,197,94,0.12);
          }
        }

        /* Checkmark stroke drawing */
        .checkmark-path {
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: draw-check 0.6s ease-out 0.3s forwards;
        }

        @keyframes draw-check {
          to {
            stroke-dashoffset: 0;
          }
        }

        /* Checkmark icon scale-in */
        .checkmark-icon {
          animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both;
        }

        @keyframes scale-in {
          from {
            transform: scale(0);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Confetti particles */
        .confetti-particle {
          top: -6px;
          animation: confetti-fall 2.8s ease-in forwards;
          opacity: 0;
        }

        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(100dvh) rotate(720deg) scale(0.3);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
