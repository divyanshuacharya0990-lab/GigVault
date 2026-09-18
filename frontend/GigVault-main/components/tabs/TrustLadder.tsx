"use client";

import { motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";

interface LadderLevel {
  level: number;
  name: string;
  badge: "REJECTED" | "LIVE TODAY" | "PLANNED" | "RESEARCH";
  badgeColor: string;
  tagline: string;
  description: string;
  guarantees: string[];
  vulnerabilities: string[];
}

const levels: LadderLevel[] = [
  {
    level: 0,
    name: "Level 0: Self-Reported Uploads",
    badge: "REJECTED",
    badgeColor: "bg-red-500/10 text-red-400 border-red-500/20",
    tagline: "PDFs, screenshots, rider-edited app receipts",
    description: "The baseline used by traditional NBFCs today. Workers upload raw screenshots or PDF statements that can be altered in seconds using basic PDF editors or browser inspect element.",
    guarantees: ["Zero cryptographical integrity", "High friction, manual review needed"],
    vulnerabilities: [
      "Trivially forgeable numbers",
      "No identity attestation binding",
      "Exposes full financial history unnecessarily",
    ],
  },
  {
    level: 1,
    name: "Level 1: Consented AA Fetch + Hash Binding",
    badge: "LIVE TODAY",
    badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    tagline: "RBI Account Aggregator + Soulbound Token",
    description: "GigVault's current live implementation. Financial figures are pulled directly from bank systems via regulated AA rails, bound irrevocably to the rider's identity identifier, and signed cryptographically.",
    guarantees: [
      "Tamper-proof source data straight from core banking",
      "Rider cannot edit or inject raw values",
      "Threshold verification without raw bank statement disclosure",
    ],
    vulnerabilities: [
      "Relies on centralized issuer signing keys",
      "Verifier sees evaluated threshold results",
    ],
  },
  {
    level: 2,
    name: "Level 2: Client-Side ZK Proof Generation",
    badge: "PLANNED",
    badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    tagline: "Circom / SnarkJS zero-knowledge circuits executing in-browser",
    description: "Moves evaluation onto the rider's device. Instead of GigVault's backend asserting the thresholds, a ZK-SNARK circuit proves income > ₹25k and tenure > 12 weeks directly from signed AA data packets.",
    guarantees: [
      "Zero trust in GigVault backend servers",
      "Cryptographic mathematical privacy",
      "Verifier receives only proof π and public inputs",
    ],
    vulnerabilities: [
      "Higher client-side computation latency on entry-level Android devices",
    ],
  },
  {
    level: 3,
    name: "Level 3: Multi-Platform Cross-Rail Aggregation",
    badge: "RESEARCH",
    badgeColor: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    tagline: "Decentralized reputation across Zomato, Swiggy, Uber & Zepto",
    description: "Unified cross-platform work credentialing combining multiple AA consent artefacts into a single composite score while preventing cross-platform identity linking or deanonymization.",
    guarantees: [
      "Portability across conflicting platform ecosystems",
      "Nullifier hashes prevent credential double-spending",
    ],
    vulnerabilities: [
      "Requires cross-industry consensus and shared revocation registries",
    ],
  },
];

export default function TrustLadder() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono">
          <Sparkles className="w-3.5 h-3.5" />
          Maturity Framework
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold font-heading text-white">
          The Trust Ladder
        </h2>
        <p className="text-zinc-400 text-sm max-w-xl mx-auto">
          How GigVault evolves from consented banking rails to trustless zero-knowledge proofs.
        </p>
      </div>

      <div className="relative border-l border-zinc-800 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-8">
        {levels.map((item, idx) => (
          <motion.div
            key={item.level}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.12 }}
            className="relative"
          >
            <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-6 h-6 rounded-full bg-zinc-950 border border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-300">
              {item.level}
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-5 sm:p-6 backdrop-blur space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-white font-heading">
                  {item.name}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full border text-xs font-mono font-medium ${item.badgeColor}`}>
                  {item.badge}
                </span>
              </div>

              <p className="text-xs sm:text-sm font-mono text-violet-300/90">
                {item.tagline}
              </p>

              <p className="text-sm text-zinc-400 leading-relaxed">
                {item.description}
              </p>

              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-800/60 text-xs">
                <div className="space-y-1.5">
                  <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Guarantees</span>
                  {item.guarantees.map((g, i) => (
                    <div key={i} className="flex items-start gap-2 text-zinc-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{g}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <span className="text-zinc-500 font-mono uppercase tracking-wider text-[10px]">Tradeoffs / Risks</span>
                  {item.vulnerabilities.map((v, i) => (
                    <div key={i} className="flex items-start gap-2 text-zinc-400">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}