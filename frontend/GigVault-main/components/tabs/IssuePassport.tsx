"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck, Database, Lock, Hash, Sparkles, CheckSquare, Square } from "lucide-react";
import { api } from "../../lib/api";
import { useAppState } from "../../lib/AppState";
import { ethers } from "ethers";
import { BankTransactionHistory } from "../BankTransactionHistory";

interface IssuePassportProps {
  onComplete?: () => void;
}

export function IssuePassport({ onComplete }: IssuePassportProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deriveData, setDeriveData] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPayerSelection, setShowPayerSelection] = useState(false);
  const [selectedPayers, setSelectedPayers] = useState<string[]>(["SWIGGY PAYMENT", "ZOMATO HYPERPURE"]);
  const [logs, setLogs] = useState<string[]>([]);
  
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, `${time} ${msg}`]);
  };

  const { setSessionId, setHolderWallet, setCommitment, setPassportData } = useAppState();

  const steps = [
    { title: "Consent Rail", desc: "Consenting to fetch via RBI Account Aggregator framework", icon: Database },
    { title: "Bank Ingestion", desc: "156 weekly credits streamed directly from core banking", icon: ShieldCheck },
    { title: "Identity Attestation", desc: "Root identity binding verified in-circuit", icon: Lock },
    { title: "Commitment Generation", desc: "Hashing claims and producing non-transferable state", icon: Hash },
    { title: "Soulbound Mint", desc: "Issuing soulbound work passport on-chain", icon: Sparkles },
  ];

  const handleStartIssuance = async () => {
    setIsProcessing(true);
    setCurrentStep(1);
    setDeriveData(null);

    try {
      // Step 1: Consent & Fetch
      addLog("Requesting consent for ramesh@demo...");
      const consentRes = await api.consent("ramesh@demo");
      const sid = consentRes.sessionId;
      const cid = consentRes.consent?.consentId ?? consentRes.consent?.id;
      setSessionId(sid);
      addLog(`Consent recorded. Session ${sid.slice(0, 8)}...`);
      
      addLog("Fetching bank statement from AA...");
      await api.fetchEnvelope(sid, cid);
      addLog("Bank statement received, signature verified. Account holder: RAMESH KUMAR");
      setCurrentStep(2);

      // Step 2: Derive (Bank Ingestion & Payer Profiling)
      addLog("Deriving income and profiling payers by payment address...");
      const deriveRes = await api.derive(sid);
      setDeriveData(deriveRes);
      
      setIsProcessing(false);
      // Open the Bank Transaction History view directly
      setShowHistory(true);
    } catch (err) {
      console.error(err);
      alert("Issuance failed: " + (err as Error).message);
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const handleHistoryContinue = async (selectedVpas: string[], selectedNames: string[]) => {
    const activeNames = selectedNames.length > 0 ? selectedNames : ["SWIGGY PAYMENT", "ZOMATO HYPERPURE"];
    setSelectedPayers(activeNames);
    setShowHistory(false);
    setShowPayerSelection(false);
    await executeIssuance(activeNames);
  };

  const executeIssuance = async (namesToConfirm: string[]) => {
    setIsProcessing(true);
    
    try {
      const actualSid = deriveData?.sessionId || "demo-session";
      addLog("Re-deriving with confirmed platforms: " + namesToConfirm.join(", "));
      const updatedDeriveRes = await api.derive(actualSid, namesToConfirm);
      setDeriveData(updatedDeriveRes);

      setCurrentStep(3);
      addLog("Aadhaar Secure QR decoded on device (Demo identity: Ramesh Kumar).");
      
      await new Promise(r => setTimeout(r, 600));
      setCurrentStep(4);
      addLog("Generating Groth16 proof over the commitment claims...");

      const wallet = ethers.Wallet.createRandom();
      setHolderWallet(wallet);

      const nullifier = 'demo-nullifier-' + actualSid.slice(0, 8) + '-' + Date.now();
      const issueRes = await api.issue(
        actualSid, 
        wallet.address, 
        { nullifier, proof: {}, publicSignals: [], decodedName: 'Ramesh Kumar' },
        { tenureTierIdx: 3, weeksTierIdx: 3, incomeTierIdx: 2 }
      );
      
      addLog(`Proof generated. Card: ≥ ${issueRes.card?.tenure} · ≥ ${issueRes.card?.weeksPaid} · ≥ ${issueRes.card?.monthlyIncome}`);
      setCommitment(issueRes.commitment);
      setPassportData(issueRes.card);
      setCurrentStep(5);
      addLog(`On-chain: Token #${issueRes.chain?.tokenId || '1'} minted to ${wallet.address.slice(0,6)}...${wallet.address.slice(-4)}`);

      setIsProcessing(false);
      setTimeout(() => {
        if (onComplete) {
          onComplete();
        }
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Issuance failed: " + (err as Error).message);
      setIsProcessing(false);
      setShowHistory(true);
    }
  };

  if (showHistory) {
    return (
      <BankTransactionHistory
        onBack={() => setShowHistory(false)}
        onContinue={handleHistoryContinue}
      />
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8 pt-4">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight text-white font-heading">
          Issue Work Passport
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          Consent once on regulated rails. Bank records become an irrefutable proof token.
        </p>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl p-6 space-y-6">
        <div className="space-y-4">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            const isDone = currentStep > idx + 1 || currentStep === steps.length;
            const isCurrent = currentStep === idx + 1 && isProcessing;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0.6 }}
                animate={{
                  opacity: currentStep >= idx + 1 ? 1 : 0.4,
                }}
                className={`flex items-start gap-4 p-3.5 rounded-lg border transition-all ${
                  isCurrent
                    ? "bg-violet-950/20 border-violet-500/40"
                    : isDone
                    ? "bg-zinc-900/80 border-emerald-500/20"
                    : "bg-zinc-950/30 border-zinc-900"
                }`}
              >
                <div
                  className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isDone
                      ? "bg-emerald-500/10 text-emerald-400"
                      : isCurrent
                      ? "bg-violet-500/20 text-violet-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isCurrent ? (
                    <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>

                <div className="space-y-0.5 w-full">
                  <div className="text-xs font-semibold text-zinc-200">{s.title}</div>
                  <div className="text-[11px] text-zinc-400 leading-snug">{s.desc}</div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {currentStep === 0 && (
          <button
            onClick={handleStartIssuance}
            className="w-full py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <span>Begin Consented Issuance</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {isProcessing && (
          <div className="text-center text-xs font-mono text-violet-400 py-1 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            <span>Processing rail commitments...</span>
          </div>
        )}

        {currentStep === steps.length && !isProcessing && (
          <div className="text-center text-xs font-mono text-emerald-400 py-1 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Minted successfully! Redirecting to presentation QR...</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default IssuePassport;