"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface SwapState {
  amount: string;
  fromToken: string;
  toToken: string;
}

interface SwapContextType {
  swapState: SwapState;
  setAmount: (amount: string) => void;
  resetSwap: () => void;
}

const defaultState: SwapState = {
  amount: "",
  fromToken: "ETH",
  toToken: "USDC",
};

const SwapContext = createContext<SwapContextType | undefined>(undefined);

export function SwapProvider({ children }: { children: React.ReactNode }) {
  const [swapState, setSwapState] = useState<SwapState>(defaultState);

  const setAmount = useCallback((amount: string) => {
    setSwapState((prev) => ({ ...prev, amount }));
  }, []);

  const resetSwap = useCallback(() => {
    setSwapState(defaultState);
  }, []);

  return (
    <SwapContext.Provider value={{ swapState, setAmount, resetSwap }}>
      {children}
    </SwapContext.Provider>
  );
}

export function useSwap() {
  const context = useContext(SwapContext);
  if (context === undefined) {
    throw new Error("useSwap must be used within a SwapProvider");
  }
  return context;
}
