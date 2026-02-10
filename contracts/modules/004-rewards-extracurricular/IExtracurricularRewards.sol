// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IExtracurricular
/// @notice Interfaces for extracurricular activity reward system
/// @dev Defines activity-related data structures and events

interface IActivityBadge {
    /// @notice Mint activity badge
    function mint(address to, uint256 activityId, uint256 amount) external;

    /// @notice Burn activity badge
    function burn(address account, uint256 activityId, uint256 amount) external;

    /// @notice Get user's badges for activity
    function balanceOf(address account, uint256 activityId) external view returns (uint256);

    /// @notice Check if activity badge exists
    function activityExists(uint256 activityId) external view returns (bool);
}

interface IExtracurricularReward {
    /// @notice Activity structure
    struct Activity {
        string name;
        string description;
        uint256 rewardAmount;
        uint256 badgeTokenId;
        uint256 maxClaimsPerStudent;
        bool active;
        uint256 createdAt;
    }

    /// @notice Student activity record
    struct ActivityRecord {
        address student;
        uint256 activityId;
        uint256 timestamp;
        bool rewarded;
        string metadata;
    }

    /// @notice Register activity type
    function registerActivity(
        string calldata name,
        string calldata description,
        uint256 rewardAmount,
        uint256 badgeTokenId,
        uint256 maxClaimsPerStudent
    ) external returns (uint256 activityId);

    /// @notice Log student participation
    function logActivity(
        address student,
        uint256 activityId,
        string calldata metadata
    ) external returns (uint256 recordId);

    /// @notice Claim activity reward
    function claimActivity(uint256 recordId) external;

    /// @notice Get activities
    function getActivities() external view returns (uint256[] memory);

    /// @notice Get student's activities
    function getStudentActivities(address student) external view returns (uint256[] memory);

    /// @notice Get activity details
    function getActivity(uint256 activityId) external view returns (Activity memory);
}

/// @notice Extracurricular events
interface IExtracurricularEvents {
    event ActivityRegistered(
        uint256 indexed activityId,
        string name,
        uint256 rewardAmount
    );

    event ActivityLogged(
        uint256 indexed recordId,
        address indexed student,
        uint256 indexed activityId
    );

    event ActivityClaimed(
        uint256 indexed recordId,
        address indexed student,
        uint256 rewardAmount
    );

    event ActivityDeactivated(uint256 indexed activityId);
}
