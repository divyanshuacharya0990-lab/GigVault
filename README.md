<div align="center">
  <img src="./frontend/GigVault-main/public/icon.svg" alt="GigVault Logo" width="120" />
  <h1>GigVault</h1>
  <p><strong>Bridging FinTech and Blockchain to give Gig Workers portable, Zero-Knowledge credit and identity.</strong></p>
  <p>🏆 <em>Built for DSU DEVHACK 3.0</em> | <strong>Domains: Blockchain & FinTech</strong></p>
  <p>
    <a href="https://gigvault-1.onrender.com/"><strong>🔴 Live Demo: GigVault — The Missing Rail</strong></a>
  </p>
</div>

---

## 🚀 The Vision: Why GigVault?

The modern gig economy is broken. Over **50 million gig workers** generate billions in economic value, yet they remain invisible to traditional finance. Their reputation and income data are siloed within centralized platforms (Uber, Swiggy, etc.), leaving them unable to access fair credit or port their reputation to new platforms without redundant, multi-day background checks.

**GigVault** solves this by intersecting **FinTech (Open Banking)** and **Blockchain (Zero-Knowledge Proofs)**. We transform raw, fragmented banking data into a **cryptographically verifiable, privacy-preserving Soulbound Work Passport**. 

---

## ⛓️ Domain 1: Blockchain

GigVault acts as the ultimate trust bridge between off-chain data and on-chain utility. 
By utilizing **ZK-SNARKs (Groth16)**, we bring traditional identity on-chain without the privacy risks.

- 🛡️ **Zero-Knowledge KYC:** We integrate the **Anon Aadhaar** protocol. Users prove their identity (Age > 18, State Residency, Gender) *locally on their device*. No biometric data or Aadhaar numbers ever hit our servers, but the resulting proof is cryptographically guaranteed.
- 🪙 **Soulbound Work Passports (SBTs):** Once a worker's income and identity are verified, GigVault mints a non-transferable Soulbound Token. This acts as their universal, on-chain CV.
- 🏦 **Uncollateralized DeFi Lending:** By bringing verified income data on-chain in a privacy-preserving way, GigVault enables decentralized lending protocols to issue under-collateralized loans to gig workers based purely on cryptographic reputation.

## 💳 Domain 2: FinTech

GigVault re-engineers traditional underwriting by plugging directly into the heart of modern FinTech infrastructure (India Stack).

- 📊 **Account Aggregator (AA) Integration:** Instead of relying on easily forged PDFs, GigVault interfaces with the AA framework to ingest digitally signed, real-time banking data directly from the Financial Information Provider (FIP).
- 🧠 **Privacy-Preserving Underwriting:** Our backend FIP Simulator parses raw bank statements to identify gig-platform payouts. It derives specific financial health metrics (e.g., tenure, average weekly income) and discards the rest.
- ⚡ **Frictionless Enterprise Onboarding:** For businesses, GigVault replaces manual background checks. Employers simply verify the cryptographic signature of the Work Passport, slashing onboarding costs and ensuring compliance with strict data privacy laws (DPDP Act / GDPR) since they store *proofs*, not PII.

---

## 📸 Platform Walkthrough

We built a premium, dark-mode, glassmorphism UI to make complex cryptography feel entirely frictionless.

### 1. Zero-Knowledge Aadhaar e-KYC
> *Identity verification happens locally in the browser via WebAssembly. No data leaves the device.*
<p align="center"><img src="./docs/login.png" width="800" alt="ZK Proof Generation" /></p>

### 2. The GigVault Dashboard
> *Once verified, workers enter their private vault. Their aggregated FinTech data (income, reputation) is visualized securely.*
<p align="center"><img src="./docs/dashboard.png" width="800" alt="GigVault Dashboard" /></p>

### 3. Consent Rail (Account Aggregator)
> *Workers issue a Work Passport by cryptographically committing to specific, derived data tiers—never raw data.*
<p align="center"><img src="./docs/issue-1.png" width="800" alt="Issue Work Passport" /></p>

### 4. Zero-Knowledge Derivation
> *The platform proves income stability mathematically, protecting the worker's privacy.*
<p align="center"><img src="./docs/issue-2.png" width="800" alt="Bank Transaction History" /></p>

### 5. On-Chain Soulbound Mint
> *The final product: a time-limited ephemeral QR code or a direct on-chain Passport ID ready for Web3 protocols or Web2 employers.*
<p align="center"><img src="./docs/issue-3.png" width="800" alt="Minted Work Passport" /></p>

---

## 🛠️ Architecture

GigVault uses a modern, hybrid architecture designed for extreme privacy and scalability:
1. **Frontend (`/frontend`)**: Next.js 14, Tailwind CSS, `@anon-aadhaar/react`. Generates massive cryptographic zero-knowledge proofs entirely client-side using WebAssembly and SnarkJS.
2. **Backend (`/backend`)**: Express API acting as the FIP (Financial Information Provider) Simulator. It handles the heavy lifting of profiling payers, calculating derived metrics, and issuing the cryptographic commitments for the Soulbound Tokens.

## 🚀 Running Locally

**Prerequisites:** Node.js v18+, npm or yarn.

**Backend Setup:**
```bash
cd backend
npm install
npm run dev
# Runs on http://localhost:4000
```

**Frontend Setup:**
```bash
cd frontend/GigVault-main
npm install
npm run dev
# Runs on http://localhost:3000
```

---
<div align="center">
  <p>Built with ❤️ for privacy, financial inclusion, and the gig economy.</p>
</div>
