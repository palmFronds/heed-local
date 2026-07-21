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
    change: "+1.8%",
    changeUp: true,
    iconBg: "bg-blue-500/10",
    iconBorder: "border-blue-500/25",
    iconColor: "text-blue-400",
  },
  {
    icon: "💲",
    name: "USD Coin",
    symbol: "USDC",
    balance: "4,250.00 USDC",
    usd: "$4,250.00",
    change: "+0.01%",
    changeUp: true,
    iconBg: "bg-emerald-500/10",
    iconBorder: "border-emerald-500/25",
    iconColor: "text-emerald-400",
  },
  {
    icon: "◎",
    name: "Solana",
    symbol: "SOL",
    balance: "32.5 SOL",
    usd: "$4,699.62",
    change: "+3.2%",
    changeUp: true,
    iconBg: "bg-purple-500/10",
    iconBorder: "border-purple-500/25",
    iconColor: "text-purple-400",
  },
];

export default function WalletOverview() {
  return (
    <div className="flex min-h-dvh flex-col bg-page">

      {/* ── Simulated Status Bar ── */}
      <div className="flex items-center justify-between px-6 pt-4 pb-1 text-[11px] font-semibold text-white/40 select-none">
        <span>9:41</span>
        <div className="flex items-center gap-1.5">
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
            <rect x="0" y="4" width="3" height="7" rx="0.8" fill="currentColor" opacity="0.3"/>
            <rect x="4.5" y="2.5" width="3" height="8.5" rx="0.8" fill="currentColor" opacity="0.5"/>
            <rect x="9" y="0.5" width="3" height="10.5" rx="0.8" fill="currentColor" opacity="0.8"/>
            <rect x="13.5" y="0" width="2.5" height="11" rx="0.8" fill="currentColor"/>
          </svg>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path d="M8 2.5C10.5 2.5 12.7 3.5 14.3 5.2L15.5 4C13.6 2 11 1 8 1 5 1 2.4 2 0.5 4L1.7 5.2C3.3 3.5 5.5 2.5 8 2.5Z" fill="currentColor" opacity="0.4"/>
            <path d="M8 5C9.9 5 11.5 5.8 12.7 7L13.9 5.8C12.4 4.3 10.3 3.5 8 3.5 5.7 3.5 3.6 4.3 2.1 5.8L3.3 7C4.5 5.8 6.1 5 8 5Z" fill="currentColor" opacity="0.7"/>
            <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
          </svg>
          <div className="flex items-center gap-0.5">
            <div className="h-2.5 w-5 rounded-sm border border-white/30 p-px">
              <div className="h-full w-[75%] rounded-[2px] bg-white/70" />
            </div>
          </div>
        </div>
      </div>

      {/* ── Greeting + Total Balance ── */}
      <div className="px-6 pt-8 pb-2">
        <p className="text-sm text-white/40 font-medium tracking-wide">Total Balance</p>

        <h1 className="mt-2 text-[42px] font-bold tracking-tight text-white leading-none">
          $12,480
          <span className="text-3xl text-white/40 font-semibold">.32</span>
        </h1>

        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1L9 5H6.5V9H3.5V5H1L5 1Z" fill="currentColor"/>
            </svg>
            2.4% today
          </span>
          <span className="text-xs text-white/25">+$291.36</span>
        </div>
      </div>

      {/* ── Quick Action Pills ── */}
      <div className="flex items-center gap-2 px-6 pt-5 pb-1">
        {["Portfolio", "Activity", "NFTs"].map((label, i) => (
          <button
            key={label}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              i === 0
                ? "bg-white/10 text-white/80 border border-white/10"
                : "text-white/30 hover:text-white/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Section Label ── */}
      <div className="px-6 pt-5 pb-2">
        <h2 className="text-[11px] font-semibold tracking-[0.1em] text-white/30 uppercase">
          Assets
        </h2>
      </div>

      {/* ── Asset List ── */}
      <div className="flex flex-1 flex-col gap-2 px-5">
        {assets.map((asset) => (
          <div
            key={asset.symbol}
            className="asset-row flex items-center gap-3.5 rounded-2xl glass-card px-4 py-3.5 cursor-default"
          >
            {/* Token icon */}
            <div
              className={`token-icon ${asset.iconBg} ${asset.iconBorder} ${asset.iconColor}`}
            >
              {asset.icon}
            </div>

            {/* Name + ticker */}
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold text-white leading-tight">
                {asset.name}
              </span>
              <span className="text-xs text-white/35 font-medium">{asset.balance}</span>
            </div>

            {/* USD Value + change */}
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[15px] font-semibold text-white/90">
                {asset.usd}
              </span>
              <span className={`text-xs font-medium ${asset.changeUp ? "text-emerald-400" : "text-red-400"}`}>
                {asset.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Swap CTA ── */}
      <div className="sticky bottom-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/90 to-transparent px-5 pt-8 pb-10">
        <Link href="/swap">
          <Button
            className="glow-green-btn h-14 w-full rounded-2xl bg-emerald-500 text-base font-bold text-[#0a0e1a] hover:bg-emerald-400 active:bg-emerald-600 tracking-wide"
            size="lg"
          >
            Swap Assets
          </Button>
        </Link>
      </div>
    </div>
  );
}
