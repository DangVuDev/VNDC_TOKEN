// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";

contract MarketplaceManager is Ownable, AccessControl, Pausable, ReentrancyGuard, ERC1155Holder, ERC721Holder {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    struct Listing {
        bytes32 id;
        address seller;
        address nftContract;
        address paymentToken;
        uint256 tokenId;
        uint256 amount;
        uint256 price;
        bool active;
        uint64 createdAt;
    }

    mapping(bytes32 => Listing) public listings;

    event ListingCreated(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        uint256 amount,
        uint256 price,
        address paymentToken
    );
    event ListingCancelled(bytes32 indexed listingId, address indexed seller);
    event ListingPriceUpdated(bytes32 indexed listingId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    event SaleFinalized(
        bytes32 indexed listingId,
        bytes32 indexed purchaseId,
        address indexed buyer,
        address seller,
        uint256 price,
        bytes32 paymentTxHash
    );

    constructor() Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
    }

    function createListing(
        bytes32 listingId,
        address seller,
        address nftContract,
        address paymentToken,
        uint256 tokenId,
        uint256 amount,
        uint256 price
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(listingId != bytes32(0), "zero listing id");
        require(seller != address(0), "zero seller");
        require(nftContract != address(0), "zero nft contract");
        require(paymentToken != address(0), "zero payment token");
        require(amount > 0, "zero amount");
        require(listings[listingId].id == bytes32(0), "listing exists");

        _escrowNFT(seller, nftContract, tokenId, amount);

        listings[listingId] = Listing({
            id: listingId,
            seller: seller,
            nftContract: nftContract,
            paymentToken: paymentToken,
            tokenId: tokenId,
            amount: amount,
            price: price,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        emit ListingCreated(listingId, seller, nftContract, tokenId, amount, price, paymentToken);
    }

    function updateListingPrice(bytes32 listingId, uint256 newPrice) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        require(newPrice > 0, "zero price");
        Listing storage listing = _requireActiveListing(listingId);
        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(listingId, listing.seller, oldPrice, newPrice);
    }

    function cancelListing(bytes32 listingId) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Listing storage listing = _requireActiveListing(listingId);
        listing.active = false;

        _releaseNFT(listing.seller, listing.nftContract, listing.tokenId, listing.amount);

        emit ListingCancelled(listingId, listing.seller);
    }

    function finalizeSale(bytes32 listingId, bytes32 purchaseId, address buyer, bytes32 paymentTxHash) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Listing storage listing = _requireActiveListing(listingId);
        require(purchaseId != bytes32(0), "zero purchase id");
        require(buyer != address(0), "zero buyer");
        require(listing.price > 0, "listing not for sale");

        listing.active = false;

        _releaseNFT(buyer, listing.nftContract, listing.tokenId, listing.amount);

        emit SaleFinalized(listingId, purchaseId, buyer, listing.seller, listing.price, paymentTxHash);
    }

    function _requireActiveListing(bytes32 listingId) internal view returns (Listing storage listing) {
        listing = listings[listingId];
        require(listing.id != bytes32(0), "listing not found");
        require(listing.active, "listing inactive");
    }

    function _escrowNFT(address seller, address nftContract, uint256 tokenId, uint256 amount) internal {
        try IERC721(nftContract).ownerOf(tokenId) returns (address owner) {
            require(amount == 1, "erc721 amount must be 1");
            require(owner == seller || owner == msg.sender, "not nft owner");
            IERC721(nftContract).safeTransferFrom(owner, address(this), tokenId);
        } catch {
            IERC1155(nftContract).safeTransferFrom(seller, address(this), tokenId, amount, "");
        }
    }

    function _releaseNFT(address to, address nftContract, uint256 tokenId, uint256 amount) internal {
        try IERC721(nftContract).ownerOf(tokenId) returns (address owner) {
            require(owner == address(this), "nft not escrowed");
            IERC721(nftContract).safeTransferFrom(address(this), to, tokenId);
        } catch {
            IERC1155(nftContract).safeTransferFrom(address(this), to, tokenId, amount, "");
        }
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
