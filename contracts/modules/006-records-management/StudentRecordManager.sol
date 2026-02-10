// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStudentRecordManager} from "./interfaces/IStudentRecordManager.sol";

/**
 * @title StudentRecordManager
 * @dev Manages student academic records on blockchain
 * Handles grades, GPA calculation, record verification, and transcript management
 */
contract StudentRecordManager is IStudentRecordManager, Ownable {
    
    // ============ State Variables ============
    uint256 private recordIdCounter = 1;
    
    mapping(uint256 => StudentRecord) private records;
    mapping(address => uint256[]) private studentRecords;
    mapping(uint256 => mapping(uint256 => Semester)) private semesters;
    mapping(uint256 => uint256) private semesterCounts;
    
    // Authorized verifiers (institutions)
    mapping(address => bool) private authorizedVerifiers;

    // ============ Modifiers ============
    modifier onlyVerifier() {
        require(authorizedVerifiers[msg.sender] || msg.sender == owner(), "Not authorized verifier");
        _;
    }

    modifier recordExists(uint256 recordId) {
        require(records[recordId].student != address(0), "Record not found");
        _;
    }

    // ============ Constructor ============
    constructor() Ownable(msg.sender) {
        // Owner is automatically authorized as a verifier
        authorizedVerifiers[msg.sender] = true;
    }

    // ============ Record Management ============
    /**
     * @dev Create a new student record
     */
    function createRecord(
        string calldata name,
        string calldata studentId,
        string calldata transcript
    ) external returns (uint256 recordId) {
        require(bytes(name).length > 0, "Invalid name");
        require(bytes(studentId).length > 0, "Invalid student ID");

        recordId = recordIdCounter++;
        
        StudentRecord storage record = records[recordId];
        record.recordId = recordId;
        record.student = msg.sender;
        record.name = name;
        record.studentId = studentId;
        record.enrollmentDate = block.timestamp;
        record.totalCredits = 0;
        record.cumulativeGpa = 0;
        record.isVerified = false;
        record.transcriptIPFS = transcript;

        studentRecords[msg.sender].push(recordId);
        semesterCounts[recordId] = 0;

        emit RecordCreated(msg.sender, recordId, transcript, block.timestamp);
    }

    /**
     * @dev Add a grade to current semester
     */
    function addGrade(
        uint256 recordId,
        string calldata subject,
        uint256 grade,
        uint256 credits
    ) external recordExists(recordId) {
        require(records[recordId].student == msg.sender, "Unauthorized");
        require(bytes(subject).length > 0, "Invalid subject");
        require(grade <= 100, "Invalid grade");
        require(credits > 0, "Invalid credits");

        uint256 currentSemester = semesterCounts[recordId];
        
        // Initialize semester if not exists
        if (semesters[recordId][currentSemester].semesterIndex == 0) {
            semesters[recordId][currentSemester].semesterIndex = currentSemester;
        }

        Semester storage sem = semesters[recordId][currentSemester];
        sem.grades.push(Grade({
            subject: subject,
            grade: grade,
            credits: credits,
            timestamp: block.timestamp
        }));

        emit GradeAdded(msg.sender, recordId, subject, grade, credits, block.timestamp);
    }

    /**
     * @dev Complete semester and calculate GPA
     */
    function completeSemester(uint256 recordId, uint256 semesterIndex) external recordExists(recordId) {
        require(records[recordId].student == msg.sender, "Unauthorized");
        require(semesterIndex < semesterCounts[recordId] + 1, "Invalid semester");

        Semester storage sem = semesters[recordId][semesterIndex];
        require(!sem.isCompleted, "Semester already completed");
        require(sem.grades.length > 0, "No grades in semester");

        // Calculate GPA (weighted by credits)
        uint256 totalGradePoints = 0;
        uint256 totalCredits = 0;

        for (uint256 i = 0; i < sem.grades.length; i++) {
            uint256 gradePoints = _gradeToPoints(sem.grades[i].grade) * sem.grades[i].credits;
            totalGradePoints += gradePoints;
            totalCredits += sem.grades[i].credits;
        }

        uint256 gpa = totalCredits > 0 ? (totalGradePoints * 100) / totalCredits : 0;
        
        sem.gpa = gpa;
        sem.totalCredits = totalCredits;
        sem.isCompleted = true;
        sem.timestamp = block.timestamp;

        // Update student total credits and cumulative GPA
        StudentRecord storage record = records[recordId];
        uint256 totalCreditsEarned = record.totalCredits + totalCredits;
        
        // Weighted cumulative GPA
        if (totalCreditsEarned > 0) {
            uint256 newCumulativePoints = (record.cumulativeGpa * record.totalCredits) + (gpa * totalCredits);
            record.cumulativeGpa = newCumulativePoints / totalCreditsEarned;
        }
        
        record.totalCredits = totalCreditsEarned;

        // Move to next semester
        semesterCounts[recordId]++;

        emit SemesterCompleted(msg.sender, recordId, semesterIndex, gpa, block.timestamp);
    }

    /**
     * @dev Verify student record
     */
    function verifyRecord(uint256 recordId) external onlyVerifier recordExists(recordId) {
        StudentRecord storage record = records[recordId];
        require(!record.isVerified, "Already verified");

        record.isVerified = true;
        record.verifier = msg.sender;
        record.verificationDate = block.timestamp;

        emit RecordVerified(record.student, recordId, msg.sender, block.timestamp);
    }

    /**
     * @dev Issue transcript
     */
    function issueTranscript(uint256 recordId, string calldata ipfsHash) external recordExists(recordId) {
        require(records[recordId].student == msg.sender || msg.sender == owner(), "Unauthorized");
        require(bytes(ipfsHash).length > 0, "Invalid IPFS hash");
        require(records[recordId].isVerified, "Record must be verified first");

        records[recordId].transcriptIPFS = ipfsHash;

        emit TranscriptIssued(records[recordId].student, recordId, ipfsHash, block.timestamp);
    }

    /**
     * @dev Update record information
     */
    function updateRecord(
        uint256 recordId,
        string calldata name,
        string calldata transcript
    ) external recordExists(recordId) {
        require(records[recordId].student == msg.sender, "Unauthorized");
        require(bytes(name).length > 0, "Invalid name");

        StudentRecord storage record = records[recordId];
        record.name = name;
        record.transcriptIPFS = transcript;

        emit RecordUpdated(msg.sender, recordId, transcript, block.timestamp);
    }

    // ============ Admin Functions ============
    /**
     * @dev Authorize a verifier (institution)
     */
    function authorizeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "Invalid address");
        authorizedVerifiers[verifier] = true;
    }

    /**
     * @dev Revoke verifier authorization
     */
    function revokeVerifier(address verifier) external onlyOwner {
        authorizedVerifiers[verifier] = false;
    }

    /**
     * @dev Check if address is authorized verifier
     */
    function isAuthorizedVerifier(address verifier) external view returns (bool) {
        return authorizedVerifiers[verifier];
    }

    // ============ Query Functions ============
    /**
     * @dev Get student record
     */
    function getRecord(uint256 recordId) external view recordExists(recordId) returns (StudentRecord memory) {
        return records[recordId];
    }

    /**
     * @dev Get all records for a student
     */
    function getStudentRecords(address student) external view returns (uint256[] memory) {
        return studentRecords[student];
    }

    /**
     * @dev Get grades in a semester
     */
    function getSemesterGrades(uint256 recordId, uint256 semesterIndex) 
        external 
        view 
        recordExists(recordId) 
        returns (Grade[] memory) 
    {
        return semesters[recordId][semesterIndex].grades;
    }

    /**
     * @dev Get semester GPA
     */
    function getSemesterGPA(uint256 recordId, uint256 semesterIndex) 
        external 
        view 
        recordExists(recordId) 
        returns (uint256) 
    {
        return semesters[recordId][semesterIndex].gpa;
    }

    /**
     * @dev Get cumulative GPA
     */
    function getCumulativeGPA(uint256 recordId) 
        external 
        view 
        recordExists(recordId) 
        returns (uint256) 
    {
        return records[recordId].cumulativeGpa;
    }

    /**
     * @dev Check if record is verified
     */
    function isRecordVerified(uint256 recordId) 
        external 
        view 
        recordExists(recordId) 
        returns (bool) 
    {
        return records[recordId].isVerified;
    }

    /**
     * @dev Get total credits
     */
    function getTotalCredits(uint256 recordId) 
        external 
        view 
        recordExists(recordId) 
        returns (uint256) 
    {
        return records[recordId].totalCredits;
    }

    /**
     * @dev Get semester count
     */
    function getSemesterCount(uint256 recordId) 
        external 
        view 
        recordExists(recordId) 
        returns (uint256) 
    {
        return semesterCounts[recordId];
    }

    /**
     * @dev Get transcript IPFS hash
     */
    function getTranscriptIPFS(uint256 recordId) 
        external 
        view 
        recordExists(recordId) 
        returns (string memory) 
    {
        return records[recordId].transcriptIPFS;
    }

    /**
     * @dev Get total records
     */
    function getTotalRecords() external view returns (uint256) {
        return recordIdCounter - 1;
    }

    /**
     * @dev Check if student is verified
     */
    function isStudentVerified(address student) external view returns (bool) {
        uint256[] memory ids = studentRecords[student];
        for (uint256 i = 0; i < ids.length; i++) {
            if (records[ids[i]].isVerified) {
                return true;
            }
        }
        return false;
    }

    // ============ Internal Functions ============
    /**
     * @dev Convert grade (0-100) to GPA points (0-4.0 as 0-400 in basis points)
     */
    function _gradeToPoints(uint256 grade) internal pure returns (uint256) {
        if (grade >= 93) return 400;      // A (3.75-4.0)
        if (grade >= 90) return 375;      // A- (3.7-3.74)
        if (grade >= 87) return 350;      // B+ (3.3-3.69)
        if (grade >= 83) return 325;      // B (3.0-3.29)
        if (grade >= 80) return 300;      // B- (2.7-2.99)
        if (grade >= 77) return 275;      // C+ (2.3-2.69)
        if (grade >= 73) return 250;      // C (2.0-2.29)
        if (grade >= 70) return 225;      // C- (1.7-1.99)
        if (grade >= 67) return 200;      // D+ (1.3-1.69)
        if (grade >= 63) return 175;      // D (1.0-1.29)
        if (grade >= 60) return 150;      // D- (0.7-0.99)
        return 0;                         // F
    }
}
