"use client";

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Check, Plus, ArrowDownLeft, ArrowUpRight, AlertTriangle, Lock, Building2, UserCheck, Info } from "lucide-react";

export interface TransactionItem {
  id: string;
  date: string;
  description: string;
  vpa: string;
  cbsLegalName: string;
  entityType: "Corporate" | "Individual";
  type: "CREDIT" | "DEBIT";
  rawAmount: number;
  amount: string;
  confidenceTier: "high" | "low";
  railType: string;
  crossRefVerdict: "PASS" | "P2P" | "DEBIT_LOCKED";
  notes: string;
}

const STATEMENT_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1",
    date: "09-12",
    description: "SWIGGY PAYMENT",
    vpa: "swiggy.payout@icici",
    cbsLegalName: "BUNDL TECHNOLOGIES PRIVATE LIMITED",
    entityType: "Corporate",
    type: "CREDIT",
    rawAmount: 5240,
    amount: "+₹5,240",
    confidenceTier: "high",
    railType: "UPI Merchant Bulk",
    crossRefVerdict: "PASS",
    notes: "Weekly platform payout",
  },
  {
    id: "tx-2",
    date: "09-10",
    description: "MEENA KUMAR",
    vpa: "meena.kumar@sbi",
    cbsLegalName: "MEENA KUMAR",
    entityType: "Individual",
    type: "CREDIT",
    rawAmount: 2000,
    amount: "+₹2,000",
    confidenceTier: "low",
    railType: "UPI Personal",
    crossRefVerdict: "P2P",
    notes: "Family transfer (bidirectional)",
  },
  {
    id: "tx-3",
    date: "09-08",
    description: "MEENA KUMAR",
    vpa: "meena.kumar@sbi",
    cbsLegalName: "MEENA KUMAR",
    entityType: "Individual",
    type: "DEBIT",
    rawAmount: 500,
    amount: "-₹500",
    confidenceTier: "low",
    railType: "UPI Personal",
    crossRefVerdict: "DEBIT_LOCKED",
    notes: "Outgoing family transfer",
  },
  {
    id: "tx-4",
    date: "09-07",
    description: "ZOMATO HYPERPURE",
    vpa: "xxxx3239",
    cbsLegalName: "ZOMATO LIMITED",
    entityType: "Corporate",
    type: "CREDIT",
    rawAmount: 3820,
    amount: "+₹3,820",
    confidenceTier: "high",
    railType: "NEFT Salary Rail",
    crossRefVerdict: "PASS",
    notes: "Biweekly platform payout",
  },
  {
    id: "tx-5",
    date: "09-05",
    description: "SWIGGY PAYMENT",
    vpa: "swiggy.payout@icici",
    cbsLegalName: "BUNDL TECHNOLOGIES PRIVATE LIMITED",
    entityType: "Corporate",
    type: "CREDIT",
    rawAmount: 5180,
    amount: "+₹5,180",
    confidenceTier: "high",
    railType: "UPI Merchant Bulk",
    crossRefVerdict: "PASS",
    notes: "Weekly platform payout",
  },
  {
    id: "tx-6",
    date: "09-04",
    description: "RAHUL S",
    vpa: "rahul.sharma92@paytm",
    cbsLegalName: "RAHUL SHARMA",
    entityType: "Individual",
    type: "CREDIT",
    rawAmount: 850,
    amount: "+₹850",
    confidenceTier: "low",
    railType: "UPI Personal",
    crossRefVerdict: "P2P",
    notes: "Peer transfer (ad-hoc)",
  },
  {
    id: "tx-7",
    date: "09-03",
    description: "RAHUL S",
    vpa: "rahul.sharma92@paytm",
    cbsLegalName: "RAHUL SHARMA",
    entityType: "Individual",
    type: "DEBIT",
    rawAmount: 300,
    amount: "-₹300",
    confidenceTier: "low",
    railType: "UPI Personal",
    crossRefVerdict: "DEBIT_LOCKED",
    notes: "Outgoing peer transfer",
  },
  {
    id: "tx-8",
    date: "08-28",
    description: "SWIGGY PAYMENT",
    vpa: "swiggy.payout@icici",
    cbsLegalName: "BUNDL TECHNOLOGIES PRIVATE LIMITED",
    entityType: "Corporate",
    type: "CREDIT",
    rawAmount: 5310,
    amount: "+₹5,310",
    confidenceTier: "high",
    railType: "UPI Merchant Bulk",
    crossRefVerdict: "PASS",
    notes: "Weekly platform payout",
  },
  {
    id: "tx-9",
    date: "08-24",
    description: "ZOMATO HYPERPURE",
    vpa: "xxxx3239",
    cbsLegalName: "ZOMATO LIMITED",
    entityType: "Corporate",
    type: "CREDIT",
    rawAmount: 3790,
    amount: "+₹3,790",
    confidenceTier: "high",
    railType: "NEFT Salary Rail",
    crossRefVerdict: "PASS",
    notes: "Biweekly platform payout",
  },
];

