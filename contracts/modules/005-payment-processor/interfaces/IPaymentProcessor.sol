// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title IPaymentProcessor
 * @dev Interface for payment processing system supporting multiple payment methods
 */
interface IPaymentProcessor {
    // ============ Events ============
    event PaymentProcessed(
        uint256 indexed paymentId,
        address indexed student,
        address indexed merchant,
        uint256 amount,
        string paymentMethod,
        uint256 timestamp
    );

    event PaymentRefunded(
        uint256 indexed paymentId,
        address indexed student,
        uint256 refundAmount,
        string reason,
        uint256 timestamp
    );

    event PaymentMethodAdded(string paymentMethod, address tokenAddress);
    event PaymentMethodRemoved(string paymentMethod);
    event WalletLinked(address indexed student, string paymentMethod, string walletId);
    event WalletUnlinked(address indexed student, string paymentMethod);

    // ============ Structs ============
    struct PaymentRecord {
        uint256 paymentId;
        address student;
        address merchant;
        uint256 amount;
        string paymentMethod;
        uint256 timestamp;
        bool isRefunded;
        uint256 refundAmount;
        string refundReason;
        uint256 refundTimestamp;
    }

    struct PaymentMethod {
        string name;
        address tokenAddress;
        bool isActive;
        uint256 minAmount;
        uint256 maxAmount;
    }

    // ============ Mutation Functions ============
    /**
     * @dev Process a payment from student to merchant
     * @param merchant Recipient merchant address
     * @param amount Payment amount
     * @param paymentMethod Payment method (e.g., "VNDC", "USDC", "Credit Card")
     * @return paymentId The ID of the processed payment
     */
    function processPayment(
        address merchant,
        uint256 amount,
        string calldata paymentMethod
    ) external returns (uint256 paymentId);

    /**
     * @dev Refund a payment
     * @param paymentId ID of the payment to refund
     * @param reason Reason for refund
     */
    function refundPayment(
        uint256 paymentId,
        string calldata reason
    ) external;

    /**
     * @dev Link a wallet to a payment method
     * @param paymentMethod Payment method identifier
     * @param walletId Wallet identifier (e.g., credit card number, crypto address)
     */
    function linkWallet(
        string calldata paymentMethod,
        string calldata walletId
    ) external;

    /**
     * @dev Unlink a wallet from a payment method
     * @param paymentMethod Payment method identifier
     */
    function unlinkWallet(string calldata paymentMethod) external;

    /**
     * @dev Add a new payment method
     * @param name Payment method name
     * @param tokenAddress Token contract address (0x0 if not token-based)
     * @param minAmount Minimum payment amount
     * @param maxAmount Maximum payment amount
     */
    function addPaymentMethod(
        string calldata name,
        address tokenAddress,
        uint256 minAmount,
        uint256 maxAmount
    ) external;

    /**
     * @dev Remove a payment method
     * @param paymentMethod Payment method to remove
     */
    function removePaymentMethod(string calldata paymentMethod) external;

    // ============ Query Functions ============
    /**
     * @dev Get payment record by ID
     * @param paymentId Payment ID
     * @return PaymentRecord structure
     */
    function getPaymentRecord(uint256 paymentId) external view returns (PaymentRecord memory);

    /**
     * @dev Get all payments for a student
     * @param student Student address
     * @return Array of payment records
     */
    function getStudentPayments(address student) external view returns (PaymentRecord[] memory);

    /**
     * @dev Get all payments for a merchant
     * @param merchant Merchant address
     * @return Array of payment records
     */
    function getMerchantPayments(address merchant) external view returns (PaymentRecord[] memory);

    /**
     * @dev Check if a payment method is supported
     * @param paymentMethod Payment method name
     * @return true if method is active
     */
    function isPaymentMethodSupported(string calldata paymentMethod) external view returns (bool);

    /**
     * @dev Get payment method details
     * @param paymentMethod Payment method name
     * @return PaymentMethod structure
     */
    function getPaymentMethod(string calldata paymentMethod) external view returns (PaymentMethod memory);

    /**
     * @dev Get total payments made by student
     * @param student Student address
     * @return Total amount paid
     */
    function getTotalStudentPayments(address student) external view returns (uint256);

    /**
     * @dev Get total payments received by merchant
     * @param merchant Merchant address
     * @return Total amount received
     */
    function getTotalMerchantRevenue(address merchant) external view returns (uint256);

    /**
     * @dev Get wallet ID linked to payment method
     * @param student Student address
     * @param paymentMethod Payment method name
     * @return Linked wallet ID
     */
    function getLinkedWallet(address student, string calldata paymentMethod) external view returns (string memory);

    /**
     * @dev Get total transaction count
     * @return Total number of payment transactions
     */
    function getTotalPaymentCount() external view returns (uint256);
}
