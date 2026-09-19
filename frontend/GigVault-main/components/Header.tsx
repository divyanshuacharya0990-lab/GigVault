"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAnonAadhaar } from "@anon-aadhaar/react";

export default function Header() {
  const router = useRouter();
  const [, anonAadhaarDispatcher] = useAnonAadhaar();

  const handleReset = () => {
    localStorage.removeItem("gigvault_auth");
    localStorage.removeItem("gigvault_kyc_name");
    localStorage.removeItem("gigvault_anon_aadhaar_proof");
    localStorage.removeItem("anon_aadhaar_status");
    
    // Clear SDK state
    if (anonAadhaarDispatcher) {
      anonAadhaarDispatcher({ type: "logout" });
    }
    
    router.push("/login");
  };

  return (
    <header className="relative z-10 border-b border-border/80 bg-bg-primary/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-[12px] border border-white/10 bg-[#0a1122] shadow-[0_0_24px_rgba(138,92,246,0.2)]">
           <img 
              src="/icon.svg" 
              alt="GigVault" 
              className="h-9 w-9 object-contain" 
            />
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-none tracking-tight">
              <span className="text-text-primary">Gig</span>
              <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">Vault</span>
            </p>
            <p className="mt-1 text-[11px] leading-none text-text-muted">
              The missing rail.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 rounded-[10px] border border-border bg-card px-3 py-1.5 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
            <span className="font-mono text-xs text-text-secondary">
              Account Aggregator rail · live
            </span>
          </div>
          
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors border border-white/5"
            title="Reset auth and return to login"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Login</span>
          </button>
        </div>
      </div>
    </header>
  );
}
