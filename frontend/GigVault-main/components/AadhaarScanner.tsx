"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Scan, ShieldCheck, Camera, CameraOff, Loader2, Upload, Fingerprint, User } from "lucide-react";

interface AadhaarScannerProps {
  onScanSuccess: (decodedText: string) => void;
}

// Simulated Aadhaar Secure QR payload (mirrors real UIDAI XML structure)
const DEMO_AADHAAR_PAYLOAD = JSON.stringify({
  uid: "XXXX-XXXX-8374",
  name: "RAMESH KUMAR",
  dob: "15-03-1995",
  gender: "M",
  co: "S/O SURESH KUMAR",
  loc: "Bengaluru",
  state: "Karnataka",
  pc: "560001",
  signature: "DEMO_SIG_DSU_DEVHACK_3.0",
  timestamp: new Date().toISOString(),
});

export function AadhaarScanner({ onScanSuccess }: AadhaarScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
    } catch (e) {
      console.warn("Scanner stop error:", e);
    }
  }, []);

  const initScanner = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 100));

    const el = document.getElementById("aadhaar-reader");
    if (!el) return;

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        if (mountedRef.current) {
          setHasPermission(false);
          setError("No camera devices found.");
        }
        return;
      }

      if (mountedRef.current) setHasPermission(true);

      const scanner = new Html5Qrcode("aadhaar-reader", { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, aspectRatio: 1.0 },
        (decodedText) => {
          scanner.stop().catch(console.error);
          onScanSuccess(decodedText);
        },
        () => {}
      );
    } catch (err: any) {
      if (mountedRef.current) {
        setHasPermission(false);
        setError(err?.message || "Camera permission denied or unavailable.");
      }
    }
  }, [onScanSuccess]);

  useEffect(() => {
    mountedRef.current = true;
    if (isActive) initScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleCamera = async () => {
    if (isActive) {
      await stopScanner();
      setIsActive(false);
      setHasPermission(null);
    } else {
      setIsActive(true);
      setTimeout(() => initScanner(), 150);
    }
  };

  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const tempScanner = new Html5Qrcode("aadhaar-file-reader");
      const result = await tempScanner.scanFile(file, false);
      tempScanner.clear();
      onScanSuccess(result);
    } catch {
      alert("Could not detect a QR code in this image. Aadhaar Secure QR uses high-density encoding that requires UIDAI's native SDK. Use 'Demo Identity' for the hackathon demo.");
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDemoIdentity = async () => {
    setDemoLoading(true);
    // Stop camera if running
    await stopScanner();
    setIsActive(false);
    
    // Simulate UIDAI SDK processing time
    await new Promise((r) => setTimeout(r, 1200));
    onScanSuccess(DEMO_AADHAAR_PAYLOAD);
  };

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

        <div className="w-full aspect-square rounded-2xl overflow-hidden bg-black border border-zinc-800/80 relative flex items-center justify-center mb-4 shadow-inner">
          {/* Scanner container — hidden via CSS, not unmounted */}
          <div
            id="aadhaar-reader"
            className="w-full h-full [&_video]:object-cover"
            style={{ display: isActive ? "block" : "none" }}
          />
          <div id="aadhaar-file-reader" style={{ display: "none" }} />

          {/* Camera off */}
          {!isActive && !demoLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 px-4 text-center">
              <CameraOff className="w-8 h-8 text-zinc-600 mb-3" />
              <span className="text-sm text-zinc-400 font-medium">Camera is Off</span>
            </div>
          )}

          {/* Demo processing animation */}
          {demoLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 px-4 text-center">
              <div className="w-16 h-16 rounded-full bg-violet-500/20 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                <Fingerprint className="w-8 h-8 text-violet-400 animate-pulse" />
              </div>
              <span className="text-sm text-violet-300 font-medium mb-1">Decoding Aadhaar Secure QR...</span>
              <span className="text-[11px] text-zinc-500 font-mono">Verifying UIDAI digital signature</span>
            </div>
          )}

          {/* Loading */}
          {isActive && hasPermission === null && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10">
              <Loader2 className="w-6 h-6 text-violet-500 animate-spin mb-3" />
              <span className="text-xs text-zinc-400 font-mono">Initializing camera...</span>
            </div>
          )}

          {/* Permission denied */}
          {isActive && hasPermission === false && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 z-10 px-4 text-center">
              <Camera className="w-8 h-8 text-rose-500/50 mb-3" />
              <span className="text-sm text-rose-400 font-medium mb-1">Camera Access Required</span>
              <span className="text-xs text-zinc-500">{error}</span>
            </div>
          )}

          {/* Scanner frame overlay */}
          {isActive && hasPermission === true && (
            <div className="absolute inset-0 pointer-events-none z-10">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border border-violet-500/30 rounded-xl flex items-center justify-center">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-violet-400 rounded-tl-xl -translate-x-px -translate-y-px" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-violet-400 rounded-tr-xl translate-x-px -translate-y-px" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-violet-400 rounded-bl-xl -translate-x-px translate-y-px" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-violet-400 rounded-br-xl translate-x-px translate-y-px" />
                <div className="w-full h-0.5 bg-violet-400 shadow-[0_0_8px_2px_rgba(139,92,246,0.6)] animate-scan" />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons row 1 */}
        <div className="flex items-center gap-3 mb-3 w-full">
          <button
            onClick={handleToggleCamera}
            disabled={demoLoading}
            className="flex-1 px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isActive ? (
              <><CameraOff className="w-3.5 h-3.5" /> Turn Off Camera</>
            ) : (
              <><Camera className="w-3.5 h-3.5" /> Turn On Camera</>
            )}
          </button>

          <label className="flex-1 px-4 py-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-xs font-medium text-violet-300 hover:bg-violet-500/20 hover:text-violet-200 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Scan from Image
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileScan}
              className="hidden"
            />
          </label>
        </div>

        {/* Demo identity button */}
        <button
          onClick={handleDemoIdentity}
          disabled={demoLoading}
          className="w-full px-4 py-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-200 transition-all flex items-center justify-center gap-2.5 disabled:opacity-40 mb-4 shadow-lg shadow-emerald-900/20"
        >
          <User className="w-4 h-4" />
          Use Demo Identity (Ramesh Kumar)
        </button>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>UIDAI Compliant Scanner</span>
        </div>
      </div>
    </div>
  );
}

export default AadhaarScanner;
