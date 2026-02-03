// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VNDC Token
 * @notice ERC-20 token for VNDC ecosystem (payments, rewards, governance)
 * @dev Implements minting, burning, pausing, and snapshots for governance
 * @author VNDC Team
 */
contract VNDC_Token is
    ERC20,
    ERC20Burnable,
    ERC20Snapshot,
    Ownable,
    Pausable,
    AccessControl
{
    // ===== ROLES =====
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    // ===== STATE VARIABLES =====
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion VNDC
    uint256 public constant MAX_SUPPLY = 10_000_000_000 * 10 ** 18;    // 10 billion cap
    uint256 public snapshotCounter = 0;

    // ===== EVENTS =====
    event SnapshotCreated(uint256 indexed snapshotId, uint256 timestamp);
    event TokensMinted(address indexed to, uint256 amount, string reason);
    event TokensBurned(address indexed from, uint256 amount, string reason);

    // ===== CONSTRUCTOR =====
    /**
     * @notice Initialize VNDC Token with initial supply
     * @param initialHolder Address to receive initial supply
     */
    constructor(address initialHolder) ERC20("VNDC Token", "VNDC") {
        require(initialHolder != address(0), "Invalid initial holder");

        // Setup roles
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
        _setupRole(PAUSER_ROLE, msg.sender);
        _setupRole(SNAPSHOT_ROLE, msg.sender);

        // Mint initial supply
        _mint(initialHolder, INITIAL_SUPPLY);
    }

    // ===== MINTING FUNCTIONS =====

    /**
     * @notice Mint new tokens
     * @param to Recipient address
     * @param amount Amount to mint
     * @param reason Reason for minting (for tracking)
     * @dev Only MINTER_ROLE can call
     * @dev Cannot exceed MAX_SUPPLY
     */
    function mint(
        address to,
        uint256 amount,
        string memory reason
    ) public onlyRole(MINTER_ROLE) {
        require(to != address(0), "Cannot mint to zero address");
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "Exceeds maximum supply"
        );

        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @notice Batch mint tokens to multiple addresses
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     * @param reason Reason for minting
     * @dev Convenience function to reduce gas for multiple mints
     */
    function batchMint(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string memory reason
    ) public onlyRole(MINTER_ROLE) {
        require(
            recipients.length == amounts.length,
            "Arrays length mismatch"
        );
        require(recipients.length <= 100, "Batch size too large");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(
            totalSupply() + totalAmount <= MAX_SUPPLY,
            "Exceeds maximum supply"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }

        emit TokensMinted(address(0), totalAmount, reason);
    }

    // ===== BURNING FUNCTIONS =====

    /**
     * @notice Burn tokens from caller's balance
     * @param amount Amount to burn
     * @param reason Reason for burning
     * @dev Tokens are permanently removed from circulation
     */
    function burn(uint256 amount, string memory reason)
        public
        override
    {
        super.burn(amount);
        emit TokensBurned(msg.sender, amount, reason);
    }

    /**
     * @notice Burn tokens from another address
     * @param account Address to burn from
     * @param amount Amount to burn
     * @param reason Reason for burning
     * @dev Requires allowance from account
     */
    function burnFrom(
        address account,
        uint256 amount,
        string memory reason
    ) public override {
        super.burnFrom(account, amount);
        emit TokensBurned(account, amount, reason);
    }

    // ===== PAUSE FUNCTIONS =====

    /**
     * @notice Pause token transfers
     * @dev Only PAUSER_ROLE can call
     * @dev Emergency function to stop all transfers
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause token transfers
     * @dev Only PAUSER_ROLE can call
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ===== SNAPSHOT FUNCTIONS =====

    /**
     * @notice Create a snapshot of token balances
     * @dev Used for governance voting and token holder audits
     * @dev Only SNAPSHOT_ROLE can call
     * @return snapshotId ID of the created snapshot
     */
    function snapshot() public onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        snapshotCounter++;
        _snapshot();
        emit SnapshotCreated(snapshotCounter, block.timestamp);
        return snapshotCounter;
    }

    /**
     * @notice Get balance of account at specific snapshot
     * @param account The account address
     * @param snapshotId The snapshot ID
     * @return Balance at snapshot
     */
    function balanceOfAt(address account, uint256 snapshotId)
        public
        view
        override
        returns (uint256)
    {
        return super.balanceOfAt(account, snapshotId);
    }

    /**
     * @notice Get total supply at specific snapshot
     * @param snapshotId The snapshot ID
     * @return Total supply at snapshot
     */
    function totalSupplyAt(uint256 snapshotId)
        public
        view
        override
        returns (uint256)
    {
        return super.totalSupplyAt(snapshotId);
    }

    // ===== INTERNAL FUNCTIONS =====

    /**
     * @notice Hook before token transfer
     * @dev Prevents transfers when contract is paused
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Snapshot) whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @notice Hook after token transfer
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20) {
        super._afterTokenTransfer(from, to, amount);
    }

    /**
     * @notice Hook for token minting
     */
    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._mint(to, amount);
    }

    /**
     * @notice Hook for token burning
     */
    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Snapshot)
    {
        super._burn(account, amount);
    }

    // ===== QUERY FUNCTIONS =====

    /**
     * @notice Get total supply
     * @return Current total supply
     */
    function getTotalSupply() public view returns (uint256) {
        return totalSupply();
    }

    /**
     * @notice Get max supply cap
     * @return Maximum supply allowed
     */
    function getMaxSupply() public pure returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @notice Get remaining tokens that can be minted
     * @return Amount of tokens that can still be minted
     */
    function getRemainingMintable() public view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @notice Check if address is a minter
     * @param account Address to check
     * @return true if account has MINTER_ROLE
     */
    function isMinter(address account) public view returns (bool) {
        return hasRole(MINTER_ROLE, account);
    }
}
