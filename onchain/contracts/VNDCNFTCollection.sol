// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract VNDCNFTCollection is ERC1155, ERC1155Supply, Ownable {
    mapping(uint256 => string) private tokenURIs;

    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 amount, string tokenURI);
    event TokenURIUpdated(uint256 indexed tokenId, string tokenURI);

    constructor(string memory baseURI) ERC1155(baseURI) Ownable(msg.sender) {}

    function mint(address to, uint256 tokenId, uint256 amount, string calldata tokenURI_) external onlyOwner {
        require(to != address(0), "zero recipient");
        require(amount > 0, "zero amount");

        _mint(to, tokenId, amount, "");
        if (bytes(tokenURI_).length > 0) {
            tokenURIs[tokenId] = tokenURI_;
            emit TokenURIUpdated(tokenId, tokenURI_);
        }

        emit TokenMinted(to, tokenId, amount, tokenURI_);
    }

    function setTokenURI(uint256 tokenId, string calldata tokenURI_) external onlyOwner {
        require(exists(tokenId), "token not minted");
        tokenURIs[tokenId] = tokenURI_;
        emit TokenURIUpdated(tokenId, tokenURI_);
    }

    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory tokenURI_ = tokenURIs[tokenId];
        if (bytes(tokenURI_).length > 0) {
            return tokenURI_;
        }
        return super.uri(tokenId);
    }

    function _update(address from, address to, uint256[] memory ids, uint256[] memory values) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}