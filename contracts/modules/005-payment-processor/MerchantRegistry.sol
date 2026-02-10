// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMerchantRegistry} from "./interfaces/IMerchantRegistry.sol";

/**
 * @title MerchantRegistry
 * @dev Registry for managing merchant registrations, approvals, and information
 * Handles merchant onboarding, verification, and commission management
 */
contract MerchantRegistry is IMerchantRegistry, Ownable {
    
    // ============ State Variables ============
    mapping(address => Merchant) private merchants;
    mapping(address => bool) private registeredMerchants;
    address[] private merchantList;
    mapping(string => address[]) private merchantsByCategory;
    mapping(address => bool) private approvedMerchants;
    
    // Default commission rate (in basis points, 250 = 2.5%)
    uint256 private defaultCommissionRate = 250;

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {}

    // ============ Modifiers ============
    modifier onlyRegistered(address merchant) {
        require(registeredMerchants[merchant], "Merchant not registered");
        _;
    }

    modifier onlyApproved(address merchant) {
        require(approvedMerchants[merchant], "Merchant not approved");
        _;
    }

    // ============ Merchant Registration ============
    /**
     * @dev Register a new merchant
     */
    function registerMerchant(
        string calldata name,
        string calldata category,
        string calldata contactEmail,
        string calldata contactPhone
    ) external returns (address merchantAddress) {
        require(!registeredMerchants[msg.sender], "Already registered");
        require(bytes(name).length > 0, "Invalid name");
        require(bytes(category).length > 0, "Invalid category");

        merchantAddress = msg.sender;
        
        merchants[merchantAddress] = Merchant({
            merchantAddress: merchantAddress,
            name: name,
            category: category,
            contactEmail: contactEmail,
            contactPhone: contactPhone,
            isApproved: false,
            isActive: true,
            commissionRate: defaultCommissionRate,
            totalTransactions: 0,
            totalRevenue: 0,
            registrationDate: block.timestamp,
            approvalDate: 0
        });

        registeredMerchants[merchantAddress] = true;
        merchantList.push(merchantAddress);
        merchantsByCategory[category].push(merchantAddress);

        emit MerchantRegistered(
            merchantAddress,
            name,
            category,
            block.timestamp
        );
    }

    /**
     * @dev Update merchant information
     */
    function updateMerchant(
        address merchant,
        string calldata name,
        string calldata category,
        string calldata contactEmail,
        string calldata contactPhone
    ) external onlyRegistered(merchant) {
        require(msg.sender == merchant || msg.sender == owner(), "Unauthorized");
        require(bytes(name).length > 0, "Invalid name");
        require(bytes(category).length > 0, "Invalid category");

        Merchant storage merch = merchants[merchant];
        merch.name = name;
        merch.category = category;
        merch.contactEmail = contactEmail;
        merch.contactPhone = contactPhone;

        emit MerchantUpdated(
            merchant,
            name,
            category,
            block.timestamp
        );
    }

    /**
     * @dev Approve a merchant registration
     */
    function approveMerchant(address merchant) external onlyOwner onlyRegistered(merchant) {
        require(!approvedMerchants[merchant], "Already approved");

        approvedMerchants[merchant] = true;
        merchants[merchant].isApproved = true;
        merchants[merchant].approvalDate = block.timestamp;

        emit MerchantApproved(merchant, block.timestamp);
    }

    /**
     * @dev Reject a merchant registration
     */
    function rejectMerchant(address merchant, string calldata reason) external onlyOwner onlyRegistered(merchant) {
        require(!approvedMerchants[merchant], "Already approved");

        registeredMerchants[merchant] = false;
        approvedMerchants[merchant] = false;

        emit MerchantRejected(merchant, reason, block.timestamp);
    }

    /**
     * @dev Deactivate a merchant account
     */
    function deactivateMerchant(address merchant) external onlyOwner onlyRegistered(merchant) {
        require(merchants[merchant].isActive, "Already inactive");

        merchants[merchant].isActive = false;

        emit MerchantDeactivated(merchant, block.timestamp);
    }

    /**
     * @dev Reactivate a merchant account
     */
    function reactivateMerchant(address merchant) external onlyOwner onlyRegistered(merchant) {
        require(!merchants[merchant].isActive, "Already active");

        merchants[merchant].isActive = true;

        emit MerchantUpdated(
            merchant,
            merchants[merchant].name,
            merchants[merchant].category,
            block.timestamp
        );
    }

    /**
     * @dev Set commission rate for a merchant
     */
    function setCommissionRate(address merchant, uint256 commissionRate) external onlyOwner onlyRegistered(merchant) {
        require(commissionRate <= 10000, "Commission rate too high"); // Max 100%

        merchants[merchant].commissionRate = commissionRate;

        emit CommissionRateSet(merchant, commissionRate, block.timestamp);
    }

    /**
     * @dev Update merchant transaction stats
     */
    function updateTransactionStats(address merchant, uint256 transactionAmount) external {
        require(registeredMerchants[merchant], "Merchant not registered");
        
        Merchant storage merch = merchants[merchant];
        merch.totalTransactions += 1;
        merch.totalRevenue += transactionAmount;
    }

    // ============ Query Functions ============
    /**
     * @dev Get merchant information
     */
    function getMerchant(address merchant) external view returns (Merchant memory) {
        require(registeredMerchants[merchant], "Merchant not registered");
        return merchants[merchant];
    }

    /**
     * @dev Check if address is an approved merchant
     */
    function isApprovedMerchant(address merchant) external view returns (bool) {
        return approvedMerchants[merchant] && merchants[merchant].isActive;
    }

    /**
     * @dev Check if merchant is active
     */
    function isMerchantActive(address merchant) external view returns (bool) {
        return registeredMerchants[merchant] && merchants[merchant].isActive;
    }

    /**
     * @dev Get commission rate for merchant
     */
    function getCommissionRate(address merchant) external view returns (uint256) {
        require(registeredMerchants[merchant], "Merchant not registered");
        return merchants[merchant].commissionRate;
    }

    /**
     * @dev Get all merchants in a category
     */
    function getMerchantsByCategory(string calldata category) external view returns (address[] memory) {
        return merchantsByCategory[category];
    }

    /**
     * @dev Get total registered merchants
     */
    function getTotalMerchants() external view returns (uint256) {
        return merchantList.length;
    }

    /**
     * @dev Get total approved merchants
     */
    function getTotalApprovedMerchants() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 0; i < merchantList.length; i++) {
            if (approvedMerchants[merchantList[i]]) {
                count++;
            }
        }
        return count;
    }

    /**
     * @dev Get merchant by index
     */
    function getMerchantByIndex(uint256 index) external view returns (address) {
        require(index < merchantList.length, "Index out of bounds");
        return merchantList[index];
    }

    /**
     * @dev Check if address is registered merchant
     */
    function isMerchantRegistered(address merchant) external view returns (bool) {
        return registeredMerchants[merchant];
    }

    /**
     * @dev Set default commission rate
     */
    function setDefaultCommissionRate(uint256 rate) external onlyOwner {
        require(rate <= 10000, "Commission rate too high");
        defaultCommissionRate = rate;
    }

    /**
     * @dev Get default commission rate
     */
    function getDefaultCommissionRate() external view returns (uint256) {
        return defaultCommissionRate;
    }
}
