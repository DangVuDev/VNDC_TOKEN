// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IInternshipManager
 * @dev Interface for internship program management
 */
interface IInternshipManager {
    // ============ Events ============
    event InternshipCreated(
        uint256 indexed internshipId,
        string title,
        address indexed company,
        uint256 startDate,
        uint256 endDate
    );

    event InternApplicationSubmitted(
        uint256 indexed internshipId,
        address indexed intern,
        uint256 applicationId
    );

    event InternshipOfferExtended(
        uint256 indexed applicationId,
        address indexed intern,
        uint256 offerExpiry
    );

    event InternshipStarted(
        uint256 indexed internshipId,
        address indexed intern,
        uint256 startedAt
    );

    event InternshipCompleted(
        uint256 indexed internshipId,
        address indexed intern,
        uint256 completedAt
    );

    event MentorAssigned(
        uint256 indexed internshipId,
        address indexed intern,
        address indexed mentor
    );

    event PerformanceEvaluated(
        uint256 indexed internshipId,
        address indexed intern,
        uint256 score,
        uint256 evaluatedAt
    );

    event MilestoneCompleted(
        uint256 indexed internshipId,
        address indexed intern,
        string milestoneName,
        uint256 completedAt
    );

    event CertificateIssued(
        uint256 indexed internshipId,
        address indexed intern,
        string certificateURI
    );

    // ============ Mutations ============
    /**
     * @notice Create internship program
     * @param title Internship title
     * @param description Program description
     * @param startDate Program start date
     * @param endDate Program end date
     * @param mentorRequired Whether mentor is required
     * @param minGPA Minimum GPA requirement
     * @param description Detailed program description
     * @return internshipId ID of internship program
     */
    function createInternship(
        string calldata title,
        string calldata description,
        uint256 startDate,
        uint256 endDate,
        bool mentorRequired,
        uint256 minGPA,
        uint256 maxPositions
    ) external returns (uint256);

    /**
     * @notice Apply for internship
     * @param internshipId Internship ID
     * @param motivationLetter Motivation letter
     */
    function applyForInternship(
        uint256 internshipId,
        string calldata motivationLetter
    ) external returns (uint256);

    /**
     * @notice Extend internship offer
     * @param applicationId Application ID
     * @param stipend Monthly stipend (if any)
     * @param offerValidDays Days for offer validity
     */
    function extendOffer(
        uint256 applicationId,
        uint256 stipend,
        uint256 offerValidDays
    ) external;

    /**
     * @notice Accept internship offer
     * @param applicationId Application ID
     */
    function acceptOffer(uint256 applicationId) external;

    /**
     * @notice Start internship
     * @param applicationId Application ID
     */
    function startInternship(uint256 applicationId) external;

    /**
     * @notice Complete internship
     * @param applicationId Application ID
     * @param certificateURI IPFS URI for completion certificate
     */
    function completeInternship(
        uint256 applicationId,
        string calldata certificateURI
    ) external;

    /**
     * @notice Assign mentor
     * @param applicationId Application ID
     * @param mentor Mentor address
     */
    function assignMentor(uint256 applicationId, address mentor) external;

    /**
     * @notice Submit performance evaluation
     * @param applicationId Application ID
     * @param score Performance score (1-100)
     * @param feedback Evaluation feedback
     */
    function evaluatePerformance(
        uint256 applicationId,
        uint256 score,
        string calldata feedback
    ) external;

    /**
     * @notice Record milestone completion
     * @param applicationId Application ID
     * @param milestoneName Milestone name
     */
    function recordMilestone(
        uint256 applicationId,
        string calldata milestoneName
    ) external;

    /**
     * @notice Add internship requirement
     * @param internshipId Internship ID
     * @param requirement Requirement description
     */
    function addRequirement(
        uint256 internshipId,
        string calldata requirement
    ) external;

    // ============ Queries ============
    /**
     * @notice Get internship details
     * @param internshipId Internship ID
     */
    function getInternshipDetails(uint256 internshipId)
        external
        view
        returns (
            string memory title,
            string memory description,
            address company,
            uint256 startDate,
            uint256 endDate,
            bool mentorRequired,
            uint256 minGPA,
            uint256 maxPositions,
            uint256 filledPositions,
            string memory status
        );

    /**
     * @notice Get application status
     * @param applicationId Application ID
     */
    function getApplicationStatus(uint256 applicationId)
        external
        view
        returns (
            address intern,
            uint256 internshipId,
            string memory status,
            uint256 submittedAt,
            uint256 offerExpiry
        );

    /**
     * @notice Get intern progress
     * @param applicationId Application ID
     */
    function getInternProgress(uint256 applicationId)
        external
        view
        returns (
            address mentor,
            uint256 performanceScore,
            uint256 companionedMilestonesCount,
            string memory evaluationFeedback,
            string memory certificateURI
        );

    /**
     * @notice Get internship applications
     * @param internshipId Internship ID
     */
    function getInternshipApplications(uint256 internshipId)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get intern applications
     * @param intern Intern address
     */
    function getInternApplications(address intern)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get company internships
     * @param company Company address
     */
    function getCompanyInternships(address company)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get total internships
     */
    function getTotalInternships() external view returns (uint256);

    /**
     * @notice Get total applications
     */
    function getTotalInternApplications() external view returns (uint256);

    /**
     * @notice Get internship requirements
     * @param internshipId Internship ID
     */
    function getInternshipRequirements(uint256 internshipId)
        external
        view
        returns (string[] memory);

    /**
     * @notice Get intern milestones
     * @param applicationId Application ID
     */
    function getInternMilestones(uint256 applicationId)
        external
        view
        returns (string[] memory milestones, uint256[] memory completedDates);
}
