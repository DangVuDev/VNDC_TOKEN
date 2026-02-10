// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ICertificationSystem
 * @dev Interface for student certification system (ERC-1155 based)
 */
interface ICertificationSystem {
    // ============ Events ============
    event CertificateTypeCreated(
        uint256 indexed certificateTypeId,
        string name,
        string description,
        uint256 createdAt
    );

    event CertificateIssued(
        address indexed student,
        uint256 indexed certificateTypeId,
        uint256 indexed tokenId,
        uint256 issuedAt
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        string reason,
        uint256 revokedAt
    );

    event CertificateVerified(
        uint256 indexed tokenId,
        address indexed verifier,
        uint256 verifiedAt
    );

    event IssuerAuthorized(
        address indexed issuer,
        uint256[] certificateTypeIds
    );

    event IssuerRevoked(
        address indexed issuer
    );

    // ============ Mutations ============
    /**
     * @notice Create a new certificate type
     * @param name Certificate name
     * @param description Certificate description
     * @param metadataURI IPFS URI for metadata
     * @return certificateTypeId ID of the new certificate type
     */
    function createCertificateType(
        string calldata name,
        string calldata description,
        string calldata metadataURI
    ) external returns (uint256);

    /**
     * @notice Issue a certificate to a student
     * @param student Student address
     * @param certificateTypeId Type of certificate
     * @param metadataURI IPFS URI for this specific certificate
     * @param expiryDate Certificate expiry date (0 = no expiry)
     * @return tokenId ID of the issued certificate
     */
    function issueCertificate(
        address student,
        uint256 certificateTypeId,
        string calldata metadataURI,
        uint256 expiryDate
    ) external returns (uint256);

    /**
     * @notice Revoke a certificate
     * @param tokenId Token ID to revoke
     * @param reason Revocation reason
     */
    function revokeCertificate(
        uint256 tokenId,
        string calldata reason
    ) external;

    /**
     * @notice Verify a certificate (mark as verified by authorized verifier)
     * @param tokenId Certificate token ID
     */
    function verifyCertificate(uint256 tokenId) external;

    /**
     * @notice Authorize an issuer for specific certificate types
     * @param issuer Address to authorize
     * @param certificateTypeIds Array of certificate type IDs they can issue
     */
    function authorizeIssuer(
        address issuer,
        uint256[] calldata certificateTypeIds
    ) external;

    /**
     * @notice Revoke issuer authorization
     * @param issuer Address to revoke
     */
    function revokeIssuer(address issuer) external;

    /**
     * @notice Authorize a verifier
     * @param verifier Address to authorize
     */
    function authorizeVerifier(address verifier) external;

    /**
     * @notice Revoke verifier authorization
     * @param verifier Address to revoke
     */
    function revokeVerifier(address verifier) external;

    // ============ Queries ============
    /**
     * @notice Get certificate type information
     * @param certificateTypeId Certificate type ID
     */
    function getCertificateType(uint256 certificateTypeId)
        external
        view
        returns (
            string memory name,
            string memory description,
            string memory metadataURI,
            uint256 createdAt,
            uint256 totalIssued
        );

    /**
     * @notice Get certificate details
     * @param tokenId Certificate token ID
     */
    function getCertificateDetails(uint256 tokenId)
        external
        view
        returns (
            address student,
            uint256 certificateTypeId,
            uint256 issuedAt,
            uint256 expiryDate,
            bool isRevoked,
            bool isVerified,
            string memory metadataURI
        );

    /**
     * @notice Get all certificates for a student
     * @param student Student address
     * @return tokenIds Array of certificate token IDs
     */
    function getStudentCertificates(address student)
        external
        view
        returns (uint256[] memory);

    /**
     * @notice Get all certificates of a specific type for a student
     * @param student Student address
     * @param certificateTypeId Certificate type ID
     * @return tokenIds Array of certificate token IDs
     */
    function getStudentCertificatesByType(
        address student,
        uint256 certificateTypeId
    ) external view returns (uint256[] memory);

    /**
     * @notice Check if a certificate is currently valid
     * @param tokenId Certificate token ID
     * @return isValid True if not revoked and not expired
     */
    function isCertificateValid(uint256 tokenId)
        external
        view
        returns (bool);

    /**
     * @notice Check if a certificate is expired
     * @param tokenId Certificate token ID
     * @return isExpired True if expired
     */
    function isCertificateExpired(uint256 tokenId)
        external
        view
        returns (bool);

    /**
     * @notice Check if address is authorized issuer
     * @param issuer Address to check
     * @return isAuthorized True if authorized
     */
    function isAuthorizedIssuer(address issuer)
        external
        view
        returns (bool);

    /**
     * @notice Check if issuer can issue specific certificate type
     * @param issuer Issuer address
     * @param certificateTypeId Certificate type ID
     * @return canIssue True if can issue this type
     */
    function canIssuer(address issuer, uint256 certificateTypeId)
        external
        view
        returns (bool);

    /**
     * @notice Check if address is authorized verifier
     * @param verifier Address to check
     * @return isVerifier True if authorized
     */
    function isAuthorizedVerifier(address verifier)
        external
        view
        returns (bool);

    /**
     * @notice Get total number of certificate types
     * @return total Count
     */
    function getTotalCertificateTypes() external view returns (uint256);

    /**
     * @notice Get total certificates issued
     * @return total Count
     */
    function getTotalCertificatesIssued() external view returns (uint256);

    /**
     * @notice Get total active (non-revoked) certificates
     * @return total Count
     */
    function getTotalActiveCertificates() external view returns (uint256);

    /**
     * @notice Get total revoked certificates
     * @return total Count
     */
    function getTotalRevokedCertificates() external view returns (uint256);

    /**
     * @notice Get total verified certificates
     * @return total Count
     */
    function getTotalVerifiedCertificates() external view returns (uint256);
}
