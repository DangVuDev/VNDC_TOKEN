// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IScholarshipManager} from "./IScholarshipManager.sol";

/**
 * @title ScholarshipManager
 * @dev Manages scholarship distribution and tracking system
 */
contract ScholarshipManager is Ownable, IScholarshipManager {
    // ============ Data Structures ============
    struct Scholarship {
        string name;
        string description;
        address funder;
        uint256 totalAmount;
        uint256 distributedAmount;
        uint256 maxAwards;
        uint256 awardsGiven;
        uint256 createdAt;
        uint256 endsAt;
        string status;
        string requirements;
    }

    struct StudentAward {
        uint256 awardAmount;
        uint256 claimedAmount;
        bool hasBeenAwarded;
        uint256 awardedAt;
        uint256 claimedAt;
    }

    // ============ State Variables ============
    uint256 private scholarshipCounter;
    
    mapping(uint256 => Scholarship) private scholarships;
    mapping(uint256 => mapping(address => StudentAward)) private studentAwards;
    mapping(address => uint256[]) private studentScholarships;
    mapping(address => uint256[]) private fundedScholarships;
    mapping(address => bool) private authorizedFundingEntities;

    // Statistics
    uint256 private totalFundsInScholarships;
    uint256 private totalFundsDistributed;

    // ============ Modifiers ============
    modifier onlyFundingEntity() {
        require(
            authorizedFundingEntities[msg.sender] || msg.sender == owner(),
            "ScholarshipManager: Not authorized funding entity"
        );
        _;
    }

    modifier scholarshipExists(uint256 scholarshipId) {
        require(
            scholarshipId > 0 && scholarshipId < scholarshipCounter,
            "ScholarshipManager: Scholarship does not exist"
        );
        _;
    }

    modifier scholarshipOpen(uint256 scholarshipId) {
        require(
            keccak256(bytes(scholarships[scholarshipId].status)) == keccak256(bytes("active")),
            "ScholarshipManager: Scholarship is not active"
        );
        require(
            scholarships[scholarshipId].endsAt == 0 || scholarships[scholarshipId].endsAt > block.timestamp,
            "ScholarshipManager: Scholarship has ended"
        );
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        scholarshipCounter = 1;
        totalFundsInScholarships = 0;
        totalFundsDistributed = 0;
    }

    // ============ Core Functions ============
    /**
     * @notice Create a new scholarship
     */
    function createScholarship(
        string calldata name,
        string calldata description,
        uint256 totalAmount,
        uint256 maxAwards,
        string calldata requirements,
        uint256 duration
    ) external onlyFundingEntity returns (uint256) {
        require(bytes(name).length > 0, "ScholarshipManager: Name required");
        require(totalAmount > 0, "ScholarshipManager: Amount must be greater than 0");
        require(maxAwards > 0, "ScholarshipManager: Max awards must be greater than 0");

        uint256 scholarshipId = scholarshipCounter++;
        uint256 endsAt = duration > 0 ? block.timestamp + duration : 0;

        scholarships[scholarshipId] = Scholarship({
            name: name,
            description: description,
            funder: msg.sender,
            totalAmount: totalAmount,
            distributedAmount: 0,
            maxAwards: maxAwards,
            awardsGiven: 0,
            createdAt: block.timestamp,
            endsAt: endsAt,
            status: "active",
            requirements: requirements
        });

        fundedScholarships[msg.sender].push(scholarshipId);
        totalFundsInScholarships += totalAmount;

        emit ScholarshipCreated(scholarshipId, name, totalAmount, maxAwards, msg.sender);

        return scholarshipId;
    }

    /**
     * @notice Deposit funds into a scholarship
     */
    function depositFunds(uint256 scholarshipId, uint256 amount)
        external
        scholarshipExists(scholarshipId)
    {
        require(amount > 0, "ScholarshipManager: Amount must be greater than 0");

        scholarships[scholarshipId].totalAmount += amount;
        totalFundsInScholarships += amount;

        emit FundsDeposited(scholarshipId, amount, msg.sender);
    }

    /**
     * @notice Award scholarship to a student
     */
    function awardScholarship(
        uint256 scholarshipId,
        address student,
        uint256 amount
    ) 
        external 
        scholarshipExists(scholarshipId)
        scholarshipOpen(scholarshipId)
    {
        require(student != address(0), "ScholarshipManager: Invalid student address");
        require(amount > 0, "ScholarshipManager: Amount must be greater than 0");
        require(msg.sender == scholarships[scholarshipId].funder || msg.sender == owner(),
            "ScholarshipManager: Only scholarship funder or owner can award"
        );

        Scholarship storage scholarship = scholarships[scholarshipId];
        require(
            scholarship.awardsGiven < scholarship.maxAwards,
            "ScholarshipManager: Max awards reached"
        );
        require(
            scholarship.distributedAmount + amount <= scholarship.totalAmount,
            "ScholarshipManager: Insufficient scholarship funds"
        );

        require(
            !studentAwards[scholarshipId][student].hasBeenAwarded,
            "ScholarshipManager: Student already awarded"
        );

        // Record award
        studentAwards[scholarshipId][student] = StudentAward({
            awardAmount: amount,
            claimedAmount: 0,
            hasBeenAwarded: true,
            awardedAt: block.timestamp,
            claimedAt: 0
        });

        // Track student scholarship
        if (!_hasScholarshipInList(student, scholarshipId)) {
            studentScholarships[student].push(scholarshipId);
        }

        // Update scholarship stats
        scholarship.awardsGiven++;
        scholarship.distributedAmount += amount;
        totalFundsDistributed += amount;

        emit StudentAwarded(scholarshipId, student, amount, block.timestamp);
    }

    /**
     * @notice Claim awarded scholarship funds
     */
    function claimScholarship(uint256 scholarshipId)
        external
        scholarshipExists(scholarshipId)
    {
        StudentAward storage award = studentAwards[scholarshipId][msg.sender];
        require(award.hasBeenAwarded, "ScholarshipManager: Student not awarded");
        require(award.claimedAmount < award.awardAmount, "ScholarshipManager: Already claimed");

        uint256 claimableAmount = award.awardAmount - award.claimedAmount;
        award.claimedAmount = award.awardAmount;
        award.claimedAt = block.timestamp;

        emit ScholarshipClaimed(scholarshipId, msg.sender, claimableAmount, block.timestamp);
    }

    /**
     * @notice Update scholarship status
     */
    function updateScholarshipStatus(
        uint256 scholarshipId,
        string calldata newStatus
    ) 
        external 
        scholarshipExists(scholarshipId)
    {
        require(
            msg.sender == scholarships[scholarshipId].funder || msg.sender == owner(),
            "ScholarshipManager: Only funder or owner can update status"
        );

        scholarships[scholarshipId].status = newStatus;
        emit ScholarshipStatusUpdated(scholarshipId, newStatus);
    }

    /**
     * @notice Withdraw unclaimed funds from scholarship
     */
    function withdrawFunds(uint256 scholarshipId, uint256 amount)
        external
        scholarshipExists(scholarshipId)
    {
        require(
            msg.sender == scholarships[scholarshipId].funder || msg.sender == owner(),
            "ScholarshipManager: Only funder or owner can withdraw"
        );
        require(amount > 0, "ScholarshipManager: Amount must be greater than 0");

        Scholarship storage scholarship = scholarships[scholarshipId];
        uint256 availableFunds = scholarship.totalAmount - scholarship.distributedAmount;
        
        require(
            amount <= availableFunds,
            "ScholarshipManager: Insufficient available funds"
        );

        scholarship.totalAmount -= amount;
        totalFundsInScholarships -= amount;

        emit FundsWithdrawn(scholarshipId, amount, msg.sender);
    }

    /**
     * @notice Add funding institution
     */
    function addFundingEntity(address fundingEntity) external onlyOwner {
        require(fundingEntity != address(0), "ScholarshipManager: Invalid address");
        authorizedFundingEntities[fundingEntity] = true;
    }

    /**
     * @notice Remove funding institution
     */
    function removeFundingEntity(address fundingEntity) external onlyOwner {
        require(fundingEntity != address(0), "ScholarshipManager: Invalid address");
        authorizedFundingEntities[fundingEntity] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get scholarship information
     */
    function getScholarshipInfo(uint256 scholarshipId)
        external
        view
        scholarshipExists(scholarshipId)
        returns (
            string memory name,
            string memory description,
            address funder,
            uint256 totalAmount,
            uint256 distributedAmount,
            uint256 maxAwards,
            uint256 awardsGiven,
            uint256 createdAt,
            uint256 endsAt,
            string memory status
        )
    {
        Scholarship memory scholarship = scholarships[scholarshipId];
        return (
            scholarship.name,
            scholarship.description,
            scholarship.funder,
            scholarship.totalAmount,
            scholarship.distributedAmount,
            scholarship.maxAwards,
            scholarship.awardsGiven,
            scholarship.createdAt,
            scholarship.endsAt,
            scholarship.status
        );
    }

    /**
     * @notice Get scholarship requirements
     */
    function getScholarshipRequirements(uint256 scholarshipId)
        external
        view
        scholarshipExists(scholarshipId)
        returns (string memory)
    {
        return scholarships[scholarshipId].requirements;
    }

    /**
     * @notice Get award amount for a student
     */
    function getAwardAmount(uint256 scholarshipId, address student)
        external
        view
        scholarshipExists(scholarshipId)
        returns (uint256)
    {
        return studentAwards[scholarshipId][student].awardAmount;
    }

    /**
     * @notice Get claimed amount for a student
     */
    function getClaimedAmount(uint256 scholarshipId, address student)
        external
        view
        scholarshipExists(scholarshipId)
        returns (uint256)
    {
        return studentAwards[scholarshipId][student].claimedAmount;
    }

    /**
     * @notice Get all scholarships for a student
     */
    function getStudentScholarships(address student)
        external
        view
        returns (uint256[] memory)
    {
        require(student != address(0), "ScholarshipManager: Invalid address");
        return studentScholarships[student];
    }

    /**
     * @notice Get all scholarships funded by an entity
     */
    function getFundedScholarships(address funder)
        external
        view
        returns (uint256[] memory)
    {
        require(funder != address(0), "ScholarshipManager: Invalid address");
        return fundedScholarships[funder];
    }

    /**
     * @notice Check if scholarship is still open
     */
    function isScholarshipOpen(uint256 scholarshipId)
        external
        view
        scholarshipExists(scholarshipId)
        returns (bool)
    {
        Scholarship memory scholarship = scholarships[scholarshipId];
        
        if (keccak256(bytes(scholarship.status)) != keccak256(bytes("active"))) {
            return false;
        }
        
        if (scholarship.endsAt > 0 && scholarship.endsAt < block.timestamp) {
            return false;
        }

        if (scholarship.awardsGiven >= scholarship.maxAwards) {
            return false;
        }

        return true;
    }

    /**
     * @notice Check if student is eligible for scholarship
     */
    function isStudentEligible(uint256 scholarshipId, address student)
        external
        view
        scholarshipExists(scholarshipId)
        returns (bool)
    {
        if (!studentAwards[scholarshipId][student].hasBeenAwarded) {
            return false;
        }

        return studentAwards[scholarshipId][student].claimedAmount < 
               studentAwards[scholarshipId][student].awardAmount;
    }

    /**
     * @notice Get total scholarships
     */
    function getTotalScholarships() external view returns (uint256) {
        return scholarshipCounter - 1;
    }

    /**
     * @notice Get total funds in scholarships
     */
    function getTotalFundsInScholarships() external view returns (uint256) {
        return totalFundsInScholarships;
    }

    /**
     * @notice Get total distributed funds
     */
    function getTotalFundsDistributed() external view returns (uint256) {
        return totalFundsDistributed;
    }

    /**
     * @notice Get available funds in a scholarship
     */
    function getAvailableFunds(uint256 scholarshipId)
        external
        view
        scholarshipExists(scholarshipId)
        returns (uint256)
    {
        Scholarship memory scholarship = scholarships[scholarshipId];
        return scholarship.totalAmount - scholarship.distributedAmount;
    }

    // ============ Internal Helper Functions ============
    /**
     * @notice Check if student already has scholarship in list
     */
    function _hasScholarshipInList(address student, uint256 scholarshipId)
        internal
        view
        returns (bool)
    {
        uint256[] memory scholarships_ = studentScholarships[student];
        for (uint256 i = 0; i < scholarships_.length; i++) {
            if (scholarships_[i] == scholarshipId) {
                return true;
            }
        }
        return false;
    }
}
