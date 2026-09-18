"use client";

import { Shield, FileCheck, QrCode, CheckCircle, AlertOctagon, GitMerge } from "lucide-react";

export default function TabNav({
  activeTab,
  onChange,
}: {
  activeTab: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    { id: "overview", label: "Overview", icon: Shield },
    { id: "issue", label: "Issue Passport", icon: FileCheck },
    { id: "present", label: "Present QR", icon: QrCode },
    { id: "verify", label: "Verify", icon: CheckCircle },
    { id: "forged", label: "Forged Proof", icon: AlertOctagon },
    { id: "ladder", label: "Trust Ladder", icon: GitMerge },
  ];

  return (
    <div className="flex items-center justify-start sm:justify-center overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
      <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800/80 rounded-xl backdrop-blur-md">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}