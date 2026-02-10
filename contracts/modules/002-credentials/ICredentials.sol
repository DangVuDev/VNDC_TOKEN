// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICredentials
/// @notice Interfaces for credential system
/// @dev Defines credential-related data structures and events

interface ICredentialNFT {
    /// @notice Mint credential NFT
    function mint(address to, string calldata credentialURI) external returns (uint256);

    /// @notice Burn credential NFT
    function burn(uint256 tokenId) external;

    /// @notice Get token URI
    function tokenURI(uint256 tokenId) external view returns (string memory);

    /// @notice Get all tokens owned by address
    function tokensOfOwner(address owner) external view returns (uint256[] memory);
}

interface ICredentialVerification {
    /// @notice Credential data structure
    struct Credential {
        string name;
        string level;
        address issuer;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
        string ipfsMetadata;
    }

    /// @notice Issue credential to student
    function issueCredential(
        address student,
        string calldata name,
        string calldata level,
        uint256 expirationDays,
        string calldata ipfsMetadata
    ) external returns (uint256 tokenId);

    /// @notice Verify credential validity
    function verifyCredential(uint256 tokenId)
        external
        view
        returns (bool valid, string memory name, string memory level);

    /// @notice Revoke credential
    function revokeCredential(uint256 tokenId) external;

    /// @notice Get all credentials of user
    function getCredentialsByUser(address user) external view returns (uint256[] memory);

    /// @notice Get credential details
    function getCredential(uint256 tokenId)
        external
        view
        returns (Credential memory);

    /// @notice Check if credential is valid
    function isCredentialValid(uint256 tokenId) external view returns (bool);
}

/// @notice Credential events
interface ICredentialEvents {
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed student,
        string name,
        string level,
        address indexed issuer
    );

    event CredentialRevoked(uint256 indexed tokenId, address indexed revoker);

    event CredentialExpired(uint256 indexed tokenId);
}
