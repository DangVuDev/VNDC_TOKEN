// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IInternshipManager} from "./IInternshipManager.sol";

/**
 * @title InternshipManager
 * @dev Manages internship programs and tracking
 */
contract InternshipManager is Ownable, IInternshipManager {
    // ============ Data Structures ============
    struct Internship {
        string title;
        string description;
        address company;
        uint256 startDate;
        uint256 endDate;
        bool mentorRequired;
        uint256 minGPA;
        uint256 maxPositions;
        uint256 filledPositions;
        string status;
        uint256 createdAt;
    }

    struct InternApplication {
        address intern;
        uint256 internshipId;
        string motivationLetter;
        string status;
        uint256 submittedAt;
        uint256 offerExpiry;
        uint256 stipend;
    }

    struct InternProgress {
        address mentor;
        uint256 performanceScore;
        uint256 milestonesCompleted;
        string evaluationFeedback;
        string certificateURI;
        uint256 completedAt;
    }

    // ============ State Variables ============
    uint256 private internshipCounter;
    uint256 private applicationCounter;

    mapping(uint256 => Internship) private internships;
    mapping(uint256 => InternApplication) private applications;
    mapping(uint256 => InternProgress) private progress;
    mapping(uint256 => uint256[]) private internshipApplications;
    mapping(address => uint256[]) private internApplications;
    mapping(address => uint256[]) private companyInternships;
    mapping(uint256 => string[]) private internshipRequirements;
    mapping(uint256 => mapping(uint256 => string)) private internMilestones;
    mapping(uint256 => mapping(uint256 => uint256)) private milestoneDates;
    mapping(uint256 => uint256) private milestoneCounts;

    // ============ Modifiers ============
    modifier internshipExists(uint256 internshipId) {
        require(internshipId > 0 && internshipId < internshipCounter, 
            "InternshipManager: Internship does not exist"
        );
        _;
    }

    modifier applicationExists(uint256 applicationId) {
        require(applicationId > 0 && applicationId < applicationCounter,
            "InternshipManager: Application does not exist"
        );
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        internshipCounter = 1;
        applicationCounter = 1;
    }

    // ============ Core Functions ============
    /**
     * @notice Create internship
     */
    function createInternship(
        string calldata title,
        string calldata description,
        uint256 startDate,
        uint256 endDate,
        bool mentorRequired,
        uint256 minGPA,
        uint256 maxPositions
    ) external returns (uint256) {
        require(bytes(title).length > 0, "InternshipManager: Title required");
        require(startDate < endDate, "InternshipManager: Invalid dates");
        require(maxPositions > 0, "InternshipManager: Max positions must be > 0");

        uint256 internshipId = internshipCounter++;

        internships[internshipId] = Internship({
            title: title,
            description: description,
            company: msg.sender,
            startDate: startDate,
            endDate: endDate,
            mentorRequired: mentorRequired,
            minGPA: minGPA,
            maxPositions: maxPositions,
            filledPositions: 0,
            status: "open",
            createdAt: block.timestamp
        });

        companyInternships[msg.sender].push(internshipId);

        emit InternshipCreated(internshipId, title, msg.sender, startDate, endDate);

        return internshipId;
    }

    /**
     * @notice Apply for internship
     */
    function applyForInternship(
        uint256 internshipId,
        string calldata motivationLetter
    ) external internshipExists(internshipId) returns (uint256) {
        require(bytes(motivationLetter).length > 0, "InternshipManager: Letter required");
        require(
            keccak256(bytes(internships[internshipId].status)) == keccak256(bytes("open")),
            "InternshipManager: Internship not open"
        );

        uint256 applicationId = applicationCounter++;

        applications[applicationId] = InternApplication({
            intern: msg.sender,
            internshipId: internshipId,
            motivationLetter: motivationLetter,
            status: "submitted",
            submittedAt: block.timestamp,
            offerExpiry: 0,
            stipend: 0
        });

        internshipApplications[internshipId].push(applicationId);
        internApplications[msg.sender].push(applicationId);

        emit InternApplicationSubmitted(internshipId, msg.sender, applicationId);

        return applicationId;
    }

    /**
     * @notice Extend offer
     */
    function extendOffer(
        uint256 applicationId,
        uint256 stipend,
        uint256 offerValidDays
    ) external applicationExists(applicationId) {
        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can extend offer"
        );

        app.status = "offered";
        app.stipend = stipend;
        app.offerExpiry = block.timestamp + (offerValidDays * 1 days);

        emit InternshipOfferExtended(applicationId, app.intern, app.offerExpiry);
    }

    /**
     * @notice Accept offer
     */
    function acceptOffer(uint256 applicationId)
        external
        applicationExists(applicationId)
    {
        InternApplication storage app = applications[applicationId];
        require(app.intern == msg.sender, "InternshipManager: Only applicant can accept");
        require(
            keccak256(bytes(app.status)) == keccak256(bytes("offered")),
            "InternshipManager: No active offer"
        );
        require(block.timestamp < app.offerExpiry, "InternshipManager: Offer expired");

        app.status = "accepted";
        internships[app.internshipId].filledPositions++;
    }

    /**
     * @notice Start internship
     */
    function startInternship(uint256 applicationId)
        external
        applicationExists(applicationId)
    {
        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can start"
        );

        app.status = "active";

        emit InternshipStarted(app.internshipId, app.intern, block.timestamp);
    }

    /**
     * @notice Complete internship
     */
    function completeInternship(
        uint256 applicationId,
        string calldata certificateURI
    ) external applicationExists(applicationId) {
        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can complete"
        );

        app.status = "completed";
        progress[applicationId].certificateURI = certificateURI;
        progress[applicationId].completedAt = block.timestamp;

        emit InternshipCompleted(app.internshipId, app.intern, block.timestamp);
        emit CertificateIssued(app.internshipId, app.intern, certificateURI);
    }

    /**
     * @notice Assign mentor
     */
    function assignMentor(uint256 applicationId, address mentor)
        external
        applicationExists(applicationId)
    {
        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can assign"
        );

        progress[applicationId].mentor = mentor;

        emit MentorAssigned(app.internshipId, app.intern, mentor);
    }

    /**
     * @notice Evaluate performance
     */
    function evaluatePerformance(
        uint256 applicationId,
        uint256 score,
        string calldata feedback
    ) external applicationExists(applicationId) {
        require(score >= 0 && score <= 100, "InternshipManager: Score 0-100");

        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can evaluate"
        );

        progress[applicationId].performanceScore = score;
        progress[applicationId].evaluationFeedback = feedback;

        emit PerformanceEvaluated(app.internshipId, app.intern, score, block.timestamp);
    }

    /**
     * @notice Record milestone
     */
    function recordMilestone(
        uint256 applicationId,
        string calldata milestoneName
    ) external applicationExists(applicationId) {
        InternApplication storage app = applications[applicationId];
        require(
            msg.sender == internships[app.internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can record"
        );

        uint256 count = milestoneCounts[applicationId];
        internMilestones[applicationId][count] = milestoneName;
        milestoneDates[applicationId][count] = block.timestamp;
        milestoneCounts[applicationId]++;
        progress[applicationId].milestonesCompleted++;

        emit MilestoneCompleted(app.internshipId, app.intern, milestoneName, block.timestamp);
    }

    /**
     * @notice Add requirement
     */
    function addRequirement(
        uint256 internshipId,
        string calldata requirement
    ) external internshipExists(internshipId) {
        require(
            msg.sender == internships[internshipId].company || msg.sender == owner(),
            "InternshipManager: Only company can add"
        );

        internshipRequirements[internshipId].push(requirement);
    }

    // ============ Query Functions ============
    /**
     * @notice Get internship details
     */
    function getInternshipDetails(uint256 internshipId)
        external
        view
        internshipExists(internshipId)
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
        )
    {
        Internship memory internship = internships[internshipId];
        return (
            internship.title,
            internship.description,
            internship.company,
            internship.startDate,
            internship.endDate,
            internship.mentorRequired,
            internship.minGPA,
            internship.maxPositions,
            internship.filledPositions,
            internship.status
        );
    }

    /**
     * @notice Get application status
     */
    function getApplicationStatus(uint256 applicationId)
        external
        view
        applicationExists(applicationId)
        returns (
            address intern,
            uint256 internshipId,
            string memory status,
            uint256 submittedAt,
            uint256 offerExpiry
        )
    {
        InternApplication memory app = applications[applicationId];
        return (
            app.intern,
            app.internshipId,
            app.status,
            app.submittedAt,
            app.offerExpiry
        );
    }

    /**
     * @notice Get intern progress
     */
    function getInternProgress(uint256 applicationId)
        external
        view
        applicationExists(applicationId)
        returns (
            address mentor,
            uint256 performanceScore,
            uint256 milestonesCount,
            string memory evaluationFeedback,
            string memory certificateURI
        )
    {
        InternProgress memory prog = progress[applicationId];
        return (
            prog.mentor,
            prog.performanceScore,
            prog.milestonesCompleted,
            prog.evaluationFeedback,
            prog.certificateURI
        );
    }

    /**
     * @notice Get internship applications
     */
    function getInternshipApplications(uint256 internshipId)
        external
        view
        internshipExists(internshipId)
        returns (uint256[] memory)
    {
        return internshipApplications[internshipId];
    }

    /**
     * @notice Get intern applications
     */
    function getInternApplications(address intern)
        external
        view
        returns (uint256[] memory)
    {
        return internApplications[intern];
    }

    /**
     * @notice Get company internships
     */
    function getCompanyInternships(address company)
        external
        view
        returns (uint256[] memory)
    {
        return companyInternships[company];
    }

    /**
     * @notice Get total internships
     */
    function getTotalInternships() external view returns (uint256) {
        return internshipCounter - 1;
    }

    /**
     * @notice Get total applications
     */
    function getTotalInternApplications() external view returns (uint256) {
        return applicationCounter - 1;
    }

    /**
     * @notice Get internship requirements
     */
    function getInternshipRequirements(uint256 internshipId)
        external
        view
        internshipExists(internshipId)
        returns (string[] memory)
    {
        return internshipRequirements[internshipId];
    }

    /**
     * @notice Get intern milestones
     */
    function getInternMilestones(uint256 applicationId)
        external
        view
        applicationExists(applicationId)
        returns (string[] memory milestones, uint256[] memory completedDates)
    {
        uint256 count = milestoneCounts[applicationId];
        string[] memory ms = new string[](count);
        uint256[] memory dates = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            ms[i] = internMilestones[applicationId][i];
            dates[i] = milestoneDates[applicationId][i];
        }

        return (ms, dates);
    }
}
