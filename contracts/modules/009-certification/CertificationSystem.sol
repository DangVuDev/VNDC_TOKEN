// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC1155} from "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICertificationSystem} from "./ICertificationSystem.sol";

/**
 * @title CertificationSystem
 * @dev ERC-1155 based certification system for issuing and verifying student certificates
 */
contract CertificationSystem is ERC1155, Ownable, ICertificationSystem {
    // ============ Data Structures ============
    struct CertificateType {
        string name;
        string description;
        string metadataURI;
        uint256 createdAt;
        uint256 totalIssued;
    }

    struct Certificate {
        address student;
        uint256 certificateTypeId;
        uint256 issuedAt;
        uint256 expiryDate;
        bool isRevoked;
        bool isVerified;
        string metadataURI;
    }

    struct IssuerInfo {
        bool isAuthorized;
        uint256[] authorizedCertificateTypes;
        uint256 certificatesIssued;
    }

    // ============ State Variables ============
    uint256 private certificateTypeCounter;
    uint256 private certificateTokenCounter;

    mapping(uint256 => CertificateType) private certificateTypes;
    mapping(uint256 => Certificate) private certificates;
    mapping(address => uint256[]) private studentCertificates;
    mapping(address => IssuerInfo) private issuers;
    mapping(address => bool) private authorizedVerifiers;
    mapping(uint256 => mapping(address => bool)) private revokedByType;

    // Statistics
    uint256 private totalCertificatesIssued;
    uint256 private totalRevokedCertificates;
    uint256 private totalVerifiedCertificates;

    // ============ Modifiers ============
    modifier onlyAuthorizedIssuer() {
        require(
            issuers[msg.sender].isAuthorized || msg.sender == owner(),
            "CertificationSystem: Not authorized as issuer"
        );
        _;
    }

    modifier onlyAuthorizedVerifier() {
        require(
            authorizedVerifiers[msg.sender] || msg.sender == owner(),
            "CertificationSystem: Not authorized as verifier"
        );
        _;
    }

    modifier certificateTypeExists(uint256 certificateTypeId) {
        require(
            certificateTypeId > 0 && certificateTypeId < certificateTypeCounter,
            "CertificationSystem: Certificate type does not exist"
        );
        _;
    }

    modifier certificateExists(uint256 tokenId) {
        require(
            tokenId > 0 && tokenId < certificateTokenCounter,
            "CertificationSystem: Certificate does not exist"
        );
        _;
    }

    modifier certificateNotRevoked(uint256 tokenId) {
        require(
            !certificates[tokenId].isRevoked,
            "CertificationSystem: Certificate is revoked"
        );
        _;
    }

    // ============ Constructor ============
    constructor() 
        ERC1155("ipfs://")
        Ownable(msg.sender)
    {
        certificateTypeCounter = 1;
        certificateTokenCounter = 1;
        totalCertificatesIssued = 0;
        totalRevokedCertificates = 0;
        totalVerifiedCertificates = 0;
        
        // Authorize the deployer as a verifier
        authorizedVerifiers[msg.sender] = true;
    }

    // ============ Core Functions ============
    /**
     * @notice Create a new certificate type
     */
    function createCertificateType(
        string calldata name,
        string calldata description,
        string calldata metadataURI
    ) external onlyOwner returns (uint256) {
        require(bytes(name).length > 0, "CertificationSystem: Name required");
        require(bytes(description).length > 0, "CertificationSystem: Description required");

        uint256 certificateTypeId = certificateTypeCounter++;

        certificateTypes[certificateTypeId] = CertificateType({
            name: name,
            description: description,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            totalIssued: 0
        });

        emit CertificateTypeCreated(certificateTypeId, name, description, block.timestamp);

        return certificateTypeId;
    }

    /**
     * @notice Issue a certificate to a student
     */
    function issueCertificate(
        address student,
        uint256 certificateTypeId,
        string calldata metadataURI,
        uint256 expiryDate
    ) 
        external 
        onlyAuthorizedIssuer 
        certificateTypeExists(certificateTypeId)
        returns (uint256)
    {
        require(student != address(0), "CertificationSystem: Invalid student address");

        uint256 tokenId = certificateTokenCounter++;
        uint256 typeId = certificateTypeId;

        // Check if issuer is authorized for this certificate type
        if (msg.sender != owner()) {
            bool canIssueType = false;
            uint256[] memory authorizedTypes = issuers[msg.sender].authorizedCertificateTypes;
            for (uint256 i = 0; i < authorizedTypes.length; i++) {
                if (authorizedTypes[i] == typeId) {
                    canIssueType = true;
                    break;
                }
            }
            require(
                canIssueType,
                "CertificationSystem: Not authorized to issue this certificate type"
            );
        }

        // Mint the certificate (ERC-1155)
        _mint(student, tokenId, 1, bytes(metadataURI));

        // Store certificate information
        certificates[tokenId] = Certificate({
            student: student,
            certificateTypeId: typeId,
            issuedAt: block.timestamp,
            expiryDate: expiryDate,
            isRevoked: false,
            isVerified: false,
            metadataURI: metadataURI
        });

        // Track student certificates
        studentCertificates[student].push(tokenId);

        // Update statistics
        certificateTypes[typeId].totalIssued++;
        totalCertificatesIssued++;
        issuers[msg.sender].certificatesIssued++;

        emit CertificateIssued(student, typeId, tokenId, block.timestamp);

        return tokenId;
    }

    /**
     * @notice Revoke a certificate
     */
    function revokeCertificate(
        uint256 tokenId,
        string calldata reason
    ) 
        external 
        onlyOwner 
        certificateExists(tokenId)
        certificateNotRevoked(tokenId)
    {
        require(bytes(reason).length > 0, "CertificationSystem: Reason required");

        certificates[tokenId].isRevoked = true;
        totalRevokedCertificates++;

        // If was verified, decrement verified count
        if (certificates[tokenId].isVerified) {
            totalVerifiedCertificates--;
            certificates[tokenId].isVerified = false;
        }

        emit CertificateRevoked(tokenId, reason, block.timestamp);
    }

    /**
     * @notice Verify a certificate
     */
    function verifyCertificate(uint256 tokenId)
        external
        onlyAuthorizedVerifier
        certificateExists(tokenId)
        certificateNotRevoked(tokenId)
    {
        require(!certificates[tokenId].isVerified, "CertificationSystem: Already verified");

        certificates[tokenId].isVerified = true;
        totalVerifiedCertificates++;

        emit CertificateVerified(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @notice Authorize an issuer for specific certificate types
     */
    function authorizeIssuer(
        address issuer,
        uint256[] calldata certificateTypeIds
    ) external onlyOwner {
        require(issuer != address(0), "CertificationSystem: Invalid issuer address");
        require(certificateTypeIds.length > 0, "CertificationSystem: Must specify at least one certificate type");

        issuers[issuer].isAuthorized = true;
        issuers[issuer].authorizedCertificateTypes = certificateTypeIds;

        emit IssuerAuthorized(issuer, certificateTypeIds);
    }

    /**
     * @notice Revoke issuer authorization
     */
    function revokeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "CertificationSystem: Invalid issuer address");
        require(issuers[issuer].isAuthorized, "CertificationSystem: Not an authorized issuer");

        issuers[issuer].isAuthorized = false;
        delete issuers[issuer].authorizedCertificateTypes;

        emit IssuerRevoked(issuer);
    }

    /**
     * @notice Authorize a verifier
     */
    function authorizeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "CertificationSystem: Invalid verifier address");
        authorizedVerifiers[verifier] = true;
    }

    /**
     * @notice Revoke verifier authorization
     */
    function revokeVerifier(address verifier) external onlyOwner {
        require(verifier != address(0), "CertificationSystem: Invalid verifier address");
        authorizedVerifiers[verifier] = false;
    }

    // ============ Query Functions ============
    /**
     * @notice Get certificate type information
     */
    function getCertificateType(uint256 certificateTypeId)
        external
        view
        certificateTypeExists(certificateTypeId)
        returns (
            string memory name,
            string memory description,
            string memory metadataURI,
            uint256 createdAt,
            uint256 totalIssued
        )
    {
        CertificateType memory certType = certificateTypes[certificateTypeId];
        return (
            certType.name,
            certType.description,
            certType.metadataURI,
            certType.createdAt,
            certType.totalIssued
        );
    }

    /**
     * @notice Get certificate details
     */
    function getCertificateDetails(uint256 tokenId)
        external
        view
        certificateExists(tokenId)
        returns (
            address student,
            uint256 certificateTypeId,
            uint256 issuedAt,
            uint256 expiryDate,
            bool isRevoked,
            bool isVerified,
            string memory metadataURI
        )
    {
        Certificate memory cert = certificates[tokenId];
        return (
            cert.student,
            cert.certificateTypeId,
            cert.issuedAt,
            cert.expiryDate,
            cert.isRevoked,
            cert.isVerified,
            cert.metadataURI
        );
    }

    /**
     * @notice Get all certificates for a student
     */
    function getStudentCertificates(address student)
        external
        view
        returns (uint256[] memory)
    {
        require(student != address(0), "CertificationSystem: Invalid address");
        return studentCertificates[student];
    }

    /**
     * @notice Get certificates of specific type for a student
     */
    function getStudentCertificatesByType(
        address student,
        uint256 certificateTypeId
    ) 
        external 
        view 
        certificateTypeExists(certificateTypeId)
        returns (uint256[] memory)
    {
        require(student != address(0), "CertificationSystem: Invalid address");

        uint256[] memory allCerts = studentCertificates[student];
        uint256 count = 0;

        // Count certificates of this type
        for (uint256 i = 0; i < allCerts.length; i++) {
            if (certificates[allCerts[i]].certificateTypeId == certificateTypeId) {
                count++;
            }
        }

        // Create result array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < allCerts.length; i++) {
            if (certificates[allCerts[i]].certificateTypeId == certificateTypeId) {
                result[index] = allCerts[i];
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Check if certificate is valid
     */
    function isCertificateValid(uint256 tokenId)
        external
        view
        certificateExists(tokenId)
        returns (bool)
    {
        Certificate memory cert = certificates[tokenId];
        
        // Not valid if revoked
        if (cert.isRevoked) return false;
        
        // Not valid if expired (and has expiry)
        if (cert.expiryDate > 0 && cert.expiryDate < block.timestamp) {
            return false;
        }

        return true;
    }

    /**
     * @notice Check if certificate is expired
     */
    function isCertificateExpired(uint256 tokenId)
        external
        view
        certificateExists(tokenId)
        returns (bool)
    {
        Certificate memory cert = certificates[tokenId];
        
        // Not expired if no expiry date
        if (cert.expiryDate == 0) return false;
        
        return cert.expiryDate < block.timestamp;
    }

    /**
     * @notice Check if address is authorized issuer
     */
    function isAuthorizedIssuer(address issuer)
        external
        view
        returns (bool)
    {
        return issuers[issuer].isAuthorized;
    }

    /**
     * @notice Check if issuer can issue specific certificate type
     */
    function canIssuer(address issuer, uint256 certificateTypeId)
        external
        view
        returns (bool)
    {
        if (!issuers[issuer].isAuthorized) return false;

        uint256[] memory authorizedTypes = issuers[issuer].authorizedCertificateTypes;
        for (uint256 i = 0; i < authorizedTypes.length; i++) {
            if (authorizedTypes[i] == certificateTypeId) {
                return true;
            }
        }

        return false;
    }

    /**
     * @notice Check if address is authorized verifier
     */
    function isAuthorizedVerifier(address verifier)
        external
        view
        returns (bool)
    {
        return authorizedVerifiers[verifier];
    }

    /**
     * @notice Get total certificate types
     */
    function getTotalCertificateTypes() external view returns (uint256) {
        return certificateTypeCounter - 1;
    }

    /**
     * @notice Get total certificates issued
     */
    function getTotalCertificatesIssued() external view returns (uint256) {
        return totalCertificatesIssued;
    }

    /**
     * @notice Get total active certificates
     */
    function getTotalActiveCertificates() external view returns (uint256) {
        return totalCertificatesIssued - totalRevokedCertificates;
    }

    /**
     * @notice Get total revoked certificates
     */
    function getTotalRevokedCertificates() external view returns (uint256) {
        return totalRevokedCertificates;
    }

    /**
     * @notice Get total verified certificates
     */
    function getTotalVerifiedCertificates() external view returns (uint256) {
        return totalVerifiedCertificates;
    }

    // ============ Override Functions ============
    function uri(uint256 tokenId) 
        public 
        view 
        override 
        certificateExists(tokenId)
        returns (string memory)
    {
        return certificates[tokenId].metadataURI;
    }
}
