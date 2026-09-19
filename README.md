<div align="center">
  <img src="./frontend/GigVault-main/public/icon.svg" alt="GigVault Logo" width="120" />
  <h1>GigVault</h1>
  <p><strong>A Zero-Knowledge Identity and Verifiable Credential Platform for the Gig Economy</strong></p>
  <p>Built for DSU DEVHACK 3.0</p>
</div>

---

## 🏆 Round 3: Final Demo & Pitch Focus

GigVault addresses the core challenges of trust, privacy, and frictionless onboarding in the modern gig economy. By leveraging **Zero-Knowledge Proofs (ZKPs)** via the Anon Aadhaar protocol, we enable instant, cryptographically verifiable identity checks without exposing sensitive personal data.

### 1. Functionality & Innovation 🚀
- **Zero-Knowledge KYC:** Users prove their identity (e.g., Age > 18, State Residency, Gender) locally on their device. No biometric data or full Aadhaar numbers ever hit our servers.
- **Verifiable Credentials:** Income histories and payer profiles are derived instantly from raw bank statements via the Financial Information Provider (FIP) simulator.
- **Privacy-Preserving Onboarding:** We replace manual, multi-day background checks with 1-click, mathematically guaranteed proofs.

### 2. Overall Impact & Sustainability 🌍
- **Impact:** Empowers 50M+ gig workers in India to own and portability carry their reputation across platforms (Uber, Swiggy, Urban Company) without redundant background checks.
- **Sustainability:** The platform inherently reduces data compliance overhead (GDPR / DPDP Act) for employers because they only store cryptographically signed *proofs*, not raw personally identifiable information (PII).

### 3. Potential for Further Work & Scalability 📈
- **Cross-Platform Credential Portability:** GigVault is designed to become a universal passport for gig workers. A driver verified once can instantly onboard to any partnered service.
- **Smart Contract Integration:** Proofs can be published on-chain (e.g., Polygon) to enable decentralized lending or automated payouts for high-reputation workers.
- **Account Aggregator (AA) Network:** Native integration with India's Sahamati AA framework to ingest real-time, digitally signed financial data directly from banks.

### 4. Presentation & Clarity 🎨
- **Premium UX/UI:** GigVault features a sleek, dark-mode glassmorphism interface, ensuring a frictionless user experience. 
- **Developer Experience:** Clean architecture separating the React frontend from the Express/Node.js FIP simulator.

---

## 📸 Demo

### Zero-Knowledge Aadhaar e-KYC (No Data Leaves Device)
> *The user uploads a digital Aadhaar Secure QR. The proof is generated using Groth16 zk-SNARKs directly in the browser.*
<p align="center">
  <img src="./docs/login.png" width="800" alt="ZK Proof Generation" />
</p>

### GigVault Dashboard & Credential Ledger
> *Once verified, the user enters the vault where their credentials (income, reputation, state residency) are displayed securely.*
<p align="center">
  <img src="./docs/dashboard.png" width="800" alt="GigVault Dashboard" />
</p>

### Present Work Passport
> *The user can present a time-limited ephemeral QR code or direct on-chain Passport ID to verifiers.*
<p align="center">
  <img src="./docs/present.png" width="800" alt="Present QR" />
</p>

### Verifier Terminal
> *Verifiers can scan the ephemeral QR or query the on-chain Passport ID to instantly cryptographically verify the user's credentials.*
<p align="center">
  <img src="./docs/verify.png" width="800" alt="Verifier Terminal" />
</p>

---

## 🛠️ Architecture

GigVault uses a modern, hybrid architecture:
1. **Frontend (`/frontend`)**: Next.js 14, Tailwind CSS, `@anon-aadhaar/react`. Generates zero-knowledge proofs locally in the browser using WebAssembly and SnarkJS.
2. **Backend (`/backend`)**: Express API acting as the FIP (Financial Information Provider) Simulator. It parses financial statements, profiles payers (e.g., Swiggy, Zomato), and calculates derived income metrics securely.

## 🚀 Running Locally

### Prerequisites
- Node.js v18+
- npm or yarn

### Setup Backend
```bash
cd backend
npm install
npm run dev
```
*Runs on http://localhost:4000*

### Setup Frontend
```bash
cd frontend/GigVault-main
npm install
npm run dev
```
*Runs on http://localhost:3000*

## 🔒 Security Guarantees
- **No PII Storage**: We do not store full names, addresses, or Aadhaar numbers.
- **Mathematical Certainty**: Identities are verified against UIDAI's public RSA keys using the official Anon Aadhaar circuitry.
- **Local Proving**: The intensive Groth16 proving process happens entirely on the client side, ensuring maximum privacy.

---
<div align="center">
  <p>Built with ❤️ for privacy and the gig economy.</p>
</div>
