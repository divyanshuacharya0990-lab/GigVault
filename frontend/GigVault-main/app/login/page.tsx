"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useAnonAadhaar,
  processAadhaarArgs,
} from "@anon-aadhaar/react";
import BackgroundGlow from "@/components/BackgroundGlow";
import { ShieldCheck, CheckCircle2, Fingerprint, Upload, AlertCircle } from "lucide-react";
import jsQR from "jsqr";

export default function LoginPage() {
  const router = useRouter();
  const [anonAadhaar, anonAadhaarDispatcher] = useAnonAadhaar();
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (anonAadhaar.status === "logged-in") {
      // Set auth flag with proof data
      if (typeof window !== "undefined") {
        localStorage.setItem("gigvault_auth", "true");
        localStorage.setItem("gigvault_kyc_name", "RAMESH KUMAR");
        
        // Store the proof for on-chain verification if needed
        if (anonAadhaar.anonAadhaarProofs && Object.keys(anonAadhaar.anonAadhaarProofs).length > 0) {
          localStorage.setItem(
            "gigvault_anon_aadhaar_proof",
            JSON.stringify(anonAadhaar.anonAadhaarProofs[0])
          );
        }
      }
    }
  }, [anonAadhaar]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg("");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        
        // Scan for QR code using jsQR
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          try {
            // It found the QR text!
            const qrData = code.data;
            
            // Dispatch login action with processed args
            // We use true for test mode to ensure flawless hackathon demo
            const args = await processAadhaarArgs(
              qrData, 
              true, 
              1234567890, 
              ["revealAgeAbove18", "revealState", "revealGender"]
            );
            
            if (anonAadhaarDispatcher) {
              anonAadhaarDispatcher({ type: "login", args });
            }
          } catch (err) {
            console.error(err);
            setErrorMsg("Failed to generate ZK Proof. The QR code may be invalid or corrupted.");
          }
        } else {
          setErrorMsg("Invalid QR Code. Please ensure the QR is clear and fully visible in the image.");
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const isLoggingIn = anonAadhaar.status === "logging-in";
  const isLoggedIn = anonAadhaar.status === "logged-in";

  return (
    <main className="min-h-screen bg-bg-primary text-zinc-100 relative overflow-hidden flex flex-col font-sans justify-center">
      <BackgroundGlow />

      {/* Header logo */}
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
            Zero-knowledge proof of Aadhaar identity — no data leaves your device.
          </p>
        </div>

        {isLoggedIn ? (
          /* Success state */
          <div className="w-full max-w-sm mx-auto p-12 rounded-3xl bg-zinc-900/50 border border-emerald-500/30 flex flex-col items-center justify-center backdrop-blur-md shadow-2xl animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Verified</h3>
            <p className="text-sm text-emerald-400/80 text-center font-mono mb-8">
              ZK proof generated on-device.
            </p>
            <button
              onClick={() => router.push("/")}
              className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold transition-all shadow-lg shadow-emerald-500/20"
            >
              Enter Vault
            </button>
          </div>
        ) : (
          /* Custom Native Scanner UI */
          <div className="w-full max-w-sm mx-auto p-1 rounded-3xl bg-gradient-to-b from-zinc-800/50 to-zinc-950 shadow-2xl overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="absolute inset-0 bg-violet-500/5 blur-3xl rounded-full mix-blend-screen pointer-events-none" />

            <div className="relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/50 rounded-[1.4rem] p-8 flex flex-col items-center">
              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 shadow-inner">
                <Fingerprint className={`w-8 h-8 ${isLoggingIn ? 'text-emerald-400 animate-pulse' : 'text-violet-400'}`} />
              </div>

              <h3 className="text-xl font-bold font-heading text-white mb-2 text-center">
                Aadhaar e-KYC
              </h3>
              <p className="text-sm text-zinc-400 text-center mb-8 max-w-[260px]">
                Upload your Aadhaar Secure QR code. A zero-knowledge proof is generated entirely on your device.
              </p>

              {/* Error Message */}
              {errorMsg && (
                <div className="w-full mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300 font-medium leading-relaxed">{errorMsg}</p>
                </div>
              )}

              {/* Custom Upload Button */}
              {!isLoggingIn && (
                <div className="w-full">
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 hover:from-violet-500 hover:to-indigo-600 text-white font-bold transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] hover:-translate-y-0.5 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-5 h-5" />
                    Upload QR Code
                  </button>
                </div>
              )}

              {/* Status indicator */}
              {isLoggingIn && (
                <div className="mt-2 w-full text-center">
                  <div className="flex items-center justify-center gap-2 text-emerald-400 text-sm font-bold tracking-wide">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>GENERATING ZK PROOF</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-4 overflow-hidden">
                    <div className="h-full bg-emerald-500 w-1/2 animate-[progress_2s_ease-in-out_infinite]" />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-4 font-mono">
                    Groth16 proving circuit active...
                  </p>
                </div>
              )}

              {/* Divider */}
              <div className="w-full flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {/* Demo bypass for hackathon */}
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("gigvault_auth", "true");
                    localStorage.setItem("gigvault_kyc_name", "RAMESH KUMAR");
                  }
                  router.push("/");
                }}
                className="w-full py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/10"
              >
                <Fingerprint className="w-4 h-4" />
                Demo: Pre-verified Identity
              </button>

              {/* Footer */}
              <div className="mt-6 flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                <span>Powered by Anon Aadhaar (PSE)</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center flex flex-col items-center">
          <p className="text-[10px] text-zinc-500 font-mono flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Zero-knowledge • No data leaves your device
          </p>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}} />
    </main>
  );
}
