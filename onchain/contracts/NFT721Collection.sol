// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract NFT721Collection is ERC721URIStorage, Ownable, EIP712, Nonces {
    bytes32 private constant APPROVAL_TYPEHASH =
        keccak256("NFTApproval(address owner,address spender,uint256 tokenId,uint256 nonce,uint256 deadline)");

    uint256 private _nextTokenId;

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);

    constructor(string memory name_, string memory symbol_) ERC721(name_, symbol_) Ownable(msg.sender) EIP712(name_, "1") {}

    function mint(address to, string calldata tokenURI_) external onlyOwner returns (uint256 tokenId) {
        require(to != address(0), "zero recipient");

        tokenId = ++_nextTokenId;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        emit NFTMinted(to, tokenId, tokenURI_);
    }

    function approveWithSignature(
        address owner,
        address spender,
        uint256 tokenId,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(block.timestamp <= deadline, "approval expired");
        require(ownerOf(tokenId) == owner, "not token owner");

        uint256 nonce = _useNonce(owner);
        bytes32 structHash = keccak256(abi.encode(APPROVAL_TYPEHASH, owner, spender, tokenId, nonce, deadline));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), signature);
        require(signer == owner, "invalid approval signature");

        _approve(spender, tokenId, owner);
    }
}
