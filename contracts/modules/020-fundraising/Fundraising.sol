// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IFundraising.sol";

/**
 * @title Fundraising
 * @author VNDC Education Platform
 * @notice Campus crowdfunding — create campaigns, donate VNDC, matching fund.
 *         Students can raise funds for projects, research, clubs, events, and startups.
 *         Supports milestones, refunds on failed campaigns, and admin matching fund.
 * @dev Module 020 – counters start at 1, Ownable(msg.sender)
 */
contract Fundraising is IFundraising, Ownable, ReentrancyGuard {

    // ─── Token ───
    IERC20 public paymentToken;

    // ─── Counters ───
    uint256 public nextCampaignId;

    // ─── Platform Fees ───
    uint256 public platformFeeBps; // basis-points fee on successful withdrawal (e.g. 250 = 2.5%)
    uint256 public matchingFundBalance;

    // ─── Platform Stats ───
    uint256 public totalRaisedPlatform;
    uint256 public totalDonorsPlatform;
    uint256 public totalSuccessfulCampaigns;

    // ─── Structs ───

    struct Campaign {
        address  creator;
        string   title;
        string   description;
        string   imageURI;
        CampaignCategory category;
        uint256  goalAmount;
        uint256  raisedAmount;
        uint256  deadline;
        uint256  minDonation;
        CampaignStatus status;
        uint256  createdAt;
        bool     fundsWithdrawn;
        // donors
        address[] donors;
        mapping(address => uint256) donations;
        mapping(address => string) lastMessage;
        mapping(address => uint256) lastDonatedAt;
        // milestones
        string[]  milestoneDescs;
        uint256[] milestoneTargets;
        bool[]    milestoneCompleted;
    }

    // ─── Storage ───
    mapping(uint256 => Campaign)    private campaigns;
    mapping(address => uint256[])   private _userCampaigns;
    mapping(address => uint256[])   private _userDonations;  // campaignIds where user donated
    mapping(address => mapping(uint256 => bool)) private _hasDonated; // user -> campaignId -> bool

    // ─── Constructor ───
    constructor(address _paymentToken) Ownable(msg.sender) {
        require(_paymentToken != address(0), "Zero token");
        paymentToken = IERC20(_paymentToken);
        nextCampaignId = 1;
        platformFeeBps = 250; // 2.5% default
    }

    // ═══════════════════════════════════════════════
    // ─── Admin ───
    // ═══════════════════════════════════════════════

    function setPlatformFeeBps(uint256 feeBps) external onlyOwner {
        require(feeBps <= 1000, "Max 10%");
        platformFeeBps = feeBps;
    }

    function depositMatchingFund(uint256 amount) external {
        require(amount > 0, "Zero amount");
        paymentToken.transferFrom(msg.sender, address(this), amount);
        matchingFundBalance += amount;
        emit MatchingFundDeposited(msg.sender, amount, block.timestamp);
    }

    function applyMatchingFund(uint256 campaignId, uint256 matchAmount) external onlyOwner {
        Campaign storage c = campaigns[campaignId];
        require(c.createdAt > 0, "Not found");
        require(c.status == CampaignStatus.Active, "Not active");
        require(matchAmount > 0 && matchAmount <= matchingFundBalance, "Insufficient matching fund");

        matchingFundBalance -= matchAmount;
        c.raisedAmount += matchAmount;
        totalRaisedPlatform += matchAmount;

        emit MatchingFundApplied(campaignId, matchAmount, block.timestamp);

        // Auto-succeed if goal reached
        if (c.raisedAmount >= c.goalAmount) {
            c.status = CampaignStatus.Successful;
            totalSuccessfulCampaigns++;
        }
    }

    // ═══════════════════════════════════════════════
    // ─── Campaign Management ───
    // ═══════════════════════════════════════════════

    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata imageURI,
        uint8 category,
        uint256 goalAmount,
        uint256 durationDays,
        uint256 minDonation
    ) external returns (uint256 campaignId) {
        require(bytes(title).length > 0, "Empty title");
        require(goalAmount > 0, "Goal > 0");
        require(durationDays >= 1 && durationDays <= 365, "Duration 1-365 days");
        require(category <= uint8(CampaignCategory.Other), "Invalid category");

        campaignId = nextCampaignId++;
        Campaign storage c = campaigns[campaignId];
        c.creator     = msg.sender;
        c.title       = title;
        c.description = description;
        c.imageURI    = imageURI;
        c.category    = CampaignCategory(category);
        c.goalAmount  = goalAmount;
        c.deadline    = block.timestamp + (durationDays * 1 days);
        c.minDonation = minDonation;
        c.status      = CampaignStatus.Active;
        c.createdAt   = block.timestamp;

        _userCampaigns[msg.sender].push(campaignId);

        emit CampaignCreated(campaignId, msg.sender, title, goalAmount, c.deadline, block.timestamp);
    }

    function updateCampaign(uint256 campaignId, string calldata newDescription, string calldata newImageURI) external {
        Campaign storage c = campaigns[campaignId];
        require(c.creator == msg.sender, "Not creator");
        require(c.status == CampaignStatus.Active, "Not active");
        c.description = newDescription;
        if (bytes(newImageURI).length > 0) c.imageURI = newImageURI;
        emit CampaignUpdated(campaignId, newDescription, block.timestamp);
    }

    function cancelCampaign(uint256 campaignId) external {
        Campaign storage c = campaigns[campaignId];
        require(c.creator == msg.sender || msg.sender == owner(), "Not authorized");
        require(c.status == CampaignStatus.Active, "Not active");
        c.status = CampaignStatus.Cancelled;
        emit CampaignCancelled(campaignId, block.timestamp);
    }

    // ═══════════════════════════════════════════════
    // ─── Milestones ───
    // ═══════════════════════════════════════════════

    function addMilestone(uint256 campaignId, string calldata description, uint256 targetAmount) external {
        Campaign storage c = campaigns[campaignId];
        require(c.creator == msg.sender, "Not creator");
        require(c.status == CampaignStatus.Active, "Not active");
        require(bytes(description).length > 0, "Empty desc");
        require(targetAmount > 0 && targetAmount <= c.goalAmount, "Invalid target");

        c.milestoneDescs.push(description);
        c.milestoneTargets.push(targetAmount);
        c.milestoneCompleted.push(false);

        emit MilestoneAdded(campaignId, c.milestoneDescs.length - 1, description, targetAmount, block.timestamp);
    }

    function completeMilestone(uint256 campaignId, uint256 milestoneIndex) external {
        Campaign storage c = campaigns[campaignId];
        require(c.creator == msg.sender, "Not creator");
        require(milestoneIndex < c.milestoneDescs.length, "Invalid index");
        require(!c.milestoneCompleted[milestoneIndex], "Already completed");
        require(c.raisedAmount >= c.milestoneTargets[milestoneIndex], "Not reached target");

        c.milestoneCompleted[milestoneIndex] = true;
        emit MilestoneCompleted(campaignId, milestoneIndex, block.timestamp);
    }

    // ═══════════════════════════════════════════════
    // ─── Donations ───
    // ═══════════════════════════════════════════════

    function donate(uint256 campaignId, uint256 amount, string calldata message) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.createdAt > 0, "Not found");
        require(c.status == CampaignStatus.Active, "Not active");
        require(block.timestamp <= c.deadline, "Expired");
        require(amount >= c.minDonation, "Below min");

        paymentToken.transferFrom(msg.sender, address(this), amount);

        c.raisedAmount += amount;
        c.donations[msg.sender] += amount;
        c.lastMessage[msg.sender] = message;
        c.lastDonatedAt[msg.sender] = block.timestamp;
        totalRaisedPlatform += amount;

        if (!_hasDonated[msg.sender][campaignId]) {
            _hasDonated[msg.sender][campaignId] = true;
            c.donors.push(msg.sender);
            _userDonations[msg.sender].push(campaignId);
            totalDonorsPlatform++;
        }

        emit DonationMade(campaignId, msg.sender, amount, message, block.timestamp);

        // Auto-succeed if goal reached
        if (c.raisedAmount >= c.goalAmount) {
            c.status = CampaignStatus.Successful;
            totalSuccessfulCampaigns++;
        }
    }

    // ═══════════════════════════════════════════════
    // ─── Withdraw / Refund ───
    // ═══════════════════════════════════════════════

    function withdrawFunds(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];
        require(c.creator == msg.sender, "Not creator");
        require(!c.fundsWithdrawn, "Already withdrawn");

        // Must be successful OR deadline passed with raised >= goal
        _finalizeCampaign(campaignId);
        require(c.status == CampaignStatus.Successful, "Not successful");

        c.fundsWithdrawn = true;

        uint256 raised = c.raisedAmount;
        uint256 fee = (raised * platformFeeBps) / 10000;
        uint256 payout = raised - fee;

        // Fee stays in contract (owner can retrieve later)
        paymentToken.transfer(msg.sender, payout);

        emit FundsWithdrawn(campaignId, msg.sender, payout, block.timestamp);
    }

    function claimRefund(uint256 campaignId) external nonReentrant {
        Campaign storage c = campaigns[campaignId];

        // Finalize if deadline passed
        _finalizeCampaign(campaignId);

        require(
            c.status == CampaignStatus.Failed || c.status == CampaignStatus.Cancelled,
            "Not refundable"
        );

        uint256 donated = c.donations[msg.sender];
        require(donated > 0, "No donation");

        c.donations[msg.sender] = 0;
        c.raisedAmount -= donated;

        paymentToken.transfer(msg.sender, donated);

        emit RefundClaimed(campaignId, msg.sender, donated, block.timestamp);
    }

    /// @notice Owner can withdraw accumulated platform fees
    function withdrawPlatformFees(uint256 amount) external onlyOwner {
        paymentToken.transfer(owner(), amount);
    }

    // ═══════════════════════════════════════════════
    // ─── View Functions ───
    // ═══════════════════════════════════════════════

    function getCampaign(uint256 campaignId) external view returns (
        address creator,
        string memory title,
        string memory description,
        string memory imageURI,
        CampaignCategory category,
        uint256 goalAmount,
        uint256 raisedAmount,
        uint256 donorCount,
        uint256 deadline,
        uint256 minDonation,
        CampaignStatus status,
        uint256 createdAt
    ) {
        Campaign storage c = campaigns[campaignId];
        // Compute effective status
        CampaignStatus effectiveStatus = c.status;
        if (effectiveStatus == CampaignStatus.Active && block.timestamp > c.deadline) {
            effectiveStatus = c.raisedAmount >= c.goalAmount
                ? CampaignStatus.Successful
                : CampaignStatus.Failed;
        }
        return (
            c.creator, c.title, c.description, c.imageURI, c.category,
            c.goalAmount, c.raisedAmount, c.donors.length, c.deadline,
            c.minDonation, effectiveStatus, c.createdAt
        );
    }

    function getTotalCampaigns() external view returns (uint256) {
        return nextCampaignId - 1;
    }

    function getUserCampaigns(address user) external view returns (uint256[] memory) {
        return _userCampaigns[user];
    }

    function getUserDonations(address user) external view returns (uint256[] memory) {
        return _userDonations[user];
    }

    function getDonation(uint256 campaignId, address donor) external view returns (
        uint256 amount, string memory lastMessage, uint256 lastDonatedAt
    ) {
        Campaign storage c = campaigns[campaignId];
        return (c.donations[donor], c.lastMessage[donor], c.lastDonatedAt[donor]);
    }

    function getCampaignDonors(uint256 campaignId) external view returns (address[] memory) {
        return campaigns[campaignId].donors;
    }

    function getMilestones(uint256 campaignId) external view returns (
        string[] memory descriptions,
        uint256[] memory targets,
        bool[] memory completed
    ) {
        Campaign storage c = campaigns[campaignId];
        return (c.milestoneDescs, c.milestoneTargets, c.milestoneCompleted);
    }

    function getPlatformStats() external view returns (
        uint256 totalCampaigns,
        uint256 totalRaised,
        uint256 totalDonors,
        uint256 totalSuccessful,
        uint256 matchingFundBalance_
    ) {
        return (nextCampaignId - 1, totalRaisedPlatform, totalDonorsPlatform, totalSuccessfulCampaigns, matchingFundBalance);
    }

    // ═══════════════════════════════════════════════
    // ─── Internal ───
    // ═══════════════════════════════════════════════

    function _finalizeCampaign(uint256 campaignId) internal {
        Campaign storage c = campaigns[campaignId];
        if (c.status != CampaignStatus.Active) return;
        if (block.timestamp <= c.deadline) return;

        if (c.raisedAmount >= c.goalAmount) {
            c.status = CampaignStatus.Successful;
            totalSuccessfulCampaigns++;
        } else {
            c.status = CampaignStatus.Failed;
        }
    }
}
