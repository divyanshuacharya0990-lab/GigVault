"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { XCircle, CheckCircle2, FileWarning, ShieldCheck } from "lucide-react";

type Exhibit = "uploaded" | "fetched";

export default function ForgedProof() {
  const [exhibit, setExhibit] = useState<Exhibit>("uploaded");

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-center font-mono text-xs uppercase tracking-wide text-accent-cyan">
        A judge edits the income figure
      </p>
      <h2 className="mt-3 text-center font-display text-2xl font-semibold tracking-tight">
        Anything he can edit, he can fake.
      </h2>
      <p className="mt-2 text-center text-sm leading-relaxed text-text-secondary">
        We accept no file from the applicant. Only records that arrive
        through the consented rail are admitted.
      </p>

      <div className="mx-auto mt-6 flex w-fit rounded-[10px] border border-border bg-card p-1">
        <SegButton
          active={exhibit === "uploaded"}
          onClick={() => setExhibit("uploaded")}
        >
          Exhibit A · Uploaded file
        </SegButton>
        <SegButton
          active={exhibit === "fetched"}
          onClick={() => setExhibit("fetched")}
        >
          Exhibit B · Fetched via AA
        </SegButton>
      </div>

      <div className="mt-6 min-h-[380px]">
        <AnimatePresence mode="wait">
          {exhibit === "uploaded" ? (
            <motion.div
              key="uploaded"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rounded-card border border-border bg-card-elevated p-5">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <FileWarning size={14} />
                  statement.pdf · uploaded by applicant
                </div>

                <div className="mt-4 space-y-2 rounded-[8px] bg-bg-primary p-4 font-mono text-xs">
                  <Row label="Week 42 credit" value="₹9,400" />
                  <Row
                    label="Week 43 credit"
                    value={
                      <span className="flex items-center gap-2">
                        <span className="text-text-muted line-through">₹9,400</span>
                        <span className="text-status-error">₹19,400</span>
                        <span className="rounded-[4px] bg-status-error/10 px-1.5 py-0.5 text-[10px] text-status-error">
                          edited
                        </span>
                      </span>
                    }
                  />
                  <Row label="Week 44 credit" value="₹9,600" />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-status-error">
                  <XCircle size={14} />
                  no AA consent artefact attached to this file
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3 rounded-card border border-status-error/30 bg-status-error/5 py-6">
                <XCircle size={40} className="text-status-error" />
                <p className="font-display text-xl font-semibold text-status-error">
                  REJECTED
                </p>
                <p className="max-w-[300px] text-center text-xs leading-relaxed text-text-muted">
                  A number he can type into a PDF is a number he can fake.
                  Without a signed consent artefact, the figure has no
                  origin we can trust.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="fetched"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="rounded-card border border-border bg-card-elevated p-5">
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <ShieldCheck size={14} className="text-accent-cyan" />
                  fetched via RBI Account Aggregator · same underlying data
                </div>

                <div className="mt-4 space-y-2 rounded-[8px] bg-bg-primary p-4 font-mono text-xs">
                  <Row label="Weeks paid" value="156 / 156" ok />
                  <Row label="Consent artefact" value="signed · not expired" ok />
                  <Row label="Source" value="bank-signed, not applicant-supplied" ok />
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs text-status-success">
                  <CheckCircle2 size={14} />
                  figures arrived via the rail, not the applicant
                </div>
              </div>

              <div className="mt-5 flex flex-col items-center gap-3 rounded-card border border-status-success/30 bg-status-success/5 py-6">
                <CheckCircle2 size={40} className="text-status-success" />
                <p className="font-display text-xl font-semibold text-status-success">
                  ADMITTED
                </p>
                <p className="max-w-[300px] text-center text-xs leading-relaxed text-text-muted">
                  Same underlying income, arrived a different way. The rail,
                  not the applicant, is the source of truth.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SegButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[8px] px-3.5 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-brand-primary/15 text-text-primary"
          : "text-text-muted hover:text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  label,
  value,
  ok,
}: {
  label: string;
  value: React.ReactNode;
  ok?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-text-muted">{label}</span>
      <span className={ok ? "text-status-success" : "text-text-primary"}>
        {value}
      </span>
    </div>
  );
}