interface BankTransactionHistoryProps {
  onBack?: () => void;
  onContinue: (selectedVpas: string[], selectedNames: string[]) => void;
}

export function BankTransactionHistory({
  onBack,
  onContinue,
}: BankTransactionHistoryProps) {
  // Auto-select verified platform payouts based on G3/G4 pass
  const selectedPayers = new Set(
    STATEMENT_TRANSACTIONS.filter(t => t.crossRefVerdict === "PASS" && t.type === "CREDIT").map(t => t.description)
  );

  // Calculate recognized credits
  const creditIncomeTxns = STATEMENT_TRANSACTIONS.filter(
    (t) => t.type === "CREDIT" && selectedPayers.has(t.description)
  );
  const otherTxns = STATEMENT_TRANSACTIONS.filter(
    (t) => t.type === "DEBIT" || !selectedPayers.has(t.description)
  );
  const totalIncomeSum = creditIncomeTxns.reduce((sum, t) => sum + t.rawAmount, 0);

  const handleProceed = () => {
    const names = Array.from(selectedPayers);
    const vpas = Array.from(
      new Set(
        STATEMENT_TRANSACTIONS.filter((t) => selectedPayers.has(t.description)).map((t) => t.vpa)
      )
    );
    onContinue(vpas, names);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pt-2">
      <div className="space-y-1 text-left">
        <h2 className="text-2xl font-bold font-heading text-white tracking-tight">Bank Transaction History</h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          Statement ingested via Account Aggregator. Payer profiler evaluates transactions against 4 multi-layer anti-spoofing guardrails before proof synthesis.
        </p>
      </div>

      {/* Core Architectural Trust Principle */}
      <div className="p-3.5 rounded-xl bg-violet-950/20 border border-violet-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="text-xs text-zinc-300 leading-relaxed">
          <span className="font-semibold text-violet-300">Core Trust Boundary: </span>
          <span className="italic text-zinc-200">“User selection tells us what they want to prove; platform verification tells us whether we can trust that source.”</span>
          <span className="block text-[11px] text-zinc-400 mt-0.5">
            VPAs are cross-referenced against the Verified Platform Registry and NPCI Core Banking System (CBS) entity records.
          </span>
        </div>
      </div>

      {/* 4-Layer Guardrails Status Banner */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
            G1
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">Directional Filter</div>
            <div className="text-[11px] text-zinc-400">Credits Only (Debits locked)</div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
            G2
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">Recurring Cadence</div>
            <div className="text-[11px] text-zinc-400">Weekly/Bi-weekly settlement</div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-zinc-950/40 border border-zinc-800/60">
          <div className="w-6 h-6 rounded-md bg-violet-500/20 text-violet-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
            G3
          </div>
          <div>
            <div className="text-xs font-semibold text-zinc-200">NPCI / CBS Match</div>
            <div className="text-[11px] text-zinc-400">VPA matched to CBS legal entity</div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30">
          <div className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold font-mono">
            G4
          </div>
          <div>
            <div className="text-xs font-semibold text-emerald-300">Verified Platform Registry</div>
            <div className="text-[11px] text-zinc-400">Checked against certified platforms</div>
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase">Recognized Work Income</div>
          <div className="text-lg font-bold text-violet-300 font-mono mt-0.5">
            ₹{totalIncomeSum.toLocaleString("en-IN")}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">✓ {creditIncomeTxns.length} credits from selected sources</div>
        </div>

        <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase">Selected Income Sources</div>
          <div className="text-lg font-bold text-white font-mono mt-0.5">
            {selectedPayers.size} Sources
          </div>
          <div className="text-[10px] text-zinc-400 mt-0.5">{Array.from(selectedPayers).join(", ")}</div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase">Excluded Transfers & Debits</div>
          <div className="text-lg font-bold text-zinc-400 font-mono mt-0.5">
            {otherTxns.length} Transactions
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Debits & unverified personal transfers</div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-zinc-950/70 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-[11px] font-mono text-zinc-400 uppercase tracking-wider">
                <th className="py-3.5 px-4 font-semibold">DATE</th>
                <th className="py-3.5 px-4 font-semibold">COUNTERPARTY & CBS ENTITY</th>
                <th className="py-3.5 px-4 font-semibold">VPA / ADDRESS</th>
                <th className="py-3.5 px-4 font-semibold">G3: NPCI / CBS CROSS-REF</th>
                <th className="py-3.5 px-4 text-right font-semibold">AMOUNT</th>
                <th className="py-3.5 px-4 text-center font-semibold">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/80 font-mono">
              {STATEMENT_TRANSACTIONS.map((t) => {
                const isDebit = t.type === "DEBIT";
                const isSelected = !isDebit && selectedPayers.has(t.description);
                const isLowConfidence = t.confidenceTier === "low";
                const isCorporatePass = t.crossRefVerdict === "PASS";

                return (
                  <tr
                    key={t.id}
                    className={`transition-colors duration-150 ${
                      isSelected && !isLowConfidence
                        ? "bg-violet-950/20 text-violet-200 hover:bg-violet-950/30"
                        : isSelected && isLowConfidence
                        ? "bg-amber-950/20 text-amber-200 hover:bg-amber-950/30"
                        : isDebit
                        ? "text-zinc-600 bg-zinc-950/40 hover:bg-zinc-900/20"
                        : "text-zinc-500 hover:bg-zinc-900/20"
                    }`}
                  >
                    <td className="py-3 px-4 text-xs text-zinc-400 whitespace-nowrap">{t.date}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                          {isSelected && !isLowConfidence ? (
                            <span className="text-violet-300 font-semibold">{t.description}</span>
                          ) : isSelected && isLowConfidence ? (
                            <span className="text-amber-300 font-semibold">{t.description}</span>
                          ) : (
                            <span className="text-zinc-400">{t.description}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                          {t.entityType === "Corporate" ? (
                            <Building2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          ) : (
                            <UserCheck className="w-3 h-3 text-amber-500 shrink-0" />
                          )}
                          <span>{t.cbsLegalName}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-zinc-300 text-[11px] font-mono">{t.vpa}</span>
                        <span className="text-[10px] text-zinc-500">{t.railType}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {isCorporatePass ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-mono bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/30">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          <span>PASS (Corporate Match)</span>
                        </span>
                      ) : isDebit ? (
                        <span className="inline-flex items-center gap-1 text-zinc-500 text-[10px] font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          <Lock className="w-3 h-3 text-zinc-500" />
                          <span>Debit Locked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-400 text-[10px] font-mono bg-amber-950/30 px-2 py-0.5 rounded border border-amber-500/30">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          <span>P2P (Individual KYC)</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold whitespace-nowrap">
                      {isSelected && !isLowConfidence ? (
                        <span className="text-violet-300 font-bold">{t.amount}</span>
                      ) : isSelected && isLowConfidence ? (
                        <span className="text-amber-300 font-bold">{t.amount}</span>
                      ) : isDebit ? (
                        <span className="text-zinc-600">{t.amount}</span>
                      ) : (
                        <span className="text-zinc-500">{t.amount}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {isDebit ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full bg-zinc-900/60 border border-zinc-800/60 text-zinc-600 cursor-not-allowed">
                          <Lock className="w-3 h-3 text-zinc-600" />
                          <span>G1 Blocked</span>
                        </span>
                      ) : !isLowConfidence ? (
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-violet-500/20 border-violet-500/40 text-violet-300 shadow-sm"
                              : "bg-zinc-900/60 border-zinc-800/60 text-zinc-600"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3 h-3 text-violet-400" />
                              <span>Platform Verified</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-zinc-600" />
                              <span>G4 Blocked</span>
                            </>
                          )}
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1.5 ${
                            isSelected
                              ? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm"
                              : "bg-zinc-900/60 border-zinc-800/60 text-zinc-600"
                          }`}
                        >
                          {isSelected ? (
                            <>
                              <Check className="w-3 h-3 text-amber-400" />
                              <span>Unlisted Work Source</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-zinc-600" />
                              <span>G4 Blocked</span>
                            </>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between text-xs font-mono text-zinc-400 pl-1 gap-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-violet-400" />
            <span>High Confidence Platform Payouts (NPCI Verified)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Low Confidence / Personal Transfers (Optional)</span>
          </div>
        </div>
        <div className="text-[11px] text-zinc-500">
          Clustered by VPA & Cross-Referenced against Bank CBS Legal Entity
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-4 pt-2">
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-3 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 font-medium text-xs sm:text-sm transition-colors flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
        )}
        <button
          onClick={handleProceed}
          className="flex-1 py-3 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-violet-950/40 flex items-center justify-center gap-2"
        >
          <span>Mint Verified Income</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default BankTransactionHistory;
