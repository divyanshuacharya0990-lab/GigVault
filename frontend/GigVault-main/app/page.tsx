"use client";

import { useState } from "react";
import Header from "@/components/Header";
import BackgroundGlow from "@/components/BackgroundGlow";
import TabNav from "@/components/TabNav";

import Overview from "@/components/tabs/Overview";
import IssuePassport from "@/components/tabs/IssuePassport";
import PresentQR from "@/components/tabs/PresentQR";
import Verify from "@/components/tabs/Verify";
import ForgedProof from "@/components/tabs/ForgedProof";
import TrustLadder from "@/components/tabs/TrustLadder";

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("overview");

  return (
   <main className="min-h-screen bg-transparent text-zinc-100 relative overflow-hidden flex flex-col font-sans">
      <BackgroundGlow />
      <Header />

      <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-6 pb-20 flex-1 space-y-8">
        <TabNav activeTab={activeTab as any} onChange={setActiveTab as any} />

        <div className="pt-2">
          {activeTab === "overview" && <Overview onNavigate={setActiveTab} />}
          {activeTab === "issue" && <IssuePassport onComplete={() => setActiveTab("present")} />}
          {activeTab === "present" && <PresentQR />}
          {activeTab === "verify" && <Verify />}
          {activeTab === "forged" && <ForgedProof />}
          {activeTab === "ladder" && <TrustLadder />}
        </div>
      </div>
    </main>
  );
}