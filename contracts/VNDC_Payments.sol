// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VNDC_Payments
 * @notice Payment system for tuition, fees, and campus services
 * @dev Handles VNDC token payments and settlement to institutions
 * @author VNDC Team
 */
contract VNDC_Payments is AccessControl, Pausable, ReentrancyGuard {
    // ===== ROLES =====
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MERCHANT_ROLE = keccak256("MERCHANT_ROLE");
    bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");

    // ===== ENUMS =====
    enum PaymentStatus {
        PENDING,
        COMPLETED,
        REFUNDED,
        DISPUTED,
        CANCELLED
    }

    enum PaymentType {
        TUITION,
        ACCOMMODATION,
        MEAL_PLAN,
        LIBRARY_FEE,
        EXAMINATION_FEE,
        CAMPUS_SERVICE,
        OTHER
    }

    // ===== STRUCTS =====
    struct Payment {
        uint256 paymentId;
        address payer;
        address merchant;
        uint256 amount;
        PaymentType paymentType;
        string description;
        PaymentStatus status;
        uint256 createdAt;
        uint256 completedAt;
        string transactionReference;
    }

    struct Merchant {
        address merchantAddress;
        string name;
        string bankAccount;
        uint256 totalReceived;
        uint256 totalSettled;
        bool active;
        uint256 registeredAt;
    }

    struct PaymentBatch {
        uint256 batchId;
        address merchant;
        uint256 totalAmount;
        uint256 paymentCount;
        uint256 createdAt;
        uint256 settledAt;
        bool settled;
    }

    // ===== STATE VARIABLES =====
    IERC20 public vndc;                          // VNDC token

    uint256 public paymentCounter = 0;
    uint256 public batchCounter = 0;
    uint256 public totalPaymentsProcessed = 0;
    uint256 public totalAmountProcessed = 0;

    mapping(uint256 => Payment) public payments;
    mapping(address => Merchant) public merchants;
    mapping(uint256 => PaymentBatch) public paymentBatches;
    mapping(address => uint256[]) public merchantPayments;
    mapping(address => uint256[]) public studentPayments;
    mapping(address => uint256) public merchantPendingBalance;

    // Commission/fee tracking
    uint256 public settlementFeePercentage = 0;  // 0% default (no fee)
    uint256 public totalFeesCollected = 0;

    // ===== EVENTS =====
    event PaymentCreated(
        uint256 indexed paymentId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        PaymentType paymentType,
        string description
    );

    event PaymentCompleted(
        uint256 indexed paymentId,
        address indexed payer,
        address indexed merchant,
        uint256 amount,
        string transactionReference
    );

    event PaymentRefunded(
        uint256 indexed paymentId,
        address indexed payer,
        uint256 amount
    );

    event MerchantRegistered(
        address indexed merchant,
        string name
    );

    event MerchantSettlement(
        address indexed merchant,
        uint256 amount,
        uint256 batchId
    );

    event BatchCreated(
        uint256 indexed batchId,
        address indexed merchant,
        uint256 totalAmount,
        uint256 paymentCount
    );

    event BatchSettled(
        uint256 indexed batchId,
        uint256 amount,
        uint256 timestamp
    );

    // ===== CONSTRUCTOR =====
    /**
     * @notice Initialize payment contract
     * @param vndcTokenAddress Address of VNDC token
     */
    constructor(address vndcTokenAddress) {
        require(vndcTokenAddress != address(0), "Invalid token address");
        
        vndc = IERC20(vndcTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(MERCHANT_ROLE, msg.sender);
        _setupRole(SETTLEMENT_ROLE, msg.sender);
    }

    // ===== MERCHANT MANAGEMENT =====

    /**
     * @notice Register a new merchant (school, service provider, etc.)
     * @param merchantAddress Address of merchant
     * @param name Name of merchant
     * @param bankAccount Bank account for settlement
     */
    function registerMerchant(
        address merchantAddress,
        string memory name,
        string memory bankAccount
    ) public onlyRole(ADMIN_ROLE) {
        require(merchantAddress != address(0), "Invalid merchant address");
        require(bytes(name).length > 0, "Name required");

        merchants[merchantAddress] = Merchant({
            merchantAddress: merchantAddress,
            name: name,
            bankAccount: bankAccount,
            totalReceived: 0,
            totalSettled: 0,
            active: true,
            registeredAt: block.timestamp
        });

        emit MerchantRegistered(merchantAddress, name);
    }

    /**
     * @notice Deactivate a merchant
     * @param merchantAddress Address to deactivate
     */
    function deactivateMerchant(address merchantAddress)
        public
        onlyRole(ADMIN_ROLE)
    {
        require(merchants[merchantAddress].active, "Merchant not active");
        merchants[merchantAddress].active = false;
    }

    /**
     * @notice Activate a merchant
     * @param merchantAddress Address to activate
     */
    function activateMerchant(address merchantAddress)
        public
        onlyRole(ADMIN_ROLE)
    {
        require(!merchants[merchantAddress].active, "Merchant already active");
        merchants[merchantAddress].active = true;
    }

    /**
     * @notice Get merchant details
     * @param merchantAddress Address of merchant
     * @return Merchant information
     */
    function getMerchant(address merchantAddress)
        public
        view
        returns (Merchant memory)
    {
        return merchants[merchantAddress];
    }

    /**
     * @notice Update settlement fee percentage
     * @param feePercentage Fee in basis points (e.g., 100 = 1%)
     * @dev Only admin
     */
    function setSettlementFeePercentage(uint256 feePercentage)
        public
        onlyRole(ADMIN_ROLE)
    {
        require(feePercentage <= 1000, "Fee cannot exceed 10%");
        settlementFeePercentage = feePercentage;
    }

    // ===== PAYMENT FUNCTIONS =====

    /**
     * @notice Submit a payment to a merchant
     * @param merchant Address of merchant receiving payment
     * @param amount Amount in VNDC
     * @param paymentType Type of payment
     * @param description Description of payment
     * @return paymentId ID of created payment
     * @dev Caller must approve this contract to spend VNDC
     */
    function submitPayment(
        address merchant,
        uint256 amount,
        PaymentType paymentType,
        string memory description
    ) public nonReentrant returns (uint256) {
        require(merchant != address(0), "Invalid merchant");
        require(merchants[merchant].active, "Merchant not active");
        require(amount > 0, "Amount must be positive");
        require(bytes(description).length > 0, "Description required");

        // Transfer VNDC to this contract
        bool success = vndc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        uint256 paymentId = paymentCounter++;

        payments[paymentId] = Payment({
            paymentId: paymentId,
            payer: msg.sender,
            merchant: merchant,
            amount: amount,
            paymentType: paymentType,
            description: description,
            status: PaymentStatus.COMPLETED,
            createdAt: block.timestamp,
            completedAt: block.timestamp,
            transactionReference: ""
        });

        // Track payment
        merchantPayments[merchant].push(paymentId);
        studentPayments[msg.sender].push(paymentId);
        merchantPendingBalance[merchant] += amount;

        totalPaymentsProcessed++;
        totalAmountProcessed += amount;

        emit PaymentCreated(
            paymentId,
            msg.sender,
            merchant,
            amount,
            paymentType,
            description
        );

        emit PaymentCompleted(
            paymentId,
            msg.sender,
            merchant,
            amount,
            ""
        );

        return paymentId;
    }

    /**
     * @notice Batch submit payments
     * @param merchants Array of merchant addresses
     * @param amounts Array of amounts
     * @param paymentTypes Array of payment types
     * @param descriptions Array of descriptions
     */
    function batchSubmitPayments(
        address[] calldata merchants,
        uint256[] calldata amounts,
        PaymentType[] calldata paymentTypes,
        string[] calldata descriptions
    ) public nonReentrant returns (uint256[] memory) {
        require(
            merchants.length == amounts.length &&
            amounts.length == paymentTypes.length &&
            paymentTypes.length == descriptions.length,
            "Array length mismatch"
        );
        require(merchants.length <= 50, "Batch too large");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        // Single transfer for all
        bool success = vndc.transferFrom(msg.sender, address(this), totalAmount);
        require(success, "Transfer failed");

        uint256[] memory paymentIds = new uint256[](merchants.length);

        for (uint256 i = 0; i < merchants.length; i++) {
            paymentIds[i] = submitPayment(
                merchants[i],
                amounts[i],
                paymentTypes[i],
                descriptions[i]
            );
        }

        return paymentIds;
    }

    /**
     * @notice Refund a payment
     * @param paymentId ID of payment to refund
     */
    function refundPayment(uint256 paymentId)
        public
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(paymentId < paymentCounter, "Invalid payment ID");
        Payment storage payment = payments[paymentId];
        require(payment.status == PaymentStatus.COMPLETED, "Cannot refund");

        payment.status = PaymentStatus.REFUNDED;
        merchantPendingBalance[payment.merchant] -= payment.amount;

        // Transfer back to payer
        bool success = vndc.transfer(payment.payer, payment.amount);
        require(success, "Refund failed");

        emit PaymentRefunded(paymentId, payment.payer, payment.amount);
    }

    // ===== SETTLEMENT FUNCTIONS =====

    /**
     * @notice Create a settlement batch for merchant pending balance
     * @param merchant Merchant address
     * @return batchId ID of created batch
     */
    function createSettlementBatch(address merchant)
        public
        onlyRole(SETTLEMENT_ROLE)
        returns (uint256)
    {
        require(merchants[merchant].active, "Merchant not active");
        require(merchantPendingBalance[merchant] > 0, "No pending balance");

        uint256 batchId = batchCounter++;
        uint256 amount = merchantPendingBalance[merchant];

        paymentBatches[batchId] = PaymentBatch({
            batchId: batchId,
            merchant: merchant,
            totalAmount: amount,
            paymentCount: merchantPayments[merchant].length,
            createdAt: block.timestamp,
            settledAt: 0,
            settled: false
        });

        emit BatchCreated(batchId, merchant, amount, merchantPayments[merchant].length);

        return batchId;
    }

    /**
     * @notice Settle a batch (transfer VNDC to merchant)
     * @param batchId ID of batch to settle
     */
    function settleBatch(uint256 batchId)
        public
        onlyRole(SETTLEMENT_ROLE)
        nonReentrant
    {
        require(batchId < batchCounter, "Invalid batch ID");
        PaymentBatch storage batch = paymentBatches[batchId];
        require(!batch.settled, "Batch already settled");

        uint256 settlementAmount = batch.totalAmount;
        uint256 fee = (settlementAmount * settlementFeePercentage) / 10000;
        uint256 netAmount = settlementAmount - fee;

        batch.settled = true;
        batch.settledAt = block.timestamp;

        // Track fees
        totalFeesCollected += fee;

        // Clear merchant pending balance
        merchantPendingBalance[batch.merchant] = 0;

        // Update merchant tracking
        merchants[batch.merchant].totalReceived += settlementAmount;
        merchants[batch.merchant].totalSettled += settlementAmount;

        // Transfer net amount to merchant
        bool success = vndc.transfer(batch.merchant, netAmount);
        require(success, "Settlement failed");

        emit BatchSettled(batchId, netAmount, block.timestamp);
        emit MerchantSettlement(batch.merchant, netAmount, batchId);
    }

    // ===== QUERY FUNCTIONS =====

    /**
     * @notice Get payment details
     * @param paymentId ID of payment
     * @return Payment information
     */
    function getPayment(uint256 paymentId)
        public
        view
        returns (Payment memory)
    {
        require(paymentId < paymentCounter, "Invalid payment ID");
        return payments[paymentId];
    }

    /**
     * @notice Get all payments by student
     * @param student Student address
     * @return Array of payment IDs
     */
    function getStudentPayments(address student)
        public
        view
        returns (uint256[] memory)
    {
        return studentPayments[student];
    }

    /**
     * @notice Get all payments by merchant
     * @param merchant Merchant address
     * @return Array of payment IDs
     */
    function getMerchantPayments(address merchant)
        public
        view
        returns (uint256[] memory)
    {
        return merchantPayments[merchant];
    }

    /**
     * @notice Get merchant's pending balance
     * @param merchant Merchant address
     * @return Pending balance in VNDC
     */
    function getMerchantPendingBalance(address merchant)
        public
        view
        returns (uint256)
    {
        return merchantPendingBalance[merchant];
    }

    /**
     * @notice Get total stats
     * @return totalPayments Total payments processed
     * @return totalAmount Total amount processed
     * @return totalFees Total fees collected
     */
    function getStats()
        public
        view
        returns (
            uint256 totalPayments,
            uint256 totalAmount,
            uint256 totalFees
        )
    {
        totalPayments = totalPaymentsProcessed;
        totalAmount = totalAmountProcessed;
        totalFees = totalFeesCollected;
    }

    /**
     * @notice Pause payments
     * @dev Emergency function
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause payments
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @notice Withdraw fees collected
     * @param amount Amount to withdraw
     */
    function withdrawFees(uint256 amount)
        public
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(amount <= totalFeesCollected, "Exceeds collected fees");
        totalFeesCollected -= amount;
        bool success = vndc.transfer(msg.sender, amount);
        require(success, "Withdrawal failed");
    }
}
