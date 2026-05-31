// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title FundingManager
 * @notice On-chain vault for categorized fundraising pots.
 *
 * Design:
 *  - This contract stores pot metadata, manager roles, and on-chain balances.
 *  - Incoming token transfer is executed by the existing transfer pipeline.
 *  - After a transfer to this contract succeeds, backend calls recordContribution()
 *    to attribute that amount to a specific pot.
 *  - Spending from pots is enforced on-chain with owner/deputy checks.
 */
contract FundingManager is Ownable, AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    IERC20 public immutable token;

    enum PotStatus {
        DRAFT,
        ACTIVE,
        CLOSED,
        CANCELLED
    }

    struct Pot {
        bytes32 id;
        string category;
        string title;
        address owner;
        uint256 targetAmount;
        uint256 totalContributed;
        uint256 totalSpent;
        uint256 availableBalance;
        PotStatus status;
        uint64 createdAt;
        uint64 startsAt;
        uint64 endsAt;
    }

    mapping(bytes32 => Pot) public pots;
    mapping(bytes32 => mapping(address => bool)) public deputies;

    event PotCreated(bytes32 indexed potId, address indexed owner, uint256 targetAmount, string category, string title);
    event DeputyAdded(bytes32 indexed potId, address indexed deputy);
    event DeputyRemoved(bytes32 indexed potId, address indexed deputy);
    event PotStatusUpdated(bytes32 indexed potId, PotStatus status);
    event ContributionRecorded(bytes32 indexed potId, address indexed contributor, uint256 amount, uint256 availableBalance, bytes32 indexed transferTxHash);
    event Spent(bytes32 indexed potId, address indexed actor, address indexed beneficiary, uint256 amount, uint256 availableBalance, string note);

    constructor(address tokenAddress) Ownable(msg.sender) {
        require(tokenAddress != address(0), "zero token");
        token = IERC20(tokenAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function createPot(
        bytes32 potId,
        address owner,
        uint256 targetAmount,
        string calldata category,
        string calldata title,
        address[] calldata deputyList,
        uint64 startsAt,
        uint64 endsAt
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(potId != bytes32(0), "zero pot id");
        require(owner != address(0), "zero owner");
        require(targetAmount > 0, "zero target");
        require(pots[potId].id == bytes32(0), "pot exists");
        if (endsAt > 0 && startsAt > 0) {
            require(endsAt > startsAt, "invalid time window");
        }

        Pot storage p = pots[potId];
        p.id = potId;
        p.category = category;
        p.title = title;
        p.owner = owner;
        p.targetAmount = targetAmount;
        p.status = PotStatus.ACTIVE;
        p.createdAt = uint64(block.timestamp);
        p.startsAt = startsAt;
        p.endsAt = endsAt;

        _addInitialDeputies(potId, owner, deputyList);

        emit PotCreated(potId, owner, targetAmount, category, title);
    }

    function addDeputy(bytes32 potId, address deputy) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Pot storage p = _requirePot(potId);
        require(p.status != PotStatus.CANCELLED, "pot cancelled");
        require(deputy != address(0), "zero deputy");
        require(deputy != p.owner, "owner cannot be deputy");
        require(!deputies[potId][deputy], "deputy exists");

        deputies[potId][deputy] = true;
        emit DeputyAdded(potId, deputy);
    }

    function removeDeputy(bytes32 potId, address deputy) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Pot storage p = _requirePot(potId);
        require(p.status != PotStatus.CANCELLED, "pot cancelled");
        require(deputies[potId][deputy], "deputy missing");

        deputies[potId][deputy] = false;
        emit DeputyRemoved(potId, deputy);
    }

    function setPotStatus(bytes32 potId, PotStatus status) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Pot storage p = _requirePot(potId);
        p.status = status;
        emit PotStatusUpdated(potId, status);
    }

    /**
     * @notice Attribute an already-settled token transfer to a pot.
     * @dev The backend should call this only after transfer worker confirms
     * token transfer to this contract address.
     */
    function recordContribution(
        bytes32 potId,
        address contributor,
        uint256 amount,
        bytes32 transferTxHash
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Pot storage p = _requirePot(potId);
        require(p.status == PotStatus.ACTIVE || p.status == PotStatus.DRAFT, "pot not accepting funds");
        require(contributor != address(0), "zero contributor");
        require(amount > 0, "zero amount");

        p.totalContributed += amount;
        p.availableBalance += amount;

        emit ContributionRecorded(potId, contributor, amount, p.availableBalance, transferTxHash);
    }

    /**
     * @notice Spend pot funds to a beneficiary if actor is owner/deputy.
     */
    function spend(
        bytes32 potId,
        address actor,
        address beneficiary,
        uint256 amount,
        string calldata note
    ) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Pot storage p = _requirePot(potId);
        require(p.status == PotStatus.ACTIVE, "pot not active");
        require(actor != address(0), "zero actor");
        require(beneficiary != address(0), "zero beneficiary");
        require(amount > 0, "zero amount");
        require(_canSpend(potId, actor), "actor not manager");
        require(p.availableBalance >= amount, "insufficient pot balance");

        p.availableBalance -= amount;
        p.totalSpent += amount;

        require(token.transfer(beneficiary, amount), "token transfer failed");

        emit Spent(potId, actor, beneficiary, amount, p.availableBalance, note);
    }

    function _canSpend(bytes32 potId, address actor) internal view returns (bool) {
        Pot storage p = pots[potId];
        return p.owner == actor || deputies[potId][actor];
    }

    function _requirePot(bytes32 potId) internal view returns (Pot storage) {
        Pot storage p = pots[potId];
        require(p.id != bytes32(0), "pot not found");
        return p;
    }

    function _addInitialDeputies(bytes32 potId, address owner, address[] calldata deputyList) internal {
        for (uint256 i = 0; i < deputyList.length; i++) {
            address deputy = deputyList[i];
            if (deputy != address(0) && deputy != owner && !deputies[potId][deputy]) {
                deputies[potId][deputy] = true;
                emit DeputyAdded(potId, deputy);
            }
        }
    }
}
