// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IStudentID
 * @dev Interface for Student ID ERC-721 NFT system
 */
interface IStudentID {
    // ============ Events ============
    event StudentIDIssued(
        address indexed student,
        uint256 indexed tokenId,
        uint256 issuedAt
    );

    event StudentIDSuspended(
        uint256 indexed tokenId,
        string reason,
        uint256 suspendedAt
    );

    event StudentIDRevoked(
        uint256 indexed tokenId,
        string reason,
        uint256 revokedAt
    );

    event StudentIDReactivated(
        uint256 indexed tokenId,
        uint256 reactivatedAt
    );

    event MetadataURIUpdated(
        uint256 indexed tokenId,
        string newURI
    );

    // ============ Mutations ============
    /**
     * @notice Issue a student ID to a verified student
     * @param student Address of the student
     * @param studentName Name of the student
     * @param program Academic program
     * @param enrollmentDate Enrollment date timestamp
     * @param metadataURI IPFS URI for metadata
     * @return tokenId ID of the minted NFT
     */
    function issueStudentID(
        address student,
        string calldata studentName,
        string calldata program,
        uint256 enrollmentDate,
        string calldata metadataURI
    ) external returns (uint256);

    /**
     * @notice Suspend a student ID (temporary)
     * @param tokenId Token ID to suspend
     * @param reason Suspension reason
     */
    function suspendStudentID(
        uint256 tokenId,
        string calldata reason
    ) external;

    /**
     * @notice Revoke a student ID (permanent)
     * @param tokenId Token ID to revoke
     * @param reason Revocation reason
     */
    function revokeStudentID(
        uint256 tokenId,
        string calldata reason
    ) external;

    /**
     * @notice Reactivate a suspended student ID
     * @param tokenId Token ID to reactivate
     */
    function reactivateStudentID(uint256 tokenId) external;

    /**
     * @notice Update metadata URI for a student ID
     * @param tokenId Token ID
     * @param newURI New IPFS URI
     */
    function updateMetadataURI(
        uint256 tokenId,
        string calldata newURI
    ) external;

    /**
     * @notice Authorize a verifier institution
     * @param verifier Address to authorize as verifier
     */
    function authorizeVerifier(address verifier) external;

    /**
     * @notice Revoke verifier authorization
     * @param verifier Address to revoke
     */
    function revokeVerifier(address verifier) external;

    // ============ Queries ============
    /**
     * @notice Get student information
     * @param tokenId Token ID
     * @return studentAddr Student address
     * @return studentName Student name
     * @return program Academic program
     * @return enrollmentDate Enrollment date
     * @return issuedAt Issuance timestamp
     * @return isSuspended Suspension status
     * @return isRevoked Revocation status
     */
    function getStudentInfo(uint256 tokenId)
        external
        view
        returns (
            address studentAddr,
            string memory studentName,
            string memory program,
            uint256 enrollmentDate,
            uint256 issuedAt,
            bool isSuspended,
            bool isRevoked
        );

    /**
     * @notice Get student ID details
     * @param tokenId Token ID
     * @return metadataURI IPFS URI
     * @return suspensionReason Reason for suspension (if suspended)
     * @return revocationReason Reason for revocation (if revoked)
     */
    function getStudentIDDetails(uint256 tokenId)
        external
        view
        returns (
            string memory metadataURI,
            string memory suspensionReason,
            string memory revocationReason
        );

    /**
     * @notice Get all active student IDs for a holder
     * @param student Student address
     * @return tokenIds Array of active token IDs
     */
    function getActiveStudentIDs(address student)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Check if an ID is currently active (not suspended or revoked)
     * @param tokenId Token ID
     * @return isActive True if active
     */
    function isActiveStudentID(uint256 tokenId)
        external
        view
        returns (bool);

    /**
     * @notice Check if an address is an authorized verifier
     * @param verifier Address to check
     * @return isVerifier True if authorized
     */
    function isAuthorizedVerifier(address verifier)
        external
        view
        returns (bool);

    /**
     * @notice Get total number of issued student IDs
     * @return total Count
     */
    function getTotalStudentIDs() external view returns (uint256);

    /**
     * @notice Get total number of active student IDs
     * @return total Count
     */
    function getTotalActiveStudentIDs() external view returns (uint256);

    /**
     * @notice Get total number of suspended student IDs
     * @return total Count
     */
    function getTotalSuspendedStudentIDs() external view returns (uint256);

    /**
     * @notice Get total number of revoked student IDs
     * @return total Count
     */
    function getTotalRevokedStudentIDs() external view returns (uint256);
}
