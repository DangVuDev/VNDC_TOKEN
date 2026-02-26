// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMarketplace
 * @notice Interface for the Campus Marketplace — a full-featured e-commerce
 *         platform for students and teachers to buy/sell products & services.
 *         Inspired by Shopee / TikTok Shop functionality.
 */
interface IMarketplace {
    // ─── Enums ───
    enum ProductStatus { Active, SoldOut, Paused, Deleted }
    enum OrderStatus   { Pending, Confirmed, Shipping, Delivered, Completed, Cancelled, Refunded, Disputed }
    enum ShopStatus    { Active, Suspended, Closed }

    // ─── Events: Shop ───
    event ShopRegistered(address indexed owner, uint256 indexed shopId, string shopName, uint256 timestamp);
    event ShopUpdated(address indexed owner, uint256 indexed shopId, uint256 timestamp);
    event ShopSuspended(uint256 indexed shopId, string reason, uint256 timestamp);
    event ShopReactivated(uint256 indexed shopId, uint256 timestamp);

    // ─── Events: Product ───
    event ProductListed(uint256 indexed productId, uint256 indexed shopId, string name, uint256 price, uint256 timestamp);
    event ProductUpdated(uint256 indexed productId, uint256 timestamp);
    event ProductStatusChanged(uint256 indexed productId, ProductStatus newStatus, uint256 timestamp);

    // ─── Events: Order ───
    event OrderCreated(uint256 indexed orderId, address indexed buyer, uint256 indexed shopId, uint256 totalAmount, uint256 timestamp);
    event OrderStatusUpdated(uint256 indexed orderId, OrderStatus newStatus, uint256 timestamp);
    event OrderRefunded(uint256 indexed orderId, uint256 amount, string reason, uint256 timestamp);

    // ─── Events: Review / Wishlist / Cart ───
    event ReviewSubmitted(uint256 indexed productId, address indexed reviewer, uint256 rating, uint256 timestamp);
    event ProductAddedToWishlist(address indexed user, uint256 indexed productId, uint256 timestamp);
    event ProductRemovedFromWishlist(address indexed user, uint256 indexed productId, uint256 timestamp);
    event DisputeOpened(uint256 indexed orderId, address indexed opener, string reason, uint256 timestamp);
    event DisputeResolved(uint256 indexed orderId, string resolution, uint256 timestamp);

    // ─── Shop Management ───
    function registerShop(string calldata shopName, string calldata description, string calldata avatarURI, string calldata category) external returns (uint256 shopId);
    function updateShop(uint256 shopId, string calldata shopName, string calldata description, string calldata avatarURI, string calldata category) external;
    function getShopInfo(uint256 shopId) external view returns (
        address owner, string memory shopName, string memory description,
        string memory avatarURI, string memory category,
        ShopStatus status, uint256 totalProducts, uint256 totalSales,
        uint256 totalRevenue, uint256 totalRating, uint256 reviewCount,
        uint256 createdAt
    );
    function getShopsByOwner(address owner) external view returns (uint256[] memory);
    function getTotalShops() external view returns (uint256);
    function suspendShop(uint256 shopId, string calldata reason) external;
    function reactivateShop(uint256 shopId) external;
    function getShopProducts(uint256 shopId) external view returns (uint256[] memory);

    // ─── Product Management ───
    function listProduct(
        uint256 shopId, string calldata name, string calldata description,
        uint256 price, uint256 stock, string calldata category,
        string calldata imageURI, string calldata condition
    ) external returns (uint256 productId);
    function updateProduct(
        uint256 productId, string calldata name, string calldata description,
        uint256 price, uint256 stock, string calldata category,
        string calldata imageURI
    ) external;
    function changeProductStatus(uint256 productId, ProductStatus newStatus) external;
    function getProduct(uint256 productId) external view returns (
        uint256 id, uint256 shopId, string memory name, string memory description,
        uint256 price, uint256 stock, uint256 sold,
        string memory category, string memory imageURI, string memory condition,
        ProductStatus status, uint256 totalRating, uint256 reviewCount,
        uint256 createdAt
    );
    function getTotalProducts() external view returns (uint256);
    function getProductsByCategory(string calldata category) external view returns (uint256[] memory);
    function searchProducts(string calldata keyword) external view returns (uint256[] memory);

    // ─── Order Management ───
    function createOrder(uint256[] calldata productIds, uint256[] calldata quantities, string calldata shippingAddress, string calldata note) external returns (uint256 orderId);
    function confirmOrder(uint256 orderId) external;
    function shipOrder(uint256 orderId, string calldata trackingCode) external;
    function confirmDelivery(uint256 orderId) external;
    function completeOrder(uint256 orderId) external;
    function cancelOrder(uint256 orderId, string calldata reason) external;
    function requestRefund(uint256 orderId, string calldata reason) external;
    function approveRefund(uint256 orderId) external;
    function getOrder(uint256 orderId) external view returns (
        uint256 id, address buyer, uint256 shopId,
        uint256 totalAmount, string memory shippingAddress,
        string memory note, string memory trackingCode,
        OrderStatus status, uint256 createdAt, uint256 updatedAt
    );
    function getOrderItems(uint256 orderId) external view returns (uint256[] memory productIds, uint256[] memory quantities, uint256[] memory prices);
    function getBuyerOrders(address buyer) external view returns (uint256[] memory);
    function getShopOrders(uint256 shopId) external view returns (uint256[] memory);
    function getTotalOrders() external view returns (uint256);

    // ─── Reviews & Ratings ───
    function submitReview(uint256 productId, uint256 orderId, uint256 rating, string calldata comment, string calldata imageURI) external;
    function getProductReviews(uint256 productId) external view returns (
        address[] memory reviewers, uint256[] memory ratings,
        string[] memory comments, string[] memory imageURIs,
        uint256[] memory timestamps
    );

    // ─── Wishlist / Favorites ───
    function addToWishlist(uint256 productId) external;
    function removeFromWishlist(uint256 productId) external;
    function getWishlist(address user) external view returns (uint256[] memory);

    // ─── Cart (on-chain for persistence) ───
    function addToCart(uint256 productId, uint256 quantity) external;
    function removeFromCart(uint256 productId) external;
    function updateCartQuantity(uint256 productId, uint256 quantity) external;
    function getCart(address user) external view returns (uint256[] memory productIds, uint256[] memory quantities);
    function clearCart() external;

    // ─── Disputes ───
    function openDispute(uint256 orderId, string calldata reason) external;
    function resolveDispute(uint256 orderId, string calldata resolution, bool refundBuyer) external;

    // ─── Platform Stats ───
    function getPlatformStats() external view returns (
        uint256 totalShops, uint256 totalProducts,
        uint256 totalOrders, uint256 totalVolume,
        uint256 totalReviews
    );
}
