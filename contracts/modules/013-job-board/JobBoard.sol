// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IJobBoard} from "./IJobBoard.sol";

/**
 * @title JobBoard
 * @dev Job board and career opportunities system for students
 */
contract JobBoard is Ownable, IJobBoard {
    // ============ Data Structures ============
    struct Job {
        string title;
        string description;
        address employer;
        string category;
        string location;
        string jobType;
        uint256 minSalary;
        uint256 maxSalary;
        string requiredSkills;
        string status;
        uint256 postedAt;
        uint256 applicationCount;
        uint256 acceptedCount;
        uint256 rejectedCount;
        uint256 totalRating;
        uint256 reviewCount;
    }

    struct Application {
        address applicant;
        uint256 jobId;
        string coverLetter;
        string status;
        uint256 submittedAt;
    }

    struct Employer {
        string companyName;
        string companyURI;
        uint256 jobsPosted;
        uint256 registeredAt;
    }

    struct Review {
        address reviewer;
        uint256 rating;
        string comment;
        uint256 timestamp;
    }

    // ============ State Variables ============
    uint256 private jobCounter;
    uint256 private applicationCounter;

    mapping(uint256 => Job) private jobs;
    mapping(uint256 => Application) private applications;
    mapping(address => Employer) private employers;
    mapping(uint256 => uint256[]) private jobApplications;
    mapping(address => uint256[]) private studentApplications;
    mapping(address => uint256[]) private employerJobs;
    mapping(uint256 => Review[]) private jobReviews;
    mapping(string => uint256[]) private jobsByCategory;
    mapping(string => uint256[]) private jobsByLocation;
    mapping(address => bool) private authorizedMatchingServices;

    // Statistics
    uint256 private totalEmployers;

    // ============ Modifiers ============
    modifier onlyRegisteredEmployer(address employer) {
        require(bytes(employers[employer].companyName).length > 0, "JobBoard: Not registered employer");
        _;
    }

    modifier jobExists(uint256 jobId) {
        require(jobId > 0 && jobId < jobCounter, "JobBoard: Job does not exist");
        _;
    }

    modifier applicationExists(uint256 applicationId) {
        require(applicationId > 0 && applicationId < applicationCounter, "JobBoard: Application does not exist");
        _;
    }

    modifier onlyMatchingService() {
        require(
            authorizedMatchingServices[msg.sender] || msg.sender == owner(),
            "JobBoard: Not authorized matching service"
        );
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        jobCounter = 1;
        applicationCounter = 1;
        totalEmployers = 0;
    }

    // ============ Core Functions ============
    /**
     * @notice Register as employer
     */
    function registerEmployer(
        string calldata companyName,
        string calldata companyURI
    ) external {
        require(bytes(companyName).length > 0, "JobBoard: Company name required");
        require(bytes(employers[msg.sender].companyName).length == 0, "JobBoard: Already registered");

        employers[msg.sender] = Employer({
            companyName: companyName,
            companyURI: companyURI,
            jobsPosted: 0,
            registeredAt: block.timestamp
        });

        totalEmployers++;

        emit EmployerRegistered(msg.sender, companyName);
    }

    /**
     * @notice Post a job
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
    ) 
        external 
        onlyRegisteredEmployer(msg.sender)
        returns (uint256)
    {
        require(bytes(title).length > 0, "JobBoard: Title required");
        require(minSalary <= maxSalary, "JobBoard: Invalid salary range");

        uint256 jobId = jobCounter++;

        jobs[jobId] = Job({
            title: title,
            description: description,
            employer: msg.sender,
            category: category,
            location: location,
            jobType: jobType,
            minSalary: minSalary,
            maxSalary: maxSalary,
            requiredSkills: requiredSkills,
            status: "open",
            postedAt: block.timestamp,
            applicationCount: 0,
            acceptedCount: 0,
            rejectedCount: 0,
            totalRating: 0,
            reviewCount: 0
        });

        employerJobs[msg.sender].push(jobId);
        jobsByCategory[category].push(jobId);
        jobsByLocation[location].push(jobId);
        employers[msg.sender].jobsPosted++;

        emit JobPosted(jobId, title, msg.sender, block.timestamp);

        return jobId;
    }

    /**
     * @notice Submit job application
     */
    function applyForJob(
        uint256 jobId,
        string calldata coverLetter
    ) 
        external 
        jobExists(jobId)
        returns (uint256)
    {
        require(bytes(coverLetter).length > 0, "JobBoard: Cover letter required");
        require(
            keccak256(bytes(jobs[jobId].status)) == keccak256(bytes("open")),
            "JobBoard: Job is not open"
        );

        uint256 applicationId = applicationCounter++;

        applications[applicationId] = Application({
            applicant: msg.sender,
            jobId: jobId,
            coverLetter: coverLetter,
            status: "submitted",
            submittedAt: block.timestamp
        });

        jobApplications[jobId].push(applicationId);
        studentApplications[msg.sender].push(applicationId);
        jobs[jobId].applicationCount++;

        emit ApplicationSubmitted(jobId, msg.sender, applicationId, block.timestamp);

        return applicationId;
    }

    /**
     * @notice Update application status
     */
    function updateApplicationStatus(
        uint256 applicationId,
        string calldata status
    ) 
        external 
        applicationExists(applicationId)
    {
        Application storage application = applications[applicationId];
        require(
            msg.sender == jobs[application.jobId].employer || msg.sender == owner(),
            "JobBoard: Only job employer can update"
        );

        application.status = status;

        // Update job statistics
        if (keccak256(bytes(status)) == keccak256(bytes("accepted"))) {
            jobs[application.jobId].acceptedCount++;
        } else if (keccak256(bytes(status)) == keccak256(bytes("rejected"))) {
            jobs[application.jobId].rejectedCount++;
        }

        emit ApplicationStatusUpdated(applicationId, status);
    }

    /**
     * @notice Update job status
     */
    function updateJobStatus(uint256 jobId, string calldata status)
        external
        jobExists(jobId)
    {
        require(
            msg.sender == jobs[jobId].employer || msg.sender == owner(),
            "JobBoard: Only job employer can update"
        );

        jobs[jobId].status = status;

        emit JobStatusUpdated(jobId, status);
    }

    /**
     * @notice Submit review
     */
    function submitReview(
        uint256 jobId,
        uint256 rating,
        string calldata comment
    ) 
        external 
        jobExists(jobId)
    {
        require(rating >= 1 && rating <= 5, "JobBoard: Rating must be 1-5");

        jobReviews[jobId].push(Review({
            reviewer: msg.sender,
            rating: rating,
            comment: comment,
            timestamp: block.timestamp
        }));

        jobs[jobId].totalRating += rating;
        jobs[jobId].reviewCount++;

        emit ReviewSubmitted(jobId, msg.sender, rating);
    }

    /**
     * @notice Authorize matching service
     */
    function authorizeMatchingService(address service) external onlyOwner {
        require(service != address(0), "JobBoard: Invalid service address");
        authorizedMatchingServices[service] = true;
    }

    /**
     * @notice Revoke matching service
     */
    function revokeMatchingService(address service) external onlyOwner {
        require(service != address(0), "JobBoard: Invalid service address");
        authorizedMatchingServices[service] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get job details
     */
    function getJobDetails(uint256 jobId)
        external
        view
        jobExists(jobId)
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
        )
    {
        Job memory job = jobs[jobId];
        return (
            job.title,
            job.description,
            job.employer,
            job.category,
            job.location,
            job.jobType,
            job.minSalary,
            job.maxSalary,
            job.requiredSkills,
            job.status,
            job.postedAt,
            job.applicationCount
        );
    }

    /**
     * @notice Get application details
     */
    function getApplicationDetails(uint256 applicationId)
        external
        view
        applicationExists(applicationId)
        returns (
            address applicant,
            uint256 jobId,
            string memory coverLetter,
            string memory status,
            uint256 submittedAt
        )
    {
        Application memory application = applications[applicationId];
        return (
            application.applicant,
            application.jobId,
            application.coverLetter,
            application.status,
            application.submittedAt
        );
    }

    /**
     * @notice Get employer info
     */
    function getEmployerInfo(address employer)
        external
        view
        returns (
            string memory companyName,
            string memory companyURI,
            uint256 jobsPosted,
            uint256 registeredAt
        )
    {
        Employer memory emp = employers[employer];
        return (
            emp.companyName,
            emp.companyURI,
            emp.jobsPosted,
            emp.registeredAt
        );
    }

    /**
     * @notice Get job applications
     */
    function getJobApplications(uint256 jobId)
        external
        view
        jobExists(jobId)
        returns (uint256[] memory)
    {
        return jobApplications[jobId];
    }

    /**
     * @notice Get student applications
     */
    function getStudentApplications(address student)
        external
        view
        returns (uint256[] memory)
    {
        return studentApplications[student];
    }

    /**
     * @notice Get employer jobs
     */
    function getEmployerJobs(address employer)
        external
        view
        returns (uint256[] memory)
    {
        return employerJobs[employer];
    }

    /**
     * @notice Check if registered employer
     */
    function isRegisteredEmployer(address employer)
        external
        view
        returns (bool)
    {
        return bytes(employers[employer].companyName).length > 0;
    }

    /**
     * @notice Get job reviews
     */
    function getJobReviews(uint256 jobId)
        external
        view
        jobExists(jobId)
        returns (
            address[] memory reviewers,
            uint256[] memory ratings,
            string[] memory comments,
            uint256[] memory timestamps
        )
    {
        Review[] memory reviews = jobReviews[jobId];
        uint256 length = reviews.length;

        address[] memory rev = new address[](length);
        uint256[] memory rat = new uint256[](length);
        string[] memory com = new string[](length);
        uint256[] memory times = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            rev[i] = reviews[i].reviewer;
            rat[i] = reviews[i].rating;
            com[i] = reviews[i].comment;
            times[i] = reviews[i].timestamp;
        }

        return (rev, rat, com, times);
    }

    /**
     * @notice Get job stats
     */
    function getJobStats(uint256 jobId)
        external
        view
        jobExists(jobId)
        returns (
            uint256 applicationCount,
            uint256 acceptedCount,
            uint256 rejectedCount,
            uint256 averageRating
        )
    {
        Job memory job = jobs[jobId];
        uint256 avgRating = job.reviewCount > 0 ? (job.totalRating * 100) / job.reviewCount : 0;

        return (
            job.applicationCount,
            job.acceptedCount,
            job.rejectedCount,
            avgRating
        );
    }

    /**
     * @notice Get total jobs
     */
    function getTotalJobsPosted() external view returns (uint256) {
        return jobCounter - 1;
    }

    /**
     * @notice Get total applications
     */
    function getTotalApplications() external view returns (uint256) {
        return applicationCounter - 1;
    }

    /**
     * @notice Get total employers
     */
    function getTotalEmployers() external view returns (uint256) {
        return totalEmployers;
    }

    /**
     * @notice Get jobs by category
     */
    function getJobsByCategory(string calldata category)
        external
        view
        returns (uint256[] memory)
    {
        return jobsByCategory[category];
    }

    /**
     * @notice Get jobs by location
     */
    function getJobsByLocation(string calldata location)
        external
        view
        returns (uint256[] memory)
    {
        return jobsByLocation[location];
    }

    /**
     * @notice Get job matches (placeholder for AI matching service)
     */
    function getJobMatches(address student, uint256 limit)
        external
        view
        onlyMatchingService
        returns (uint256[] memory jobIds, uint256[] memory scores)
    {
        // This would be populated by the matching service
        uint256[] memory emptyJobs = new uint256[](0);
        uint256[] memory emptyScores = new uint256[](0);
        return (emptyJobs, emptyScores);
    }
}
