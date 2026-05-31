// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";

contract MarketplaceManager is Ownable, AccessControl, Pausable, ReentrancyGuard, ERC1155Holder {
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
        require(price > 0, "zero price");
        require(listings[listingId].id == bytes32(0), "listing exists");

        IERC1155(nftContract).safeTransferFrom(seller, address(this), tokenId, amount, "");

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

    function cancelListing(bytes32 listingId) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Listing storage listing = _requireActiveListing(listingId);
        listing.active = false;

        IERC1155(listing.nftContract).safeTransferFrom(address(this), listing.seller, listing.tokenId, listing.amount, "");

        emit ListingCancelled(listingId, listing.seller);
    }

    function finalizeSale(bytes32 listingId, bytes32 purchaseId, address buyer, bytes32 paymentTxHash) external onlyRole(OPERATOR_ROLE) nonReentrant whenNotPaused {
        Listing storage listing = _requireActiveListing(listingId);
        require(purchaseId != bytes32(0), "zero purchase id");
        require(buyer != address(0), "zero buyer");

        IERC20 paymentToken = IERC20(listing.paymentToken);
        require(paymentToken.balanceOf(address(this)) >= listing.price, "insufficient contract balance");

        listing.active = false;

        require(paymentToken.transfer(listing.seller, listing.price), "token payout failed");
        IERC1155(listing.nftContract).safeTransferFrom(address(this), buyer, listing.tokenId, listing.amount, "");

        emit SaleFinalized(listingId, purchaseId, buyer, listing.seller, listing.price, paymentTxHash);
    }

    function _requireActiveListing(bytes32 listingId) internal view returns (Listing storage listing) {
        listing = listings[listingId];
        require(listing.id != bytes32(0), "listing not found");
        require(listing.active, "listing inactive");
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC1155Holder) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
