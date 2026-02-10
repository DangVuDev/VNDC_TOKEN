// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./IAcademicRewards.sol";
import "./AcademicBadgeNFT.sol";

/// @title AcademicReward
/// @notice Manages academic reward distribution based on GPA
/// @dev Integrates with VNDC token and AcademicBadgeNFT
contract AcademicReward is Ownable, IAcademicReward, IAcademicRewardEvents {
    AcademicBadgeNFT public badgeContract;
    address public vndcToken;
    address public registryContract;

    mapping(uint256 => RewardTier) private _rewardTiers;
    mapping(uint256 => StudentReward) private _studentRewards;
    mapping(address => uint256[]) private _userRewards;

    uint256 private _rewardIdCounter;

    // Teachers and admins who can award students
    mapping(address => bool) private _authorizedIssuers;

    // GPA with 2 decimal precision (e.g., 3.80 = 380)
    uint256 private constant GPA_PRECISION = 100;

    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    constructor(address badgeContractAddress, address vndc, address registry)
        Ownable(msg.sender)
    {
        require(badgeContractAddress != address(0), "AcademicReward: Invalid badge contract");
        require(vndc != address(0), "AcademicReward: Invalid VNDC token");
        require(registry != address(0), "AcademicReward: Invalid registry");

        badgeContract = AcademicBadgeNFT(badgeContractAddress);
        vndcToken = vndc;
        registryContract = registry;

        _authorizedIssuers[msg.sender] = true;
    }

    // ============ Issuer Management ============

    /// @notice Add authorized issuer (teacher/registrar)
    /// @param issuer Address to authorize
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "AcademicReward: Invalid issuer");
        require(!_authorizedIssuers[issuer], "AcademicReward: Already issuer");
        _authorizedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Remove issuer
    /// @param issuer Address to revoke
    function removeIssuer(address issuer) external onlyOwner {
        require(_authorizedIssuers[issuer], "AcademicReward: Not issuer");
        _authorizedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Check if address is issuer
    function isIssuer(address issuer) external view returns (bool) {
        return _authorizedIssuers[issuer];
    }

    // ============ Reward Tier Management ============

    /// @notice Set or update reward tier
    /// @param tierId Tier identifier (0 = premium, 1 = gold, 2 = silver, 3 = bronze)
    /// @param name Tier name
    /// @param minGPA Minimum GPA × 100 (e.g., 380 = 3.80)
    /// @param vncdAmount VNDC reward amount
    /// @param badgeTokenId Badge NFT ID
    function setRewardTier(
        uint256 tierId,
        string calldata name,
        uint256 minGPA,
        uint256 vncdAmount,
        uint256 badgeTokenId
    ) external onlyOwner {
        require(bytes(name).length > 0, "AcademicReward: Name cannot be empty");
        require(minGPA > 0, "AcademicReward: GPA must be positive");
        require(vncdAmount > 0, "AcademicReward: Amount must be positive");
        require(badgeContract.badgeExists(badgeTokenId), "AcademicReward: Invalid badge");

        _rewardTiers[tierId] = RewardTier({
            name: name,
            minGPA: minGPA,
            vncdAmount: vncdAmount,
            badgeTokenId: badgeTokenId,
            active: true
        });

        emit RewardTierSet(tierId, name, minGPA, vncdAmount);
    }

    /// @notice Get reward tier details
    /// @param tierId Tier ID
    /// @return Reward tier struct
    function getRewardTier(uint256 tierId) external view returns (RewardTier memory) {
        return _rewardTiers[tierId];
    }

    /// @notice Disable reward tier
    /// @param tierId Tier ID
    function deactivateTier(uint256 tierId) external onlyOwner {
        _rewardTiers[tierId].active = false;
    }

    // ============ Student Rewards ============

    /// @notice Award student based on GPA
    /// @param student Student address
    /// @param gpa Student GPA × 100
    /// @return rewardId Unique reward ID
    function awardStudent(address student, uint256 gpa)
        external
        returns (uint256)
    {
        require(_authorizedIssuers[msg.sender], "AcademicReward: Not authorized");
        require(student != address(0), "AcademicReward: Invalid student");
        require(gpa > 0, "AcademicReward: Invalid GPA");
        require(gpa <= 400, "AcademicReward: GPA cannot exceed 4.0"); // 400 = 4.00

        // Determine best matching tier (highest GPA requirement student qualifies for)
        uint256 tierId = _findBestTier(gpa);
        require(_rewardTiers[tierId].active, "AcademicReward: No active tier matches GPA");

        uint256 rewardId = _rewardIdCounter;
        _rewardIdCounter++;

        _studentRewards[rewardId] = StudentReward({
            student: student,
            gpa: gpa,
            tierId: tierId,
            issuedAt: block.timestamp,
            claimed: false
        });

        _userRewards[student].push(rewardId);

        emit StudentAwarded(rewardId, student, gpa, tierId);
        return rewardId;
    }

    /// @notice Claim reward by student
    /// @param rewardId Reward ID
    function claimReward(uint256 rewardId) external {
        StudentReward storage reward = _studentRewards[rewardId];
        require(reward.student == msg.sender, "AcademicReward: Only student can claim");
        require(!reward.claimed, "AcademicReward: Already claimed");
        require(_rewardTiers[reward.tierId].active, "AcademicReward: Tier inactive");

        reward.claimed = true;

        // Mint badge
        badgeContract.mint(msg.sender, _rewardTiers[reward.tierId].badgeTokenId, 1);

        // Transfer VNDC (would be implemented with actual token transfer)
        // For now, just emit event as placeholder
        // actualVNDCTransfer(msg.sender, _rewardTiers[reward.tierId].vncdAmount);

        emit RewardClaimed(rewardId, msg.sender);
    }

    /// @notice Get student's rewards
    /// @param student Student address
    /// @return Array of reward IDs
    function getStudentRewards(address student) external view returns (uint256[] memory) {
        require(student != address(0), "AcademicReward: Invalid student");
        return _userRewards[student];
    }

    /// @notice Get student's claimed rewards
    /// @param student Student address
    /// @return Array of claimed reward IDs
    function getClaimedRewards(address student) external view returns (uint256[] memory) {
        require(student != address(0), "AcademicReward: Invalid student");

        uint256[] storage allRewards = _userRewards[student];
        uint256 claimedCount = 0;

        // Count claimed rewards
        for (uint256 i = 0; i < allRewards.length; i++) {
            if (_studentRewards[allRewards[i]].claimed) {
                claimedCount++;
            }
        }

        // Build array
        uint256[] memory claimedRewards = new uint256[](claimedCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allRewards.length; i++) {
            if (_studentRewards[allRewards[i]].claimed) {
                claimedRewards[index] = allRewards[i];
                index++;
            }
        }

        return claimedRewards;
    }

    /// @notice Get reward details
    /// @param rewardId Reward ID
    /// @return Student reward struct
    function getReward(uint256 rewardId) external view returns (StudentReward memory) {
        require(rewardExists(rewardId), "AcademicReward: Reward does not exist");
        return _studentRewards[rewardId];
    }

    /// @notice Check if reward exists
    /// @param rewardId Reward ID
    /// @return True if exists
    function rewardExists(uint256 rewardId) public view returns (bool) {
        return _studentRewards[rewardId].issuedAt > 0;
    }

    // ============ Utility Functions ============

    /// @notice Find best matching tier for GPA
    /// @param gpa Student GPA
    /// @return tierId Best matching tier
    function _findBestTier(uint256 gpa) internal view returns (uint256) {
        // Default tiers (can be overridden):
        // 0: 3.80+ = Premium
        // 1: 3.50+ = Gold
        // 2: 3.00+ = Silver
        // 3: 2.00+ = Bronze

        if (gpa >= 380) return 0; // Premium
        if (gpa >= 350) return 1; // Gold
        if (gpa >= 300) return 2; // Silver
        if (gpa >= 200) return 3; // Bronze
        return 3; // Default to bronze if exists
    }

    /// @notice Get reward statistics
    /// @return totalAwarded Total rewards awarded
    /// @return totalClaimed Total rewards claimed
    function getStats() external view returns (uint256 totalAwarded, uint256 totalClaimed) {
        uint256 awarded = _rewardIdCounter;
        uint256 claimed = 0;

        // Count claimed rewards (simplified - assumes sequential IDs)
        for (uint256 i = 0; i < _rewardIdCounter; i++) {
            if (_studentRewards[i].claimed) {
                claimed++;
            }
        }

        return (awarded, claimed);
    }
}
