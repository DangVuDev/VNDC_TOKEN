// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title VNDC_Credential
 * @notice NFT-based credential system for issuing, verifying, and revoking diplomas/badges
 * @dev ERC-721 with role-based access control and revocation mechanism
 * @author VNDC Team
 */
contract VNDC_Credential is ERC721, ERC721Enumerable, AccessControl, Pausable {
    using Counters for Counters.Counter;

    // ===== ROLES =====
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant REVOKER_ROLE = keccak256("REVOKER_ROLE");

    // ===== STATE VARIABLES =====
    Counters.Counter private _tokenIdCounter;
    
    mapping(uint256 => string) public tokenURIs;          // tokenId => IPFS URI
    mapping(uint256 => bool) public revoked;              // tokenId => isRevoked
    mapping(uint256 => uint256) public issuedAtBlock;     // tokenId => issuedAtBlock (audit)
    mapping(uint256 => address) public issuedBy;          // tokenId => issuer address
    mapping(uint256 => uint256) public issuedAtTime;      // tokenId => issuedAt (timestamp)
    mapping(address => uint256[]) public holderTokens;    // holder => array of token IDs

    // ===== EVENTS =====
    event CredentialIssued(
        uint256 indexed tokenId,
        address indexed holder,
        address indexed issuer,
        string uri,
        uint256 timestamp
    );

    event CredentialRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        string reason,
        uint256 timestamp
    );

    event CredentialReinstated(
        uint256 indexed tokenId,
        address indexed reinstate,
        uint256 timestamp
    );

    event CredentialMetadataUpdated(
        uint256 indexed tokenId,
        string newUri,
        uint256 timestamp
    );

    // ===== CONSTRUCTOR =====
    /**
     * @notice Initialize the credential contract
     * @dev Sets up roles and initial configuration
     */
    constructor() ERC721("VNDC Credentials", "VNDCCRED") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ISSUER_ROLE, msg.sender);
        _setupRole(REVOKER_ROLE, msg.sender);
    }

    // ===== ISSUER FUNCTIONS =====

    /**
     * @notice Issue a credential (diploma, badge, certificate) to a student
     * @param to The student's wallet address
     * @param uri IPFS URI pointing to credential metadata JSON
     * @return tokenId The ID of the newly minted NFT
     * @dev Only ISSUER_ROLE can call this function
     * @dev Emits CredentialIssued event
     */
    function issueCredential(
        address to,
        string memory uri
    ) public onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256) {
        require(to != address(0), "Cannot issue to zero address");
        require(bytes(uri).length > 0, "URI cannot be empty");

        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();

        _safeMint(to, tokenId);
        tokenURIs[tokenId] = uri;
        issuedAtBlock[tokenId] = block.number;
        issuedAtTime[tokenId] = block.timestamp;
        issuedBy[tokenId] = msg.sender;
        holderTokens[to].push(tokenId);

        emit CredentialIssued(
            tokenId,
            to,
            msg.sender,
            uri,
            block.timestamp
        );

        return tokenId;
    }

    /**
     * @notice Batch issue credentials to multiple students
     * @param recipients Array of student addresses
     * @param uris Array of IPFS URIs (same length as recipients)
     * @return Array of newly created token IDs
     * @dev More gas-efficient than calling issueCredential multiple times
     * @dev Max batch size: 100 (prevent gas limit exceeded)
     */
    function batchIssueCredentials(
        address[] calldata recipients,
        string[] calldata uris
    ) public onlyRole(ISSUER_ROLE) whenNotPaused returns (uint256[] memory) {
        require(
            recipients.length == uris.length,
            "Recipients and URIs length mismatch"
        );
        require(recipients.length <= 100, "Batch size too large (max 100)");

        uint256[] memory tokenIds = new uint256[](recipients.length);

        for (uint256 i = 0; i < recipients.length; i++) {
            tokenIds[i] = issueCredential(recipients[i], uris[i]);
        }

        return tokenIds;
    }

    /**
     * @notice Revoke a credential (due to fraud, error, etc.)
     * @param tokenId The ID of the credential to revoke
     * @param reason Human-readable reason for revocation
     * @dev Only REVOKER_ROLE can call this
     * @dev Credential remains on-chain but marked invalid
     * @dev Emits CredentialRevoked event
     */
    function revokeCredential(
        uint256 tokenId,
        string memory reason
    ) public onlyRole(REVOKER_ROLE) {
        require(_exists(tokenId), "Credential does not exist");
        require(!revoked[tokenId], "Credential already revoked");

        revoked[tokenId] = true;

        emit CredentialRevoked(tokenId, msg.sender, reason, block.timestamp);
    }

    /**
     * @notice Reinstate a previously revoked credential
     * @param tokenId The ID of the credential to reinstate
     * @dev Only REVOKER_ROLE can call this (in case of false revocation)
     * @dev Emits CredentialReinstated event
     */
    function reinstateCredential(uint256 tokenId)
        public
        onlyRole(REVOKER_ROLE)
    {
        require(_exists(tokenId), "Credential does not exist");
        require(revoked[tokenId], "Credential is not revoked");

        revoked[tokenId] = false;

        emit CredentialReinstated(tokenId, msg.sender, block.timestamp);
    }

    /**
     * @notice Update the metadata URI for a credential
     * @param tokenId The ID of the credential
     * @param newUri The new IPFS URI
     * @dev Only ISSUER_ROLE can call this
     * @dev Useful for fixing metadata errors
     */
    function updateCredentialURI(uint256 tokenId, string memory newUri)
        public
        onlyRole(ISSUER_ROLE)
    {
        require(_exists(tokenId), "Credential does not exist");
        require(bytes(newUri).length > 0, "URI cannot be empty");

        tokenURIs[tokenId] = newUri;

        emit CredentialMetadataUpdated(tokenId, newUri, block.timestamp);
    }

    // ===== VERIFICATION FUNCTIONS =====

    /**
     * @notice Check if a credential is valid (exists and not revoked)
     * @param tokenId The ID of the credential to check
     * @return true if credential exists and is not revoked
     */
    function isCredentialValid(uint256 tokenId)
        public
        view
        returns (bool)
    {
        return _exists(tokenId) && !revoked[tokenId];
    }

    /**
     * @notice Get the complete status of a credential
     * @param tokenId The ID of the credential
     * @return holder The student's wallet address
     * @return uri The IPFS metadata URI
     * @return valid Whether credential is currently valid
     * @return revokedFlag Whether credential was revoked
     * @return issuer The address that issued the credential
     * @return issuedAtBlockNum The block number when issued (audit trail)
     */
    function getCredential(uint256 tokenId)
        public
        view
        returns (
            address holder,
            string memory uri,
            bool valid,
            bool revokedFlag,
            address issuer,
            uint256 issuedAtBlockNum
        )
    {
        require(_exists(tokenId), "Credential does not exist");

        holder = ownerOf(tokenId);
        uri = tokenURIs[tokenId];
        valid = !revoked[tokenId];
        revokedFlag = revoked[tokenId];
        issuer = issuedBy[tokenId];
        issuedAtBlockNum = issuedAtBlock[tokenId];
    }

    /**
     * @notice Get extended credential information including timestamp
     * @param tokenId The ID of the credential
     * @return holder The student's wallet address
     * @return uri The IPFS metadata URI
     * @return valid Whether credential is currently valid
     * @return issuer The address that issued the credential
     * @return issuedBlock The block number when issued
     * @return issuedTime The timestamp when issued
     */
    function getCredentialExtended(uint256 tokenId)
        public
        view
        returns (
            address holder,
            string memory uri,
            bool valid,
            address issuer,
            uint256 issuedBlock,
            uint256 issuedTime
        )
    {
        require(_exists(tokenId), "Credential does not exist");

        holder = ownerOf(tokenId);
        uri = tokenURIs[tokenId];
        valid = !revoked[tokenId];
        issuer = issuedBy[tokenId];
        issuedBlock = issuedAtBlock[tokenId];
        issuedTime = issuedAtTime[tokenId];
    }

    /**
     * @notice Get all credentials held by an address
     * @param holder The student's wallet address
     * @return Array of token IDs
     */
    function getCredentialsForHolder(address holder)
        public
        view
        returns (uint256[] memory)
    {
        return holderTokens[holder];
    }

    /**
     * @notice Get count of credentials held by an address
     * @param holder The student's wallet address
     * @return Number of credentials
     */
    function getCredentialCountForHolder(address holder)
        public
        view
        returns (uint256)
    {
        return holderTokens[holder].length;
    }

    /**
     * @notice Get total credentials issued
     * @return The total count of credentials minted
     */
    function getTotalCredentialsIssued()
        public
        view
        returns (uint256)
    {
        return _tokenIdCounter.current();
    }

    /**
     * @notice Get token URI (metadata) for a credential
     * @param tokenId The ID of the credential
     * @return IPFS URI pointing to metadata JSON
     * @dev Override of ERC721.tokenURI()
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(tokenId), "Token does not exist");
        return tokenURIs[tokenId];
    }

    // ===== ADMIN FUNCTIONS =====

    /**
     * @notice Pause credential issuance (emergency)
     * @dev Only DEFAULT_ADMIN_ROLE can call
     */
    function pause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume credential issuance
     * @dev Only DEFAULT_ADMIN_ROLE can call
     */
    function unpause() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ===== INTERNAL FUNCTIONS =====

    /**
     * @notice Override to prevent credential transfers (Soulbound NFTs)
     * @dev Students keep their credentials; cannot be traded
     * @dev Allow minting (from == address(0)) and burning (to == address(0))
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721, ERC721Enumerable) whenNotPaused {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);

        // Prevent transfers between addresses (only allow mint/burn)
        require(
            from == address(0) || to == address(0),
            "Credentials are non-transferable (Soulbound)"
        );
    }

    /**
     * @notice Override supportsInterface for multiple inheritance
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // ===== REQUIRED OVERRIDES =====

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._burn(tokenId);
    }
}
