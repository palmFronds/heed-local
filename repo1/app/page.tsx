"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

const assets = [
  {
    icon: "⟠",
    name: "Ethereum",
    symbol: "ETH",
    balance: "1.42 ETH",
    usd: "$3,530.70",
    iconBg: "bg-blue-500/15 text-blue-400",
  },
  {
    icon: "💲",
    name: "USD Coin",
    symbol: "USDC",
    balance: "4,250.00 USDC",
    usd: "$4,250.00",
    iconBg: "bg-emerald-500/15 text-emerald-400",
  },
  {
    icon: "◎",
    name: "Solana",
    symbol: "SOL",
    balance: "32.5 SOL",
    usd: "$4,699.62",
    iconBg: "bg-purple-500/15 text-purple-400",
  },
];

export default function WalletOverview() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#0a0e1a]">
      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between px-6 pt-3 pb-1 text-xs font-semibold text-white/80">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <span>●●●●○</span>
          <span>WiFi</span>
          <span>🔋</span>
        </div>
      </div>

      {/* ── Greeting + Balance ── */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span className="text-base">👛</span>
          <span>Good morning</span>
        </div>

        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white">
          $12,480
          <span className="text-3xl text-white/60">.32</span>
        </h1>
        <p className="mt-1 text-xs text-emerald-400">
          ▲ 2.4% today
        </p>
      </div>

      {/* ── Quick Actions Row ── */}
      <div className="flex items-center gap-3 px-6 pt-4 pb-2">
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-400">
          Portfolio
        </span>
        <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-500">
          Activity
        </span>
      </div>

      {/* ── Asset List ── */}
      <div className="mt-2 flex flex-1 flex-col gap-2.5 px-5">
        <h2 className="px-1 text-xs font-medium tracking-wider text-gray-500 uppercase">
          Assets
        </h2>

        {assets.map((asset) => (
          <div
            key={asset.symbol}
            className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-white/[0.06] backdrop-blur-sm transition-colors hover:bg-white/[0.07]"
          >
            {/* Token icon */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${asset.iconBg}`}
            >
              {asset.icon}
            </div>

            {/* Name + Balance */}
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-semibold text-white">
                {asset.name}
              </span>
              <span className="text-xs text-gray-500">{asset.balance}</span>
            </div>

            {/* USD Value */}
            <span className="text-sm font-medium text-white/90">
              {asset.usd}
            </span>
          </div>
        ))}
      </div>

      {/* ── Swap CTA ── */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a] to-transparent px-5 pt-6 pb-8">
        <Link href="/swap">
          <Button
            className="h-14 w-full rounded-2xl text-base font-semibold"
            size="lg"
          >
            Swap
          </Button>
        </Link>
      </div>
    </div>
  );
}
