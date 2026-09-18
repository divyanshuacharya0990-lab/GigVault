#!/usr/bin/env bash
set -euo pipefail

# Regenerates the entire derived-artifact set from circuits/gigvault.circom in one
# script, per zk-reference.md's "artifact-sync hazard": circuit.wasm,
# circuit_final.zkey, verification_key.json, and the Solidity verifier are all derived
# from one compile, and regenerating one without the others fails in a way that looks
# like a logic bug and isn't. Never run these steps individually by hand under time
# pressure — always through this script.

cd "$(dirname "$0")/.."   # backend/

BUILD_DIR="circuits/build"
PTAU_DIR="circuits/ptau"
CIRCUIT_NAME="gigvault"

mkdir -p "$BUILD_DIR" "$PTAU_DIR"

echo "== 1/6 compile circuit =="
if ! command -v circom >/dev/null 2>&1; then
  echo "circom not found on PATH. Install: https://docs.circom.io/getting-started/installation/" >&2
  exit 1
fi
circom "circuits/${CIRCUIT_NAME}.circom" \
  --r1cs --wasm --sym \
  -o "$BUILD_DIR" \
  -l node_modules/circomlib/circuits \
  -l node_modules

echo "== 2/6 constraint count (informational — check before setup, not during) =="
npx snarkjs r1cs info "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs"

echo "== 3/6 phase 1 (universal, circuit-independent) — reuse cached ptau if present =="
PTAU_FINAL="${PTAU_DIR}/pot12_final.ptau"
if [ ! -f "$PTAU_FINAL" ]; then
  echo "No cached ptau found at ${PTAU_FINAL} — generating a NEW one locally."
  echo "For anything beyond a local demo, download a public ceremony's ptau instead"
  echo "of generating your own (zk-reference.md: 'download a public ptau file rather"
  echo "than generating one')."
  npx snarkjs powersoftau new bn128 12 "${PTAU_DIR}/pot12_0000.ptau" -v
  npx snarkjs powersoftau contribute "${PTAU_DIR}/pot12_0000.ptau" "${PTAU_DIR}/pot12_0001.ptau" \
    --name="gigvault hackathon contribution" -v -e="$(date +%s)-$$-entropy"
  npx snarkjs powersoftau prepare phase2 "${PTAU_DIR}/pot12_0001.ptau" "$PTAU_FINAL" -v
else
  echo "Reusing cached ptau at ${PTAU_FINAL}"
fi

echo "== 4/6 phase 2 (circuit-specific — always rerun on circuit change) =="
npx snarkjs groth16 setup "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" "$PTAU_FINAL" "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey"
npx snarkjs zkey contribute "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
  --name="gigvault hackathon" -v -e="$(date +%s)-$$-entropy2"

echo "== 5/6 export verification key + Solidity verifier (BOTH, together, always) =="
npx snarkjs zkey export verificationkey "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" "${BUILD_DIR}/verification_key.json"
VERIFIER_SOL="../contracts/contracts/GigVaultVerifier.sol"
npx snarkjs zkey export solidityverifier "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" "$VERIFIER_SOL"

# snarkjs names the generated contract `Groth16Verifier`, but scripts/deploy.ts resolves
# it by artifact name via getContractFactory('GigVaultVerifier'). Without this rename the
# deploy fails with HH701 ("artifact not found") the moment you first build the circuit —
# i.e. only after the placeholder has been overwritten, which is the worst possible time
# to discover it. Rename the contract, not just the file.
if grep -q "contract Groth16Verifier" "$VERIFIER_SOL"; then
  sed -i.bak 's/contract Groth16Verifier/contract GigVaultVerifier/' "$VERIFIER_SOL"
  rm -f "${VERIFIER_SOL}.bak"
  echo "   renamed generated contract Groth16Verifier -> GigVaultVerifier"
fi

# Fail loudly if the generated verifier's public-signal count drifts from the 4 that
# GigVaultAdmission.sol's IGigVaultVerifier interface expects.
if ! grep -qE "uint\[4\] (calldata |memory )?_pubSignals" "$VERIFIER_SOL"; then
  echo "WARNING: generated verifier does not take uint[4] _pubSignals." >&2
  echo "         GigVaultAdmission.sol's IGigVaultVerifier expects exactly 4 public" >&2
  echo "         signals [commitment, tenureTierIdx, weeksTierIdx, incomeTierIdx]." >&2
  echo "         Update that interface to match before compiling contracts." >&2
fi

echo "== 6/6 warm-up proof (first prove is slow; quote a warm number on stage) =="
echo "Skipping warm-up run here — do this once manually before your demo, with real"
echo "sample input, using scripts/warmup-prove.sh (see backend/scripts/)."

echo ""
echo "Done. Regenerated together:"
echo "  ${BUILD_DIR}/${CIRCUIT_NAME}.wasm (inside ${CIRCUIT_NAME}_js/)"
echo "  ${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey"
echo "  ${BUILD_DIR}/verification_key.json"
echo "  ../contracts/contracts/GigVaultVerifier.sol"
echo "If you hand-edit the circuit again, rerun this whole script — not individual steps."
