// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IVNDCCore
/// @notice Core interfaces for VNDC system
/// @dev Base interfaces used across all modules

interface IVNDCToken {
    /// @notice Mint new tokens
    function mint(address to, uint256 amount) external;

    /// @notice Burn tokens from a specific account
    function burnFrom(address account, uint256 amount) external;

    /// @notice Permit function for ERC-2612 (gas-free approvals)
    function permit(
        address owner,
        address spender,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external;

    /// @notice Check if an account is authorized as minter
    function isMinter(address account) external view returns (bool);

    /// @notice Check if an account is authorized as burner
    function isBurner(address account) external view returns (bool);
}

interface IVNDCRegistry {
    /// @notice User profile struct
    struct UserProfile {
        address userAddress;
        string name;
        bytes32 role;
        string metadataUri;
        uint256 registeredAt;
        bool exists;
    }

    /// @notice Register a new user
    function registerUser(
        address user,
        string calldata name,
        bytes32 role
    ) external;

    /// @notice Update user profile
    function updateProfile(
        address user,
        string calldata newName,
        string calldata metadataUri
    ) external;

    /// @notice Get user profile
    function getUserProfile(address user)
        external
        view
        returns (UserProfile memory);

    /// @notice Check if user exists
    function userExists(address user) external view returns (bool);

    /// @notice Get user role
    function getUserRole(address user) external view returns (bytes32);
}

interface IAccessControl {
    /// @notice Check if account has role
    function hasRole(bytes32 role, address account)
        external
        view
        returns (bool);

    /// @notice Grant role to account
    function grantRole(bytes32 role, address account) external;

    /// @notice Revoke role from account
    function revokeRole(bytes32 role, address account) external;

    /// @notice Check if account has ANY role
    function isAuthorized(address account) external view returns (bool);

    /// @notice Get all roles of an account
    function getRoles(address account)
        external
        view
        returns (bytes32[] memory);
}

/// @notice Role definitions
library Roles {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant TEACHER_ROLE = keccak256("TEACHER_ROLE");
    bytes32 public constant STUDENT_ROLE = keccak256("STUDENT_ROLE");
    bytes32 public constant MERCHANT_ROLE = keccak256("MERCHANT_ROLE");
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
}

/// @notice Common events for all modules
interface IVNDCEvents {
    event ModuleInitialized(address indexed module, uint256 timestamp);
    event RoleGranted(
        bytes32 indexed role,
        address indexed account,
        address indexed grantedBy
    );
    event RoleRevoked(
        bytes32 indexed role,
        address indexed account,
        address indexed revokedBy
    );
    event TokenMinted(address indexed to, uint256 amount);
    event TokenBurned(address indexed from, uint256 amount);
    event UserRegistered(address indexed user, bytes32 role);
    event UserUpdated(address indexed user, string newName);
}
