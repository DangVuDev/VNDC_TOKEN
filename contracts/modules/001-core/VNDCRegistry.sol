// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVNDCCore.sol";

/// @title VNDC Registry
/// @notice User registration and profile management for VNDC system
/// @dev Maintains user profiles and role assignments
contract VNDCRegistry is Ownable, IVNDCRegistry, IVNDCEvents {
    // User registry
    mapping(address => UserProfile) private _profiles;
    mapping(address => bool) private _exists;
    address[] private _allUsers;

    // Role to address mapping (for quick lookup)
    mapping(bytes32 => address[]) private _roleMembers;

    // Events
    event UserProfileUpdated(
        address indexed user,
        string newName,
        string metadataUri
    );
    event UserRoleChanged(
        address indexed user,
        bytes32 oldRole,
        bytes32 newRole
    );

    /// @notice Initialize registry
    constructor() Ownable(msg.sender) {}

    // ================== Registration ==================

    /// @notice Register a new user
    /// @param user User address
    /// @param name User display name
    /// @param role User role (ADMIN, TEACHER, STUDENT, MERCHANT, etc)
    function registerUser(
        address user,
        string calldata name,
        bytes32 role
    ) external onlyOwner {
        _registerUser(user, name, role);
    }

    /// @notice Internal user registration helper
    function _registerUser(
        address user,
        string memory name,
        bytes32 role
    ) internal {
        require(user != address(0), "Registry: Invalid address");
        require(bytes(name).length > 0, "Registry: Name cannot be empty");
        require(role != bytes32(0), "Registry: Role cannot be empty");
        require(!_exists[user], "Registry: User already registered");

        _profiles[user] = UserProfile({
            userAddress: user,
            name: name,
            role: role,
            metadataUri: "",
            registeredAt: block.timestamp,
            exists: true
        });

        _exists[user] = true;
        _allUsers.push(user);
        _roleMembers[role].push(user);

        emit UserRegistered(user, role);
    }

    /// @notice Update user profile
    /// @param user User address
    /// @param newName New display name
    /// @param metadataUri IPFS metadata URI
    function updateProfile(
        address user,
        string calldata newName,
        string calldata metadataUri
    ) external {
        require(_exists[user], "Registry: User does not exist");
        require(
            msg.sender == user || msg.sender == owner(),
            "Registry: Only user or owner can update"
        );
        require(bytes(newName).length > 0, "Registry: Name cannot be empty");

        _profiles[user].name = newName;
        _profiles[user].metadataUri = metadataUri;

        emit UserUpdated(user, newName);
        emit UserProfileUpdated(user, newName, metadataUri);
    }

    // ================== Profile Queries ==================

    /// @notice Get user profile
    /// @param user User address
    /// @return User profile struct
    function getUserProfile(address user)
        external
        view
        returns (UserProfile memory)
    {
        require(_exists[user], "Registry: User does not exist");
        return _profiles[user];
    }

    /// @notice Check if user exists
    /// @param user User address
    /// @return True if user is registered
    function userExists(address user) external view returns (bool) {
        return _exists[user];
    }

    /// @notice Get user role
    /// @param user User address
    /// @return User's role
    function getUserRole(address user) external view returns (bytes32) {
        require(_exists[user], "Registry: User does not exist");
        return _profiles[user].role;
    }

    /// @notice Get user name
    /// @param user User address
    /// @return User's display name
    function getUserName(address user)
        external
        view
        returns (string memory)
    {
        require(_exists[user], "Registry: User does not exist");
        return _profiles[user].name;
    }

    /// @notice Get user registration timestamp
    /// @param user User address
    /// @return Registration timestamp
    function getUserRegisteredAt(address user)
        external
        view
        returns (uint256)
    {
        require(_exists[user], "Registry: User does not exist");
        return _profiles[user].registeredAt;
    }

    // ================== Role Management ==================

    /// @notice Change user role
    /// @param user User address
    /// @param newRole New role
    function changeUserRole(address user, bytes32 newRole)
        external
        onlyOwner
    {
        require(_exists[user], "Registry: User does not exist");
        require(newRole != bytes32(0), "Registry: Role cannot be empty");

        bytes32 oldRole = _profiles[user].role;

        // Remove from old role list
        address[] storage oldRoleMembers = _roleMembers[oldRole];
        for (uint256 i = 0; i < oldRoleMembers.length; i++) {
            if (oldRoleMembers[i] == user) {
                oldRoleMembers[i] = oldRoleMembers[oldRoleMembers.length - 1];
                oldRoleMembers.pop();
                break;
            }
        }

        // Add to new role
        _profiles[user].role = newRole;
        _roleMembers[newRole].push(user);

        emit UserRoleChanged(user, oldRole, newRole);
    }

    /// @notice Get all users with specific role
    /// @param role Role to query
    /// @return Array of user addresses with that role
    function getUsersByRole(bytes32 role)
        external
        view
        returns (address[] memory)
    {
        return _roleMembers[role];
    }

    /// @notice Get role member count
    /// @param role Role to count
    /// @return Number of users with that role
    function getRoleMemberCount(bytes32 role)
        external
        view
        returns (uint256)
    {
        return _roleMembers[role].length;
    }

    // ================== User Statistics ==================

    /// @notice Get total registered users
    /// @return Total user count
    function getTotalUsers() external view returns (uint256) {
        return _allUsers.length;
    }

    /// @notice Get all users
    /// @return Array of all registered user addresses
    function getAllUsers() external view returns (address[] memory) {
        return _allUsers;
    }

    /// @notice Get user at index
    /// @param index User index
    /// @return User address at index
    function getUserAtIndex(uint256 index)
        external
        view
        returns (address)
    {
        require(index < _allUsers.length, "Registry: Index out of bounds");
        return _allUsers[index];
    }

    // ================== Batch Operations ==================

    /// @notice Register multiple users at once
    /// @param users Array of user addresses
    /// @param names Array of user names
    /// @param roles Array of user roles
    function registerUsersBatch(
        address[] calldata users,
        string[] calldata names,
        bytes32[] calldata roles
    ) external onlyOwner {
        require(
            users.length == names.length && names.length == roles.length,
            "Registry: Array lengths mismatch"
        );
        require(users.length > 0, "Registry: Empty array");
        require(users.length <= 100, "Registry: Too many users");

        for (uint256 i = 0; i < users.length; i++) {
            if (!_exists[users[i]]) {
                _registerUser(users[i], names[i], roles[i]);
            }
        }
    }

    // ================== Utility ==================

    /// @notice Get registry stats
    /// @return totalUsers Total registered users
    /// @return totalAdmins Total admins
    /// @return totalTeachers Total teachers
    /// @return totalStudents Total students
    function getRegistryStats()
        external
        view
        returns (
            uint256 totalUsers,
            uint256 totalAdmins,
            uint256 totalTeachers,
            uint256 totalStudents
        )
    {
        return (
            _allUsers.length,
            _roleMembers[Roles.ADMIN_ROLE].length,
            _roleMembers[Roles.TEACHER_ROLE].length,
            _roleMembers[Roles.STUDENT_ROLE].length
        );
    }
}
