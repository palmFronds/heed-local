"use client";

import { useSwap } from "@/app/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Header */}
      <div className="px-5 pt-14 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push("/")}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to wallet"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-xl font-semibold text-foreground">Swap</h1>
        </div>
      </div>

      {/* From Token Section */}
      <div className="px-5 mb-3">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">From</span>
              <span className="text-xs text-muted-foreground">
                Balance: 1.42 ETH
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 shrink-0">
                <span className="text-lg">◈</span>
                <span className="font-medium text-sm">ETH</span>
              </div>
              <Input
                data-heed="amount-input"
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => {
                  const val = e.target.value;
                  // Allow only valid decimal input
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    setAmount(val);
                  }
                }}
                className="text-right text-2xl font-mono font-semibold bg-transparent border-none focus-visible:ring-0 focus-visible:border-none h-auto py-1 placeholder:text-muted-foreground/40"
              />
            </div>
            {numericAmount > 0 && (
              <div className="text-right text-xs text-muted-foreground mt-1">
                ≈ ${(numericAmount * ETH_USDC_RATE).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Swap Direction Indicator */}
      <div className="flex justify-center -my-1 relative z-10">
        <div className="w-9 h-9 rounded-full bg-secondary border-2 border-background flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
            <path d="M12 5v14" />
            <path d="M19 12l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* To Token Section */}
      <div className="px-5 mt-3 mb-5">
        <Card className="border-border/50">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">To</span>
              <span className="text-xs text-muted-foreground">
                Balance: 4,250.00 USDC
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2 shrink-0">
                <span className="text-lg">💲</span>
                <span className="font-medium text-sm">USDC</span>
              </div>
              <div className="flex-1 text-right text-2xl font-mono font-semibold text-foreground/70 py-1">
                {numericAmount > 0
                  ? grossReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "0.00"}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction Details — these extend below the 844px fold */}
      <div className="px-5 flex-1 flex flex-col gap-3 pb-32">
        {/* Exchange Rate */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Exchange Rate</span>
          <span className="text-sm font-mono text-foreground">
            1 ETH = {ETH_USDC_RATE.toLocaleString()} USDC
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Fee Row — data-heed selector */}
        <div
          data-heed="fee-row"
          className="flex justify-between items-center py-2.5 px-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Network Fee</span>
            <span className="text-xs text-muted-foreground/60">(0.3%)</span>
          </div>
          <span className="text-sm font-mono text-foreground">
            {numericAmount > 0
              ? `${fee.toFixed(6)} ETH`
              : "—"}
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Minimum Received Row — data-heed selector */}
        <div
          data-heed="min-received-row"
          className="flex justify-between items-center py-2.5 px-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Min. Received</span>
            <span className="text-xs text-muted-foreground/60">(0.5% slippage)</span>
          </div>
          <span className="text-sm font-mono text-foreground">
            {numericAmount > 0
              ? `${minReceived.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
              : "—"}
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Gas Estimate */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Gas Estimate</span>
          <span className="text-sm font-mono text-foreground">
            ~{GAS_ESTIMATE_ETH} ETH (${GAS_ESTIMATE_USD})
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Price Impact */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Price Impact</span>
          <span className={`text-sm font-mono ${parseFloat(priceImpact) < 1 ? "text-primary" : "text-destructive"}`}>
            {numericAmount > 0 ? `${priceImpact}%` : "—"}
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Route */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Route</span>
          <span className="text-sm text-foreground">via Uniswap V3</span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Slippage Tolerance */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Slippage Tolerance</span>
          <span className="text-sm font-mono text-foreground">0.5%</span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Network */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Network</span>
          <span className="text-sm text-foreground">Ethereum Mainnet</span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Max Transaction Cost */}
        <div className="flex justify-between items-center py-2.5 px-1">
          <span className="text-sm text-muted-foreground">Max Tx Cost</span>
          <span className="text-sm font-mono text-foreground">
            {numericAmount > 0
              ? `${(fee + GAS_ESTIMATE_ETH).toFixed(6)} ETH`
              : "—"}
          </span>
        </div>

        <div className="h-px bg-border/50" />

        {/* Transaction Details Card */}
        <Card className="border-border/30 mt-2">
          <CardContent className="pt-4">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Transaction Details
            </h3>
            <div className="space-y-2.5">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Order Type</span>
                <span className="text-xs text-foreground">Market Swap</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Liquidity Source</span>
                <span className="text-xs text-foreground">Uniswap V3 Pool</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Expected Confirmation</span>
                <span className="text-xs text-foreground">~12 seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Max Slippage Protection</span>
                <span className="text-xs text-foreground">Enabled</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Risk Warning */}
        <Card className="border-destructive/20 mt-2">
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <span className="text-destructive text-sm mt-0.5">⚠</span>
              <div>
                <h4 className="text-sm font-medium text-destructive/90 mb-1">
                  Risk Disclosure
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Cryptocurrency transactions are irreversible. The exchange rate
                  shown is an estimate and may differ from the final execution
                  price due to market volatility. Network fees are paid to
                  validators and are non-refundable. By proceeding, you
                  acknowledge that you understand these risks.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional disclaimers for scroll height */}
        <div className="mt-2 space-y-3">
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            Swap routing is optimized for best execution across available
            liquidity pools. Actual received amount may vary based on pool
            depth and concurrent transactions.
          </p>
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            This transaction requires approval of the token spending allowance.
            Gas fees for approval transactions are separate from the swap gas
            estimate shown above.
          </p>
          <p className="text-xs text-muted-foreground/50 leading-relaxed">
            Price data is sourced from on-chain oracles and may experience
            brief delays during periods of high network congestion. All amounts
            are denominated in their respective token units.
          </p>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[390px] px-5 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        <Button
          data-heed="proceed-cta"
          className={`w-full h-14 text-base font-semibold rounded-2xl transition-all ${
            canProceed
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
              : "bg-muted text-muted-foreground cursor-not-allowed"
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
