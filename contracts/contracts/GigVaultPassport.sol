// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GigVaultPassport
 * @notice ERC-721 + ERC-5192 soulbound "work passport." Non-transferable per the
 * deck's "issued on his phone... a token nobody can sell or seize." Only the
 * GigVaultAdmission contract (set once at deploy/setAdmission) may mint, since minting
 * must be gated on a verified Groth16 proof, not left open.
 *
 * Per zk-reference.md's honest framing of what soulbinding does and doesn't give you:
 * this contract stops the token being sold or lent, and stops it being transferred.
 * It does NOT by itself prove the presenter controls the wallet holding it — that
 * requires a signature from the owning key checked against ownerOf, which is the
 * verifier's job at presentation time, not this contract's. And it does NOT stop
 * someone forwarding a copy of data derived from the token; freshness has to come from
 * a challenge or expiry at the presentation layer (see backend /present route note on
 * QR expiry), not from anything enforced on-chain here.
 */
contract GigVaultPassport is ERC721, Ownable {
    // ERC-5192
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    bytes4 private constant ERC5192_INTERFACE_ID = 0xb45a3c0e;

    address public admissionContract;
    uint256 private _nextTokenId = 1;

    mapping(uint256 => bool) private _locked;
    mapping(uint256 => bytes32) public commitmentOf; // tokenId -> Poseidon commitment
    mapping(uint256 => bool) public revoked;

    event PassportIssued(uint256 indexed tokenId, address indexed holder, bytes32 commitment);
    event PassportRevoked(uint256 indexed tokenId);

    modifier onlyAdmission() {
        require(msg.sender == admissionContract, "GigVaultPassport: caller is not the Admission contract");
        _;
    }

    constructor() ERC721("GigVault Work Passport", "GVWP") Ownable(msg.sender) {}

    /// @notice One-time wiring of the Admission contract address (owner-only, meant to
    /// be called exactly once right after both contracts are deployed — see
    /// scripts/deploy.ts). Re-callable by the owner only as an explicit escape hatch
    /// if a redeploy is needed mid-hackathon; not meant to be changed in production.
    function setAdmissionContract(address admission) external onlyOwner {
        admissionContract = admission;
    }

    /// @notice Mints a locked (soulbound) passport to `holder`. Only callable by the
    /// Admission contract, which is expected to have already verified the Groth16
    /// proof before calling this — this contract does not re-verify anything itself.
    function issue(address holder, bytes32 commitment) external onlyAdmission returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _safeMint(holder, tokenId);
        _locked[tokenId] = true;
        commitmentOf[tokenId] = commitment;
        emit Locked(tokenId);
        emit PassportIssued(tokenId, holder, commitment);
    }

    /// @notice Revocation flag, checked by verifiers off-chain and by the Admission
    /// contract's admit() before returning true. Per deck: "what is stored publicly:
    /// a hash, an issuer, a date, a revocation flag."
    function revoke(uint256 tokenId) external onlyAdmission {
        require(_ownerOf(tokenId) != address(0), "GigVaultPassport: nonexistent token");
        revoked[tokenId] = true;
        emit PassportRevoked(tokenId);
    }

    // ---- ERC-5192 ----

    function locked(uint256 tokenId) external view returns (bool) {
        require(_ownerOf(tokenId) != address(0), "GigVaultPassport: nonexistent token");
        return _locked[tokenId];
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == ERC5192_INTERFACE_ID || super.supportsInterface(interfaceId);
    }

    // ---- Block transfers while locked (soulbound enforcement) ----
    // OZ v5 routes mint/burn/transfer through _update; reverting here for a locked,
    // already-owned token blocks transfers while still allowing the initial mint
    // (from == address(0)) and leaving room for a future burn path if ever needed.

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) {
            require(!_locked[tokenId], "GigVaultPassport: token is soulbound and cannot be transferred");
        }
        return super._update(to, tokenId, auth);
    }

    // Approvals on a token that can never be transferred are misleading (per
    // zk-reference.md's ERC-5192 notes), so block them too once locked.
    function approve(address to, uint256 tokenId) public virtual override {
        require(!_locked[tokenId], "GigVaultPassport: cannot approve a soulbound token");
        super.approve(to, tokenId);
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert("GigVaultPassport: soulbound tokens do not support operator approval");
    }
}
