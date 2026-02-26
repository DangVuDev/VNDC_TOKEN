// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./IMarketplace.sol";

/**
 * @title Marketplace
 * @author VNDC Education Platform
 * @notice Full-featured campus e-commerce marketplace for students & teachers
 *         Product listing, ordering, reviews, wishlist, cart, disputes.
 * @dev Module 019 – follows platform conventions (counters start at 1, Ownable)
 */
contract Marketplace is IMarketplace, Ownable, ReentrancyGuard {

    // ─── Counters ───
    uint256 public nextShopId;
    uint256 public nextProductId;
    uint256 public nextOrderId;

    // ─── Platform fee (basis points, 100 = 1%) ───
    uint256 public platformFeeBps;
    address public feeRecipient;
    uint256 public totalPlatformVolume;
    uint256 public totalPlatformReviews;

    // ─── Structs ───
    struct Shop {
        address owner;
        string  shopName;
        string  description;
        string  avatarURI;
        string  category;
        ShopStatus status;
        uint256 totalProducts;
        uint256 totalSales;
        uint256 totalRevenue;
        uint256 totalRating;
        uint256 reviewCount;
        uint256 createdAt;
    }

    struct Product {
        uint256 id;
        uint256 shopId;
        string  name;
        string  description;
        uint256 price;
        uint256 stock;
        uint256 sold;
        string  category;
        string  imageURI;
        string  condition;
        ProductStatus status;
        uint256 totalRating;
        uint256 reviewCount;
        uint256 createdAt;
    }

    struct Order {
        uint256 id;
        address buyer;
        uint256 shopId;
        uint256 totalAmount;
        string  shippingAddress;
        string  note;
        string  trackingCode;
        OrderStatus status;
        uint256 createdAt;
        uint256 updatedAt;
    }

    struct OrderItem {
        uint256 productId;
        uint256 quantity;
        uint256 price;
    }

    struct Review {
        address reviewer;
        uint256 rating;
        string  comment;
        string  imageURI;
        uint256 timestamp;
    }

    struct CartItem {
        uint256 productId;
        uint256 quantity;
    }

    struct Dispute {
        uint256 orderId;
        address opener;
        string  reason;
        string  resolution;
        bool    resolved;
        uint256 openedAt;
        uint256 resolvedAt;
    }

    // ─── Storage ───
    mapping(uint256 => Shop)      public shops;
    mapping(uint256 => Product)   public products;
    mapping(uint256 => Order)     public orders;

    // Shop helpers
    mapping(address => uint256[]) private _ownerShops;
    mapping(uint256 => uint256[]) private _shopProductIds;
    mapping(uint256 => uint256[]) private _shopOrderIds;

    // Order items
    mapping(uint256 => OrderItem[]) private _orderItems;

    // Buyer orders
    mapping(address => uint256[]) private _buyerOrders;

    // Reviews
    mapping(uint256 => Review[]) private _productReviews;
    mapping(bytes32 => bool)     private _hasReviewed; // keccak256(buyer,productId,orderId)

    // Wishlist
    mapping(address => uint256[])          private _wishlist;
    mapping(address => mapping(uint256 => bool)) private _inWishlist;

    // Cart
    mapping(address => CartItem[])          private _cart;
    mapping(address => mapping(uint256 => uint256)) private _cartIndex; // productId => index+1

    // Category index
    mapping(string => uint256[]) private _categoryProducts;

    // Disputes
    mapping(uint256 => Dispute) public disputes;

    // ─── Constructor ───
    constructor() Ownable(msg.sender) {
        nextShopId    = 1;
        nextProductId = 1;
        nextOrderId   = 1;
        platformFeeBps = 250; // 2.5 %
        feeRecipient  = msg.sender;
    }

    // ═══════════════════════════════════════════════
    // ─── Admin ───
    // ═══════════════════════════════════════════════

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high"); // max 10%
        platformFeeBps = _feeBps;
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
    }

    // ═══════════════════════════════════════════════
    // ─── Shop Management ───
    // ═══════════════════════════════════════════════

    function registerShop(
        string calldata shopName,
        string calldata description,
        string calldata avatarURI,
        string calldata category
    ) external returns (uint256 shopId) {
        require(bytes(shopName).length > 0, "Empty name");

        shopId = nextShopId++;
        Shop storage s = shops[shopId];
        s.owner       = msg.sender;
        s.shopName    = shopName;
        s.description = description;
        s.avatarURI   = avatarURI;
        s.category    = category;
        s.status      = ShopStatus.Active;
        s.createdAt   = block.timestamp;

        _ownerShops[msg.sender].push(shopId);

        emit ShopRegistered(msg.sender, shopId, shopName, block.timestamp);
    }

    function updateShop(
        uint256 shopId,
        string calldata shopName,
        string calldata description,
        string calldata avatarURI,
        string calldata category
    ) external {
        Shop storage s = shops[shopId];
        require(s.owner == msg.sender, "Not shop owner");
        require(s.status != ShopStatus.Closed, "Shop closed");

        s.shopName    = shopName;
        s.description = description;
        s.avatarURI   = avatarURI;
        s.category    = category;

        emit ShopUpdated(msg.sender, shopId, block.timestamp);
    }

    function suspendShop(uint256 shopId, string calldata reason) external onlyOwner {
        Shop storage s = shops[shopId];
        require(s.status == ShopStatus.Active, "Not active");
        s.status = ShopStatus.Suspended;
        emit ShopSuspended(shopId, reason, block.timestamp);
    }

    function reactivateShop(uint256 shopId) external onlyOwner {
        Shop storage s = shops[shopId];
        require(s.status == ShopStatus.Suspended, "Not suspended");
        s.status = ShopStatus.Active;
        emit ShopReactivated(shopId, block.timestamp);
    }

    function getShopInfo(uint256 shopId) external view returns (
        address owner_, string memory shopName_, string memory description_,
        string memory avatarURI_, string memory category_,
        ShopStatus status_, uint256 totalProducts_, uint256 totalSales_,
        uint256 totalRevenue_, uint256 totalRating_, uint256 reviewCount_,
        uint256 createdAt_
    ) {
        Shop storage s = shops[shopId];
        return (
            s.owner, s.shopName, s.description,
            s.avatarURI, s.category,
            s.status, s.totalProducts, s.totalSales,
            s.totalRevenue, s.totalRating, s.reviewCount,
            s.createdAt
        );
    }

    function getShopsByOwner(address owner) external view returns (uint256[] memory) {
        return _ownerShops[owner];
    }

    function getTotalShops() external view returns (uint256) {
        return nextShopId - 1;
    }

    function getShopProducts(uint256 shopId) external view returns (uint256[] memory) {
        return _shopProductIds[shopId];
    }

    // ═══════════════════════════════════════════════
    // ─── Product Management ───
    // ═══════════════════════════════════════════════

    function listProduct(
        uint256 shopId,
        string calldata name,
        string calldata description,
        uint256 price,
        uint256 stock,
        string calldata category,
        string calldata imageURI,
        string calldata condition
    ) external returns (uint256 productId) {
        Shop storage s = shops[shopId];
        require(s.owner == msg.sender, "Not shop owner");
        require(s.status == ShopStatus.Active, "Shop not active");
        require(price > 0, "Price must be > 0");
        require(bytes(name).length > 0, "Empty name");

        productId = nextProductId++;
        Product storage p = products[productId];
        p.id          = productId;
        p.shopId      = shopId;
        p.name        = name;
        p.description = description;
        p.price       = price;
        p.stock       = stock;
        p.category    = category;
        p.imageURI    = imageURI;
        p.condition   = condition;
        p.status      = stock > 0 ? ProductStatus.Active : ProductStatus.SoldOut;
        p.createdAt   = block.timestamp;

        s.totalProducts++;
        _shopProductIds[shopId].push(productId);
        _categoryProducts[category].push(productId);

        emit ProductListed(productId, shopId, name, price, block.timestamp);
    }

    function updateProduct(
        uint256 productId,
        string calldata name,
        string calldata description,
        uint256 price,
        uint256 stock,
        string calldata category,
        string calldata imageURI
    ) external {
        Product storage p = products[productId];
        require(shops[p.shopId].owner == msg.sender, "Not owner");
        require(p.status != ProductStatus.Deleted, "Deleted");

        p.name        = name;
        p.description = description;
        p.price       = price;
        p.stock       = stock;
        p.category    = category;
        p.imageURI    = imageURI;

        if (stock == 0 && p.status == ProductStatus.Active) {
            p.status = ProductStatus.SoldOut;
        } else if (stock > 0 && p.status == ProductStatus.SoldOut) {
            p.status = ProductStatus.Active;
        }

        emit ProductUpdated(productId, block.timestamp);
    }

    function changeProductStatus(uint256 productId, ProductStatus newStatus) external {
        Product storage p = products[productId];
        require(shops[p.shopId].owner == msg.sender || owner() == msg.sender, "Not authorized");
        p.status = newStatus;
        emit ProductStatusChanged(productId, newStatus, block.timestamp);
    }

    function getProduct(uint256 productId) external view returns (
        uint256 id_, uint256 shopId_, string memory name_, string memory description_,
        uint256 price_, uint256 stock_, uint256 sold_,
        string memory category_, string memory imageURI_, string memory condition_,
        ProductStatus status_, uint256 totalRating_, uint256 reviewCount_,
        uint256 createdAt_
    ) {
        Product storage p = products[productId];
        return (
            p.id, p.shopId, p.name, p.description,
            p.price, p.stock, p.sold,
            p.category, p.imageURI, p.condition,
            p.status, p.totalRating, p.reviewCount,
            p.createdAt
        );
    }

    function getTotalProducts() external view returns (uint256) {
        return nextProductId - 1;
    }

    function getProductsByCategory(string calldata category) external view returns (uint256[] memory) {
        return _categoryProducts[category];
    }

    function searchProducts(string calldata /* keyword */) external view returns (uint256[] memory) {
        // On-chain full-text search is expensive; return all active products
        // FE should handle client-side filtering based on keyword
        uint256 total = nextProductId - 1;
        uint256 count;
        for (uint256 i = 1; i <= total; i++) {
            if (products[i].status == ProductStatus.Active) count++;
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx;
        for (uint256 i = 1; i <= total; i++) {
            if (products[i].status == ProductStatus.Active) {
                result[idx++] = i;
            }
        }
        return result;
    }

    // ═══════════════════════════════════════════════
    // ─── Order Management ───
    // ═══════════════════════════════════════════════

    function createOrder(
        uint256[] calldata productIds,
        uint256[] calldata quantities,
        string calldata shippingAddress,
        string calldata note
    ) external nonReentrant returns (uint256 orderId) {
        require(productIds.length > 0, "Empty order");
        require(productIds.length == quantities.length, "Length mismatch");

        // All products must belong to same shop
        uint256 shopId = products[productIds[0]].shopId;
        uint256 totalAmount;

        for (uint256 i = 0; i < productIds.length; i++) {
            Product storage p = products[productIds[i]];
            require(p.shopId == shopId, "Multi-shop order not supported");
            require(p.status == ProductStatus.Active, "Product not active");
            require(p.stock >= quantities[i], "Insufficient stock");
            require(quantities[i] > 0, "Zero quantity");

            uint256 lineTotal = p.price * quantities[i];
            totalAmount += lineTotal;

            // Reserve stock
            p.stock -= quantities[i];
            if (p.stock == 0) {
                p.status = ProductStatus.SoldOut;
                emit ProductStatusChanged(productIds[i], ProductStatus.SoldOut, block.timestamp);
            }
        }

        orderId = nextOrderId++;
        Order storage o = orders[orderId];
        o.id              = orderId;
        o.buyer           = msg.sender;
        o.shopId          = shopId;
        o.totalAmount     = totalAmount;
        o.shippingAddress = shippingAddress;
        o.note            = note;
        o.status          = OrderStatus.Pending;
        o.createdAt       = block.timestamp;
        o.updatedAt       = block.timestamp;

        for (uint256 i = 0; i < productIds.length; i++) {
            _orderItems[orderId].push(OrderItem({
                productId: productIds[i],
                quantity:  quantities[i],
                price:     products[productIds[i]].price
            }));
        }

        _buyerOrders[msg.sender].push(orderId);
        _shopOrderIds[shopId].push(orderId);

        emit OrderCreated(orderId, msg.sender, shopId, totalAmount, block.timestamp);
    }

    function confirmOrder(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(shops[o.shopId].owner == msg.sender, "Not shop owner");
        require(o.status == OrderStatus.Pending, "Not pending");
        o.status    = OrderStatus.Confirmed;
        o.updatedAt = block.timestamp;
        emit OrderStatusUpdated(orderId, OrderStatus.Confirmed, block.timestamp);
    }

    function shipOrder(uint256 orderId, string calldata trackingCode) external {
        Order storage o = orders[orderId];
        require(shops[o.shopId].owner == msg.sender, "Not shop owner");
        require(o.status == OrderStatus.Confirmed, "Not confirmed");
        o.trackingCode = trackingCode;
        o.status       = OrderStatus.Shipping;
        o.updatedAt    = block.timestamp;
        emit OrderStatusUpdated(orderId, OrderStatus.Shipping, block.timestamp);
    }

    function confirmDelivery(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Not buyer");
        require(o.status == OrderStatus.Shipping, "Not shipping");
        o.status    = OrderStatus.Delivered;
        o.updatedAt = block.timestamp;
        emit OrderStatusUpdated(orderId, OrderStatus.Delivered, block.timestamp);
    }

    function completeOrder(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender || shops[o.shopId].owner == msg.sender, "Not authorized");
        require(o.status == OrderStatus.Delivered, "Not delivered");
        o.status    = OrderStatus.Completed;
        o.updatedAt = block.timestamp;

        // Update shop stats
        Shop storage s = shops[o.shopId];
        OrderItem[] storage items = _orderItems[orderId];
        for (uint256 i = 0; i < items.length; i++) {
            products[items[i].productId].sold += items[i].quantity;
        }
        s.totalSales++;
        s.totalRevenue += o.totalAmount;
        totalPlatformVolume += o.totalAmount;

        emit OrderStatusUpdated(orderId, OrderStatus.Completed, block.timestamp);
    }

    function cancelOrder(uint256 orderId, string calldata /* reason */) external {
        Order storage o = orders[orderId];
        require(
            o.buyer == msg.sender || shops[o.shopId].owner == msg.sender || owner() == msg.sender,
            "Not authorized"
        );
        require(
            o.status == OrderStatus.Pending || o.status == OrderStatus.Confirmed,
            "Cannot cancel"
        );

        // Restore stock
        OrderItem[] storage items = _orderItems[orderId];
        for (uint256 i = 0; i < items.length; i++) {
            Product storage p = products[items[i].productId];
            p.stock += items[i].quantity;
            if (p.status == ProductStatus.SoldOut && p.stock > 0) {
                p.status = ProductStatus.Active;
                emit ProductStatusChanged(items[i].productId, ProductStatus.Active, block.timestamp);
            }
        }

        o.status    = OrderStatus.Cancelled;
        o.updatedAt = block.timestamp;
        emit OrderStatusUpdated(orderId, OrderStatus.Cancelled, block.timestamp);
    }

    function requestRefund(uint256 orderId, string calldata reason) external {
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Not buyer");
        require(
            o.status == OrderStatus.Confirmed ||
            o.status == OrderStatus.Shipping  ||
            o.status == OrderStatus.Delivered,
            "Cannot refund"
        );
        // We use dispute mechanism for refund flow
        _openDisputeInternal(orderId, msg.sender, reason);
    }

    function approveRefund(uint256 orderId) external {
        Order storage o = orders[orderId];
        require(shops[o.shopId].owner == msg.sender || owner() == msg.sender, "Not authorized");
        require(o.status != OrderStatus.Refunded && o.status != OrderStatus.Cancelled, "Already resolved");

        // Restore stock
        OrderItem[] storage items = _orderItems[orderId];
        for (uint256 i = 0; i < items.length; i++) {
            Product storage p = products[items[i].productId];
            p.stock += items[i].quantity;
            if (p.status == ProductStatus.SoldOut && p.stock > 0) {
                p.status = ProductStatus.Active;
            }
        }

        o.status    = OrderStatus.Refunded;
        o.updatedAt = block.timestamp;
        emit OrderRefunded(orderId, o.totalAmount, "Approved", block.timestamp);
    }

    function getOrder(uint256 orderId) external view returns (
        uint256 id_, address buyer_, uint256 shopId_,
        uint256 totalAmount_, string memory shippingAddress_,
        string memory note_, string memory trackingCode_,
        OrderStatus status_, uint256 createdAt_, uint256 updatedAt_
    ) {
        Order storage o = orders[orderId];
        return (
            o.id, o.buyer, o.shopId,
            o.totalAmount, o.shippingAddress,
            o.note, o.trackingCode,
            o.status, o.createdAt, o.updatedAt
        );
    }

    function getOrderItems(uint256 orderId) external view returns (
        uint256[] memory productIds_,
        uint256[] memory quantities_,
        uint256[] memory prices_
    ) {
        OrderItem[] storage items = _orderItems[orderId];
        uint256 len = items.length;
        productIds_ = new uint256[](len);
        quantities_ = new uint256[](len);
        prices_     = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            productIds_[i] = items[i].productId;
            quantities_[i] = items[i].quantity;
            prices_[i]     = items[i].price;
        }
    }

    function getBuyerOrders(address buyer) external view returns (uint256[] memory) {
        return _buyerOrders[buyer];
    }

    function getShopOrders(uint256 shopId) external view returns (uint256[] memory) {
        return _shopOrderIds[shopId];
    }

    function getTotalOrders() external view returns (uint256) {
        return nextOrderId - 1;
    }

    // ═══════════════════════════════════════════════
    // ─── Reviews & Ratings ───
    // ═══════════════════════════════════════════════

    function submitReview(
        uint256 productId,
        uint256 orderId,
        uint256 rating,
        string calldata comment,
        string calldata imageURI
    ) external {
        require(rating >= 1 && rating <= 5, "Rating 1-5");
        Order storage o = orders[orderId];
        require(o.buyer == msg.sender, "Not buyer");
        require(o.status == OrderStatus.Completed || o.status == OrderStatus.Delivered, "Not completed");

        bytes32 key = keccak256(abi.encodePacked(msg.sender, productId, orderId));
        require(!_hasReviewed[key], "Already reviewed");
        _hasReviewed[key] = true;

        _productReviews[productId].push(Review({
            reviewer:  msg.sender,
            rating:    rating,
            comment:   comment,
            imageURI:  imageURI,
            timestamp: block.timestamp
        }));

        Product storage p = products[productId];
        p.totalRating += rating;
        p.reviewCount++;

        Shop storage s = shops[p.shopId];
        s.totalRating += rating;
        s.reviewCount++;
        totalPlatformReviews++;

        emit ReviewSubmitted(productId, msg.sender, rating, block.timestamp);
    }

    function getProductReviews(uint256 productId) external view returns (
        address[] memory reviewers_,
        uint256[] memory ratings_,
        string[]  memory comments_,
        string[]  memory imageURIs_,
        uint256[] memory timestamps_
    ) {
        Review[] storage reviews = _productReviews[productId];
        uint256 len = reviews.length;
        reviewers_  = new address[](len);
        ratings_    = new uint256[](len);
        comments_   = new string[](len);
        imageURIs_  = new string[](len);
        timestamps_ = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            reviewers_[i]  = reviews[i].reviewer;
            ratings_[i]    = reviews[i].rating;
            comments_[i]   = reviews[i].comment;
            imageURIs_[i]  = reviews[i].imageURI;
            timestamps_[i] = reviews[i].timestamp;
        }
    }

    // ═══════════════════════════════════════════════
    // ─── Wishlist / Favorites ───
    // ═══════════════════════════════════════════════

    function addToWishlist(uint256 productId) external {
        require(!_inWishlist[msg.sender][productId], "Already in wishlist");
        require(products[productId].id != 0, "Product not found");
        _inWishlist[msg.sender][productId] = true;
        _wishlist[msg.sender].push(productId);
        emit ProductAddedToWishlist(msg.sender, productId, block.timestamp);
    }

    function removeFromWishlist(uint256 productId) external {
        require(_inWishlist[msg.sender][productId], "Not in wishlist");
        _inWishlist[msg.sender][productId] = false;
        // Remove from array
        uint256[] storage list = _wishlist[msg.sender];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == productId) {
                list[i] = list[list.length - 1];
                list.pop();
                break;
            }
        }
        emit ProductRemovedFromWishlist(msg.sender, productId, block.timestamp);
    }

    function getWishlist(address user) external view returns (uint256[] memory) {
        return _wishlist[user];
    }

    // ═══════════════════════════════════════════════
    // ─── Cart ───
    // ═══════════════════════════════════════════════

    function addToCart(uint256 productId, uint256 quantity) external {
        require(products[productId].id != 0, "Product not found");
        require(quantity > 0, "Zero quantity");

        uint256 idx = _cartIndex[msg.sender][productId];
        if (idx > 0) {
            _cart[msg.sender][idx - 1].quantity += quantity;
        } else {
            _cart[msg.sender].push(CartItem({productId: productId, quantity: quantity}));
            _cartIndex[msg.sender][productId] = _cart[msg.sender].length; // 1-based
        }
    }

    function removeFromCart(uint256 productId) external {
        uint256 idx = _cartIndex[msg.sender][productId];
        require(idx > 0, "Not in cart");
        CartItem[] storage cart = _cart[msg.sender];
        uint256 last = cart.length - 1;
        if (idx - 1 != last) {
            cart[idx - 1] = cart[last];
            _cartIndex[msg.sender][cart[idx - 1].productId] = idx;
        }
        cart.pop();
        delete _cartIndex[msg.sender][productId];
    }

    function updateCartQuantity(uint256 productId, uint256 quantity) external {
        uint256 idx = _cartIndex[msg.sender][productId];
        require(idx > 0, "Not in cart");
        require(quantity > 0, "Use removeFromCart");
        _cart[msg.sender][idx - 1].quantity = quantity;
    }

    function getCart(address user) external view returns (
        uint256[] memory productIds_,
        uint256[] memory quantities_
    ) {
        CartItem[] storage cart = _cart[user];
        uint256 len = cart.length;
        productIds_ = new uint256[](len);
        quantities_ = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            productIds_[i] = cart[i].productId;
            quantities_[i] = cart[i].quantity;
        }
    }

    function clearCart() external {
        CartItem[] storage cart = _cart[msg.sender];
        for (uint256 i = 0; i < cart.length; i++) {
            delete _cartIndex[msg.sender][cart[i].productId];
        }
        delete _cart[msg.sender];
    }

    // ═══════════════════════════════════════════════
    // ─── Disputes ───
    // ═══════════════════════════════════════════════

    function openDispute(uint256 orderId, string calldata reason) external {
        Order storage o = orders[orderId];
        require(
            o.buyer == msg.sender || shops[o.shopId].owner == msg.sender,
            "Not party"
        );
        _openDisputeInternal(orderId, msg.sender, reason);
    }

    function _openDisputeInternal(uint256 orderId, address opener, string memory reason) internal {
        require(!disputes[orderId].resolved, "Already resolved");
        require(disputes[orderId].openedAt == 0, "Dispute exists");

        Order storage o = orders[orderId];
        o.status    = OrderStatus.Disputed;
        o.updatedAt = block.timestamp;

        disputes[orderId] = Dispute({
            orderId:    orderId,
            opener:     opener,
            reason:     reason,
            resolution: "",
            resolved:   false,
            openedAt:   block.timestamp,
            resolvedAt: 0
        });

        emit DisputeOpened(orderId, opener, reason, block.timestamp);
        emit OrderStatusUpdated(orderId, OrderStatus.Disputed, block.timestamp);
    }

    function resolveDispute(uint256 orderId, string calldata resolution, bool refundBuyer) external onlyOwner {
        Dispute storage d = disputes[orderId];
        require(d.openedAt > 0, "No dispute");
        require(!d.resolved, "Already resolved");

        d.resolution = resolution;
        d.resolved   = true;
        d.resolvedAt = block.timestamp;

        Order storage o = orders[orderId];
        if (refundBuyer) {
            // Restore stock
            OrderItem[] storage items = _orderItems[orderId];
            for (uint256 i = 0; i < items.length; i++) {
                Product storage p = products[items[i].productId];
                p.stock += items[i].quantity;
                if (p.status == ProductStatus.SoldOut && p.stock > 0) {
                    p.status = ProductStatus.Active;
                }
            }
            o.status = OrderStatus.Refunded;
            emit OrderRefunded(orderId, o.totalAmount, resolution, block.timestamp);
        } else {
            o.status = OrderStatus.Completed;
        }
        o.updatedAt = block.timestamp;

        emit DisputeResolved(orderId, resolution, block.timestamp);
        emit OrderStatusUpdated(orderId, o.status, block.timestamp);
    }

    // ═══════════════════════════════════════════════
    // ─── Platform Stats ───
    // ═══════════════════════════════════════════════

    function getPlatformStats() external view returns (
        uint256 totalShops_,
        uint256 totalProducts_,
        uint256 totalOrders_,
        uint256 totalVolume_,
        uint256 totalReviews_
    ) {
        return (
            nextShopId - 1,
            nextProductId - 1,
            nextOrderId - 1,
            totalPlatformVolume,
            totalPlatformReviews
        );
    }
}
