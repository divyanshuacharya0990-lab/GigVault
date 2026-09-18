"use client";

import { motion } from "framer-motion";
import PassportCard from "@/components/PassportCard";
import { Shield, ArrowRight, Lock, Database, QrCode } from "lucide-react";

export function Overview({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const flowSteps = [
    {
      num: "01",
      title: "Evidence",
      desc: "Swiggy pays into his bank weekly. He consents once on the RBI AA rail; the bank sends the record.",
      icon: Database,
    },
    {
      num: "02",
      title: "Identity",
      desc: "One QR scan: one human, one passport, his name matched to the bank record in-circuit.",
      icon: Lock,
    },
    {
      num: "03",
      title: "Issue",
      desc: "A hash on chain, in a soulbound token nobody can sell, transfer, or seize.",
      icon: Shield,
    },
    {
      num: "04",
      title: "Presentation",
      desc: "One ephemeral QR code shown at the next platform. Admitted or rejected in under 2 seconds.",
      icon: QrCode,
    },
  ];

  return (
    <div className="space-y-12 max-w-5xl mx-auto pt-2">
      {/* Hero Section */}
      <div className="grid lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-7 space-y-5">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Republic of the Gig Economy &middot; Protocol Spec</span>
          </div>

          {/* Refined, smaller headline */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-semibold tracking-tight text-zinc-100 leading-snug">
              Aadhaar made identity portable. <br />
              UPI made money portable. <br />
              <span className="text-zinc-400 font-normal">Nobody has made work portable.</span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-zinc-400 max-w-xl leading-relaxed">
            GigVault is the missing rail: a portable work passport proved directly by the rider&apos;s bank, readable by anyone, disclosing nothing beneath the threshold.
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => onNavigate("issue")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-medium text-xs sm:text-sm transition-all shadow-sm"
            >
              Issue Passport
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onNavigate("ladder")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-medium text-xs sm:text-sm transition-all"
            >
              View Trust Ladder
            </button>
          </div>

          {/* Metrics / Citations */}
          <div className="grid grid-cols-3 gap-6 pt-5 border-t border-zinc-800/60">
            <div>
              <div className="text-xl font-bold font-mono text-zinc-100 tracking-tight">77 Lakh</div>
              <div className="text-[11px] text-zinc-400">Workers without payslips</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">NITI Aayog (2022)</div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-zinc-100 tracking-tight">1.5 Lakh</div>
              <div className="text-[11px] text-zinc-400">Churn to zero monthly</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Zomato CEO statement</div>
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-zinc-100 tracking-tight">0 People</div>
              <div className="text-[11px] text-zinc-400">Can currently verify it</div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Karnataka Act 2025</div>
            </div>
          </div>
        </div>

        {/* Passport Card Preview */}
        <div className="lg:col-span-5 flex justify-center lg:justify-end">
          <div className="w-full max-w-sm">
            <PassportCard />
          </div>
        </div>
      </div>

      {/* Issuance Rail Steps */}
      <div className="space-y-4 pt-6 border-t border-zinc-900">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 font-mono">
            Protocol Pipeline
          </h3>
          <p className="text-xs text-zinc-500">
            Consent in, true/false out — converting weekly bank credits into a portable zero-knowledge assertion.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {flowSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.08 }}
                className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center justify-between text-zinc-500">
                  <span className="font-mono text-[11px] text-violet-400">ENTRY {step.num}</span>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200">{step.title}</h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{step.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Overview;