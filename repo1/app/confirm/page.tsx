"use client";

import { useRouter } from "next/navigation";
import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

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
      <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6">
        <div className="w-full max-w-[390px] text-center">
          <div className="mb-6 text-5xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold text-white">
            No swap details
          </h2>
          <p className="mb-8 text-sm text-zinc-400">
            Please go back and enter an amount to swap.
          </p>
          <Button
            data-heed="back-btn"
            variant="outline"
            className="w-full border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            onClick={() => router.push("/swap")}
          >
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="px-6 pt-12 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Confirm Swap
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Review your swap details before confirming
        </p>
      </div>

      {/* Swap Summary Card */}
      <div className="flex-1 px-6">
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader>
            <CardTitle className="text-zinc-300">Swap Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* From / To */}
            <div className="flex items-center justify-between rounded-lg bg-zinc-800/60 p-4">
              <div className="space-y-1">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  From
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-semibold text-white">
                    {numAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 6,
                    })}
                  </span>
                  <span className="text-sm font-medium text-zinc-400">ETH</span>
                </div>
              </div>

              <div className="text-2xl text-zinc-600">→</div>

              <div className="space-y-1 text-right">
                <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                  To
                </span>
                <div className="flex items-baseline justify-end gap-2">
                  <span className="text-lg font-semibold text-emerald-400">
                    {received.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-sm font-medium text-zinc-400">
                    USDC
                  </span>
                </div>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Exchange Rate</span>
                <span className="text-sm font-medium text-zinc-200">
                  1 ETH = 2,485.00 USDC
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Network Fee</span>
                <span className="text-sm font-medium text-zinc-200">
                  {networkFee.toLocaleString(undefined, {
                    minimumFractionDigits: 6,
                    maximumFractionDigits: 6,
                  })}{" "}
                  ETH
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Minimum Received</span>
                <span className="text-sm font-medium text-zinc-200">
                  {minimumReceived.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  USDC
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buttons */}
        <div className="mt-8 space-y-3 pb-10">
          <Button
            data-heed="confirm-cta"
            className="h-12 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white hover:bg-emerald-500"
            onClick={() => router.push("/success")}
          >
            Confirm Swap
          </Button>
          <Button
            data-heed="back-btn"
            variant="outline"
            className="h-12 w-full rounded-xl border-zinc-700 text-base text-zinc-300 hover:bg-zinc-800"
            onClick={() => router.push("/swap")}
          >
            Back
          </Button>
        </div>
      </div>
    </div>
  );
}
