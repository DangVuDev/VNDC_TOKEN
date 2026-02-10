// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/// @title ActivityBadge
/// @notice ERC-1155 badges for extracurricular activities
/// @dev Manages activity badges with metadata URIs
contract ActivityBadge is ERC1155, Ownable, Pausable {
    /// @notice Badge metadata storage
    mapping(uint256 => string) public badgeURIs;
    mapping(uint256 => bool) public badgeExists;
    mapping(address => uint256[]) public userBadges;

    /// @notice Activity ID counter
    uint256 private _activityIdCounter;

    /// @notice Events
    event BadgeCreated(uint256 indexed activityId, string uri);
    event BadgeMinted(address indexed to, uint256 indexed activityId, uint256 amount);
    event BadgeBurned(address indexed from, uint256 indexed activityId, uint256 amount);

    /// @notice Initialize contract
    constructor() ERC1155("") Ownable(msg.sender) {}

    /// @notice Create new activity badge type
    /// @param uri Metadata URI for the badge
    /// @return badgeId ID of the new badge
    function createBadge(string calldata uri) external onlyOwner returns (uint256) {
        uint256 badgeId = _activityIdCounter++;
        badgeURIs[badgeId] = uri;
        badgeExists[badgeId] = true;

        emit BadgeCreated(badgeId, uri);
        return badgeId;
    }

    /// @notice Mint badge to student
    /// @param to Student address
    /// @param activityId Activity badge ID
    /// @param amount Amount of badges to mint
    function mint(
        address to,
        uint256 activityId,
        uint256 amount
    ) external onlyOwner whenNotPaused {
        require(badgeExists[activityId], "Badge does not exist");
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");

        _mint(to, activityId, amount, "");

        // Track user badges
        if (!_hasBadge(to, activityId)) {
            userBadges[to].push(activityId);
        }

        emit BadgeMinted(to, activityId, amount);
    }

    /// @notice Burn badge from student
    /// @param from Student address
    /// @param activityId Activity badge ID
    /// @param amount Amount of badges to burn
    function burn(
        address from,
        uint256 activityId,
        uint256 amount
    ) external onlyOwner whenNotPaused {
        require(badgeExists[activityId], "Badge does not exist");
        require(amount > 0, "Amount must be positive");

        _burn(from, activityId, amount);

        emit BadgeBurned(from, activityId, amount);
    }

    /// @notice Check if user has badge
    /// @param user User address
    /// @param activityId Activity badge ID
    /// @return true if user has at least 1 of this badge
    function hasBadge(address user, uint256 activityId) external view returns (bool) {
        return balanceOf(user, activityId) > 0;
    }

    /// @notice Get all activity badges owned by user
    /// @param user User address
    /// @return Array of badge IDs owned by user
    function getUserActivityBadges(address user) external view returns (uint256[] memory) {
        return userBadges[user];
    }

    /// @notice Get badge URI
    /// @param activityId Activity badge ID
    /// @return URI for the badge metadata
    function uri(uint256 activityId) public view override returns (string memory) {
        require(badgeExists[activityId], "Badge URI query for nonexistent badge");
        return badgeURIs[activityId];
    }

    /// @notice Update badge URI
    /// @param activityId Activity badge ID
    /// @param newUri New URI
    function setUri(uint256 activityId, string calldata newUri) external onlyOwner {
        require(badgeExists[activityId], "Badge does not exist");
        badgeURIs[activityId] = newUri;
    }

    /// @notice Pause badge transfers
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Resume badge transfers
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Mock transfer function for testing
    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public override whenNotPaused {
        super.safeTransferFrom(from, to, id, amount, data);
    }

    /// @notice Mock batch transfer for testing
    function safeBatchTransferFrom(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public override whenNotPaused {
        super.safeBatchTransferFrom(from, to, ids, amounts, data);
    }

    // Private helper
    function _hasBadge(address user, uint256 activityId) private view returns (bool) {
        uint256[] memory badges = userBadges[user];
        for (uint256 i = 0; i < badges.length; i++) {
            if (badges[i] == activityId) {
                return true;
            }
        }
        return false;
    }
}
