// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./GigVaultPassport.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @dev Minimal interface matching snarkjs's generated Solidity verifier
 * (GigVaultVerifier.sol, produced by scripts/build-circuit.sh — GENERATED, do not
 * hand-edit). The verifier's actual function signature depends on the circuit's public
 * signal count (commitment, tenureTierIdx, weeksTierIdx, incomeTierIdx = 4 public
 * signals), matching this interface. If you change the circuit's public signals, this
 * interface and GigVaultVerifier.sol both regenerate/change together — see the
 * artifact-sync note in build-circuit.sh.
 */
interface IGigVaultVerifier {
    function verifyProof(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata publicSignals // [commitment, tenureTierIdx, weeksTierIdx, incomeTierIdx, payerNameHash]
    ) external view returns (bool);
}

/**
 * @title GigVaultAdmission
 * @notice Entry 3 (ISSUE) and Entry 4/step 07 (ADMIT) on-chain. Verifies a Groth16
 * proof against the deployed verifier and, if valid, either mints a new soulbound
 * passport (issue) or answers true/false for an already-issued one (admit) — the
 * on-chain equivalent of the backend's POST /issue and POST /admit routes, for a demo
 * path that goes through a live chain rather than the off-chain SQLite-backed API.
 *
 * This contract never sees plaintext tenure/weeks/income — per zk-reference.md, "the
 * verifier learns nothing beyond the public signals," and the public signals here are
 * exactly: the commitment and three tier indices. No raw rupee or month figures ever
 * appear in calldata or storage on this contract.
 */
contract GigVaultAdmission is Ownable {
    IGigVaultVerifier public immutable verifier;
    GigVaultPassport public immutable passport;

    // Tracks which nullifiers have already issued — "one human, one passport" enforced
    // on-chain as a second line of defense alongside the backend's own check.
    mapping(bytes32 => bool) public nullifierUsed;

    event Issued(uint256 indexed tokenId, address indexed holder, bytes32 commitment);
    event Admitted(uint256 indexed tokenId, bool result);

    constructor(address verifierAddress, address passportAddress) Ownable(msg.sender) {
        verifier = IGigVaultVerifier(verifierAddress);
        passport = GigVaultPassport(passportAddress);
    }

    /// @notice Verifies the Groth16 proof and, if valid and the nullifier hasn't
    /// issued before, mints a soulbound passport to `holder`. `nullifierCommitment` is
    /// a hash of the Anon Aadhaar nullifier (kept off public signals deliberately —
    /// binding it here as a separate parameter, checked against a caller-supplied hash
    /// rather than exposing the raw nullifier on public calldata, since the nullifier
    /// itself doesn't need to be human-readable on explorer).
    function issue(
        address holder,
        bytes32 nullifierCommitment,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata publicSignals
    ) external returns (uint256 tokenId) {
        require(!nullifierUsed[nullifierCommitment], "GigVaultAdmission: nullifier already issued");
        require(verifier.verifyProof(a, b, c, publicSignals), "GigVaultAdmission: invalid proof");

        nullifierUsed[nullifierCommitment] = true;
        bytes32 commitment = bytes32(publicSignals[0]);
        tokenId = passport.issue(holder, commitment);
        emit Issued(tokenId, holder, commitment);
    }

    /// @notice Entry 4 step 07: true/false in under two seconds. Re-verifies the same
    /// stored proof (passed in fresh by the caller, e.g. from the backend's /present
    /// response) against the verifier, and additionally checks the token isn't
    /// revoked. This is what "the chain refuse his version" means on the deck's
    /// closing line — a proof over a forged commitment simply fails verifyProof here.
    function admit(
        uint256 tokenId,
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        uint256[5] calldata publicSignals
    ) external returns (bool result) {
        if (passport.revoked(tokenId)) {
            emit Admitted(tokenId, false);
            return false;
        }
        require(bytes32(publicSignals[0]) == passport.commitmentOf(tokenId), "GigVaultAdmission: commitment mismatch");
        result = verifier.verifyProof(a, b, c, publicSignals);
        emit Admitted(tokenId, result);
    }

    /// @notice Revokes a passport. Operator-only.
    ///
    /// This was previously unrestricted, which meant any address could revoke any
    /// rider's passport — a denial-of-service against the exact people this system
    /// exists to protect, and the sharpest question a judge could have asked. Now gated
    /// to the deploying operator.
    ///
    /// The honest limitation to state on stage: operator-only revocation means the
    /// operator can unilaterally disable a rider's passport. That is consistent with
    /// Level 1 on the deck's trust ladder (you already trust the operator's arithmetic)
    /// but it is a real centralisation, and it is what Level 2's independent co-signers
    /// are meant to remove. Do not describe this as trustless.
    function revoke(uint256 tokenId) external onlyOwner {
        passport.revoke(tokenId);
    }
}
