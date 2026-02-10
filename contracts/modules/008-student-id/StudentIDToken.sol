// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStudentID} from "./IStudentID.sol";

/**
 * @title StudentIDToken
 * @dev ERC-721 based student ID system with verification, suspension, and revocation
 */
contract StudentIDToken is ERC721, ERC721Enumerable, Ownable, IStudentID {
    // ============ Data Structures ============
    struct StudentInfo {
        address studentAddr;
        string studentName;
        string program;
        uint256 enrollmentDate;
        uint256 issuedAt;
        bool isSuspended;
        bool isRevoked;
    }

    struct StudentIDDetails {
        string metadataURI;
        string suspensionReason;
        string revocationReason;
        uint256 suspensionTime;
        uint256 revocationTime;
    }

    // ============ State Variables ============
    uint256 private studentIDCounter;
    
    mapping(uint256 => StudentInfo) private studentInfos;
    mapping(uint256 => StudentIDDetails) private studentIDDetails;
    mapping(address => uint256[]) private studentTokens;
    mapping(address => bool) private authorizedVerifiers;

    // Track statistics
    uint256 private totalActiveStudentIDs;
    uint256 private totalSuspendedStudentIDs;
    uint256 private totalRevokedStudentIDs;

    // ============ Modifiers ============
    modifier onlyVerifier() {
        require(
            authorizedVerifiers[msg.sender] || msg.sender == owner(),
            "StudentIDToken: Only authorized verifiers can call this"
        );
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(_ownerOf(tokenId) != address(0), "StudentIDToken: Token does not exist");
        _;
    }

    modifier tokenNotRevoked(uint256 tokenId) {
        require(
            !studentInfos[tokenId].isRevoked,
            "StudentIDToken: Token is revoked"
        );
        _;
    }

    // ============ Constructor ============
    constructor()
        ERC721("Student ID", "SID")
        Ownable(msg.sender)
    {
        studentIDCounter = 1;
        totalActiveStudentIDs = 0;
        totalSuspendedStudentIDs = 0;
        totalRevokedStudentIDs = 0;
        
        // Authorize the deployer as a verifier
        authorizedVerifiers[msg.sender] = true;
    }

    // ============ Core Functions ============
    /**
     * @notice Issue a student ID to a verified student
     */
    function issueStudentID(
        address student,
        string calldata studentName,
        string calldata program,
        uint256 enrollmentDate,
        string calldata metadataURI
    ) external onlyVerifier returns (uint256) {
        require(student != address(0), "StudentIDToken: Invalid student address");
        require(bytes(studentName).length > 0, "StudentIDToken: Student name required");
        require(bytes(program).length > 0, "StudentIDToken: Program required");
        require(enrollmentDate > 0, "StudentIDToken: Enrollment date required");

        uint256 tokenId = studentIDCounter++;
        
        // Mint the NFT
        _mint(student, tokenId);
        
        // Store student information
        studentInfos[tokenId] = StudentInfo({
            studentAddr: student,
            studentName: studentName,
            program: program,
            enrollmentDate: enrollmentDate,
            issuedAt: block.timestamp,
            isSuspended: false,
            isRevoked: false
        });

        studentIDDetails[tokenId] = StudentIDDetails({
            metadataURI: metadataURI,
            suspensionReason: "",
            revocationReason: "",
            suspensionTime: 0,
            revocationTime: 0
        });

        // Track student tokens
        studentTokens[student].push(tokenId);
        totalActiveStudentIDs++;

        emit StudentIDIssued(student, tokenId, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Suspend a student ID (temporary)
     */
    function suspendStudentID(
        uint256 tokenId,
        string calldata reason
    ) external onlyVerifier tokenExists(tokenId) tokenNotRevoked(tokenId) {
        require(!studentInfos[tokenId].isSuspended, "StudentIDToken: Already suspended");

        studentInfos[tokenId].isSuspended = true;
        studentIDDetails[tokenId].suspensionReason = reason;
        studentIDDetails[tokenId].suspensionTime = block.timestamp;

        totalActiveStudentIDs--;
        totalSuspendedStudentIDs++;

        emit StudentIDSuspended(tokenId, reason, block.timestamp);
    }

    /**
     * @notice Revoke a student ID (permanent)
     */
    function revokeStudentID(
        uint256 tokenId,
        string calldata reason
    ) external onlyVerifier tokenExists(tokenId) {
        require(!studentInfos[tokenId].isRevoked, "StudentIDToken: Already revoked");

        studentInfos[tokenId].isRevoked = true;
        studentIDDetails[tokenId].revocationReason = reason;
        studentIDDetails[tokenId].revocationTime = block.timestamp;

        if (studentInfos[tokenId].isSuspended) {
            totalSuspendedStudentIDs--;
        } else {
            totalActiveStudentIDs--;
        }
        totalRevokedStudentIDs++;

        emit StudentIDRevoked(tokenId, reason, block.timestamp);
    }

    /**
     * @notice Reactivate a suspended student ID
     */
    function reactivateStudentID(uint256 tokenId)
        external
        onlyVerifier
        tokenExists(tokenId)
        tokenNotRevoked(tokenId)
    {
        require(studentInfos[tokenId].isSuspended, "StudentIDToken: Not suspended");

        studentInfos[tokenId].isSuspended = false;
        studentIDDetails[tokenId].suspensionReason = "";
        studentIDDetails[tokenId].suspensionTime = 0;

        totalSuspendedStudentIDs--;
        totalActiveStudentIDs++;

        emit StudentIDReactivated(tokenId, block.timestamp);
    }

    /**
     * @notice Update metadata URI for a student ID
     */
    function updateMetadataURI(
        uint256 tokenId,
        string calldata newURI
    ) external onlyVerifier tokenExists(tokenId) {
        require(bytes(newURI).length > 0, "StudentIDToken: URI cannot be empty");

        studentIDDetails[tokenId].metadataURI = newURI;

        emit MetadataURIUpdated(tokenId, newURI);
    }

    /**
     * @notice Authorize a verifier institution
     */
    function authorizeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "StudentIDToken: Invalid verifier address");
        authorizedVerifiers[verifier] = true;
    }

    /**
     * @notice Revoke verifier authorization
     */
    function revokeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "StudentIDToken: Invalid verifier address");
        authorizedVerifiers[verifier] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get student information
     */
    function getStudentInfo(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (
            address studentAddr,
            string memory studentName,
            string memory program,
            uint256 enrollmentDate,
            uint256 issuedAt,
            bool isSuspended,
            bool isRevoked
        )
    {
        StudentInfo memory info = studentInfos[tokenId];
        return (
            info.studentAddr,
            info.studentName,
            info.program,
            info.enrollmentDate,
            info.issuedAt,
            info.isSuspended,
            info.isRevoked
        );
    }

    /**
     * @notice Get student ID details
     */
    function getStudentIDDetails(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (
            string memory metadataURI,
            string memory suspensionReason,
            string memory revocationReason
        )
    {
        StudentIDDetails memory details = studentIDDetails[tokenId];
        return (
            details.metadataURI,
            details.suspensionReason,
            details.revocationReason
        );
    }

    /**
     * @notice Get all active student IDs for a holder
     */
    function getActiveStudentIDs(address student)
        external
        view
        returns (uint256[] memory)
    {
        require(student != address(0), "StudentIDToken: Invalid address");

        uint256 count = 0;
        uint256[] memory allTokenIds = studentTokens[student];
        
        // Count active tokens
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (!studentInfos[allTokenIds[i]].isRevoked && 
                !studentInfos[allTokenIds[i]].isSuspended) {
                count++;
            }
        }

        // Create result array
        uint256[] memory activeIds = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allTokenIds.length; i++) {
            if (!studentInfos[allTokenIds[i]].isRevoked && 
                !studentInfos[allTokenIds[i]].isSuspended) {
                activeIds[index] = allTokenIds[i];
                index++;
            }
        }

        return activeIds;
    }

    /**
     * @notice Check if an ID is currently active
     */
    function isActiveStudentID(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (bool)
    {
        StudentInfo memory info = studentInfos[tokenId];
        return !info.isSuspended && !info.isRevoked;
    }

    /**
     * @notice Check if an address is an authorized verifier
     */
    function isAuthorizedVerifier(address verifier)
        external
        view
        returns (bool)
    {
        return authorizedVerifiers[verifier];
    }

    /**
     * @notice Get total number of issued student IDs
     */
    function getTotalStudentIDs() external view returns (uint256) {
        return studentIDCounter - 1;
    }

    /**
     * @notice Get total number of active student IDs
     */
    function getTotalActiveStudentIDs() external view returns (uint256) {
        return totalActiveStudentIDs;
    }

    /**
     * @notice Get total number of suspended student IDs
     */
    function getTotalSuspendedStudentIDs() external view returns (uint256) {
        return totalSuspendedStudentIDs;
    }

    /**
     * @notice Get total number of revoked student IDs
     */
    function getTotalRevokedStudentIDs() external view returns (uint256) {
        return totalRevokedStudentIDs;
    }

    // ============ Override Functions ============
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
