// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAlumniRegistry
 * @dev Interface for alumni management and networking system
 */
interface IAlumniRegistry {
    // ============ Events ============
    event AlumniRegistered(
        address indexed alumni,
        string name,
        string program,
        uint256 graduationYear,
        uint256 registeredAt
    );

    event AlumniStatusUpdated(
        address indexed alumni,
        string status
    );

    event AlumniProfileUpdated(
        address indexed alumni,
        string updatedField
    );

    event EventCreated(
        uint256 indexed eventId,
        string name,
        uint256 eventDate,
        address organizer
    );

    event EventRegistered(
        uint256 indexed eventId,
        address indexed alumni,
        uint256 registeredAt
    );

    event MentorshipCreated(
        uint256 indexed mentorshipId,
        address indexed mentor,
        address indexed mentee,
        uint256 createdAt
    );

    event ConnectionMade(
        address indexed alumni1,
        address indexed alumni2,
        uint256 connectedAt
    );

    event DonationMade(
        address indexed donor,
        uint256 amount,
        string purpose,
        uint256 madeAt
    );

    // ============ Mutations ============
    /**
     * @notice Register as alumni
     * @param name Alumni name
     * @param program Graduation program
     * @param graduationYear Graduation year
     * @param profileURI IPFS URI for profile
     */
    function registerAlumni(
        string calldata name,
        string calldata program,
        uint256 graduationYear,
        string calldata profileURI
    ) external;

    /**
     * @notice Update alumni profile
     * @param field Field name to update (e.g., "contactInfo", "bio")
     * @param value New value for field
     */
    function updateProfile(
        string calldata field,
        string calldata value
    ) external;

    /**
     * @notice Update alumni status
     * @param status New status (e.g., "active", "inactive")
     */
    function updateStatus(string calldata status) external;

    /**
     * @notice Create alumni event
     * @param name Event name
     * @param description Event description
     * @param eventDate Unix timestamp for event
     * @param location Event location
     * @return eventId ID of created event
     */
    function createEvent(
        string calldata name,
        string calldata description,
        uint256 eventDate,
        string calldata location
    ) external returns (uint256);

    /**
     * @notice Register for an event
     * @param eventId Event ID
     */
    function registerForEvent(uint256 eventId) external;

    /**
     * @notice Create mentorship relationship
     * @param mentee Mentee address
     * @param duration Mentorship duration in days
     * @return mentorshipId ID of mentorship
     */
    function createMentorship(
        address mentee,
        uint256 duration
    ) external returns (uint256);

    /**
     * @notice Connect with another alumni
     * @param otherAlumni Address of alumni to connect with
     */
    function connectWithAlumni(address otherAlumni) external;

    /**
     * @notice Make a donation
     * @param amount Donation amount
     * @param purpose Donation purpose
     */
    function makeDonation(uint256 amount, string calldata purpose) external;

    /**
     * @notice Authorize mentor for community
     * @param mentor Mentor address
     */
    function authorizeMentor(address mentor) external;

    /**
     * @notice Revoke mentor authorization
     * @param mentor Mentor address
     */
    function revokeMentor(address mentor) external;

    // ============ Queries ============
    /**
     * @notice Get alumni profile
     * @param alumni Alumni address
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
        );

    /**
     * @notice Get alumni custom profile field
     * @param alumni Alumni address
     * @param field Field name
     */
    function getProfileField(address alumni, string calldata field)
        external
        view
        returns (string memory);

    /**
     * @notice Get event information
     * @param eventId Event ID
     */
    function getEventInfo(uint256 eventId)
        external
        view
        returns (
            string memory name,
            string memory description,
            uint256 eventDate,
            string memory location,
            address organizer,
            uint256 registrationCount
        );

    /**
     * @notice Get alumni registered for event
     * @param eventId Event ID
     */
    function getEventRegistrations(uint256 eventId)
        external
        view
        returns (address[] memory);

    /**
     * @notice Get connections for alumni
     * @param alumni Alumni address
     */
    function getConnections(address alumni)
        external
        view
        returns (address[] memory);

    /**
     * @notice Get mentorship information
     * @param mentorshipId Mentorship ID
     */
    function getMentorshipInfo(uint256 mentorshipId)
        external
        view
        returns (
            address mentor,
            address mentee,
            uint256 startDate,
            uint256 endDate,
            bool isActive
        );

    /**
     * @notice Check if address is registered alumni
     * @param alumni Alumni address
     */
    function isRegisteredAlumni(address alumni)
        external
        view
        returns (bool);

    /**
     * @notice Check if addresses are connected
     * @param alumni1 First alumni address
     * @param alumni2 Second alumni address
     */
    function areConnected(address alumni1, address alumni2)
        external
        view
        returns (bool);

    /**
     * @notice Get total registered alumni
     */
    function getTotalAlumni() external view returns (uint256);

    /**
     * @notice Get total events created
     */
    function getTotalEvents() external view returns (uint256);

    /**
     * @notice Get total mentorships
     */
    function getTotalMentorships() external view returns (uint256);

    /**
     * @notice Get total donations
     */
    function getTotalDonations() external view returns (uint256);

    /**
     * @notice Get total donation amount
     */
    function getTotalDonationAmount() external view returns (uint256);

    /**
     * @notice Get alumni by program
     * @param program Program name
     */
    function getAlumniByProgram(string calldata program)
        external
        view
        returns (address[] memory);

    /**
     * @notice Get alumni by graduation year
     * @param year Graduation year
     */
    function getAlumniByGraduationYear(uint256 year)
        external
        view
        returns (address[] memory);
}
