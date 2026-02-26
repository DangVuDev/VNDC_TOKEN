// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFundraising
 * @notice Interface for the campus crowdfunding / fundraising platform.
 */
interface IFundraising {

    // ─── Enums ───

    enum CampaignStatus { Active, Successful, Failed, Cancelled }
    enum CampaignCategory { StudentProject, Research, Club, Charity, Event, Startup, Other }

    // ─── Events ───

    event CampaignCreated(
        uint256 indexed campaignId,
        address indexed creator,
        string title,
        uint256 goalAmount,
        uint256 deadline,
        uint256 timestamp
    );

    event CampaignUpdated(uint256 indexed campaignId, string newDescription, uint256 timestamp);
    event CampaignCancelled(uint256 indexed campaignId, uint256 timestamp);

    event DonationMade(
        uint256 indexed campaignId,
        address indexed donor,
        uint256 amount,
        string message,
        uint256 timestamp
    );

    event FundsWithdrawn(uint256 indexed campaignId, address indexed creator, uint256 amount, uint256 timestamp);
    event RefundClaimed(uint256 indexed campaignId, address indexed donor, uint256 amount, uint256 timestamp);
    event MatchingFundDeposited(address indexed depositor, uint256 amount, uint256 timestamp);
    event MatchingFundApplied(uint256 indexed campaignId, uint256 matchedAmount, uint256 timestamp);
    event MilestoneAdded(uint256 indexed campaignId, uint256 milestoneIndex, string description, uint256 targetAmount, uint256 timestamp);
    event MilestoneCompleted(uint256 indexed campaignId, uint256 milestoneIndex, uint256 timestamp);

    // ─── Campaign Management ───

    function createCampaign(
        string calldata title,
        string calldata description,
        string calldata imageURI,
        uint8 category,
        uint256 goalAmount,
        uint256 durationDays,
        uint256 minDonation
    ) external returns (uint256 campaignId);

    function updateCampaign(uint256 campaignId, string calldata newDescription, string calldata newImageURI) external;
    function cancelCampaign(uint256 campaignId) external;

    // ─── Milestones ───

    function addMilestone(uint256 campaignId, string calldata description, uint256 targetAmount) external;
    function completeMilestone(uint256 campaignId, uint256 milestoneIndex) external;

    // ─── Donations ───

    function donate(uint256 campaignId, uint256 amount, string calldata message) external;

    // ─── Withdraw / Refund ───

    function withdrawFunds(uint256 campaignId) external;
    function claimRefund(uint256 campaignId) external;

    // ─── Matching Fund (Admin) ───

    function depositMatchingFund(uint256 amount) external;
    function applyMatchingFund(uint256 campaignId, uint256 matchAmount) external;

    // ─── Views ───

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
    );

    function getTotalCampaigns() external view returns (uint256);
    function getUserCampaigns(address user) external view returns (uint256[] memory);
    function getUserDonations(address user) external view returns (uint256[] memory);
    function getDonation(uint256 campaignId, address donor) external view returns (uint256 amount, string memory lastMessage, uint256 lastDonatedAt);
    function getCampaignDonors(uint256 campaignId) external view returns (address[] memory);
    function getMilestones(uint256 campaignId) external view returns (string[] memory descriptions, uint256[] memory targets, bool[] memory completed);

    function getPlatformStats() external view returns (
        uint256 totalCampaigns,
        uint256 totalRaised,
        uint256 totalDonors,
        uint256 totalSuccessful,
        uint256 matchingFundBalance
    );
}
