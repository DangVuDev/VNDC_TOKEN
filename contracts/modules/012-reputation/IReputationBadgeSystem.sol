// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IReputationBadgeSystem
 * @dev Interface for reputation and badge management system
 */
interface IReputationBadgeSystem {
    // ============ Events ============
    event BadgeTypeCreated(
        uint256 indexed badgeTypeId,
        string name,
        uint256 requiredPoints,
        uint256 createdAt
    );

    event BadgeAwarded(
        address indexed user,
        uint256 indexed badgeTypeId,
        uint256 awardedAt
    );

    event BadgeRevoked(
        address indexed user,
        uint256 indexed badgeTypeId,
        uint256 revokedAt
    );

    event ReputationPointsAdded(
        address indexed user,
        uint256 points,
        string reason,
        uint256 addedAt
    );

    event ReputationPointsDeducted(
        address indexed user,
        uint256 points,
        string reason,
        uint256 deductedAt
    );

    event TierUpdated(
        address indexed user,
        uint256 newTier,
        uint256 updatedAt
    );

    event AchievementUnlocked(
        address indexed user,
        string achievement,
        uint256 unlockedAt
    );

    // ============ Mutations ============
    /**
     * @notice Create a badge type
     * @param name Badge name
     * @param description Badge description
     * @param requiredPoints Points required to earn badge
     * @param category Badge category
     * @param iconURI IPFS URI for badge icon
     * @return badgeTypeId ID of the badge type
     */
    function createBadgeType(
        string calldata name,
        string calldata description,
        uint256 requiredPoints,
        string calldata category,
        string calldata iconURI
    ) external returns (uint256);

    /**
     * @notice Award badge to user
     * @param user User address
     * @param badgeTypeId Badge type ID
     */
    function awardBadge(address user, uint256 badgeTypeId) external;

    /**
     * @notice Revoke badge from user
     * @param user User address
     * @param badgeTypeId Badge type ID
     */
    function revokeBadge(address user, uint256 badgeTypeId) external;

    /**
     * @notice Add reputation points
     * @param user User address
     * @param points Points to add
     * @param reason Reason for points
     */
    function addReputationPoints(
        address user,
        uint256 points,
        string calldata reason
    ) external;

    /**
     * @notice Deduct reputation points
     * @param user User address
     * @param points Points to deduct
     * @param reason Reason for deduction
     */
    function deductReputationPoints(
        address user,
        uint256 points,
        string calldata reason
    ) external;

    /**
     * @notice Unlock achievement
     * @param user User address
     * @param achievement Achievement name
     */
    function unlockAchievement(address user, string calldata achievement) external;

    /**
     * @notice Authorize a badge issuer
     * @param issuer Issuer address
     */
    function authorizeBadgeIssuer(address issuer) external;

    /**
     * @notice Revoke badge issuer authorization
     * @param issuer Issuer address
     */
    function revokeBadgeIssuer(address issuer) external;

    /**
     * @notice Authorize points editor
     * @param editor Editor address
     */
    function authorizePointsEditor(address editor) external;

    /**
     * @notice Revoke points editor authorization
     * @param editor Editor address
     */
    function revokePointsEditor(address editor) external;

    // ============ Queries ============
    /**
     * @notice Get user reputation points
     * @param user User address
     */
    function getUserReputationPoints(address user)
        external
        view
        returns (uint256);

    /**
     * @notice Get user tier level
     * @param user User address
     */
    function getUserTier(address user)
        external
        view
        returns (uint256);

    /**
     * @notice Get user badges
     * @param user User address
     */
    function getUserBadges(address user)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Check if user has badge
     * @param user User address
     * @param badgeTypeId Badge type ID
     */
    function hasBadge(address user, uint256 badgeTypeId)
        external
        view
        returns (bool);

    /**
     * @notice Get badge type information
     * @param badgeTypeId Badge type ID
     */
    function getBadgeTypeInfo(uint256 badgeTypeId)
        external
        view
        returns (
            string memory name,
            string memory description,
            uint256 requiredPoints,
            string memory category,
            string memory iconURI,
            uint256 totalAwarded
        );

    /**
     * @notice Get user achievements
     * @param user User address
     */
    function getUserAchievements(address user)
        external
        view
        returns (string[] memory);

    /**
     * @notice Check if user has achievement
     * @param user User address
     * @param achievement Achievement name
     */
    function hasAchievement(address user, string calldata achievement)
        external
        view
        returns (bool);

    /**
     * @notice Get reputation history for user
     * @param user User address
     */
    function getReputationHistory(address user)
        external
        view
        returns (
            uint256[] memory points,
            string[] memory reasons,
            uint256[] memory timestamps
        );

    /**
     * @notice Get badge history
     * @param user User address
     */
    function getBadgeHistory(address user)
        external
        view
        returns (
            uint256[] memory badgeTypeIds,
            uint256[] memory awardedAt,
            bool[] memory isActive
        );

    /**
     * @notice Get total badge types
     */
    function getTotalBadgeTypes() external view returns (uint256);

    /**
     * @notice Get total users with reputation
     */
    function getTotalUsersWithReputation() external view returns (uint256);

    /**
     * @notice Get leaderboard (top users by reputation)
     * @param limit Number of users to return
     */
    function getLeaderboard(uint256 limit)
        external
        view
        returns (address[] memory users, uint256[] memory points);

    /**
     * @notice Get tier information
     * @param tier Tier level
     */
    function getTierInfo(uint256 tier)
        external
        view
        returns (
            uint256 minPoints,
            uint256 maxPoints,
            string memory name
        );

    /**
     * @notice Check if address is badge issuer
     * @param issuer Issuer address
     */
    function isBadgeIssuer(address issuer)
        external
        view
        returns (bool);

    /**
     * @notice Check if address is points editor
     * @param editor Editor address
     */
    function isPointsEditor(address editor)
        external
        view
        returns (bool);
}
