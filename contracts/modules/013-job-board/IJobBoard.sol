// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IJobBoard
 * @dev Interface for job board and career opportunities system
 */
interface IJobBoard {
    // ============ Events ============
    event JobPosted(
        uint256 indexed jobId,
        string title,
        address indexed employer,
        uint256 postedAt
    );

    event JobStatusUpdated(
        uint256 indexed jobId,
        string status
    );

    event ApplicationSubmitted(
        uint256 indexed jobId,
        address indexed applicant,
        uint256 applicationId,
        uint256 submittedAt
    );

    event ApplicationStatusUpdated(
        uint256 indexed applicationId,
        string status
    );

    event JobMatched(
        uint256 indexed jobId,
        address indexed applicant,
        uint256 matchScore
    );

    event EmployerRegistered(
        address indexed employer,
        string companyName
    );

    event ReviewSubmitted(
        uint256 indexed jobId,
        address indexed reviewer,
        uint256 rating
    );

    // ============ Mutations ============
    /**
     * @notice Register as employer
     * @param companyName Company name
     * @param companyURI IPFS URI with company details
     */
    function registerEmployer(
        string calldata companyName,
        string calldata companyURI
    ) external;

    /**
     * @notice Post a job
     * @param title Job title
     * @param description Job description
     * @param category Job category
     * @param location Job location
     * @param jobType Employment type (full-time, part-time, etc.)
     * @param minSalary Minimum salary
     * @param maxSalary Maximum salary
     * @param requiredSkills Required skills (comma-separated)
     * @return jobId ID of posted job
     */
    function postJob(
        string calldata title,
        string calldata description,
        string calldata category,
        string calldata location,
        string calldata jobType,
        uint256 minSalary,
        uint256 maxSalary,
        string calldata requiredSkills
    ) external returns (uint256);

    /**
     * @notice Submit job application
     * @param jobId Job ID
     * @param coverLetter Applicant's cover letter
     * @return applicationId ID of application
     */
    function applyForJob(
        uint256 jobId,
        string calldata coverLetter
    ) external returns (uint256);

    /**
     * @notice Update application status
     * @param applicationId Application ID
     * @param status New status (e.g., "reviewed", "shortlisted", "rejected", "accepted")
     */
    function updateApplicationStatus(
        uint256 applicationId,
        string calldata status
    ) external;

    /**
     * @notice Update job status
     * @param jobId Job ID
     * @param status New status (e.g., "open", "closed", "filled")
     */
    function updateJobStatus(uint256 jobId, string calldata status) external;

    /**
     * @notice Submit review for completed job/internship
     * @param jobId Job ID
     * @param rating Rating (1-5)
     * @param comment Review comment
     */
    function submitReview(
        uint256 jobId,
        uint256 rating,
        string calldata comment
    ) external;

    /**
     * @notice Get job matches for student (AI/scoring based)
     * @param student Student address
     * @param limit Number of matches to return
     */
    function getJobMatches(address student, uint256 limit)
        external
        view
        returns (uint256[] memory jobIds, uint256[] memory scores);

    /**
     * @notice Authorize matching service
     * @param service Service address
     */
    function authorizeMatchingService(address service) external;

    /**
     * @notice Revoke matching service authorization
     * @param service Service address
     */
    function revokeMatchingService(address service) external;

    // ============ Queries ============
    /**
     * @notice Get job details
     * @param jobId Job ID
     */
    function getJobDetails(uint256 jobId)
        external
        view
        returns (
            string memory title,
            string memory description,
            address employer,
            string memory category,
            string memory location,
            string memory jobType,
            uint256 minSalary,
            uint256 maxSalary,
            string memory requiredSkills,
            string memory status,
            uint256 postedAt,
            uint256 applicationCount
        );

    /**
     * @notice Get application details
     * @param applicationId Application ID
     */
    function getApplicationDetails(uint256 applicationId)
        external
        view
        returns (
            address applicant,
            uint256 jobId,
            string memory coverLetter,
            string memory status,
            uint256 submittedAt
        );

    /**
     * @notice Get employer information
     * @param employer Employer address
     */
    function getEmployerInfo(address employer)
        external
        view
        returns (
            string memory companyName,
            string memory companyURI,
            uint256 jobsPosted,
            uint256 registeredAt
        );

    /**
     * @notice Get job applications
     * @param jobId Job ID
     */
    function getJobApplications(uint256 jobId)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get student applications
     * @param student Student address
     */
    function getStudentApplications(address student)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get applicant's jobs
     * @param employer Employer address
     */
    function getEmployerJobs(address employer)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Check if address is registered employer
     * @param employer Employer address
     */
    function isRegisteredEmployer(address employer)
        external
        view
        returns (bool);

    /**
     * @notice Get job reviews
     * @param jobId Job ID
     */
    function getJobReviews(uint256 jobId)
        external
        view
        returns (
            address[] memory reviewers,
            uint256[] memory ratings,
            string[] memory comments,
            uint256[] memory timestamps
        );

    /**
     * @notice Get job statistics
     * @param jobId Job ID
     */
    function getJobStats(uint256 jobId)
        external
        view
        returns (
            uint256 applicationCount,
            uint256 acceptedCount,
            uint256 rejectedCount,
            uint256 averageRating
        );

    /**
     * @notice Get total jobs posted
     */
    function getTotalJobsPosted() external view returns (uint256);

    /**
     * @notice Get total applications submitted
     */
    function getTotalApplications() external view returns (uint256);

    /**
     * @notice Get total registered employers
     */
    function getTotalEmployers() external view returns (uint256);

    /**
     * @notice Search jobs by category
     * @param category Job category
     */
    function getJobsByCategory(string calldata category)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Search jobs by location
     * @param location Job location
     */
    function getJobsByLocation(string calldata location)
        external
        view
        returns (uint256[] memory);
}
