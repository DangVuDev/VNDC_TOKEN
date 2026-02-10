// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputationBadgeSystem} from "./IReputationBadgeSystem.sol";

/**
 * @title ReputationBadgeSystem
 * @dev Manages user reputation points and badges/achievements
 */
contract ReputationBadgeSystem is Ownable, IReputationBadgeSystem {
    // ============ Data Structures ============
    struct BadgeType {
        string name;
        string description;
        uint256 requiredPoints;
        string category;
        string iconURI;
        uint256 totalAwarded;
    }

    struct ReputationRecord {
        uint256 points;
        string reason;
        uint256 timestamp;
        bool isAddition;
    }

    struct BadgeRecord {
        uint256 badgeTypeId;
        uint256 awardedAt;
        bool isActive;
    }

    struct TierInfo {
        uint256 minPoints;
        uint256 maxPoints;
        string name;
    }

    // ============ State Variables ============
    uint256 private badgeTypeCounter;
    
    mapping(address => uint256) private userReputationPoints;
    mapping(address => uint256) private userTier;
    mapping(address => uint256[]) private userBadges;
    mapping(address => mapping(uint256 => bool)) private userHasBadge;
    mapping(uint256 => BadgeType) private badgeTypes;
    mapping(address => ReputationRecord[]) private reputationHistory;
    mapping(address => BadgeRecord[]) private badgeHistory;
    mapping(address => mapping(string => bool)) private userAchievements;
    mapping(address => string[]) private userAchievementsList;
    mapping(address => bool) private authorizedBadgeIssuers;
    mapping(address => bool) private authorizedPointsEditors;

    // Tier system
    mapping(uint256 => TierInfo) private tiers;

    // Leaderboard tracking
    address[] private usersWithReputation;
    mapping(address => bool) private isTrackedUser;

    // Statistics
    uint256 private totalBadgeTypes;

    // ============ Modifiers ============
    modifier onlyBadgeIssuer() {
        require(
            authorizedBadgeIssuers[msg.sender] || msg.sender == owner(),
            "ReputationBadgeSystem: Not authorized badge issuer"
        );
        _;
    }

    modifier onlyPointsEditor() {
        require(
            authorizedPointsEditors[msg.sender] || msg.sender == owner(),
            "ReputationBadgeSystem: Not authorized points editor"
        );
        _;
    }

    modifier badgeTypeExists(uint256 badgeTypeId) {
        require(
            badgeTypeId > 0 && badgeTypeId < badgeTypeCounter,
            "ReputationBadgeSystem: Badge type does not exist"
        );
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        badgeTypeCounter = 1;
        totalBadgeTypes = 0;

        // Initialize tier system
        // Tier 1: 0-999 points (Bronze)
        tiers[1] = TierInfo({minPoints: 0, maxPoints: 999, name: "Bronze"});
        // Tier 2: 1000-4999 points (Silver)
        tiers[2] = TierInfo({minPoints: 1000, maxPoints: 4999, name: "Silver"});
        // Tier 3: 5000-9999 points (Gold)
        tiers[3] = TierInfo({minPoints: 5000, maxPoints: 9999, name: "Gold"});
        // Tier 4: 10000+ points (Platinum)
        tiers[4] = TierInfo({minPoints: 10000, maxPoints: type(uint256).max, name: "Platinum"});

        // Authorize deployer
        authorizedBadgeIssuers[msg.sender] = true;
        authorizedPointsEditors[msg.sender] = true;
    }

    // ============ Core Functions ============
    /**
     * @notice Create a badge type
     */
    function createBadgeType(
        string calldata name,
        string calldata description,
        uint256 requiredPoints,
        string calldata category,
        string calldata iconURI
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "ReputationBadgeSystem: Name required");
        require(requiredPoints >= 0, "ReputationBadgeSystem: Points must be valid");

        uint256 badgeTypeId = badgeTypeCounter++;

        badgeTypes[badgeTypeId] = BadgeType({
            name: name,
            description: description,
            requiredPoints: requiredPoints,
            category: category,
            iconURI: iconURI,
            totalAwarded: 0
        });

        totalBadgeTypes++;

        emit BadgeTypeCreated(badgeTypeId, name, requiredPoints, block.timestamp);

        return badgeTypeId;
    }

    /**
     * @notice Award badge to user
     */
    function awardBadge(address user, uint256 badgeTypeId)
        external
        onlyBadgeIssuer
        badgeTypeExists(badgeTypeId)
    {
        require(user != address(0), "ReputationBadgeSystem: Invalid user address");
        require(!userHasBadge[user][badgeTypeId], "ReputationBadgeSystem: Already has badge");

        userHasBadge[user][badgeTypeId] = true;
        userBadges[user].push(badgeTypeId);
        badgeTypes[badgeTypeId].totalAwarded++;

        // Add to badge history
        badgeHistory[user].push(BadgeRecord({
            badgeTypeId: badgeTypeId,
            awardedAt: block.timestamp,
            isActive: true
        }));

        emit BadgeAwarded(user, badgeTypeId, block.timestamp);
    }

    /**
     * @notice Revoke badge from user
     */
    function revokeBadge(address user, uint256 badgeTypeId)
        external
        onlyBadgeIssuer
        badgeTypeExists(badgeTypeId)
    {
        require(user != address(0), "ReputationBadgeSystem: Invalid user address");
        require(userHasBadge[user][badgeTypeId], "ReputationBadgeSystem: Does not have badge");

        userHasBadge[user][badgeTypeId] = false;

        // Mark in badge history
        for (uint256 i = 0; i < badgeHistory[user].length; i++) {
            if (badgeHistory[user][i].badgeTypeId == badgeTypeId && badgeHistory[user][i].isActive) {
                badgeHistory[user][i].isActive = false;
                break;
            }
        }

        emit BadgeRevoked(user, badgeTypeId, block.timestamp);
    }

    /**
     * @notice Add reputation points
     */
    function addReputationPoints(
        address user,
        uint256 points,
        string calldata reason
    ) external onlyPointsEditor {
        require(user != address(0), "ReputationBadgeSystem: Invalid user address");
        require(points > 0, "ReputationBadgeSystem: Points must be greater than 0");

        userReputationPoints[user] += points;

        // Track in history
        reputationHistory[user].push(ReputationRecord({
            points: points,
            reason: reason,
            timestamp: block.timestamp,
            isAddition: true
        }));

        // Track user in leaderboard
        if (!isTrackedUser[user]) {
            usersWithReputation.push(user);
            isTrackedUser[user] = true;
        }

        // Update tier
        _updateUserTier(user);

        emit ReputationPointsAdded(user, points, reason, block.timestamp);
    }

    /**
     * @notice Deduct reputation points
     */
    function deductReputationPoints(
        address user,
        uint256 points,
        string calldata reason
    ) external onlyPointsEditor {
        require(user != address(0), "ReputationBadgeSystem: Invalid user address");
        require(points > 0, "ReputationBadgeSystem: Points must be greater than 0");
        require(
            userReputationPoints[user] >= points,
            "ReputationBadgeSystem: Insufficient reputation points"
        );

        userReputationPoints[user] -= points;

        // Track in history
        reputationHistory[user].push(ReputationRecord({
            points: points,
            reason: reason,
            timestamp: block.timestamp,
            isAddition: false
        }));

        // Update tier
        _updateUserTier(user);

        emit ReputationPointsDeducted(user, points, reason, block.timestamp);
    }

    /**
     * @notice Unlock achievement
     */
    function unlockAchievement(address user, string calldata achievement)
        external
        onlyPointsEditor
    {
        require(user != address(0), "ReputationBadgeSystem: Invalid user address");
        require(!userAchievements[user][achievement], "ReputationBadgeSystem: Already unlocked");

        userAchievements[user][achievement] = true;
        userAchievementsList[user].push(achievement);

        emit AchievementUnlocked(user, achievement, block.timestamp);
    }

    /**
     * @notice Authorize badge issuer
     */
    function authorizeBadgeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "ReputationBadgeSystem: Invalid address");
        authorizedBadgeIssuers[issuer] = true;
    }

    /**
     * @notice Revoke badge issuer authorization
     */
    function revokeBadgeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "ReputationBadgeSystem: Invalid address");
        authorizedBadgeIssuers[issuer] = false;
    }

    /**
     * @notice Authorize points editor
     */
    function authorizePointsEditor(address editor) external onlyOwner {
        require(editor != address(0), "ReputationBadgeSystem: Invalid address");
        authorizedPointsEditors[editor] = true;
    }

    /**
     * @notice Revoke points editor authorization
     */
    function revokePointsEditor(address editor) external onlyOwner {
        require(editor != address(0), "ReputationBadgeSystem: Invalid address");
        authorizedPointsEditors[editor] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get user reputation points
     */
    function getUserReputationPoints(address user)
        external
        view
        returns (uint256)
    {
        return userReputationPoints[user];
    }

    /**
     * @notice Get user tier
     */
    function getUserTier(address user)
        external
        view
        returns (uint256)
    {
        return userTier[user] == 0 ? 1 : userTier[user];
    }

    /**
     * @notice Get user badges
     */
    function getUserBadges(address user)
        external
        view
        returns (uint256[] memory)
    {
        return userBadges[user];
    }

    /**
     * @notice Check if user has badge
     */
    function hasBadge(address user, uint256 badgeTypeId)
        external
        view
        returns (bool)
    {
        return userHasBadge[user][badgeTypeId];
    }

    /**
     * @notice Get badge type information
     */
    function getBadgeTypeInfo(uint256 badgeTypeId)
        external
        view
        badgeTypeExists(badgeTypeId)
        returns (
            string memory name,
            string memory description,
            uint256 requiredPoints,
            string memory category,
            string memory iconURI,
            uint256 totalAwarded
        )
    {
        BadgeType memory badge = badgeTypes[badgeTypeId];
        return (
            badge.name,
            badge.description,
            badge.requiredPoints,
            badge.category,
            badge.iconURI,
            badge.totalAwarded
        );
    }

    /**
     * @notice Get user achievements
     */
    function getUserAchievements(address user)
        external
        view
        returns (string[] memory)
    {
        return userAchievementsList[user];
    }

    /**
     * @notice Check if user has achievement
     */
    function hasAchievement(address user, string calldata achievement)
        external
        view
        returns (bool)
    {
        return userAchievements[user][achievement];
    }

    /**
     * @notice Get reputation history
     */
    function getReputationHistory(address user)
        external
        view
        returns (
            uint256[] memory points,
            string[] memory reasons,
            uint256[] memory timestamps
        )
    {
        ReputationRecord[] memory history = reputationHistory[user];
        uint256 length = history.length;

        uint256[] memory pointsArray = new uint256[](length);
        string[] memory reasonsArray = new string[](length);
        uint256[] memory timestampsArray = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            pointsArray[i] = history[i].points;
            reasonsArray[i] = history[i].reason;
            timestampsArray[i] = history[i].timestamp;
        }

        return (pointsArray, reasonsArray, timestampsArray);
    }

    /**
     * @notice Get badge history
     */
    function getBadgeHistory(address user)
        external
        view
        returns (
            uint256[] memory badgeTypeIds,
            uint256[] memory awardedAt,
            bool[] memory isActive
        )
    {
        BadgeRecord[] memory history = badgeHistory[user];
        uint256 length = history.length;

        uint256[] memory badgeIdsArray = new uint256[](length);
        uint256[] memory awardedAtArray = new uint256[](length);
        bool[] memory isActiveArray = new bool[](length);

        for (uint256 i = 0; i < length; i++) {
            badgeIdsArray[i] = history[i].badgeTypeId;
            awardedAtArray[i] = history[i].awardedAt;
            isActiveArray[i] = history[i].isActive;
        }

        return (badgeIdsArray, awardedAtArray, isActiveArray);
    }

    /**
     * @notice Get total badge types
     */
    function getTotalBadgeTypes() external view returns (uint256) {
        return totalBadgeTypes;
    }

    /**
     * @notice Get total users with reputation
     */
    function getTotalUsersWithReputation() external view returns (uint256) {
        return usersWithReputation.length;
    }

    /**
     * @notice Get leaderboard
     */
    function getLeaderboard(uint256 limit)
        external
        view
        returns (address[] memory users, uint256[] memory points)
    {
        uint256 count = limit < usersWithReputation.length ? limit : usersWithReputation.length;
        
        address[] memory topUsers = new address[](count);
        uint256[] memory topPoints = new uint256[](count);

        // Simple selection sort (for small limits)
        address[] memory sorted = usersWithReputation;
        
        uint256 placed = 0;
        for (uint256 i = 0; i < sorted.length && placed < count; i++) {
            uint256 maxPoints = 0;
            uint256 maxIdx = 0;
            
            for (uint256 j = 0; j < sorted.length; j++) {
                if (userReputationPoints[sorted[j]] > maxPoints) {
                    bool alreadyAdded = false;
                    for (uint256 k = 0; k < placed; k++) {
                        if (topUsers[k] == sorted[j]) {
                            alreadyAdded = true;
                            break;
                        }
                    }
                    if (!alreadyAdded) {
                        maxPoints = userReputationPoints[sorted[j]];
                        maxIdx = j;
                    }
                }
            }
            
            if (maxPoints > 0) {
                topUsers[placed] = sorted[maxIdx];
                topPoints[placed] = maxPoints;
                placed++;
            }
        }

        return (topUsers, topPoints);
    }

    /**
     * @notice Get tier information
     */
    function getTierInfo(uint256 tier)
        external
        view
        returns (
            uint256 minPoints,
            uint256 maxPoints,
            string memory name
        )
    {
        require(tier >= 1 && tier <= 4, "ReputationBadgeSystem: Invalid tier");
        TierInfo memory tierData = tiers[tier];
        return (tierData.minPoints, tierData.maxPoints, tierData.name);
    }

    /**
     * @notice Check if badge issuer
     */
    function isBadgeIssuer(address issuer)
        external
        view
        returns (bool)
    {
        return authorizedBadgeIssuers[issuer];
    }

    /**
     * @notice Check if points editor
     */
    function isPointsEditor(address editor)
        external
        view
        returns (bool)
    {
        return authorizedPointsEditors[editor];
    }

    // ============ Internal Helper Functions ============
    /**
     * @notice Update user tier based on reputation points
     */
    function _updateUserTier(address user) internal {
        uint256 points = userReputationPoints[user];

        if (points < 1000) {
            userTier[user] = 1;
        } else if (points < 5000) {
            userTier[user] = 2;
        } else if (points < 10000) {
            userTier[user] = 3;
        } else {
            userTier[user] = 4;
        }

        emit TierUpdated(user, userTier[user], block.timestamp);
    }
}
