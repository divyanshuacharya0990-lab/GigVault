#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# zk-reference.md: "Proving is slow on the first call and fast afterwards... Quote a
# warm number; run a throwaway proof before a demo." Run this once, right before you
# go on stage, after build-circuit.sh has produced fresh artifacts.

WASM="circuits/build/gigvault_js/gigvault.wasm"
ZKEY="circuits/build/gigvault_final.zkey"

if [ ! -f "$WASM" ] || [ ! -f "$ZKEY" ]; then
  echo "Circuit artifacts missing — run 'npm run circuit:build' first." >&2
  exit 1
fi

cat > /tmp/gigvault-warmup-input.json <<'EOF'
{
  "tenureMonths": "24",
  "weeksPaid": "156",
  "monthlyIncome": "18000",
  "salt": "12345678901234567890",
  "commitment": "0",
  "tenureTierIdx": "2",
  "weeksTierIdx": "3",
  "incomeTierIdx": "2"
}
EOF
echo "NOTE: the commitment above is a dummy placeholder (0) — this script only times"
echo "witness generation + proving, it does not produce a verifiable proof. Use"
echo "src/zk/prove.ts for a real, correctly-committed proof."
echo ""
echo "Timing a throwaway prove run..."
time npx snarkjs groth16 fullprove /tmp/gigvault-warmup-input.json "$WASM" "$ZKEY" \
  /tmp/gigvault-warmup-proof.json /tmp/gigvault-warmup-public.json || true

echo "Warm-up complete. The wasm/witness-calculator caches are now warm for this process."
echo "Note: warmth here doesn't carry into the Fastify server process — see the note"
echo "in src/zk/prove.ts about calling a throwaway proof at server startup instead."
