# GigVault — Rider app (Privy)

The rider half of the deck, as a phone-first React app: Privy phone/email login creates an
embedded EVM wallet; the passport is minted to it; presentations are signed by it.

```
cp .env.example .env         # paste VITE_PRIVY_APP_ID from dashboard.privy.io
npm install
npm run dev                  # http://localhost:5173  (backend must be running on :4000)
```

Privy dashboard settings that must match `src/main.tsx`:
- Login methods: SMS and Email enabled.
- Embedded wallets → Ethereum → "Create on login: all users".
- Allowed origins: add `http://localhost:5173` (and your tunnel URL if the phone is the rider).

The verifier stays on the backend's static page: `http://localhost:4000` → Verifier tab →
Scan passport QR. Camera on the phone needs https: `cloudflared tunnel --url http://localhost:5173`
and add that origin in Privy.

What is real here: the wallet is Privy's; `holderKeyScheme: eip191-secp256k1` and the same
signing/verification as the static client. What is not: the Aadhaar step is still decode-only.
