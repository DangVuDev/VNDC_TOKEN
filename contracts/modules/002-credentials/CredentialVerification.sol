// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./ICredentials.sol";
import "./CredentialNFT.sol";

/// @title CredentialVerification
/// @notice Manages credential issuance, verification, and revocation
/// @dev Uses CredentialNFT for NFT minting and storage
contract CredentialVerification is Ownable, ICredentialVerification, ICredentialEvents {
    CredentialNFT public nftContract;

    mapping(uint256 => Credential) private _credentials;
    mapping(address => uint256[]) private _userCredentials;
    mapping(address => bool) private _issuers;

    // Events from interface
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);

    constructor(address nftContractAddress) Ownable(msg.sender) {
        require(nftContractAddress != address(0), "CredentialVerification: Invalid NFT contract");
        nftContract = CredentialNFT(nftContractAddress);
        _issuers[msg.sender] = true;
    }

    // ============ Issuer Management ============

    /// @notice Add issuer (teacher/admin)
    /// @param issuer Address to grant issuer role
    function addIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "CredentialVerification: Invalid issuer");
        require(!_issuers[issuer], "CredentialVerification: Already an issuer");
        _issuers[issuer] = true;
        emit IssuerAdded(issuer);
    }

    /// @notice Remove issuer
    /// @param issuer Address to revoke issuer role
    function removeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "CredentialVerification: Invalid issuer");
        require(_issuers[issuer], "CredentialVerification: Not an issuer");
        _issuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }

    /// @notice Check if address is issuer
    /// @param issuer Address to check
    /// @return True if issuer
    function isIssuer(address issuer) external view returns (bool) {
        return _issuers[issuer];
    }

    // ============ Credential Management ============

    /// @notice Issue credential to student
    /// @param student Student address
    /// @param name Credential name
    /// @param level Credential level (e.g., "Bachelor", "Master")
    /// @param expirationDays Days until expiration (0 = no expiration)
    /// @param ipfsMetadata IPFS metadata URI
    /// @return tokenId The issued credential token ID
    function issueCredential(
        address student,
        string calldata name,
        string calldata level,
        uint256 expirationDays,
        string calldata ipfsMetadata
    ) external returns (uint256) {
        require(_issuers[msg.sender], "CredentialVerification: Not authorized to issue");
        require(student != address(0), "CredentialVerification: Invalid student");
        require(bytes(name).length > 0, "CredentialVerification: Name cannot be empty");
        require(bytes(level).length > 0, "CredentialVerification: Level cannot be empty");

        // Mint NFT
        uint256 tokenId = nftContract.mint(student, ipfsMetadata);

        // Store credential data
        uint256 expiresAt = 0;
        if (expirationDays > 0) {
            expiresAt = block.timestamp + (expirationDays * 1 days);
        }

        _credentials[tokenId] = Credential({
            name: name,
            level: level,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            revoked: false,
            ipfsMetadata: ipfsMetadata
        });

        _userCredentials[student].push(tokenId);

        emit CredentialIssued(tokenId, student, name, level, msg.sender);
        return tokenId;
    }

    /// @notice Revoke credential
    /// @param tokenId Credential token ID
    function revokeCredential(uint256 tokenId) external {
        Credential storage cred = _credentials[tokenId];
        require(cred.issuer == msg.sender || msg.sender == owner(), "CredentialVerification: Not authorized");
        require(!cred.revoked, "CredentialVerification: Already revoked");

        cred.revoked = true;
        emit CredentialRevoked(tokenId, msg.sender);
    }

    /// @notice Check if credential is valid (not revoked and not expired)
    /// @param tokenId Credential token ID
    /// @return True if credential is valid
    function isCredentialValid(uint256 tokenId) public view returns (bool) {
        Credential storage cred = _credentials[tokenId];
        
        // Check existence
        if (!_exists(tokenId)) return false;
        
        // Check revocation
        if (cred.revoked) return false;
        
        // Check expiration
        if (cred.expiresAt > 0 && block.timestamp > cred.expiresAt) {
            return false;
        }
        
        return true;
    }

    /// @notice Verify credential
    /// @param tokenId Credential token ID
    /// @return valid True if credential is valid
    /// @return name Credential name
    /// @return level Credential level
    function verifyCredential(uint256 tokenId)
        external
        view
        returns (bool valid, string memory name, string memory level)
    {
        Credential storage cred = _credentials[tokenId];
        return (isCredentialValid(tokenId), cred.name, cred.level);
    }

    /// @notice Get credential details
    /// @param tokenId Credential token ID
    /// @return Credential struct
    function getCredential(uint256 tokenId) external view returns (Credential memory) {
        require(_exists(tokenId), "CredentialVerification: Token does not exist");
        return _credentials[tokenId];
    }

    /// @notice Get all credentials of user
    /// @param user User address
    /// @return Array of credential token IDs
    function getCredentialsByUser(address user) external view returns (uint256[] memory) {
        require(user != address(0), "CredentialVerification: Invalid user");
        return _userCredentials[user];
    }

    /// @notice Get active credentials of user
    /// @param user User address
    /// @return Array of valid credential token IDs
    function getActiveCredentialsByUser(address user) external view returns (uint256[] memory) {
        require(user != address(0), "CredentialVerification: Invalid user");
        
        uint256[] storage allCreds = _userCredentials[user];
        uint256 activeCount = 0;

        // Count active credentials
        for (uint256 i = 0; i < allCreds.length; i++) {
            if (isCredentialValid(allCreds[i])) {
                activeCount++;
            }
        }

        // Build array of active credentials
        uint256[] memory activeCreds = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < allCreds.length; i++) {
            if (isCredentialValid(allCreds[i])) {
                activeCreds[index] = allCreds[i];
                index++;
            }
        }

        return activeCreds;
    }

    // ============ Utility Functions ============

    /// @notice Get credential statistics
    /// @return totalIssuers Total number of issuers
    /// @return totalCredentialVariants Total credential types
    function getStats() external view returns (uint256 totalIssuers, uint256 totalCredentialVariants) {
        return (0, 0); // Placeholder
    }

    /// @notice Internal function to check if token exists
    function _exists(uint256 tokenId) internal view returns (bool) {
        try nftContract.exists(tokenId) returns (bool exists_) {
            return exists_;
        } catch {
            return false;
        }
    }
}
