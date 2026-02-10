// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./IAcademicRewards.sol";

/// @title AcademicBadgeNFT
/// @notice ERC-1155 badges for academic achievements
/// @dev Implements semi-fungible token standard for badges
contract AcademicBadgeNFT is ERC1155, Ownable, IAcademicBadge {
    uint256 private _badgeIdCounter;
    mapping(uint256 => string) private _badgeURIs;
    mapping(uint256 => bool) private _badgeExists;
    mapping(address => uint256[]) private _userBadges;

    event BadgeCreated(uint256 indexed badgeId, string uri);
    event BadgeMinted(
        uint256 indexed badgeId,
        address indexed to,
        uint256 amount
    );
    event BadgeBurned(
        uint256 indexed badgeId,
        address indexed from,
        uint256 amount
    );

    constructor() ERC1155("") Ownable(msg.sender) {}

    /// @notice Create new badge type
    /// @param uri Badge metadata URI
    /// @return badgeId The created badge ID
    function createBadge(string calldata uri) external onlyOwner returns (uint256) {
        require(bytes(uri).length > 0, "AcademicBadgeNFT: URI cannot be empty");

        uint256 badgeId = _badgeIdCounter;
        _badgeIdCounter++;

        _badgeURIs[badgeId] = uri;
        _badgeExists[badgeId] = true;

        emit BadgeCreated(badgeId, uri);
        return badgeId;
    }

    /// @notice Mint badge to account
    /// @param to Recipient address
    /// @param badgeId Badge type ID
    /// @param amount Number of badges
    function mint(address to, uint256 badgeId, uint256 amount) external onlyOwner {
        require(to != address(0), "AcademicBadgeNFT: Cannot mint to zero address");
        require(_badgeExists[badgeId], "AcademicBadgeNFT: Badge does not exist");
        require(amount > 0, "AcademicBadgeNFT: Amount must be greater than 0");

        _mint(to, badgeId, amount, "");

        // Track badges for user
        if (!_userHasBadge(to, badgeId)) {
            _userBadges[to].push(badgeId);
        }

        emit BadgeMinted(badgeId, to, amount);
    }

    /// @notice Burn badge from account
    /// @param account Account to burn from
    /// @param badgeId Badge type ID
    /// @param amount Number of badges
    function burn(address account, uint256 badgeId, uint256 amount) external onlyOwner {
        require(account != address(0), "AcademicBadgeNFT: Invalid account");
        require(_badgeExists[badgeId], "AcademicBadgeNFT: Badge does not exist");
        require(amount > 0, "AcademicBadgeNFT: Amount must be greater than 0");

        uint256 currentBalance = balanceOf(account, badgeId);
        require(currentBalance >= amount, "AcademicBadgeNFT: Insufficient balance");

        _burn(account, badgeId, amount);

        emit BadgeBurned(badgeId, account, amount);
    }

    /// @notice Get all badge IDs owned by account
    /// @param account User address
    /// @return Array of badge IDs
    function getBalances(address account) external view returns (uint256[] memory) {
        require(account != address(0), "AcademicBadgeNFT: Invalid account");
        return _userBadges[account];
    }

    /// @notice Get badge URI
    /// @param badgeId Badge type ID
    /// @return Badge metadata URI
    function uri(uint256 badgeId) public view override returns (string memory) {
        require(_badgeExists[badgeId], "AcademicBadgeNFT: Badge does not exist");
        return _badgeURIs[badgeId];
    }

    /// @notice Check if badge exists
    /// @param badgeId Badge type ID
    /// @return True if badge exists
    function badgeExists(uint256 badgeId) external view returns (bool) {
        return _badgeExists[badgeId];
    }

    /// @notice Check if user has specific badge
    /// @param user User address
    /// @param badgeId Badge type ID
    /// @return True if user has badge(s)
    function hasBadge(address user, uint256 badgeId) external view returns (bool) {
        if (balanceOf(user, badgeId) > 0) return true;
        return false;
    }

    // ============ Internal Helpers ============

    /// @notice Check if user already has badge in tracking list
    function _userHasBadge(address user, uint256 badgeId) internal view returns (bool) {
        uint256[] storage badges = _userBadges[user];
        for (uint256 i = 0; i < badges.length; i++) {
            if (badges[i] == badgeId) return true;
        }
        return false;
    }

    /// @notice Support ERC1155 interface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
