// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMerchantRegistry
 * @dev Interface for managing merchant registrations and information
 */
interface IMerchantRegistry {
    // ============ Events ============
    event MerchantRegistered(
        address indexed merchant,
        string name,
        string category,
        uint256 timestamp
    );

    event MerchantUpdated(
        address indexed merchant,
        string name,
        string category,
        uint256 timestamp
    );

    event MerchantDeactivated(address indexed merchant, uint256 timestamp);
    event MerchantApproved(address indexed merchant, uint256 timestamp);
    event MerchantRejected(address indexed merchant, string reason, uint256 timestamp);
    event CommissionRateSet(address indexed merchant, uint256 commissionRate, uint256 timestamp);

    // ============ Structs ============
    struct Merchant {
        address merchantAddress;
        string name;
        string category;
        string contactEmail;
        string contactPhone;
        bool isApproved;
        bool isActive;
        uint256 commissionRate; // Basis points (e.g., 250 = 2.5%)
        uint256 totalTransactions;
        uint256 totalRevenue;
        uint256 registrationDate;
        uint256 approvalDate;
    }

    // ============ Mutation Functions ============
    /**
     * @dev Register a new merchant
     * @param name Merchant name
     * @param category Business category
     * @param contactEmail Contact email
     * @param contactPhone Contact phone
     * @return merchantAddress The registered merchant address
     */
    function registerMerchant(
        string calldata name,
        string calldata category,
        string calldata contactEmail,
        string calldata contactPhone
    ) external returns (address merchantAddress);

    /**
     * @dev Update merchant information
     * @param merchant Merchant address
     * @param name New merchant name
     * @param category New business category
     * @param contactEmail New contact email
     * @param contactPhone New contact phone
     */
    function updateMerchant(
        address merchant,
        string calldata name,
        string calldata category,
        string calldata contactEmail,
        string calldata contactPhone
    ) external;

    /**
     * @dev Approve a merchant registration
     * @param merchant Merchant address to approve
     */
    function approveMerchant(address merchant) external;

    /**
     * @dev Reject a merchant registration
     * @param merchant Merchant address to reject
     * @param reason Rejection reason
     */
    function rejectMerchant(address merchant, string calldata reason) external;

    /**
     * @dev Deactivate a merchant account
     * @param merchant Merchant address to deactivate
     */
    function deactivateMerchant(address merchant) external;

    /**
     * @dev Reactivate a merchant account
     * @param merchant Merchant address to reactivate
     */
    function reactivateMerchant(address merchant) external;

    /**
     * @dev Set commission rate for a merchant
     * @param merchant Merchant address
     * @param commissionRate Commission rate in basis points
     */
    function setCommissionRate(address merchant, uint256 commissionRate) external;

    /**
     * @dev Update merchant transaction stats
     * @param merchant Merchant address
     * @param transactionAmount Amount of transaction
     */
    function updateTransactionStats(address merchant, uint256 transactionAmount) external;

    // ============ Query Functions ============
    /**
     * @dev Get merchant information
     * @param merchant Merchant address
     * @return Merchant structure
     */
    function getMerchant(address merchant) external view returns (Merchant memory);

    /**
     * @dev Check if address is an approved merchant
     * @param merchant Merchant address
     * @return true if merchant is approved and active
     */
    function isApprovedMerchant(address merchant) external view returns (bool);

    /**
     * @dev Check if merchant is active
     * @param merchant Merchant address
     * @return true if merchant is active
     */
    function isMerchantActive(address merchant) external view returns (bool);

    /**
     * @dev Get commission rate for merchant
     * @param merchant Merchant address
     * @return Commission rate in basis points
     */
    function getCommissionRate(address merchant) external view returns (uint256);

    /**
     * @dev Get all merchants in a category
     * @param category Business category
     * @return Array of merchant addresses
     */
    function getMerchantsByCategory(string calldata category) external view returns (address[] memory);

    /**
     * @dev Get total registered merchants
     * @return Count of registered merchants
     */
    function getTotalMerchants() external view returns (uint256);

    /**
     * @dev Get total approved merchants
     * @return Count of approved merchants
     */
    function getTotalApprovedMerchants() external view returns (uint256);

    /**
     * @dev Get merchant by index
     * @param index Merchant index
     * @return Merchant address
     */
    function getMerchantByIndex(uint256 index) external view returns (address);

    /**
     * @dev Check if address is registered merchant
     * @param merchant Merchant address
     * @return true if merchant is registered
     */
    function isMerchantRegistered(address merchant) external view returns (bool);
}
