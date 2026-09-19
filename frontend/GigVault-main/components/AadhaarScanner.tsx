"use client";

import React, { useEffect, useState, useRef } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Scan, ShieldCheck, Camera, Loader2 } from "lucide-react";

interface AadhaarScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

export function AadhaarScanner({ onScanSuccess }: AadhaarScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    let isMounted = true;
    const scanner = new Html5Qrcode("aadhaar-reader", {
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
      verbose: false,
    });
    
    scannerRef.current = scanner;

    const startScanner = async () => {
      try {
        const hasCamera = await Html5Qrcode.getCameras();
        if (hasCamera && hasCamera.length > 0) {
          if (isMounted) setHasPermission(true);
          await scanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 250 },
            },
            (decodedText) => {
              // Automatically stop scanner on success
              if (scanner.isScanning) {
                scanner.stop().catch(console.error);
              }
              onScanSuccess(decodedText);
            },
            (errorMessage) => {
              // Ignore standard frame scan errors
            }
          );
        } else {
          if (isMounted) {
            setHasPermission(false);
            setError("No camera devices found.");
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setHasPermission(false);
          setError(err?.message || "Camera permission denied or unavailable.");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(console.error);
      }
      scannerRef.current?.clear();
    };
  }, [onScanSuccess]);

  return (
    <div className="w-full max-w-sm mx-auto p-1 rounded-3xl bg-gradient-to-b from-zinc-800/50 to-zinc-950 shadow-2xl overflow-hidden relative">
      <div className="absolute inset-0 bg-violet-500/5 blur-3xl rounded-full mix-blend-screen pointer-events-none" />
      
      <div className="relative bg-zinc-950/80 backdrop-blur-xl border border-zinc-800/50 rounded-[1.4rem] p-6 flex flex-col items-center">
        
        <div className="w-16 h-16 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6 shadow-inner">
          <Scan className="w-8 h-8 text-violet-400" />
        </div>

        <h3 className="text-xl font-bold font-heading text-white mb-2 text-center">
          Aadhaar e-KYC
        </h3>
        <p className="text-sm text-zinc-400 text-center mb-6 max-w-[240px]">
          Scan your Aadhaar secure QR code to authenticate instantly.
        </p>

        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black border border-zinc-800/80 relative flex items-center justify-center mb-6 shadow-inner">
          {/* Scanner Container */}
          <div id="aadhaar-reader" className="w-full h-full [&_video]:object-cover" />

          {/* Overlays for loading or errors */}
          {hasPermission === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin mb-3" />
              <span className="text-xs text-zinc-400 font-mono">Initializing camera...</span>
            </div>
          )}
          
          {hasPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 px-4 text-center">
              <Camera className="w-8 h-8 text-rose-500/50 mb-3" />
              <span className="text-sm text-rose-400 font-medium mb-1">Camera Access Required</span>
              <span className="text-xs text-zinc-500">{error}</span>
            </div>
          )}

          {/* Scanner UI frame overlay */}
          {hasPermission === true && (
            <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_0_999px_rgba(0,0,0,0.5)]">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-violet-500/30 rounded-xl flex items-center justify-center">
                 <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-violet-400 rounded-tl-xl -translate-x-px -translate-y-px" />
                 <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-violet-400 rounded-tr-xl translate-x-px -translate-y-px" />
                 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-violet-400 rounded-bl-xl -translate-x-px translate-y-px" />
                 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-violet-400 rounded-br-xl translate-x-px translate-y-px" />
                 
                 {/* Scanning laser line animation */}
                 <div className="w-full h-0.5 bg-violet-400 shadow-[0_0_8px_2px_rgba(139,92,246,0.6)] animate-scan" />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>UIDAI Compliant Scanner</span>
        </div>
      </div>
    </div>
  );
}

export default AadhaarScanner;
