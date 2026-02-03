// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title VNDC_Rewards
 * @notice Automated reward distribution for academic achievements
 * @dev Distributes VNDC tokens based on GPA, course completion, etc.
 * @author VNDC Team
 */
contract VNDC_Rewards is AccessControl, Pausable, ReentrancyGuard {
    // ===== ROLES =====
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant REWARD_ISSUER_ROLE = keccak256("REWARD_ISSUER_ROLE");
    bytes32 public constant CLAIM_MANAGER_ROLE = keccak256("CLAIM_MANAGER_ROLE");

    // ===== ENUM =====
    enum RewardType {
        GPA_BASED,
        COURSE_COMPLETION,
        PARTICIPATION,
        RESEARCH,
        EXTRACURRICULAR,
        CUSTOM
    }

    enum ClaimStatus {
        PENDING,
        APPROVED,
        REJECTED,
        CLAIMED,
        CANCELLED
    }

    // ===== STRUCTS =====
    struct RewardRule {
        uint256 id;
        RewardType rewardType;
        string description;
        uint256 baseRewardAmount;
        uint256 minRequirement;         // min GPA * 1000 (e.g., 3500 = 3.5)
        uint256 maxRewardAmount;
        bool active;
        uint256 createdAt;
    }

    struct RewardClaim {
        uint256 claimId;
        address student;
        uint256 ruleId;
        uint256 rewardAmount;
        ClaimStatus status;
        string evidence;                // IPFS URI or reference
        uint256 claimedAt;
        uint256 approvedAt;
        string rejectionReason;
    }

    struct StudentRewards {
        uint256 totalEarned;
        uint256 totalClaimed;
        uint256[] pendingClaims;
        uint256[] approvedClaims;
    }

    // ===== STATE VARIABLES =====
    IERC20 public vndc;                 // VNDC token contract
    uint256 public ruleCounter = 0;
    uint256 public claimCounter = 0;
    uint256 public rewardPool = 0;      // Total VNDC available for rewards

    mapping(uint256 => RewardRule) public rewardRules;
    mapping(uint256 => RewardClaim) public rewardClaims;
    mapping(address => StudentRewards) public studentRewards;
    mapping(address => uint256) public studentGPA;             // GPA * 1000
    mapping(address => uint256) public studentClaimedAmount;  // Claimed by student
    
    // Track claim history per student
    mapping(address => uint256[]) public studentClaimHistory;

    // ===== EVENTS =====
    event RewardRuleCreated(
        uint256 indexed ruleId,
        RewardType rewardType,
        uint256 baseRewardAmount
    );

    event RewardRuleUpdated(
        uint256 indexed ruleId,
        bool active
    );

    event RewardClaimSubmitted(
        uint256 indexed claimId,
        address indexed student,
        uint256 indexed ruleId,
        uint256 amount,
        string evidence
    );

    event RewardClaimApproved(
        uint256 indexed claimId,
        uint256 amount,
        address approvedBy
    );

    event RewardClaimRejected(
        uint256 indexed claimId,
        string reason,
        address rejectedBy
    );

    event RewardClaimed(
        uint256 indexed claimId,
        address indexed student,
        uint256 amount
    );

    event RewardPoolFunded(
        uint256 amount
    );

    event GPAUpdated(
        address indexed student,
        uint256 gpa
    );

    // ===== CONSTRUCTOR =====
    /**
     * @notice Initialize Rewards contract
     * @param vndcTokenAddress Address of VNDC token contract
     */
    constructor(address vndcTokenAddress) {
        require(vndcTokenAddress != address(0), "Invalid token address");
        
        vndc = IERC20(vndcTokenAddress);
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ADMIN_ROLE, msg.sender);
        _setupRole(REWARD_ISSUER_ROLE, msg.sender);
        _setupRole(CLAIM_MANAGER_ROLE, msg.sender);
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Fund the reward pool with VNDC tokens
     * @param amount Amount to add to pool
     * @dev Caller must approve this contract to transfer VNDC
     */
    function fundRewardPool(uint256 amount)
        public
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(amount > 0, "Amount must be positive");
        
        bool success = vndc.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        
        rewardPool += amount;
        emit RewardPoolFunded(amount);
    }

    /**
     * @notice Withdraw unused funds from reward pool
     * @param amount Amount to withdraw
     * @dev Only admin can call
     */
    function withdrawFromRewardPool(uint256 amount)
        public
        onlyRole(ADMIN_ROLE)
        nonReentrant
    {
        require(amount > 0, "Amount must be positive");
        require(amount <= rewardPool, "Insufficient pool balance");
        
        rewardPool -= amount;
        bool success = vndc.transfer(msg.sender, amount);
        require(success, "Withdrawal failed");
    }

    // ===== REWARD RULE MANAGEMENT =====

    /**
     * @notice Create a new reward rule
     * @param rewardType Type of reward (GPA_BASED, COURSE_COMPLETION, etc.)
     * @param description Description of the reward
     * @param baseRewardAmount Base amount in VNDC (18 decimals)
     * @param minRequirement Minimum requirement (e.g., 3500 for 3.5 GPA)
     * @param maxRewardAmount Maximum reward amount for this rule
     */
    function createRewardRule(
        RewardType rewardType,
        string memory description,
        uint256 baseRewardAmount,
        uint256 minRequirement,
        uint256 maxRewardAmount
    ) public onlyRole(REWARD_ISSUER_ROLE) returns (uint256) {
        require(baseRewardAmount > 0, "Base reward must be positive");
        require(maxRewardAmount >= baseRewardAmount, "Max must be >= base");

        uint256 ruleId = ruleCounter++;

        rewardRules[ruleId] = RewardRule({
            id: ruleId,
            rewardType: rewardType,
            description: description,
            baseRewardAmount: baseRewardAmount,
            minRequirement: minRequirement,
            maxRewardAmount: maxRewardAmount,
            active: true,
            createdAt: block.timestamp
        });

        emit RewardRuleCreated(ruleId, rewardType, baseRewardAmount);
        return ruleId;
    }

    /**
     * @notice Deactivate a reward rule
     * @param ruleId ID of rule to deactivate
     */
    function deactivateRewardRule(uint256 ruleId)
        public
        onlyRole(REWARD_ISSUER_ROLE)
    {
        require(ruleId < ruleCounter, "Invalid rule ID");
        rewardRules[ruleId].active = false;
        emit RewardRuleUpdated(ruleId, false);
    }

    /**
     * @notice Reactivate a reward rule
     * @param ruleId ID of rule to reactivate
     */
    function activateRewardRule(uint256 ruleId)
        public
        onlyRole(REWARD_ISSUER_ROLE)
    {
        require(ruleId < ruleCounter, "Invalid rule ID");
        rewardRules[ruleId].active = true;
        emit RewardRuleUpdated(ruleId, true);
    }

    // ===== GPA UPDATES =====

    /**
     * @notice Update student's GPA (from off-chain oracle)
     * @param student Student address
     * @param gpa GPA * 1000 (e.g., 3500 = 3.5 GPA)
     */
    function updateStudentGPA(address student, uint256 gpa)
        public
        onlyRole(REWARD_ISSUER_ROLE)
    {
        require(student != address(0), "Invalid student address");
        require(gpa <= 4000, "GPA cannot exceed 4.0");

        studentGPA[student] = gpa;
        emit GPAUpdated(student, gpa);
    }

    /**
     * @notice Batch update GPAs
     * @param students Array of student addresses
     * @param gpas Array of GPAs
     */
    function batchUpdateGPA(
        address[] calldata students,
        uint256[] calldata gpas
    ) public onlyRole(REWARD_ISSUER_ROLE) {
        require(students.length == gpas.length, "Array length mismatch");
        require(students.length <= 100, "Batch too large");

        for (uint256 i = 0; i < students.length; i++) {
            updateStudentGPA(students[i], gpas[i]);
        }
    }

    // ===== CLAIM FUNCTIONS =====

    /**
     * @notice Student submits a reward claim
     * @param ruleId ID of the reward rule being claimed
     * @param evidence IPFS URI or reference to supporting evidence
     * @return claimId ID of the created claim
     */
    function submitRewardClaim(
        uint256 ruleId,
        string memory evidence
    ) public returns (uint256) {
        require(ruleId < ruleCounter, "Invalid rule ID");
        require(rewardRules[ruleId].active, "Rule is inactive");
        require(bytes(evidence).length > 0, "Evidence required");

        RewardRule memory rule = rewardRules[ruleId];

        // Check minimum requirement
        if (rule.rewardType == RewardType.GPA_BASED) {
            require(
                studentGPA[msg.sender] >= rule.minRequirement,
                "Does not meet GPA requirement"
            );
        }

        uint256 claimId = claimCounter++;

        rewardClaims[claimId] = RewardClaim({
            claimId: claimId,
            student: msg.sender,
            ruleId: ruleId,
            rewardAmount: rule.baseRewardAmount,
            status: ClaimStatus.PENDING,
            evidence: evidence,
            claimedAt: block.timestamp,
            approvedAt: 0,
            rejectionReason: ""
        });

        studentRewards[msg.sender].pendingClaims.push(claimId);
        studentClaimHistory[msg.sender].push(claimId);

        emit RewardClaimSubmitted(
            claimId,
            msg.sender,
            ruleId,
            rule.baseRewardAmount,
            evidence
        );

        return claimId;
    }

    /**
     * @notice Approve a pending reward claim
     * @param claimId ID of claim to approve
     */
    function approveRewardClaim(uint256 claimId)
        public
        onlyRole(CLAIM_MANAGER_ROLE)
    {
        require(claimId < claimCounter, "Invalid claim ID");
        RewardClaim storage claim = rewardClaims[claimId];
        require(claim.status == ClaimStatus.PENDING, "Claim not pending");
        require(claim.rewardAmount <= rewardPool, "Insufficient pool balance");

        claim.status = ClaimStatus.APPROVED;
        claim.approvedAt = block.timestamp;

        // Move to approved claims
        _removeFromArray(studentRewards[claim.student].pendingClaims, claimId);
        studentRewards[claim.student].approvedClaims.push(claimId);

        emit RewardClaimApproved(claimId, claim.rewardAmount, msg.sender);
    }

    /**
     * @notice Reject a pending reward claim
     * @param claimId ID of claim to reject
     * @param reason Reason for rejection
     */
    function rejectRewardClaim(uint256 claimId, string memory reason)
        public
        onlyRole(CLAIM_MANAGER_ROLE)
    {
        require(claimId < claimCounter, "Invalid claim ID");
        RewardClaim storage claim = rewardClaims[claimId];
        require(claim.status == ClaimStatus.PENDING, "Claim not pending");

        claim.status = ClaimStatus.REJECTED;
        claim.rejectionReason = reason;

        // Remove from pending
        _removeFromArray(studentRewards[claim.student].pendingClaims, claimId);

        emit RewardClaimRejected(claimId, reason, msg.sender);
    }

    // ===== CLAIM REDEMPTION =====

    /**
     * @notice Student claims approved reward
     * @param claimId ID of approved claim
     * @dev Student receives VNDC tokens
     */
    function claimApprovedReward(uint256 claimId)
        public
        nonReentrant
        whenNotPaused
    {
        require(claimId < claimCounter, "Invalid claim ID");
        RewardClaim storage claim = rewardClaims[claimId];
        require(claim.student == msg.sender, "Not claim owner");
        require(claim.status == ClaimStatus.APPROVED, "Claim not approved");

        uint256 rewardAmount = claim.rewardAmount;
        require(rewardAmount <= rewardPool, "Insufficient pool balance");

        claim.status = ClaimStatus.CLAIMED;
        rewardPool -= rewardAmount;
        studentRewards[msg.sender].totalClaimed += rewardAmount;
        studentClaimedAmount[msg.sender] += rewardAmount;

        // Remove from approved claims
        _removeFromArray(studentRewards[msg.sender].approvedClaims, claimId);

        // Transfer tokens
        bool success = vndc.transfer(msg.sender, rewardAmount);
        require(success, "Transfer failed");

        emit RewardClaimed(claimId, msg.sender, rewardAmount);
    }

    // ===== QUERY FUNCTIONS =====

    /**
     * @notice Get reward rule details
     * @param ruleId ID of rule
     * @return The reward rule
     */
    function getRewardRule(uint256 ruleId)
        public
        view
        returns (RewardRule memory)
    {
        require(ruleId < ruleCounter, "Invalid rule ID");
        return rewardRules[ruleId];
    }

    /**
     * @notice Get claim details
     * @param claimId ID of claim
     * @return The reward claim
     */
    function getRewardClaim(uint256 claimId)
        public
        view
        returns (RewardClaim memory)
    {
        require(claimId < claimCounter, "Invalid claim ID");
        return rewardClaims[claimId];
    }

    /**
     * @notice Get student's reward summary
     * @param student Student address
     * @return studentRewards_ Student's reward data
     */
    function getStudentRewards(address student)
        public
        view
        returns (StudentRewards memory)
    {
        return studentRewards[student];
    }

    /**
     * @notice Get total claims by status
     * @param student Student address
     * @param status Claim status to filter
     * @return Count of claims matching status
     */
    function getClaimCountByStatus(address student, ClaimStatus status)
        public
        view
        returns (uint256)
    {
        uint256 count = 0;
        for (uint256 i = 0; i < studentClaimHistory[student].length; i++) {
            if (rewardClaims[studentClaimHistory[student][i]].status == status) {
                count++;
            }
        }
        return count;
    }

    /**
     * @notice Get reward pool balance
     * @return Available VNDC in reward pool
     */
    function getRewardPoolBalance() public view returns (uint256) {
        return rewardPool;
    }

    // ===== INTERNAL HELPER FUNCTIONS =====

    /**
     * @notice Remove element from array by value (find and remove)
     * @dev Used to remove claim IDs from pending/approved arrays
     */
    function _removeFromArray(uint256[] storage arr, uint256 value)
        internal
    {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == value) {
                arr[i] = arr[arr.length - 1];
                arr.pop();
                break;
            }
        }
    }

    /**
     * @notice Pause reward claims
     * @dev Emergency function
     */
    function pause() public onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Unpause reward claims
     */
    function unpause() public onlyRole(ADMIN_ROLE) {
        _unpause();
    }
}
