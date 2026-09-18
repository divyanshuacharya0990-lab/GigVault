"use client";

import React, { createContext, useContext, useState } from "react";
import { ethers } from "ethers";

interface AppState {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  holderWallet: ethers.Wallet | null;
  setHolderWallet: (wallet: ethers.Wallet | null) => void;
  ticketId: string | null;
  setTicketId: (id: string | null) => void;
  commitment: string | null;
  setCommitment: (commitment: string | null) => void;
  passportData: any;
  setPassportData: (data: any) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [holderWallet, setHolderWallet] = useState<ethers.Wallet | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<string | null>(null);
  const [passportData, setPassportData] = useState<any>(null);

  return (
    <AppStateContext.Provider
      value={{
        sessionId,
        setSessionId,
        holderWallet,
        setHolderWallet,
        ticketId,
        setTicketId,
        commitment,
        setCommitment,
        passportData,
        setPassportData
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
