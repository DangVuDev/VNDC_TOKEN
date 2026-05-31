// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NFTMarketplace721 is Ownable, ReentrancyGuard {
    struct Listing {
        bytes32 id;
        address seller;
        address nftContract;
        uint256 tokenId;
        address paymentToken;
        uint256 price;
        bool active;
        uint64 createdAt;
    }

    mapping(bytes32 => Listing) public listings;

    event Listed(
        bytes32 indexed listingId,
        address indexed seller,
        address indexed nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    );
    event ListingPriceUpdated(bytes32 indexed listingId, address indexed seller, uint256 oldPrice, uint256 newPrice);
    event ListingCancelled(bytes32 indexed listingId, address indexed seller);
    event Purchased(bytes32 indexed listingId, address indexed buyer, uint256 price);

    constructor() Ownable(msg.sender) {}

    function list(
        bytes32 listingId,
        address seller,
        address nftContract,
        uint256 tokenId,
        address paymentToken,
        uint256 price
    ) external nonReentrant {
        require(listingId != bytes32(0), "zero listing id");
        require(seller != address(0), "zero seller");
        require(nftContract != address(0), "zero nft contract");
        require(paymentToken != address(0), "zero payment token");
        require(listings[listingId].id == bytes32(0), "listing exists");

        // Allow contract owner (relayer) to escrow NFT on behalf of seller.
        if (msg.sender != seller) {
            require(msg.sender == owner(), "forbidden");
        }

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "not token owner");

        nft.transferFrom(msg.sender, address(this), tokenId);

        listings[listingId] = Listing({
            id: listingId,
            seller: seller,
            nftContract: nftContract,
            tokenId: tokenId,
            paymentToken: paymentToken,
            price: price,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        emit Listed(listingId, seller, nftContract, tokenId, paymentToken, price);
    }

    function updatePrice(bytes32 listingId, uint256 newPrice) external nonReentrant {
        Listing storage listing = _requireActiveListing(listingId);
        require(msg.sender == listing.seller || msg.sender == owner(), "forbidden");
        require(newPrice > 0, "price must be > 0");

        uint256 oldPrice = listing.price;
        listing.price = newPrice;

        emit ListingPriceUpdated(listingId, listing.seller, oldPrice, newPrice);
    }

    function cancel(bytes32 listingId) external nonReentrant {
        Listing storage listing = _requireActiveListing(listingId);
        require(msg.sender == listing.seller || msg.sender == owner(), "forbidden");

        listing.active = false;
        IERC721(listing.nftContract).transferFrom(address(this), listing.seller, listing.tokenId);

        emit ListingCancelled(listingId, listing.seller);
    }

    function buy(bytes32 listingId) external nonReentrant {
        _buy(listingId, msg.sender, true);
    }

    function buyFor(bytes32 listingId, address buyer) external onlyOwner nonReentrant {
        // Payment is already settled off-chain by backend relayer flow.
        _buy(listingId, buyer, false);
    }

    function _buy(bytes32 listingId, address buyer, bool withOnchainPayment) internal {
        Listing storage listing = _requireActiveListing(listingId);
        require(buyer != address(0), "zero buyer");
        require(buyer != listing.seller, "seller cannot buy");
        require(listing.price > 0, "listing not for sale");

        listing.active = false;

        if (withOnchainPayment) {
            IERC20 token = IERC20(listing.paymentToken);
            require(token.transferFrom(buyer, listing.seller, listing.price), "payment failed");
        }
        IERC721(listing.nftContract).transferFrom(address(this), buyer, listing.tokenId);

        emit Purchased(listingId, buyer, listing.price);
    }

    function _requireActiveListing(bytes32 listingId) internal view returns (Listing storage listing) {
        listing = listings[listingId];
        require(listing.id != bytes32(0), "listing not found");
        require(listing.active, "listing inactive");
    }
}
