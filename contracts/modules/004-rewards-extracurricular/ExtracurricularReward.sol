// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "../001-core/VNDC.sol";
import "./IExtracurricularRewards.sol";

/// @title ExtracurricularReward
/// @notice Manages extracurricular activity rewards
/// @dev Issues badges and VNDC tokens for student activities
contract ExtracurricularReward is
    Ownable,
    Pausable,
    IExtracurricularReward,
    IExtracurricularEvents
{
    /// @notice Reference to VNDC token
    VNDC public vndc;

    /// @notice Reference to activity badge contract
    IActivityBadge public activityBadge;

    /// @notice Activity storage
    mapping(uint256 => Activity) public activities;
    uint256[] public activityIds;

    /// @notice Activity records
    mapping(uint256 => ActivityRecord) public activityRecords;
    uint256 private _recordIdCounter;

    /// @notice Student activity history
    mapping(address => uint256[]) public studentActivities;

    /// @notice Track claims per student per activity
    mapping(address => mapping(uint256 => uint256)) public claimCounts;

    /// @notice Issuer management
    mapping(address => bool) public issuers;

    /// @notice Events
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    /// @notice Initialize with VNDC and badge contracts
    constructor(address _vndc, address _activityBadge) Ownable(msg.sender) {
        require(_vndc != address(0), "Invalid VNDC address");
        require(_activityBadge != address(0), "Invalid badge address");

        vndc = VNDC(_vndc);
        activityBadge = IActivityBadge(_activityBadge);
        issuers[msg.sender] = true;
    }

    /// @notice Register new activity type
    /// @param name Activity name
    /// @param description Activity description
    /// @param rewardAmount VNDC reward amount
    /// @param badgeTokenId Badge token ID
    /// @param maxClaimsPerStudent Max claims allowed per student
    /// @return activityId ID of registered activity
    function registerActivity(
        string calldata name,
        string calldata description,
        uint256 rewardAmount,
        uint256 badgeTokenId,
        uint256 maxClaimsPerStudent
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "Name required");
        require(rewardAmount > 0, "Reward must be positive");
        require(maxClaimsPerStudent > 0, "Max claims must be positive");

        uint256 activityId = activityIds.length;

        activities[activityId] = Activity({
            name: name,
            description: description,
            rewardAmount: rewardAmount,
            badgeTokenId: badgeTokenId,
            maxClaimsPerStudent: maxClaimsPerStudent,
            active: true,
            createdAt: block.timestamp
        });

        activityIds.push(activityId);

        emit ActivityRegistered(activityId, name, rewardAmount);
        return activityId;
    }

    /// @notice Log student participation in activity
    /// @param student Student address
    /// @param activityId Activity ID
    /// @param metadata Additional metadata
    /// @return recordId ID of the activity record
    function logActivity(
        address student,
        uint256 activityId,
        string calldata metadata
    ) external onlyIssuer returns (uint256) {
        require(student != address(0), "Invalid student");
        require(activityId < activityIds.length, "Activity not found");
        require(activities[activityId].active, "Activity not active");

        uint256 recordId = _recordIdCounter++;

        activityRecords[recordId] = ActivityRecord({
            student: student,
            activityId: activityId,
            timestamp: block.timestamp,
            rewarded: false,
            metadata: metadata
        });

        studentActivities[student].push(recordId);

        emit ActivityLogged(recordId, student, activityId);
        return recordId;
    }

    /// @notice Claim reward for logged activity
    /// @param recordId Activity record ID
    function claimActivity(uint256 recordId) external whenNotPaused {
        ActivityRecord storage record = activityRecords[recordId];

        require(record.student != address(0), "Record not found");
        require(msg.sender == record.student, "Not the activity performer");
        require(!record.rewarded, "Already claimed");

        Activity storage activity = activities[record.activityId];
        require(activity.active, "Activity not active");

        // Check claim limit
        uint256 claims = claimCounts[record.student][record.activityId];
        require(claims < activity.maxClaimsPerStudent, "Claim limit exceeded");

        // Mark as rewarded
        record.rewarded = true;
        claimCounts[record.student][record.activityId]++;

        // Transfer VNDC reward
        require(vndc.transfer(record.student, activity.rewardAmount), "Transfer failed");

        // Mint badge
        if (activity.badgeTokenId > 0) {
            activityBadge.mint(record.student, activity.badgeTokenId, 1);
        }

        emit ActivityClaimed(recordId, record.student, activity.rewardAmount);
    }

    /// @notice Get all activities
    /// @return Array of activity IDs
    function getActivities() external view returns (uint256[] memory) {
        return activityIds;
    }

    /// @notice Get student's activity records
    /// @param student Student address
    /// @return Array of record IDs
    function getStudentActivities(address student)
        external
        view
        returns (uint256[] memory)
    {
        return studentActivities[student];
    }

    /// @notice Get activity details
    /// @param activityId Activity ID
    /// @return Activity struct
    function getActivity(uint256 activityId)
        external
        view
        returns (Activity memory)
    {
        require(activityId < activityIds.length, "Activity not found");
        return activities[activityId];
    }

    /// @notice Get activity record details
    /// @param recordId Record ID
    /// @return ActivityRecord struct
    function getActivityRecord(uint256 recordId)
        external
        view
        returns (ActivityRecord memory)
    {
        require(activityRecords[recordId].student != address(0), "Record not found");
        return activityRecords[recordId];
    }

    /// @notice Get student's claimed rewards count for activity
    /// @param student Student address
    /// @param activityId Activity ID
    /// @return Number of claims
    function getClaimCount(address student, uint256 activityId)
        external
        view
        returns (uint256)
    {
        return claimCounts[student][activityId];
    }

    /// @notice Get student's completed (claimed) activities
    /// @param student Student address
    /// @return Array of completed record IDs
    function getCompletedActivities(address student)
        external
        view
        returns (uint256[] memory)
    {
        uint256[] memory records = studentActivities[student];
        uint256 count = 0;

        // Count completed
        for (uint256 i = 0; i < records.length; i++) {
            if (activityRecords[records[i]].rewarded) {
                count++;
            }
        }

        // Build result array
        uint256[] memory completed = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < records.length; i++) {
            if (activityRecords[records[i]].rewarded) {
                completed[index++] = records[i];
            }
        }

        return completed;
    }

    /// @notice Deactivate activity
    /// @param activityId Activity ID
    function deactivateActivity(uint256 activityId) external onlyOwner {
        require(activityId < activityIds.length, "Activity not found");
        activities[activityId].active = false;

        emit ActivityDeactivated(activityId);
    }

    /// @notice Add authorized issuer
    /// @param issuer Address to add as issuer
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid issuer");
        issuers[issuer] = true;

        emit IssuerAdded(issuer);
    }

    /// @notice Remove authorized issuer
    /// @param issuer Address to remove as issuer
    function removeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "Invalid issuer");
        issuers[issuer] = false;

        emit IssuerRemoved(issuer);
    }

    /// @notice Pause activity claiming
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume activity claiming
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Check if address is issuer
    /// @param addr Address to check
    /// @return true if address is authorized issuer
    function isIssuer(address addr) external view returns (bool) {
        return issuers[addr];
    }

    /// @notice Create activity badge (helper for deployment)
    /// @param name Badge name
    /// @param uri Badge URI
    /// @return badgeId ID of created badge
    function createActivityBadge(string calldata name, string calldata uri)
        external
        onlyOwner
        returns (uint256)
    {
        // This is a helper for deployment script
        // The actual badge creation happens in ActivityBadge contract
        // This returns the badge ID that would be created
        uint256 badgeId = activityIds.length;
        return badgeId;
    }

    // Modifiers
    modifier onlyIssuer() {
        require(issuers[msg.sender], "Not authorized issuer");
        _;
    }
}
