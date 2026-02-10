// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Burnable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import "./ICredentials.sol";

/// @title CredentialNFT
/// @notice ERC-721 NFT for representing educational credentials
/// @dev Extends ERC721 with metadata URI storage and burning capabilities
contract CredentialNFT is
    ERC721,
    ERC721URIStorage,
    ERC721Burnable,
    Ownable
{
    uint256 private _tokenIdCounter;
    mapping(address => uint256[]) private _userTokens;
    mapping(uint256 => bool) private _tokenExists;

    event TokenMinted(uint256 indexed tokenId, address indexed to, string uri);
    event TokenBurned(uint256 indexed tokenId);

    constructor() ERC721("VNDC Credentials", "VNDC-CRED") Ownable(msg.sender) {}

    /// @notice Mint new credential NFT
    /// @param to Recipient address
    /// @param credentialURI IPFS/metadata URI
    /// @return tokenId The minted token ID
    function mint(address to, string calldata credentialURI)
        external
        onlyOwner
        returns (uint256)
    {
        require(to != address(0), "CredentialNFT: Cannot mint to zero address");
        require(bytes(credentialURI).length > 0, "CredentialNFT: URI cannot be empty");

        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, credentialURI);
        _tokenExists[tokenId] = true;
        _userTokens[to].push(tokenId);

        emit TokenMinted(tokenId, to, credentialURI);
        return tokenId;
    }

    /// @notice Burn credential NFT
    /// @param tokenId Token ID to burn
    function burn(uint256 tokenId) public override(ERC721Burnable) {
        require(_tokenExists[tokenId], "CredentialNFT: Token does not exist");
        
        address owner = ownerOf(tokenId);
        _tokenExists[tokenId] = false;
        
        // Remove from user tokens array
        uint256[] storage tokens = _userTokens[owner];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == tokenId) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }

        super.burn(tokenId);
        emit TokenBurned(tokenId);
    }

    /// @notice Get all tokens owned by address
    /// @param owner Owner address
    /// @return Array of token IDs
    function tokensOfOwner(address owner) external view returns (uint256[] memory) {
        require(owner != address(0), "CredentialNFT: Invalid address");
        return _userTokens[owner];
    }

    /// @notice Check if token exists
    /// @param tokenId Token ID
    /// @return True if token exists
    function exists(uint256 tokenId) external view  returns (bool) {
        return _tokenExists[tokenId];
    }

    // ============ Override Compatibility Functions ============

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value) internal override(ERC721) {
        super._increaseBalance(account, value);
    }
}
