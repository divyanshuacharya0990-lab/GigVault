"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Copy, Check, QrCode } from "lucide-react";
import { useAppState } from "../../lib/AppState";
import { api } from "../../lib/api";

export function PresentQR() {
  const [timeLeft, setTimeLeft] = useState(30);
  const [copied, setCopied] = useState(false);
  const [qrPayload, setQrPayload] = useState("");
  const { sessionId, holderWallet, commitment, passportData } = useAppState();

  const passportId = passportData?.chain?.tokenId 
    ? `0x${passportData.chain.tokenId.toString(16).padStart(8, '0')}`
    : "0xPENDING";

  useEffect(() => {
    if (!sessionId || !holderWallet || !commitment) return;
    
    let isMounted = true;

    async function generateTicket() {
      try {
        const tk = await api.presentTicket(sessionId!);
        if (!tk.ticketId) return;

        const payload = ['GigVault qr v1', `session=${sessionId}`, `ticket=${tk.ticketId}`, `commitment=${commitment}`].join('\n');
        const signature = await holderWallet!.signMessage(payload);
        const qrText = `GV1|${sessionId}|${tk.ticketId}|${signature}`;
        
        if (isMounted) {
          setQrPayload(qrText);
          setTimeLeft(30);
        }
      } catch (err) {
        console.error("Failed to generate ticket", err);
      }
    }

    generateTicket();

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          generateTicket();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, holderWallet, commitment]);

  const qrUrl = qrPayload 
    ? `https://quickchart.io/qr?text=${encodeURIComponent(qrPayload)}&size=240&dark=09090b&light=ffffff&ecLevel=M&margin=1`
    : "";

  const handleCopyId = () => {
    navigator.clipboard.writeText(passportId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyQR = () => {
    navigator.clipboard.writeText(qrPayload);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pt-2">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold tracking-tight text-white font-heading">
          Present Work Passport
        </h2>
        <p className="text-xs text-zinc-400">
          Show this ephemeral QR to a verifier, or provide your Passport ID.
        </p>
      </div>

      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 text-center space-y-5 backdrop-blur">
        <div className="relative mx-auto w-60 h-60 bg-white p-3 rounded-xl shadow-xl flex items-center justify-center">
          {qrUrl ? (
            <img
              src={qrUrl}
              alt="Scannable Passport QR"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-zinc-400 text-sm flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin" />
              Generating QR...
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 text-violet-400 animate-spin" />
              Regenerating
            </span>
            <span>{timeLeft}s remaining</span>
          </div>
          <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
            <div
              className="bg-violet-500 h-full transition-all duration-1000"
              style={{ width: `${(timeLeft / 30) * 100}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCopyQR}
            disabled={!qrPayload}
            className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <QrCode className="w-4 h-4" />}
            Copy QR Payload
          </button>
        </div>

        <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between bg-zinc-950/60 px-3.5 py-2.5 rounded-lg border border-zinc-800">
          <div className="text-left">
            <div className="text-[10px] font-mono text-zinc-500 uppercase">Passport ID</div>
            <div className="text-xs font-mono font-bold text-zinc-200">{passportId}</div>
          </div>
          <button
            onClick={handleCopyId}
            className="p-2 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Copy Passport ID"
          >
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PresentQR;