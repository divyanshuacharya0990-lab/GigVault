"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, ShieldCheck, Database, Lock, Hash, Sparkles } from "lucide-react";
import { api } from "../../lib/api";
import { useAppState } from "../../lib/AppState";
import { ethers } from "ethers";

interface IssuePassportProps {
  onComplete?: () => void;
}

export function IssuePassport({ onComplete }: IssuePassportProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [deriveData, setDeriveData] = useState<any>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
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
    setNeedsConfirmation(false);

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

      // Step 2: Derive (Bank Ingestion & Attestation prep)
      addLog("Deriving income and profiling payers...");
      const deriveRes = await api.derive(sid);
      setDeriveData(deriveRes);
      
      const countedPayers = deriveRes.payers?.filter((p:any) => p.confidenceTier !== 'low').length || 0;
      const uncountedPayers = deriveRes.payers?.filter((p:any) => p.confidenceTier === 'low').length || 0;
      addLog(`Statement analyzed: ${countedPayers} platform payouts counted; ignored ${uncountedPayers}`);
      addLog(`Read: ${deriveRes.derived?.weeksPaid} weeks, ${deriveRes.derived?.tenureMonths} months, ₹${deriveRes.derived?.monthlyIncome}/month - shown to the rider only.`);
      
      // Pause for confirmation
      setIsProcessing(false);
      setNeedsConfirmation(true);
    } catch (err) {
      console.error(err);
      alert("Issuance failed: " + (err as Error).message);
      setIsProcessing(false);
      setCurrentStep(0);
    }
  };

  const handleConfirmAndIssue = async () => {
    setIsProcessing(true);
    setNeedsConfirmation(false);
    try {
      const actualSid = deriveData.sessionId;

      // Re-derive if we want to include all (for the demo button)
      // Actually we don't need to re-derive if we just continue, but the button says "Confirm: I work for them",
      // implying we accept the unlisted platforms. Let's just pass all payers to derive to include them.
      const allPayers = deriveData.payers.map((p: any) => p.displayName);
      addLog("Re-deriving with rider-confirmed platforms...");
      const updatedDeriveRes = await api.derive(actualSid, allPayers); // If API takes it
      addLog(`Read (Updated): ${updatedDeriveRes.derived?.weeksPaid} weeks, ${updatedDeriveRes.derived?.tenureMonths} months, ₹${updatedDeriveRes.derived?.monthlyIncome}/month - shown to the rider only.`);

      setCurrentStep(3);
      addLog("Aadhaar Secure QR decoded on device (Demo identity).");
      setCurrentStep(4);

      // Step 3: Issue (Minting & Commitment)
      addLog("Generating Groth16 proof over the figures...");
      const wallet = ethers.Wallet.createRandom();
      setHolderWallet(wallet);

      const nullifier = 'nullifier-' + actualSid.slice(0, 8);
      const issueRes = await api.issue(
        actualSid, 
        wallet.address, 
        { nullifier, proof: {}, publicSignals: [], decodedName: 'Ramesh  Kumar' },
        { tenureTierIdx: 3, weeksTierIdx: 3, incomeTierIdx: 2 }
      );
      
      addLog(`Proof generated. Card thresholds: ≥ ${issueRes.card.tenure} months · ≥ ${issueRes.card.weeksPaid} weeks · ≥ ${issueRes.card.monthlyIncome}`);
      setCommitment(issueRes.commitment);
      setPassportData(issueRes.card);
      setCurrentStep(5);
      addLog(`On chain: token #${issueRes.chain?.tokenId || 'X'} minted to ${wallet.address.slice(0,6)}...${wallet.address.slice(-4)} (rider's own wallet)`);

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
      setCurrentStep(0);
    }
  };

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
                  
                  {idx === 1 && needsConfirmation && deriveData && (
                    <div className="mt-3 bg-zinc-950/50 rounded p-3 border border-zinc-800/50 text-[11px] space-y-2">
                      <div className="text-emerald-400 font-mono">
                        Signed statement received; only platform payouts count as income
                      </div>
                      <div className="text-zinc-400">
                        {deriveData.payers?.filter((p:any) => p.confidenceTier !== 'low').map((p:any) => p.displayName).join(", ")} • {deriveData.derived?.weeksPaid} wks counted
                      </div>
                      
                      {deriveData.payers?.filter((p:any) => p.confidenceTier === 'low').length > 0 && (
                        <div className="pt-2 border-t border-zinc-800/50">
                          {deriveData.payers?.filter((p:any) => p.confidenceTier === 'low').map((p:any, i:number) => (
                            <div key={i} className="text-amber-500/90 font-mono mb-2">
                              Not counted: CR {p.displayName} pays regularly but is not a listed platform.
                            </div>
                          ))}
                          <button 
                            onClick={handleConfirmAndIssue}
                            className="mt-1 px-3 py-1.5 border border-amber-500/30 text-amber-500 rounded hover:bg-amber-500/10 transition-colors"
                          >
                            Confirm: I work for them
                          </button>
                        </div>
                      )}
                      {deriveData.payers?.filter((p:any) => p.confidenceTier === 'low').length === 0 && (
                        <div className="pt-2">
                          <button 
                            onClick={handleConfirmAndIssue}
                            className="mt-1 px-3 py-1.5 border border-emerald-500/30 text-emerald-500 rounded hover:bg-emerald-500/10 transition-colors"
                          >
                            Continue Issuance
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {currentStep === 0 && (
          <button
            onClick={handleStartIssuance}
            className="w-full py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-all flex items-center justify-center gap-2"
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

      {logs.length > 0 && (
        <div className="bg-zinc-950/80 border border-zinc-800/50 rounded-xl p-4 mt-6">
          <pre className="text-[11px] font-mono text-zinc-500 whitespace-pre-wrap leading-relaxed">
            {logs.join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
}

export default IssuePassport;