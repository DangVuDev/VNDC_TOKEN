// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IScholarshipManager
 * @dev Interface for scholarship management system
 */
interface IScholarshipManager {
    // ============ Events ============
    event ScholarshipCreated(
        uint256 indexed scholarshipId,
        string name,
        uint256 totalAmount,
        uint256 maxAwards,
        address funder
    );

    event StudentAwarded(
        uint256 indexed scholarshipId,
        address indexed student,
        uint256 amount,
        uint256 awardedAt
    );

    event ScholarshipClaimed(
        uint256 indexed scholarshipId,
        address indexed student,
        uint256 amount,
        uint256 claimedAt
    );

    event ScholarshipStatusUpdated(
        uint256 indexed scholarshipId,
        string status
    );

    event FundsDeposited(
        uint256 indexed scholarshipId,
        uint256 amount,
        address depositor
    );

    event FundsWithdrawn(
        uint256 scholarshipId,
        uint256 amount,
        address to
    );

    // ============ Mutations ============
    /**
     * @notice Create a new scholarship
     * @param name Scholarship name
     * @param description Scholarship description
     * @param totalAmount Total amount available
     * @param maxAwards Maximum number of awards
     * @param requirements Scholarship requirements (e.g., min GPA)
     * @param duration Duration in seconds (0 = no time limit)
     * @return scholarshipId ID of the new scholarship
     */
    function createScholarship(
        string calldata name,
        string calldata description,
        uint256 totalAmount,
        uint256 maxAwards,
        string calldata requirements,
        uint256 duration
    ) external returns (uint256);

    /**
     * @notice Deposit funds into a scholarship
     * @param scholarshipId Scholarship ID
     * @param amount Amount to deposit
     */
    function depositFunds(uint256 scholarshipId, uint256 amount) external;

    /**
     * @notice Award scholarship to a student
     * @param scholarshipId Scholarship ID
     * @param student Student address
     * @param amount Award amount
     */
    function awardScholarship(
        uint256 scholarshipId,
        address student,
        uint256 amount
    ) external;

    /**
     * @notice Claim awarded scholarship funds
     * @param scholarshipId Scholarship ID
     */
    function claimScholarship(uint256 scholarshipId) external;

    /**
     * @notice Update scholarship status
     * @param scholarshipId Scholarship ID
     * @param newStatus New status (e.g., "active", "closed", "paused")
     */
    function updateScholarshipStatus(
        uint256 scholarshipId,
        string calldata newStatus
    ) external;

    /**
     * @notice Withdraw unclaimed funds from scholarship
     * @param scholarshipId Scholarship ID
     * @param amount Amount to withdraw
     */
    function withdrawFunds(uint256 scholarshipId, uint256 amount) external;

    /**
     * @notice Add funding institution
     * @param fundingEntity Address of funding entity
     */
    function addFundingEntity(address fundingEntity) external;

    /**
     * @notice Remove funding institution
     * @param fundingEntity Address to remove
     */
    function removeFundingEntity(address fundingEntity) external;

    // ============ Queries ============
    /**
     * @notice Get scholarship information
     * @param scholarshipId Scholarship ID
     */
    function getScholarshipInfo(uint256 scholarshipId)
        external
        view
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
        );

    /**
     * @notice Get scholarship requirements
     * @param scholarshipId Scholarship ID
     */
    function getScholarshipRequirements(uint256 scholarshipId)
        external
        view
        returns (string memory requirements);

    /**
     * @notice Get award amount for a student
     * @param scholarshipId Scholarship ID
     * @param student Student address
     */
    function getAwardAmount(uint256 scholarshipId, address student)
        external
        view
        returns (uint256);

    /**
     * @notice Get claimed amount for a student
     * @param scholarshipId Scholarship ID
     * @param student Student address
     */
    function getClaimedAmount(uint256 scholarshipId, address student)
        external
        view
        returns (uint256);

    /**
     * @notice Get all scholarships for a student
     * @param student Student address
     */
    function getStudentScholarships(address student)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get all scholarships funded by an entity
     * @param funder Funder address
     */
    function getFundedScholarships(address funder)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Check if scholarship is still open
     * @param scholarshipId Scholarship ID
     */
    function isScholarshipOpen(uint256 scholarshipId)
        external
        view
        returns (bool);

    /**
     * @notice Check if student is eligible for scholarship
     * @param scholarshipId Scholarship ID
     * @param student Student address
     */
    function isStudentEligible(uint256 scholarshipId, address student)
        external
        view
        returns (bool);

    /**
     * @notice Get total scholarships created
     */
    function getTotalScholarships() external view returns (uint256);

    /**
     * @notice Get total funds in all scholarships
     */
    function getTotalFundsInScholarships() external view returns (uint256);

    /**
     * @notice Get total funds distributed
     */
    function getTotalFundsDistributed() external view returns (uint256);

    /**
     * @notice Get available funds in a scholarship
     * @param scholarshipId Scholarship ID
     */
    function getAvailableFunds(uint256 scholarshipId)
        external
        view
        returns (uint256);
}
