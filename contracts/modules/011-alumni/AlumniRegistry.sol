// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IAlumniRegistry} from "./IAlumniRegistry.sol";

/**
 * @title AlumniRegistry
 * @dev Alumni management and networking system
 */
contract AlumniRegistry is Ownable, IAlumniRegistry {
    // ============ Data Structures ============
    struct AlumniProfile {
        string name;
        string program;
        uint256 graduationYear;
        string status;
        uint256 registeredAt;
        string profileURI;
    }

    struct Event {
        string name;
        string description;
        uint256 eventDate;
        string location;
        address organizer;
        uint256 registrationCount;
    }

    struct Mentorship {
        address mentor;
        address mentee;
        uint256 startDate;
        uint256 endDate;
        bool isActive;
    }

    // ============ State Variables ============
    uint256 private alumniCounter;
    uint256 private eventCounter;
    uint256 private mentorshipCounter;
    uint256 private totalDonationAmount;

    mapping(address => AlumniProfile) private alumniProfiles;
    mapping(address => mapping(string => string)) private customProfileFields;
    mapping(uint256 => Event) private events;
    mapping(uint256 => address[]) private eventRegistrations;
    mapping(uint256 => mapping(address => bool)) private eventParticipants;
    mapping(uint256 => Mentorship) private mentorships;
    mapping(address => uint256[]) private mentorships_;
    mapping(address => address[]) private connections;
    mapping(address => mapping(address => bool)) private isConnected;
    mapping(address => uint256) private totalDonatedBy;
    mapping(address => bool) private authorizedMentors;
    mapping(string => address[]) private alumniByProgram;
    mapping(uint256 => address[]) private alumniByYear;

    // Statistics
    uint256 private totalAlumni;
    uint256 private totalEvents;
    uint256 private totalMentorships;
    uint256 private totalDonations;

    // ============ Modifiers ============
    modifier onlyRegisteredAlumni(address alumni) {
        require(alumniProfiles[alumni].registeredAt > 0, "AlumniRegistry: Not registered alumni");
        _;
    }

    modifier eventExists(uint256 eventId) {
        require(eventId > 0 && eventId < eventCounter, "AlumniRegistry: Event does not exist");
        _;
    }

    modifier mentorshipExists(uint256 mentorshipId) {
        require(mentorshipId > 0 && mentorshipId < mentorshipCounter, 
            "AlumniRegistry: Mentorship does not exist"
        );
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        alumniCounter = 1;
        eventCounter = 1;
        mentorshipCounter = 1;
        totalDonationAmount = 0;
        totalAlumni = 0;
        totalEvents = 0;
        totalMentorships = 0;
        totalDonations = 0;
    }

    // ============ Core Functions ============
    /**
     * @notice Register as alumni
     */
    function registerAlumni(
        string calldata name,
        string calldata program,
        uint256 graduationYear,
        string calldata profileURI
    ) external {
        require(bytes(name).length > 0, "AlumniRegistry: Name required");
        require(bytes(program).length > 0, "AlumniRegistry: Program required");
        require(graduationYear > 0, "AlumniRegistry: Graduation year required");
        require(alumniProfiles[msg.sender].registeredAt == 0, "AlumniRegistry: Already registered");

        alumniProfiles[msg.sender] = AlumniProfile({
            name: name,
            program: program,
            graduationYear: graduationYear,
            status: "active",
            registeredAt: block.timestamp,
            profileURI: profileURI
        });

        // Add to program and year lists
        alumniByProgram[program].push(msg.sender);
        alumniByYear[graduationYear].push(msg.sender);

        totalAlumni++;

        emit AlumniRegistered(msg.sender, name, program, graduationYear, block.timestamp);
    }

    /**
     * @notice Update alumni profile
     */
    function updateProfile(
        string calldata field,
        string calldata value
    ) external onlyRegisteredAlumni(msg.sender) {
        require(bytes(field).length > 0, "AlumniRegistry: Field name required");

        customProfileFields[msg.sender][field] = value;
        emit AlumniProfileUpdated(msg.sender, field);
    }

    /**
     * @notice Update alumni status
     */
    function updateStatus(string calldata status) external onlyRegisteredAlumni(msg.sender) {
        require(bytes(status).length > 0, "AlumniRegistry: Status required");

        alumniProfiles[msg.sender].status = status;
        emit AlumniStatusUpdated(msg.sender, status);
    }

    /**
     * @notice Create alumni event
     */
    function createEvent(
        string calldata name,
        string calldata description,
        uint256 eventDate,
        string calldata location
    ) external onlyRegisteredAlumni(msg.sender) returns (uint256) {
        require(bytes(name).length > 0, "AlumniRegistry: Event name required");
        require(eventDate > block.timestamp, "AlumniRegistry: Event date must be in future");

        uint256 eventId = eventCounter++;

        events[eventId] = Event({
            name: name,
            description: description,
            eventDate: eventDate,
            location: location,
            organizer: msg.sender,
            registrationCount: 0
        });

        totalEvents++;

        emit EventCreated(eventId, name, eventDate, msg.sender);

        return eventId;
    }

    /**
     * @notice Register for event
     */
    function registerForEvent(uint256 eventId)
        external
        onlyRegisteredAlumni(msg.sender)
        eventExists(eventId)
    {
        require(!eventParticipants[eventId][msg.sender], "AlumniRegistry: Already registered");

        eventParticipants[eventId][msg.sender] = true;
        eventRegistrations[eventId].push(msg.sender);
        events[eventId].registrationCount++;

        emit EventRegistered(eventId, msg.sender, block.timestamp);
    }

    /**
     * @notice Create mentorship
     */
    function createMentorship(
        address mentee,
        uint256 duration
    ) external onlyRegisteredAlumni(msg.sender) returns (uint256) {
        require(mentee != address(0), "AlumniRegistry: Invalid mentee address");
        require(mentee != msg.sender, "AlumniRegistry: Cannot mentor yourself");
        require(alumniProfiles[mentee].registeredAt > 0, "AlumniRegistry: Mentee not registered");
        require(authorizedMentors[msg.sender], "AlumniRegistry: Not authorized mentor");
        require(duration > 0, "AlumniRegistry: Duration required");

        uint256 mentorshipId = mentorshipCounter++;
        uint256 endDate = block.timestamp + (duration * 1 days);

        mentorships[mentorshipId] = Mentorship({
            mentor: msg.sender,
            mentee: mentee,
            startDate: block.timestamp,
            endDate: endDate,
            isActive: true
        });

        mentorships_[msg.sender].push(mentorshipId);
        totalMentorships++;

        emit MentorshipCreated(mentorshipId, msg.sender, mentee, block.timestamp);

        return mentorshipId;
    }

    /**
     * @notice Connect with another alumni
     */
    function connectWithAlumni(address otherAlumni)
        external
        onlyRegisteredAlumni(msg.sender)
        onlyRegisteredAlumni(otherAlumni)
    {
        require(otherAlumni != msg.sender, "AlumniRegistry: Cannot connect with yourself");
        require(!isConnected[msg.sender][otherAlumni], "AlumniRegistry: Already connected");

        // Add bidirectional connection
        connections[msg.sender].push(otherAlumni);
        connections[otherAlumni].push(msg.sender);
        isConnected[msg.sender][otherAlumni] = true;
        isConnected[otherAlumni][msg.sender] = true;

        emit ConnectionMade(msg.sender, otherAlumni, block.timestamp);
    }

    /**
     * @notice Make a donation
     */
    function makeDonation(uint256 amount, string calldata purpose)
        external
        onlyRegisteredAlumni(msg.sender)
    {
        require(amount > 0, "AlumniRegistry: Amount must be greater than 0");
        require(bytes(purpose).length > 0, "AlumniRegistry: Purpose required");

        totalDonationAmount += amount;
        totalDonatedBy[msg.sender] += amount;
        totalDonations++;

        emit DonationMade(msg.sender, amount, purpose, block.timestamp);
    }

    /**
     * @notice Authorize mentor
     */
    function authorizeMentor(address mentor) external onlyOwner {
        require(mentor != address(0), "AlumniRegistry: Invalid mentor address");
        authorizedMentors[mentor] = true;
    }

    /**
     * @notice Revoke mentor authorization
     */
    function revokeMentor(address mentor) external onlyOwner {
        require(mentor != address(0), "AlumniRegistry: Invalid mentor address");
        authorizedMentors[mentor] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get alumni profile
     */
    function getAlumniProfile(address alumni)
        external
        view
        returns (
            string memory name,
            string memory program,
            uint256 graduationYear,
            string memory status,
            uint256 registeredAt,
            string memory profileURI
        )
    {
        AlumniProfile memory profile = alumniProfiles[alumni];
        return (
            profile.name,
            profile.program,
            profile.graduationYear,
            profile.status,
            profile.registeredAt,
            profile.profileURI
        );
    }

    /**
     * @notice Get profile field
     */
    function getProfileField(address alumni, string calldata field)
        external
        view
        returns (string memory)
    {
        return customProfileFields[alumni][field];
    }

    /**
     * @notice Get event info
     */
    function getEventInfo(uint256 eventId)
        external
        view
        eventExists(eventId)
        returns (
            string memory name,
            string memory description,
            uint256 eventDate,
            string memory location,
            address organizer,
            uint256 registrationCount
        )
    {
        Event memory eventData = events[eventId];
        return (
            eventData.name,
            eventData.description,
            eventData.eventDate,
            eventData.location,
            eventData.organizer,
            eventData.registrationCount
        );
    }

    /**
     * @notice Get event registrations
     */
    function getEventRegistrations(uint256 eventId)
        external
        view
        eventExists(eventId)
        returns (address[] memory)
    {
        return eventRegistrations[eventId];
    }

    /**
     * @notice Get connections
     */
    function getConnections(address alumni)
        external
        view
        returns (address[] memory)
    {
        return connections[alumni];
    }

    /**
     * @notice Get mentorship info
     */
    function getMentorshipInfo(uint256 mentorshipId)
        external
        view
        mentorshipExists(mentorshipId)
        returns (
            address mentor,
            address mentee,
            uint256 startDate,
            uint256 endDate,
            bool isActive
        )
    {
        Mentorship memory mentorship = mentorships[mentorshipId];
        return (
            mentorship.mentor,
            mentorship.mentee,
            mentorship.startDate,
            mentorship.endDate,
            mentorship.isActive && mentorship.endDate > block.timestamp
        );
    }

    /**
     * @notice Check if registered alumni
     */
    function isRegisteredAlumni(address alumni)
        external
        view
        returns (bool)
    {
        return alumniProfiles[alumni].registeredAt > 0;
    }

    /**
     * @notice Check if connected
     */
    function areConnected(address alumni1, address alumni2)
        external
        view
        returns (bool)
    {
        return isConnected[alumni1][alumni2];
    }

    /**
     * @notice Get total alumni
     */
    function getTotalAlumni() external view returns (uint256) {
        return totalAlumni;
    }

    /**
     * @notice Get total events
     */
    function getTotalEvents() external view returns (uint256) {
        return totalEvents;
    }

    /**
     * @notice Get total mentorships
     */
    function getTotalMentorships() external view returns (uint256) {
        return totalMentorships;
    }

    /**
     * @notice Get total donations
     */
    function getTotalDonations() external view returns (uint256) {
        return totalDonations;
    }

    /**
     * @notice Get total donation amount
     */
    function getTotalDonationAmount() external view returns (uint256) {
        return totalDonationAmount;
    }

    /**
     * @notice Get alumni by program
     */
    function getAlumniByProgram(string calldata program)
        external
        view
        returns (address[] memory)
    {
        return alumniByProgram[program];
    }

    /**
     * @notice Get alumni by graduation year
     */
    function getAlumniByGraduationYear(uint256 year)
        external
        view
        returns (address[] memory)
    {
        return alumniByYear[year];
    }
}
