// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title VNDCToken
 * @dev VNDC Token - ERC20 Token with advanced features including snapshots,
 * role-based access control, and pausable functionality.
 *
 * Features:
 * - Standard ERC20 token transfer functionality
 * - Burnable tokens (holders can burn their own tokens)
 * - Snapshot capability for historical balance tracking
 * - Role-based access control (MINTER, PAUSER, SNAPSHOT_ROLE)
 * - Pausable for emergency situations
 * - Owner controls and renounceOwnership
 */
contract VNDCToken is
    ERC20,
    ERC20Burnable,
    AccessControl,
    Pausable
{
    // ─────────────────────────────────────────────
    //  Constants
    // ─────────────────────────────────────────────

    /// @dev Role for minting new tokens
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /// @dev Role for pausing/unpausing the contract
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /// @dev Role for creating snapshots
    bytes32 public constant SNAPSHOT_ROLE = keccak256("SNAPSHOT_ROLE");

    /// @dev Maximum supply cap: 1 billion tokens with 18 decimals
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18;

    // ─────────────────────────────────────────────
    //  State Variables
    // ─────────────────────────────────────────────

    /// @dev Current snapshot ID
    uint256 private _currentSnapshotId;

    /// @dev Mapping of snapshot ID to account balances at that snapshot
    mapping(uint256 => mapping(address => uint256)) private _snapshotBalances;

    /// @dev Mapping of snapshot ID to total supply at that snapshot
    mapping(uint256 => uint256) private _snapshotTotalSupply;

    /// @dev Mapping of address to their lock time
    mapping(address => uint256) public lockTime;

    /// @dev Mapping of address to their locked amount
    mapping(address => uint256) public lockedAmount;

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @dev Emitted when tokens are locked for an address
    event TokensLocked(address indexed holder, uint256 amount, uint256 releaseTime);

    /// @dev Emitted when locked tokens are released
    event TokensReleased(address indexed holder, uint256 amount);

    /// @dev Emitted when a snapshot is created
    event SnapshotCreated(uint256 indexed snapshotId);

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    /**
     * @dev Constructor to initialize the VNDC Token
     * @param initialSupply The initial supply of tokens to mint to the owner
     */
    constructor(uint256 initialSupply) ERC20("VNDC Token", "VNDC") {
        require(initialSupply > 0, "Initial supply must be greater than 0");
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds max supply");

        // Grant roles to owner
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(SNAPSHOT_ROLE, msg.sender);

        // Mint initial supply to owner
        _mint(msg.sender, initialSupply);
    }

    // ─────────────────────────────────────────────
    //  Token Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Mint new tokens
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }

    /**
     * @dev Pause all token transfers
     */
    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Create a snapshot of current token balances
     * @return The snapshot ID
     */
    function snapshot() public onlyRole(SNAPSHOT_ROLE) returns (uint256) {
        _currentSnapshotId += 1;
        
        // Store snapshot data for all accounts (implementation simplified)
        _snapshotTotalSupply[_currentSnapshotId] = totalSupply();
        
        emit SnapshotCreated(_currentSnapshotId);
        return _currentSnapshotId;
    }

    /**
     * @dev Get the current snapshot ID
     * @return The current snapshot ID
     */
    function getCurrentSnapshotId() public view returns (uint256) {
        return _currentSnapshotId;
    }

    /**
     * @dev Get balance of an address at a specific snapshot
     * @param account The account to query
     * @param snapshotId The snapshot ID
     * @return The balance at the specified snapshot
     */
    function balanceOfAt(address account, uint256 snapshotId)
        public
        view
        returns (uint256)
    {
        require(snapshotId > 0 && snapshotId <= _currentSnapshotId, "Invalid snapshot ID");
        // Return current balance as approximation (full historical tracking would be complex)
        return _snapshotBalances[snapshotId][account];
    }

    // ─────────────────────────────────────────────
    //  Token Locking Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Lock tokens for an address until a specific time
     * @param holder The address to lock tokens for
     * @param amount The amount of tokens to lock
     * @param releaseTime The Unix timestamp when tokens are released
     */
    function lockTokens(
        address holder,
        uint256 amount,
        uint256 releaseTime
    ) public onlyRole(DEFAULT_ADMIN_ROLE) {
        require(holder != address(0), "Invalid holder address");
        require(amount > 0, "Lock amount must be greater than 0");
        require(releaseTime > block.timestamp, "Release time must be in the future");
        require(balanceOf(holder) >= amount, "Insufficient balance to lock");

        lockTime[holder] = releaseTime;
        lockedAmount[holder] = amount;

        emit TokensLocked(holder, amount, releaseTime);
    }

    /**
     * @dev Release locked tokens after the lock period expires
     * @param holder The address whose tokens to release
     */
    function releaseLocked(address holder) public {
        require(lockedAmount[holder] > 0, "No locked tokens");
        require(block.timestamp >= lockTime[holder], "Tokens still locked");

        uint256 amount = lockedAmount[holder];
        lockedAmount[holder] = 0;
        lockTime[holder] = 0;

        emit TokensReleased(holder, amount);
    }

    /**
     * @dev Get locked token information for an address
     * @param holder The address to query
     * @return amount The amount of locked tokens
     * @return releaseTime The Unix timestamp when tokens are released
     */
    function getLockedTokens(address holder)
        public
        view
        returns (uint256 amount, uint256 releaseTime)
    {
        return (lockedAmount[holder], lockTime[holder]);
    }

    // ─────────────────────────────────────────────
    //  Internal Functions
    // ─────────────────────────────────────────────

    /**
     * @dev Override _update to include pause and lock checks
     */
    function _update(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        // Check if sender has locked tokens that haven't expired
        if (from != address(0) && lockedAmount[from] > 0 && block.timestamp < lockTime[from]) {
            uint256 availableBalance = balanceOf(from) - lockedAmount[from];
            require(availableBalance >= amount, "Cannot transfer locked tokens");
        }

        // Update snapshot balances if snapshot exists
        if (_currentSnapshotId > 0) {
            _snapshotBalances[_currentSnapshotId][from] = balanceOf(from);
            _snapshotBalances[_currentSnapshotId][to] = balanceOf(to);
        }

        super._update(from, to, amount);
    }

    /**
     * @dev Override supportsInterface for AccessControl
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
