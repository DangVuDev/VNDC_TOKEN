// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRewards
/// @notice Interfaces for academic reward system
/// @dev Defines reward-related data structures and events

interface IAcademicReward {
    /// @notice Reward tier structure
    struct RewardTier {
        string name;
        uint256 minGPA;
        uint256 vncdAmount;
        uint256 badgeTokenId;
        bool active;
    }

    /// @notice Student reward record
    struct StudentReward {
        address student;
        uint256 gpa;
        uint256 tierId;
        uint256 issuedAt;
        bool claimed;
    }

    /// @notice Set GPA threshold for reward
    function setRewardTier(
        uint256 tierId,
        string calldata name,
        uint256 minGPA,
        uint256 vncdAmount,
        uint256 badgeTokenId
    ) external;

    /// @notice Award student based on GPA
    function awardStudent(address student, uint256 gpa) external returns (uint256 rewardId);

    /// @notice Claim reward by student
    function claimReward(uint256 rewardId) external;

    /// @notice Get student's active rewards
    function getStudentRewards(address student) external view returns (uint256[] memory);

    /// @notice Get reward details
    function getReward(uint256 rewardId) external view returns (StudentReward memory);

    /// @notice Check if reward exists
    function rewardExists(uint256 rewardId) external view returns (bool);
}

interface IAcademicBadge {
    /// @notice Mint badge NFT
    function mint(address to, uint256 badgeId, uint256 amount) external;

    /// @notice Burn badge NFT
    function burn(address account, uint256 badgeId, uint256 amount) external;

    /// @notice Get balances for user across all badges
    function getBalances(address account) external view returns (uint256[] memory);
}

/// @notice Academic reward events
interface IAcademicRewardEvents {
    event RewardTierSet(uint256 indexed tierId, string name, uint256 minGPA, uint256 vncdAmount);

    event StudentAwarded(
        uint256 indexed rewardId,
        address indexed student,
        uint256 gpa,
        uint256 tierId
    );

    event RewardClaimed(uint256 indexed rewardId, address indexed student);
}
