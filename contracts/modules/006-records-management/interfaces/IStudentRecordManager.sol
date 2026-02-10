// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStudentRecordManager
 * @dev Interface for managing student academic records on blockchain
 */
interface IStudentRecordManager {
    // ============ Events ============
    event RecordCreated(
        address indexed student,
        uint256 recordId,
        string transcript,
        uint256 timestamp
    );

    event RecordUpdated(
        address indexed student,
        uint256 recordId,
        string newTranscript,
        uint256 timestamp
    );

    event RecordVerified(
        address indexed student,
        uint256 recordId,
        address verifier,
        uint256 timestamp
    );

    event GradeAdded(
        address indexed student,
        uint256 recordId,
        string subject,
        uint256 grade,
        uint256 credits,
        uint256 timestamp
    );

    event SemesterCompleted(
        address indexed student,
        uint256 recordId,
        uint256 semesterIndex,
        uint256 gpa,
        uint256 timestamp
    );

    event TranscriptIssued(
        address indexed student,
        uint256 recordId,
        string ipfsHash,
        uint256 timestamp
    );

    // ============ Structs ============
    struct Grade {
        string subject;
        uint256 grade; // 0-100
        uint256 credits;
        uint256 timestamp;
    }

    struct Semester {
        uint256 semesterIndex;
        Grade[] grades;
        uint256 gpa; // Stored as basis points (e.g., 3500 = 3.50)
        uint256 totalCredits;
        uint256 timestamp;
        bool isCompleted;
    }

    struct StudentRecord {
        uint256 recordId;
        address student;
        string name;
        string studentId;
        uint256 enrollmentDate;
        uint256 totalCredits;
        uint256 cumulativeGpa; // Basis points
        Semester[] semesters;
        bool isVerified;
        address verifier;
        uint256 verificationDate;
        string transcriptIPFS;
    }

    // ============ Mutation Functions ============
    /**
     * @dev Create a new student record
     * @param name Student name
     * @param studentId Student ID
     * @param transcript Initial transcript hash or identifier
     * @return recordId The ID of the created record
     */
    function createRecord(
        string calldata name,
        string calldata studentId,
        string calldata transcript
    ) external returns (uint256 recordId);

    /**
     * @dev Add a grade to a student's current semester
     * @param recordId Student record ID
     * @param subject Subject name
     * @param grade Grade value (0-100)
     * @param credits Credit hours
     */
    function addGrade(
        uint256 recordId,
        string calldata subject,
        uint256 grade,
        uint256 credits
    ) external;

    /**
     * @dev Complete a semester and calculate GPA
     * @param recordId Student record ID
     * @param semesterIndex Semester index
     */
    function completeSemester(uint256 recordId, uint256 semesterIndex) external;

    /**
     * @dev Verify student record
     * @param recordId Student record ID
     */
    function verifyRecord(uint256 recordId) external;

    /**
     * @dev Issue transcript document
     * @param recordId Student record ID
     * @param ipfsHash IPFS hash of transcript PDF
     */
    function issueTranscript(
        uint256 recordId,
        string calldata ipfsHash
    ) external;

    /**
     * @dev Update student record information
     * @param recordId Student record ID
     * @param name New student name
     * @param transcript New transcript identifier
     */
    function updateRecord(
        uint256 recordId,
        string calldata name,
        string calldata transcript
    ) external;

    // ============ Query Functions ============
    /**
     * @dev Get student record by ID
     * @param recordId Student record ID
     * @return StudentRecord structure
     */
    function getRecord(uint256 recordId) external view returns (StudentRecord memory);

    /**
     * @dev Get all records for a student
     * @param student Student address
     * @return Array of record IDs
     */
    function getStudentRecords(address student) external view returns (uint256[] memory);

    /**
     * @dev Get grade details for a semester
     * @param recordId Student record ID
     * @param semesterIndex Semester index
     * @return Array of grades in semester
     */
    function getSemesterGrades(uint256 recordId, uint256 semesterIndex) external view returns (Grade[] memory);

    /**
     * @dev Get GPA for a semester
     * @param recordId Student record ID
     * @param semesterIndex Semester index
     * @return GPA value in basis points
     */
    function getSemesterGPA(uint256 recordId, uint256 semesterIndex) external view returns (uint256);

    /**
     * @dev Get cumulative GPA
     * @param recordId Student record ID
     * @return Cumulative GPA in basis points
     */
    function getCumulativeGPA(uint256 recordId) external view returns (uint256);

    /**
     * @dev Check if record is verified
     * @param recordId Student record ID
     * @return true if record is verified
     */
    function isRecordVerified(uint256 recordId) external view returns (bool);

    /**
     * @dev Get total credits earned
     * @param recordId Student record ID
     * @return Total credits
     */
    function getTotalCredits(uint256 recordId) external view returns (uint256);

    /**
     * @dev Get number of semesters completed
     * @param recordId Student record ID
     * @return Number of completed semesters
     */
    function getSemesterCount(uint256 recordId) external view returns (uint256);

    /**
     * @dev Get transcript IPFS hash
     * @param recordId Student record ID
     * @return IPFS hash of transcript
     */
    function getTranscriptIPFS(uint256 recordId) external view returns (string memory);

    /**
     * @dev Get total records created
     * @return Total number of student records
     */
    function getTotalRecords() external view returns (uint256);

    /**
     * @dev Verify student by checking if they have verified record
     * @param student Student address
     * @return true if student has verified record
     */
    function isStudentVerified(address student) external view returns (bool);
}
