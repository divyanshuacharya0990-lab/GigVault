"use client";

import { PASSPORT, shortHash } from "@/lib/data";
import { useAppState } from "../lib/AppState";

export default function PassportCard() {
  const { passportData } = useAppState();

  const riderId = "RAMESH KUMAR";
  const tenureMonths = passportData?.passport?.tenureMonths ?? PASSPORT.tenureMonths;
  const weeksPaidTotal = passportData?.passport?.weeksPaid ?? PASSPORT.weeksPaidTotal;
  const weeksPaidRequired = 156;
  const incomeThreshold = passportData?.passport?.monthlyIncome ?? PASSPORT.incomeThreshold;
  
  const passportHash = passportData?.chain?.tokenId 
    ? `0x${passportData.chain.tokenId.toString(16).padStart(8, '0')}`
    : PASSPORT.passportHash;

  return (
    <div className="relative w-full max-w-sm overflow-hidden rounded-card border border-border bg-card-elevated p-6 shadow-[0_0_0_1px_rgba(139,92,246,0.06)]">
      <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-glow" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-text-muted">
            Work Passport
          </p>
          <p className="mt-1 font-display text-xl font-semibold">
            {riderId}
          </p>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-purple-gradient">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 L20 6 V12 C20 17 16.5 20.5 12 22 C7.5 20.5 4 17 4 12 V6 Z"
              stroke="#F8FAFC"
              strokeWidth="1.8"
            />
          </svg>
        </div>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-4">
        <Field label="Tenure" value={`${tenureMonths} months`} />
        <Field
          label="Weeks paid"
          value={`${weeksPaidTotal} / ${weeksPaidRequired}`}
        />
        <Field label="Income" value={`₹${incomeThreshold.toLocaleString("en-IN")}+`} />
        <Field label="Status" value="Bank verified" accent />
      </div>

      <div className="relative mt-6 flex items-center justify-between border-t border-border pt-4">
        <div>
          <p className="font-mono text-[11px] text-text-muted">Passport no.</p>
          <p className="font-mono text-sm text-accent-cyan">
            {passportData?.chain?.tokenId ? passportHash : shortHash(passportHash)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[11px] text-text-muted">Issuer</p>
          <p className="text-xs text-text-secondary">The rider. Never the platform.</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[11px] text-text-muted">{label}</p>
      <p
        className={`mt-0.5 text-sm font-medium ${
          accent ? "text-status-success" : "text-text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
