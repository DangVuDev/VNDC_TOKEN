// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./IVNDCCore.sol";

/// @title VNDC Access Control
/// @notice Role-based access control for all VNDC modules
/// @dev Simple RBAC implementation for the ecosystem
contract AccessControl is Ownable, IAccessControl, IVNDCEvents {
    // Role assignments: role => address => isGranted
    mapping(bytes32 => mapping(address => bool)) private _roles;

    // User roles: address => array of roles
    mapping(address => bytes32[]) private _userRoles;

    // Role members: role => array of addresses
    mapping(bytes32 => address[]) private _roleMembers;

    // Events
    event RoleAssigned(
        bytes32 indexed role,
        address indexed account,
        address indexed assignedBy
    );
    event RoleRemoved(
        bytes32 indexed role,
        address indexed account,
        address indexed removedBy
    );

    /// @notice Initialize access control
    constructor() Ownable(msg.sender) {
        // Grant owner admin role by default
        _grantRole(Roles.ADMIN_ROLE, msg.sender);
    }

    // ================== Role Management ==================

    /// @notice Grant role to account
    /// @param role Role to grant
    /// @param account Account to grant role to
    function grantRole(bytes32 role, address account)
        public
        onlyOwner
    {
        require(account != address(0), "AccessControl: Invalid address");
        require(role != bytes32(0), "AccessControl: Invalid role");

        _grantRole(role, account);
        emit RoleAssigned(role, account, msg.sender);
    }

    /// @notice Revoke role from account
    /// @param role Role to revoke
    /// @param account Account to revoke role from
    function revokeRole(bytes32 role, address account)
        public
        onlyOwner
    {
        require(account != address(0), "AccessControl: Invalid address");
        require(role != bytes32(0), "AccessControl: Invalid role");
        require(_roles[role][account], "AccessControl: Account doesn't have role");

        _revokeRole(role, account);
        emit RoleRemoved(role, account, msg.sender);
    }

    /// @notice Internal function to grant role
    function _grantRole(bytes32 role, address account) internal {
        if (!_roles[role][account]) {
            _roles[role][account] = true;
            _userRoles[account].push(role);
            _roleMembers[role].push(account);
        }
    }

    /// @notice Internal function to revoke role
    function _revokeRole(bytes32 role, address account) internal {
        if (_roles[role][account]) {
            _roles[role][account] = false;

            // Remove from user roles array
            bytes32[] storage userRoles = _userRoles[account];
            for (uint256 i = 0; i < userRoles.length; i++) {
                if (userRoles[i] == role) {
                    userRoles[i] = userRoles[userRoles.length - 1];
                    userRoles.pop();
                    break;
                }
            }

            // Remove from role members array
            address[] storage roleMembers = _roleMembers[role];
            for (uint256 i = 0; i < roleMembers.length; i++) {
                if (roleMembers[i] == account) {
                    roleMembers[i] = roleMembers[roleMembers.length - 1];
                    roleMembers.pop();
                    break;
                }
            }
        }
    }

    // ================== Role Queries ==================

    /// @notice Check if account has role
    /// @param role Role to check
    /// @param account Account to check
    /// @return True if account has the role
    function hasRole(bytes32 role, address account)
        public
        view
        returns (bool)
    {
        return _roles[role][account];
    }

    /// @notice Check if account has ANY role
    /// @param account Account to check
    /// @return True if account has at least one role
    function isAuthorized(address account) public view returns (bool) {
        return _userRoles[account].length > 0;
    }

    /// @notice Get all roles of an account
    /// @param account Account to query
    /// @return Array of roles for that account
    function getRoles(address account)
        public
        view
        returns (bytes32[] memory)
    {
        return _userRoles[account];
    }

    /// @notice Get role count for account
    /// @param account Account to query
    /// @return Number of roles
    function getRoleCount(address account) public view returns (uint256) {
        return _userRoles[account].length;
    }

    /// @notice Get all members of a role
    /// @param role Role to query
    /// @return Array of addresses with that role
    function getRoleMembers(bytes32 role)
        public
        view
        returns (address[] memory)
    {
        return _roleMembers[role];
    }

    /// @notice Get member count for a role
    /// @param role Role to query
    /// @return Number of members
    function getRoleMemberCount(bytes32 role) public view returns (uint256) {
        return _roleMembers[role].length;
    }

    // ================== Convenience Checks ==================

    /// @notice Check if account is admin
    /// @param account Account to check
    /// @return True if admin
    function isAdmin(address account) external view returns (bool) {
        return hasRole(Roles.ADMIN_ROLE, account);
    }

    /// @notice Check if account is teacher
    /// @param account Account to check
    /// @return True if teacher
    function isTeacher(address account) external view returns (bool) {
        return hasRole(Roles.TEACHER_ROLE, account);
    }

    /// @notice Check if account is student
    /// @param account Account to check
    /// @return True if student
    function isStudent(address account) external view returns (bool) {
        return hasRole(Roles.STUDENT_ROLE, account);
    }

    /// @notice Check if account is merchant
    /// @param account Account to check
    /// @return True if merchant
    function isMerchant(address account) external view returns (bool) {
        return hasRole(Roles.MERCHANT_ROLE, account);
    }

    /// @notice Check if account is issuer
    /// @param account Account to check
    /// @return True if issuer
    function isIssuer(address account) external view returns (bool) {
        return hasRole(Roles.ISSUER_ROLE, account);
    }

    // ================== Batch Operations ==================

    /// @notice Grant role to multiple accounts
    /// @param role Role to grant
    /// @param accounts Array of accounts
    function grantRoleBatch(bytes32 role, address[] calldata accounts)
        external
        onlyOwner
    {
        require(accounts.length > 0, "AccessControl: Empty array");
        require(accounts.length <= 100, "AccessControl: Too many accounts");

        for (uint256 i = 0; i < accounts.length; i++) {
            if (!hasRole(role, accounts[i])) {
                grantRole(role, accounts[i]);
            }
        }
    }

    /// @notice Revoke role from multiple accounts
    /// @param role Role to revoke
    /// @param accounts Array of accounts
    function revokeRoleBatch(bytes32 role, address[] calldata accounts)
        external
        onlyOwner
    {
        require(accounts.length > 0, "AccessControl: Empty array");
        require(accounts.length <= 100, "AccessControl: Too many accounts");

        for (uint256 i = 0; i < accounts.length; i++) {
            if (hasRole(role, accounts[i])) {
                revokeRole(role, accounts[i]);
            }
        }
    }

    // ================== Utility ==================

    /// @notice Get access control stats
    /// @return adminCount Total admins
    /// @return teacherCount Total teachers
    /// @return studentCount Total students
    /// @return merchantCount Total merchants
    function getAccessStats()
        external
        view
        returns (
            uint256 adminCount,
            uint256 teacherCount,
            uint256 studentCount,
            uint256 merchantCount
        )
    {
        return (
            _roleMembers[Roles.ADMIN_ROLE].length,
            _roleMembers[Roles.TEACHER_ROLE].length,
            _roleMembers[Roles.STUDENT_ROLE].length,
            _roleMembers[Roles.MERCHANT_ROLE].length
        );
    }

    /// @notice Check if role exists (has members)
    /// @param role Role to check
    /// @return True if role has at least one member
    function roleExists(bytes32 role) external view returns (bool) {
        return _roleMembers[role].length > 0;
    }
}
