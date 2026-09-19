"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import AadhaarScanner from "@/components/AadhaarScanner";
import BackgroundGlow from "@/components/BackgroundGlow";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const handleScanSuccess = (decodedText: string) => {
    // In a real implementation, we would send the signed payload to the backend
    // For DSU DevHack 3.0 demo, we authenticate and bypass to the dashboard
    console.log("Mock Aadhaar Scan Authenticated Payload:", decodedText);
    
    setSuccess(true);
    
    // Simulate network delay for effect
    setTimeout(() => {
      // Set auth flag
      if (typeof window !== "undefined") {
        localStorage.setItem("gigvault_auth", "true");
        localStorage.setItem("gigvault_kyc_name", "RAHUL SHARMA");
      }
      
      router.push("/");
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-bg-primary text-zinc-100 relative overflow-hidden flex flex-col font-sans justify-center">
      <BackgroundGlow />
      
      <div className="absolute top-6 left-6 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-accent-cyan p-0.5 shadow-lg shadow-brand-primary/20">
            <div className="w-full h-full bg-bg-secondary rounded-[10px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold font-heading tracking-tight text-white leading-none">
              GigVault
            </h1>
            <p className="text-[10px] text-zinc-400 font-mono tracking-widest mt-1">
              DSU DEVHACK 3.0
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto w-full px-6 relative z-10 pt-16">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl font-bold font-heading text-white">
            Access Your Vault
          </h2>
          <p className="text-zinc-400 text-sm">
            Zero-knowledge proofs require cryptographic identity verification.
          </p>
        </div>

        {success ? (
          <div className="w-full max-w-sm mx-auto p-12 rounded-3xl bg-zinc-900/50 border border-emerald-500/30 flex flex-col items-center justify-center backdrop-blur-md shadow-2xl animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Verified</h3>
            <p className="text-sm text-emerald-400/80 text-center font-mono">
              Identity confirmed securely. Routing to dashboard...
            </p>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <AadhaarScanner onScanSuccess={handleScanSuccess} />
          </div>
        )}

        <div className="mt-12 text-center flex flex-col items-center">
          <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secured by UIDAI offline QR standard
          </p>
        </div>
      </div>
    </main>
  );
}
