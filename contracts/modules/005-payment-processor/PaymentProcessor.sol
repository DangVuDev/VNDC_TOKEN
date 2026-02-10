// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPaymentProcessor} from "./interfaces/IPaymentProcessor.sol";

/**
 * @title PaymentProcessor
 * @dev Payment processing system supporting multiple payment methods
 * Allows students to make payments to merchants using VNDC or other tokens
 */
contract PaymentProcessor is IPaymentProcessor, Ownable {
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    uint256 private paymentIdCounter = 1;
    
    mapping(string => PaymentMethod) private paymentMethods;
    mapping(string => bool) private supportedMethods;
    mapping(uint256 => PaymentRecord) private paymentRecords;
    mapping(address => uint256[]) private studentPayments;
    mapping(address => uint256[]) private merchantPayments;
    mapping(address => mapping(string => string)) private linkedWallets;
    
    string[] private paymentMethodsList;

    // ============ Modifiers ============
    modifier validPaymentMethod(string calldata paymentMethod) {
        require(supportedMethods[paymentMethod], "Payment method not supported");
        require(paymentMethods[paymentMethod].isActive, "Payment method is inactive");
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        // Initialize with VNDC as default payment method
        _addPaymentMethod("VNDC", address(0), 0, type(uint256).max);
    }

    // ============ Payment Processing ============
    /**
     * @dev Process a payment from student to merchant
     */
    function processPayment(
        address merchant,
        uint256 amount,
        string calldata paymentMethod
    ) external validPaymentMethod(paymentMethod) returns (uint256 paymentId) {
        require(merchant != address(0), "Invalid merchant address");
        require(amount > 0, "Amount must be greater than 0");
        require(msg.sender != merchant, "Cannot pay to self");

        PaymentMethod storage method = paymentMethods[paymentMethod];
        require(amount >= method.minAmount, "Amount below minimum");
        require(amount <= method.maxAmount, "Amount exceeds maximum");

        // Process token transfer if applicable
        if (method.tokenAddress != address(0)) {
            IERC20(method.tokenAddress).safeTransferFrom(msg.sender, merchant, amount);
        }

        paymentId = paymentIdCounter++;
        
        PaymentRecord storage record = paymentRecords[paymentId];
        record.paymentId = paymentId;
        record.student = msg.sender;
        record.merchant = merchant;
        record.amount = amount;
        record.paymentMethod = paymentMethod;
        record.timestamp = block.timestamp;
        record.isRefunded = false;

        studentPayments[msg.sender].push(paymentId);
        merchantPayments[merchant].push(paymentId);

        emit PaymentProcessed(
            paymentId,
            msg.sender,
            merchant,
            amount,
            paymentMethod,
            block.timestamp
        );
    }

    /**
     * @dev Refund a payment
     */
    function refundPayment(
        uint256 paymentId,
        string calldata reason
    ) external {
        PaymentRecord storage record = paymentRecords[paymentId];
        
        require(record.paymentId != 0, "Payment not found");
        require(!record.isRefunded, "Payment already refunded");
        require(
            msg.sender == record.student || msg.sender == owner(),
            "Unauthorized refund"
        );

        PaymentMethod storage method = paymentMethods[record.paymentMethod];
        require(method.isActive, "Payment method is inactive");

        // Process refund
        if (method.tokenAddress != address(0)) {
            IERC20(method.tokenAddress).safeTransferFrom(
                record.merchant,
                record.student,
                record.amount
            );
        }

        record.isRefunded = true;
        record.refundAmount = record.amount;
        record.refundReason = reason;
        record.refundTimestamp = block.timestamp;

        emit PaymentRefunded(
            paymentId,
            record.student,
            record.amount,
            reason,
            block.timestamp
        );
    }

    /**
     * @dev Link a wallet to a payment method
     */
    function linkWallet(
        string calldata paymentMethod,
        string calldata walletId
    ) external validPaymentMethod(paymentMethod) {
        require(bytes(walletId).length > 0, "Invalid wallet ID");
        
        linkedWallets[msg.sender][paymentMethod] = walletId;

        emit WalletLinked(msg.sender, paymentMethod, walletId);
    }

    /**
     * @dev Unlink a wallet from a payment method
     */
    function unlinkWallet(string calldata paymentMethod) external {
        require(bytes(linkedWallets[msg.sender][paymentMethod]).length > 0, "No linked wallet");
        
        delete linkedWallets[msg.sender][paymentMethod];

        emit WalletUnlinked(msg.sender, paymentMethod);
    }

    // ============ Admin Functions ============
    /**
     * @dev Add a new payment method
     */
    function addPaymentMethod(
        string calldata name,
        address tokenAddress,
        uint256 minAmount,
        uint256 maxAmount
    ) external onlyOwner {
        _addPaymentMethod(name, tokenAddress, minAmount, maxAmount);
    }

    /**
     * @dev Internal helper to add payment method
     */
    function _addPaymentMethod(
        string memory name,
        address tokenAddress,
        uint256 minAmount,
        uint256 maxAmount
    ) internal {
        require(bytes(name).length > 0, "Invalid payment method name");
        require(minAmount <= maxAmount, "Invalid amount range");
        require(!supportedMethods[name], "Payment method already exists");

        paymentMethods[name] = PaymentMethod({
            name: name,
            tokenAddress: tokenAddress,
            isActive: true,
            minAmount: minAmount,
            maxAmount: maxAmount
        });

        supportedMethods[name] = true;
        paymentMethodsList.push(name);

        emit PaymentMethodAdded(name, tokenAddress);
    }

    /**
     * @dev Remove a payment method
     */
    function removePaymentMethod(string calldata paymentMethod) external onlyOwner {
        require(supportedMethods[paymentMethod], "Payment method not found");
        require(
            keccak256(bytes(paymentMethod)) != keccak256(bytes("VNDC")),
            "Cannot remove VNDC"
        );

        paymentMethods[paymentMethod].isActive = false;
        supportedMethods[paymentMethod] = false;

        emit PaymentMethodRemoved(paymentMethod);
    }

    // ============ Query Functions ============
    /**
     * @dev Get payment record by ID
     */
    function getPaymentRecord(uint256 paymentId) external view returns (PaymentRecord memory) {
        require(paymentRecords[paymentId].paymentId != 0, "Payment not found");
        return paymentRecords[paymentId];
    }

    /**
     * @dev Get all payments for a student
     */
    function getStudentPayments(address student) external view returns (PaymentRecord[] memory) {
        uint256[] memory ids = studentPayments[student];
        PaymentRecord[] memory records = new PaymentRecord[](ids.length);
        
        for (uint256 i = 0; i < ids.length; i++) {
            records[i] = paymentRecords[ids[i]];
        }
        
        return records;
    }

    /**
     * @dev Get all payments for a merchant
     */
    function getMerchantPayments(address merchant) external view returns (PaymentRecord[] memory) {
        uint256[] memory ids = merchantPayments[merchant];
        PaymentRecord[] memory records = new PaymentRecord[](ids.length);
        
        for (uint256 i = 0; i < ids.length; i++) {
            records[i] = paymentRecords[ids[i]];
        }
        
        return records;
    }

    /**
     * @dev Check if a payment method is supported
     */
    function isPaymentMethodSupported(string calldata paymentMethod) external view returns (bool) {
        return supportedMethods[paymentMethod] && paymentMethods[paymentMethod].isActive;
    }

    /**
     * @dev Get payment method details
     */
    function getPaymentMethod(string calldata paymentMethod) external view returns (PaymentMethod memory) {
        require(supportedMethods[paymentMethod], "Payment method not found");
        return paymentMethods[paymentMethod];
    }

    /**
     * @dev Get total payments made by student
     */
    function getTotalStudentPayments(address student) external view returns (uint256) {
        uint256 total = 0;
        uint256[] memory ids = studentPayments[student];
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (!paymentRecords[ids[i]].isRefunded) {
                total += paymentRecords[ids[i]].amount;
            }
        }
        
        return total;
    }

    /**
     * @dev Get total payments received by merchant
     */
    function getTotalMerchantRevenue(address merchant) external view returns (uint256) {
        uint256 total = 0;
        uint256[] memory ids = merchantPayments[merchant];
        
        for (uint256 i = 0; i < ids.length; i++) {
            if (!paymentRecords[ids[i]].isRefunded) {
                total += paymentRecords[ids[i]].amount;
            }
        }
        
        return total;
    }

    /**
     * @dev Get wallet ID linked to payment method
     */
    function getLinkedWallet(address student, string calldata paymentMethod) external view returns (string memory) {
        return linkedWallets[student][paymentMethod];
    }

    /**
     * @dev Get total transaction count
     */
    function getTotalPaymentCount() external view returns (uint256) {
        return paymentIdCounter - 1;
    }
}
