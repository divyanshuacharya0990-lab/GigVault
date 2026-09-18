"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, CheckCircle2, Scan, Printer, Search, AlertCircle, ChevronDown, Terminal } from "lucide-react";
import { api } from "../../lib/api";

export function Verify() {
  const [method, setMethod] = useState<"qr" | "id">("qr");
  const [qrInput, setQrInput] = useState("");
  const [passportInput, setPassportInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [scanResult, setScanResult] = useState<any>(null);

  const chainChecks = [
    "AA-signed consent artefact validated against expiry",
    "Figures arrived directly via AA rail, not from applicant",
    "Commitment hash verified against claimed thresholds",
    "Nullifier checked against every issued passport",
    "Identity binding matched in-circuit to bank record",
  ];

  const handleVerify = async () => {
    setError("");
    setScanning(true);
    setVerified(false);
    setCheckedSteps([]);
    setScanResult(null);

    let step = 0;
    const interval = setInterval(() => {
      if (step < chainChecks.length) {
        setCheckedSteps((prev) => [...prev, step]);
        step++;
      }
    }, 200);

    try {
      if (method === "qr") {
        if (!qrInput.trim()) {
          throw new Error("Please provide a valid QR payload");
        }
        const parts = qrInput.split('|');
        if (parts.length !== 4 || parts[0] !== 'GV1') {
           throw new Error("Invalid QR format");
        }
        const res = await api.scanTicket({
           sessionId: parts[1],
           ticketId: parts[2],
           signature: parts[3]
        });
        setScanResult(res);
      } else {
        if (!passportInput.trim()) {
          throw new Error("Please provide a valid Passport ID");
        }
        let tokenId = passportInput;
        if (tokenId.startsWith("0x")) {
            tokenId = parseInt(tokenId, 16).toString();
        }
        const res = await api.admitPassport(tokenId);
        setScanResult(res);
      }
      
      clearInterval(interval);
      setCheckedSteps([0, 1, 2, 3, 4]); // all done
      
      setTimeout(() => {
        setScanning(false);
        setVerified(true);
      }, 500);

    } catch (err: any) {
      clearInterval(interval);
      setScanning(false);
      setError(err.message || "Verification failed");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-2">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold font-heading text-white">Verifier Terminal</h2>
        <p className="text-xs sm:text-sm text-zinc-400">
          Query the registry using ephemeral QR presentation or direct on-chain Passport ID.
        </p>
      </div>

      {!verified && !scanning && (
        <div className="flex justify-center">
          <div className="inline-flex p-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-mono">
            <button
              onClick={() => { setMethod("qr"); setError(""); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                method === "qr" ? "bg-zinc-800 text-white font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              Scan QR
            </button>
            <button
              onClick={() => { setMethod("id"); setError(""); }}
              className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-all ${
                method === "id" ? "bg-zinc-800 text-white font-medium shadow-sm" : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              Passport ID Lookup
            </button>
          </div>
        </div>
      )}

      {!verified && !scanning && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 text-center space-y-5">
          {method === "qr" ? (
            <div className="space-y-3 max-w-md mx-auto text-left">
               <label className="text-xs font-mono text-zinc-400">Paste QR Payload</label>
               <input
                 type="text"
                 value={qrInput}
                 onChange={(e) => setQrInput(e.target.value)}
                 placeholder="GV1|..."
                 className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-violet-500"
               />
               {error && (
                 <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
                   <AlertCircle className="w-3.5 h-3.5" />
                   {error}
                 </div>
               )}
             </div>
          ) : (
            <div className="space-y-3 max-w-md mx-auto text-left">
              <label className="text-xs font-mono text-zinc-400">Enter On-Chain Passport ID</label>
              <input
                type="text"
                value={passportInput}
                onChange={(e) => setPassportInput(e.target.value)}
                placeholder="e.g. 0x8F3A21C4 or 1234"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3.5 py-2 text-sm font-mono text-white focus:outline-none focus:border-violet-500"
              />
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {error}
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleVerify}
            className="px-6 py-2.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-colors shadow-lg"
          >
            {method === "qr" ? "Verify Payload" : "Query Registry ID"}
          </button>
        </div>
      )}

      {scanning && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-3 text-violet-400">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs sm:text-sm">Querying state assertions...</span>
          </div>

          <div className="space-y-2.5">
            {chainChecks.map((check, idx) => {
              const done = checkedSteps.includes(idx);
              return (
                <div
                  key={idx}
                  className={`flex items-center gap-3 text-xs font-mono transition-opacity duration-300 ${
                    done ? "text-emerald-400" : "text-zinc-600"
                  }`}
                >
                  <CheckCircle2 className={`w-4 h-4 ${done ? "text-emerald-400" : "text-zinc-700"}`} />
                  <span>{check}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {verified && scanResult && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-emerald-950/20"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-mono text-xs text-emerald-400 tracking-wider">VERIFICATION PASSED</div>
                  <div className="text-lg font-bold text-white font-heading">STATUS: ADMITTED</div>
                </div>
              </div>
              <button
                onClick={() => {
                  const windowPrint = window.open('', '', 'width=800,height=600');
                  if (!windowPrint) return;
                  windowPrint.document.write(`
                    <html>
                      <head>
                        <title>GigVault Receipt</title>
                        <style>
                          body { font-family: monospace; padding: 2rem; color: #000; }
                          .receipt-header { border-bottom: 2px solid black; padding-bottom: 1rem; margin-bottom: 1.5rem; text-align: center; }
                          .receipt-header h1 { font-size: 1.5rem; text-transform: uppercase; letter-spacing: 0.1em; margin: 0; }
                          .receipt-header p { font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.25rem; }
                          .section { margin-bottom: 1.5rem; }
                          .section h3 { font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #ccc; padding-bottom: 0.25rem; margin-bottom: 0.5rem; font-size: 1rem; }
                          .section p, .section li { font-size: 0.875rem; margin: 0.25rem 0; }
                          ul { list-style: none; padding: 0; margin: 0; }
                          .footer { margin-top: 3rem; text-align: center; font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.1em; }
                        </style>
                      </head>
                      <body>
                        <div class="receipt-header">
                          <h1>GigVault</h1>
                          <p>Secure Verification Receipt</p>
                        </div>
                        <div class="section">
                          <h3>Verification Status</h3>
                          <p style="font-size: 1.125rem;">✅ PASSED / ADMITTED</p>
                          <p style="color: #666;">Date: ${new Date().toLocaleString()}</p>
                        </div>
                        <div class="section">
                          <h3>Underwriting Requirements Met</h3>
                          <ul>
                            <li>• Tenure: &ge; ${scanResult?.requirements?.minTenureMonths} Months (Actual: ${scanResult?.admittedPayload?.tenureMonths})</li>
                            <li>• Monthly Income: &ge; ₹${scanResult?.requirements?.minIncome} (Actual: ₹${scanResult?.admittedPayload?.monthlyIncome})</li>
                            <li>• Weeks Paid: &ge; 100 Weeks (Actual: ${scanResult?.admittedPayload?.weeksPaid})</li>
                          </ul>
                        </div>
                        <div class="section">
                          <h3>Cryptographic Attestation</h3>
                          <ul style="word-break: break-all;">
                            <li><strong>Token ID:</strong> ${scanResult?.chain?.tokenId || "N/A"}</li>
                            <li><strong>Commitment Hash:</strong> ${scanResult?.admittedPayload?.commitment || "N/A"}</li>
                            <li><strong>Session ID:</strong> ${scanResult?.sessionId || "N/A"}</li>
                          </ul>
                        </div>
                        <div class="footer">
                          End of receipt<br/>Verify at gigvault.dev
                        </div>
                      </body>
                    </html>
                  `);
                  windowPrint.document.close();
                  windowPrint.focus();
                  
                  // Wait for the window to render before printing, and don't immediately close it!
                  setTimeout(() => {
                    windowPrint.print();
                    // Optional: Close window after printing
                    // windowPrint.onafterprint = () => windowPrint.close();
                  }, 250);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                Receipt
              </button>
            </div>

            <div className="space-y-2 bg-zinc-950/60 p-4 rounded-lg border border-zinc-800/80">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Validated Assertions</span>
              {chainChecks.map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{check}</span>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">Underwriting Thresholds</span>
              <div className="grid sm:grid-cols-3 gap-3 font-mono text-xs">
                <div className="bg-zinc-950/40 border border-zinc-800 p-3 rounded-lg">
                  <div className="text-zinc-500">Tenure Proved</div>
                  <div className="text-white font-bold mt-1">&ge; {scanResult.requirements.minTenureMonths} Months</div>
                  <div className="text-emerald-400 text-[11px] mt-0.5">✓ {scanResult.admittedPayload.tenureMonths} Months on Rail</div>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800 p-3 rounded-lg">
                  <div className="text-zinc-500">Monthly Income Floor</div>
                  <div className="text-white font-bold mt-1">&ge; ₹{scanResult.requirements.minIncome}</div>
                  <div className="text-emerald-400 text-[11px] mt-0.5">✓ ₹{scanResult.admittedPayload.monthlyIncome} (Safe Payers)</div>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800 p-3 rounded-lg">
                  <div className="text-zinc-500">Weeks Paid</div>
                  <div className="text-white font-bold mt-1">&ge; 100 Weeks</div>
                  <div className="text-emerald-400 text-[11px] mt-0.5">✓ {scanResult.admittedPayload.weeksPaid} / 156 Weeks</div>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-800/80">
              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-xs font-mono text-zinc-400 hover:text-zinc-200 select-none py-1">
                  <span className="flex items-center gap-2">
                    <Terminal className="w-3.5 h-3.5 text-violet-400" />
                    Inspect Verifiable Payload (JSON)
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-open:rotate-180 transition-transform duration-200" />
                </summary>
                <div className="mt-2.5 rounded-lg bg-zinc-950/90 border border-zinc-800 p-3.5 text-[11px] font-mono text-emerald-400 overflow-x-auto shadow-inner">
                  <pre>
{JSON.stringify(scanResult, null, 2)}
                  </pre>
                </div>
              </details>
            </div>

            <div className="pt-2 flex justify-between items-center text-xs font-mono text-zinc-500">
              <span>Token ID: {scanResult.chain?.tokenId}</span>
              <button
                onClick={() => setVerified(false)}
                className="text-violet-400 hover:underline"
              >
                Scan Another
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}

    </div>
  );
}

export default Verify;