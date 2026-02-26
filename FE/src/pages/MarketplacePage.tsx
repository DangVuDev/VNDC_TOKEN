import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Plus, Search, Star, Package, Store, ShoppingCart,
  Heart, Truck, Tag, BarChart3, Loader2, Eye, X, MessageSquare,
  AlertTriangle, CheckCircle, Clock, ArrowRight, Filter, Grid, List,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import { useWeb3 } from '@/contexts/Web3Context';
import { useMarketplace } from '@/hooks/useContracts';
import { useContractAction } from '@/hooks/useContractAction';
import { shortenAddress, timeAgo } from '@/lib/utils';

// ─── Types ───
interface ShopInfo {
  id: number; owner: string; shopName: string; description: string;
  avatarURI: string; category: string; status: number;
  totalProducts: number; totalSales: number; totalRevenue: bigint;
  totalRating: number; reviewCount: number; createdAt: number;
}

interface ProductInfo {
  id: number; shopId: number; name: string; description: string;
  price: bigint; stock: number; sold: number; category: string;
  imageURI: string; condition: string; status: number;
  totalRating: number; reviewCount: number; createdAt: number;
}

interface OrderInfo {
  id: number; buyer: string; shopId: number; totalAmount: bigint;
  shippingAddress: string; note: string; trackingCode: string;
  status: number; createdAt: number; updatedAt: number;
}

interface ReviewInfo {
  reviewer: string; rating: number; comment: string;
  imageURI: string; timestamp: number;
}

interface CartEntry { productId: number; quantity: number; }

// Enums
const PRODUCT_STATUS = ['Đang bán', 'Hết hàng', 'Tạm dừng', 'Đã xoá'];
const ORDER_STATUS = ['Chờ xác nhận', 'Đã xác nhận', 'Đang giao', 'Đã nhận', 'Hoàn thành', 'Đã huỷ', 'Hoàn tiền', 'Tranh chấp'];
const ORDER_STATUS_COLORS = ['badge-warning', 'badge-info', 'badge-brand', 'badge-success', 'badge-success', 'badge-neutral', 'badge-error', 'badge-error'];
const CATEGORIES = ['Sách giáo trình', 'Đồ điện tử', 'Thời trang', 'Đồ ăn & Nước', 'Dịch vụ', 'Handmade', 'Công nghệ', 'Khác'];

type Tab = 'browse' | 'myShop' | 'cart' | 'orders' | 'wishlist';

export default function MarketplacePage() {
  const { address } = useWeb3();
  const marketplace = useMarketplace();
  const { isLoading, execute } = useContractAction();

  // ─── UI State ───
  const [tab, setTab] = useState<Tab>('browse');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // ─── Data State ───
  const [stats, setStats] = useState({ shops: 0, products: 0, orders: 0, volume: 0n, reviews: 0 });
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [myShops, setMyShops] = useState<ShopInfo[]>([]);
  const [myShopProducts, setMyShopProducts] = useState<ProductInfo[]>([]);
  const [myOrders, setMyOrders] = useState<OrderInfo[]>([]);
  const [shopOrders, setShopOrders] = useState<OrderInfo[]>([]);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [cartProducts, setCartProducts] = useState<ProductInfo[]>([]);
  const [wishlist, setWishlist] = useState<number[]>([]);
  const [wishlistProducts, setWishlistProducts] = useState<ProductInfo[]>([]);

  // ─── Modal State ───
  const [showCreateShop, setShowCreateShop] = useState(false);
  const [showListProduct, setShowListProduct] = useState(false);
  const [showProductDetail, setShowProductDetail] = useState<ProductInfo | null>(null);
  const [showOrderDetail, setShowOrderDetail] = useState<OrderInfo | null>(null);
  const [showReview, setShowReview] = useState<{ productId: number; orderId: number } | null>(null);
  const [productReviews, setProductReviews] = useState<ReviewInfo[]>([]);

  // ─── Form State ───
  const [shopForm, setShopForm] = useState({ shopName: '', description: '', avatarURI: '', category: '' });
  const [productForm, setProductForm] = useState({ shopId: '', name: '', description: '', price: '', stock: '', category: CATEGORIES[0], imageURI: '', condition: 'Mới' });
  const [orderForm, setOrderForm] = useState({ shippingAddress: '', note: '' });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '', imageURI: '' });
  const [trackingCode, setTrackingCode] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  // ─── Load Data ───
  const loadData = useCallback(async () => {
    if (!marketplace) return;
    setLoading(true);
    try {
      const [statsResult, totalProducts] = await Promise.all([
        marketplace.getPlatformStats().catch(() => ({ totalShops: 0n, totalProducts: 0n, totalOrders: 0n, totalVolume: 0n, totalReviews: 0n })),
        marketplace.getTotalProducts().catch(() => 0n),
      ]);

      setStats({
        shops: Number(statsResult.totalShops ?? statsResult[0]),
        products: Number(statsResult.totalProducts ?? statsResult[1]),
        orders: Number(statsResult.totalOrders ?? statsResult[2]),
        volume: statsResult.totalVolume ?? statsResult[3],
        reviews: Number(statsResult.totalReviews ?? statsResult[4]),
      });

      // Load all products
      const total = Number(totalProducts);
      const prods: ProductInfo[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const p = await marketplace.getProduct(i);
          prods.push({
            id: Number(p[0]), shopId: Number(p[1]), name: p[2], description: p[3],
            price: p[4], stock: Number(p[5]), sold: Number(p[6]),
            category: p[7], imageURI: p[8], condition: p[9],
            status: Number(p[10]), totalRating: Number(p[11]),
            reviewCount: Number(p[12]), createdAt: Number(p[13]),
          });
        } catch { /* skip */ }
      }
      setProducts(prods);

      // Load user-specific data
      if (address) {
        // My shops
        const shopIds: bigint[] = await marketplace.getShopsByOwner(address).catch(() => []);
        const shops: ShopInfo[] = [];
        for (const sid of shopIds) {
          try {
            const s = await marketplace.getShopInfo(Number(sid));
            shops.push({
              id: Number(sid), owner: s[0], shopName: s[1], description: s[2],
              avatarURI: s[3], category: s[4], status: Number(s[5]),
              totalProducts: Number(s[6]), totalSales: Number(s[7]),
              totalRevenue: s[8], totalRating: Number(s[9]),
              reviewCount: Number(s[10]), createdAt: Number(s[11]),
            });
          } catch { /* skip */ }
        }
        setMyShops(shops);

        // My shop products
        const shopProds: ProductInfo[] = [];
        for (const shop of shops) {
          const pids: bigint[] = await marketplace.getShopProducts(shop.id).catch(() => []);
          for (const pid of pids) {
            const existing = prods.find(p => p.id === Number(pid));
            if (existing) shopProds.push(existing);
          }
        }
        setMyShopProducts(shopProds);

        // My orders
        const orderIds: bigint[] = await marketplace.getBuyerOrders(address).catch(() => []);
        const ords: OrderInfo[] = [];
        for (const oid of orderIds) {
          try {
            const o = await marketplace.getOrder(Number(oid));
            ords.push({
              id: Number(o[0]), buyer: o[1], shopId: Number(o[2]),
              totalAmount: o[3], shippingAddress: o[4], note: o[5],
              trackingCode: o[6], status: Number(o[7]),
              createdAt: Number(o[8]), updatedAt: Number(o[9]),
            });
          } catch { /* skip */ }
        }
        setMyOrders(ords);

        // Shop orders (seller view)
        const sellerOrds: OrderInfo[] = [];
        for (const shop of shops) {
          const soids: bigint[] = await marketplace.getShopOrders(shop.id).catch(() => []);
          for (const oid of soids) {
            try {
              const o = await marketplace.getOrder(Number(oid));
              sellerOrds.push({
                id: Number(o[0]), buyer: o[1], shopId: Number(o[2]),
                totalAmount: o[3], shippingAddress: o[4], note: o[5],
                trackingCode: o[6], status: Number(o[7]),
                createdAt: Number(o[8]), updatedAt: Number(o[9]),
              });
            } catch { /* skip */ }
          }
        }
        setShopOrders(sellerOrds);

        // Cart
        try {
          const cartData = await marketplace.getCart(address);
          const entries: CartEntry[] = [];
          const cProds: ProductInfo[] = [];
          const pids = cartData[0] || cartData.productIds || [];
          const qtys = cartData[1] || cartData.quantities || [];
          for (let i = 0; i < pids.length; i++) {
            entries.push({ productId: Number(pids[i]), quantity: Number(qtys[i]) });
            const existing = prods.find(p => p.id === Number(pids[i]));
            if (existing) cProds.push(existing);
          }
          setCart(entries);
          setCartProducts(cProds);
        } catch { setCart([]); setCartProducts([]); }

        // Wishlist
        try {
          const wids: bigint[] = await marketplace.getWishlist(address);
          setWishlist(wids.map(Number));
          const wProds: ProductInfo[] = [];
          for (const wid of wids) {
            const existing = prods.find(p => p.id === Number(wid));
            if (existing) wProds.push(existing);
          }
          setWishlistProducts(wProds);
        } catch { setWishlist([]); setWishlistProducts([]); }
      }
    } catch (e) { console.error('Load error', e); }
    setLoading(false);
  }, [marketplace, address]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Product reviews loader ───
  const loadReviews = async (productId: number) => {
    if (!marketplace) return;
    try {
      const r = await marketplace.getProductReviews(productId);
      const reviewers = r[0] || []; const ratings = r[1] || [];
      const comments = r[2] || []; const images = r[3] || [];
      const ts = r[4] || [];
      const reviews: ReviewInfo[] = [];
      for (let i = 0; i < reviewers.length; i++) {
        reviews.push({ reviewer: reviewers[i], rating: Number(ratings[i]), comment: comments[i], imageURI: images[i], timestamp: Number(ts[i]) });
      }
      setProductReviews(reviews);
    } catch { setProductReviews([]); }
  };

  // ─── Actions ───
  const handleCreateShop = () => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.registerShop(shopForm.shopName, shopForm.description, shopForm.avatarURI, shopForm.category);
  }, { successMessage: 'Đã tạo shop!', onSuccess: () => { setShowCreateShop(false); setShopForm({ shopName: '', description: '', avatarURI: '', category: '' }); loadData(); } });

  const handleListProduct = () => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    // const { parseUnits } = await import('ethers');
    const price = productForm.price // parseUnits(productForm.price || '0', 18);
    return marketplace.listProduct(Number(productForm.shopId), productForm.name, productForm.description, price, Number(productForm.stock), productForm.category, productForm.imageURI, productForm.condition);
  }, { successMessage: 'Đã đăng sản phẩm!', onSuccess: () => { setShowListProduct(false); setProductForm({ shopId: '', name: '', description: '', price: '', stock: '', category: CATEGORIES[0], imageURI: '', condition: 'Mới' }); loadData(); } });

  const handleAddToCart = (productId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.addToCart(productId, 1);
  }, { successMessage: 'Đã thêm vào giỏ hàng!' });

  const handleRemoveFromCart = (productId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.removeFromCart(productId);
  }, { successMessage: 'Đã xoá khỏi giỏ hàng!', onSuccess: loadData });

  const handleClearCart = () => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.clearCart();
  }, { successMessage: 'Đã xoá giỏ hàng!', onSuccess: loadData });

  const handleCheckout = (shopId: number, items: CartEntry[]) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    const pIds = items.map(i => i.productId);
    const qtys = items.map(i => i.quantity);
    return marketplace.createOrder(pIds, qtys, orderForm.shippingAddress, orderForm.note);
  }, { successMessage: 'Đã đặt hàng!', onSuccess: () => { setOrderForm({ shippingAddress: '', note: '' }); loadData(); } });

  const handleToggleWishlist = (productId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    if (wishlist.includes(productId)) {
      return marketplace.removeFromWishlist(productId);
    } else {
      return marketplace.addToWishlist(productId);
    }
  }, { successMessage: wishlist.includes(productId) ? 'Đã bỏ yêu thích!' : 'Đã thêm yêu thích!', onSuccess: loadData });

  const handleConfirmOrder = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.confirmOrder(orderId);
  }, { successMessage: 'Đã xác nhận!', onSuccess: loadData });

  const handleShipOrder = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.shipOrder(orderId, trackingCode);
  }, { successMessage: 'Đã gửi hàng!', onSuccess: () => { setTrackingCode(''); loadData(); } });

  const handleConfirmDelivery = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.confirmDelivery(orderId);
  }, { successMessage: 'Đã xác nhận nhận hàng!', onSuccess: loadData });

  const handleCompleteOrder = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.completeOrder(orderId);
  }, { successMessage: 'Đã hoàn thành!', onSuccess: loadData });

  const handleCancelOrder = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.cancelOrder(orderId, 'Buyer cancelled');
  }, { successMessage: 'Đã huỷ đơn!', onSuccess: loadData });

  const handleSubmitReview = () => execute(async () => {
    if (!marketplace || !showReview) throw new Error('Contract not available');
    return marketplace.submitReview(showReview.productId, showReview.orderId, reviewForm.rating, reviewForm.comment, reviewForm.imageURI);
  }, { successMessage: 'Đã đánh giá!', onSuccess: () => { setShowReview(null); setReviewForm({ rating: 5, comment: '', imageURI: '' }); loadData(); } });

  const handleOpenDispute = (orderId: number) => execute(async () => {
    if (!marketplace) throw new Error('Contract not available');
    return marketplace.openDispute(orderId, disputeReason);
  }, { successMessage: 'Đã mở tranh chấp!', onSuccess: () => { setDisputeReason(''); loadData(); } });

  // ─── Filtered products ───
  const activeProducts = products.filter(p => p.status === 0);
  const filtered = activeProducts.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  // ─── Helper: format price ───
  const formatPrice = (price: bigint) => {
    try {
      const { formatUnits } = require('ethers');
      const val = Number(formatUnits(price, 18));
      return val.toLocaleString('vi-VN') + ' VNDC';
    } catch {
      return Number(price).toLocaleString('vi-VN');
    }
  };

  // ─── Helper: avg rating ───
  const avgRating = (totalRating: number, count: number) => count > 0 ? (totalRating / count).toFixed(1) : '0';

  // ─── Tabs ───
  const tabs: { key: Tab; label: string; icon: typeof ShoppingBag; count?: number }[] = [
    { key: 'browse', label: 'Khám phá', icon: ShoppingBag, count: activeProducts.length },
    { key: 'myShop', label: 'Shop của tôi', icon: Store, count: myShops.length },
    { key: 'cart', label: 'Giỏ hàng', icon: ShoppingCart, count: cart.length },
    { key: 'orders', label: 'Đơn hàng', icon: Package, count: myOrders.length },
    { key: 'wishlist', label: 'Yêu thích', icon: Heart, count: wishlist.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><ShoppingBag size={20} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Chợ Online Campus</h1>
            <p className="text-sm text-surface-500">Mua bán, trao đổi sản phẩm & dịch vụ</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost btn-sm" onClick={() => { setTab('myShop'); setShowCreateShop(true); }}><Store size={14} /> Mở Shop</button>
          <button className="btn-primary btn-sm" onClick={() => { setTab('myShop'); setShowListProduct(true); }}><Plus size={14} /> Đăng bán</button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Shop', value: stats.shops, icon: Store, cls: 'text-brand-600' },
          { label: 'Sản phẩm', value: stats.products, icon: Package, cls: 'text-success-600' },
          { label: 'Đơn hàng', value: stats.orders, icon: Truck, cls: 'text-info-600' },
          { label: 'Doanh thu', value: formatPrice(stats.volume), icon: BarChart3, cls: 'text-warning-600' },
          { label: 'Đánh giá', value: stats.reviews, icon: Star, cls: 'text-error-600' },
        ].map(s => (
          <div key={s.label} className="card text-center py-3">
            <s.icon size={16} className={`mx-auto mb-1 ${s.cls}`} />
            <p className={`text-lg font-bold ${s.cls}`}>{typeof s.value === 'string' ? s.value : s.value}</p>
            <p className="text-xs text-surface-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-200 pb-px">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap
              ${tab === t.key ? 'text-brand-600 bg-brand-50 border-b-2 border-brand-600' : 'text-surface-500 hover:text-surface-700 hover:bg-surface-50'}`}>
            <t.icon size={14} /> {t.label}
            {(t.count ?? 0) > 0 && <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-brand-100 text-brand-700">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card text-center py-12"><Loader2 size={24} className="animate-spin mx-auto text-brand-600 mb-2" /><p className="text-sm text-surface-500">Đang tải...</p></div>
      ) : (
        <>
          {/* ═══════ TAB: BROWSE ═══════ */}
          {tab === 'browse' && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <input className="input pl-10" placeholder="Tìm sản phẩm..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="relative">
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-500" />
                  <select className="select pl-9 pr-8 min-w-[150px]" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                    <option value="">Tất cả</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex border border-surface-200 rounded-lg overflow-hidden">
                  <button onClick={() => setViewMode('grid')} className={`p-2 ${viewMode === 'grid' ? 'bg-brand-50 text-brand-600' : 'text-surface-400'}`}><Grid size={16} /></button>
                  <button onClick={() => setViewMode('list')} className={`p-2 ${viewMode === 'list' ? 'bg-brand-50 text-brand-600' : 'text-surface-400'}`}><List size={16} /></button>
                </div>
              </div>

              {/* Category chips */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button onClick={() => setFilterCategory('')}
                  className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${!filterCategory ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                  Tất cả
                </button>
                {CATEGORIES.map(c => (
                  <button key={c} onClick={() => setFilterCategory(c)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${filterCategory === c ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                    {c}
                  </button>
                ))}
              </div>

              {filtered.length === 0 ? (
                <EmptyState lucideIcon={ShoppingBag} title="Chưa có sản phẩm" description="Hãy là người đầu tiên đăng bán!"
                  action={<button className="btn-primary btn-sm" onClick={() => setShowListProduct(true)}><Plus size={14} /> Đăng bán</button>} />
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {filtered.map(product => (
                    <div key={product.id} className="card card-hover cursor-pointer group" onClick={() => { setShowProductDetail(product); loadReviews(product.id); }}>
                      <div className="aspect-square rounded-lg bg-surface-100 flex items-center justify-center mb-3 relative overflow-hidden">
                        {product.imageURI ? (
                          <img src={product.imageURI} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package size={32} className="text-surface-300" />
                        )}
                        {/* Wishlist button */}
                        <button onClick={e => { e.stopPropagation(); handleToggleWishlist(product.id); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white transition-colors">
                          <Heart size={14} className={wishlist.includes(product.id) ? 'text-red-500 fill-red-500' : 'text-surface-400'} />
                        </button>
                        {product.sold > 0 && (
                          <span className="absolute bottom-2 left-2 px-2 py-0.5 text-[10px] font-medium bg-black/50 text-white rounded-full">
                            Đã bán {product.sold}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-medium text-surface-800 line-clamp-2 mb-1">{product.name}</h3>
                      <div className="flex items-center gap-1 mb-1">
                        <Star size={12} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-surface-600">{avgRating(product.totalRating, product.reviewCount)} ({product.reviewCount})</span>
                      </div>
                      <p className="text-sm font-bold text-red-500">{formatPrice(product.price)}</p>
                      <div className="flex items-center gap-1 mt-1 text-[10px] text-surface-400">
                        <Tag size={10} /> {product.category}
                        <span className="ml-auto">{product.condition}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {filtered.map(product => (
                    <div key={product.id} className="card card-hover cursor-pointer flex gap-4" onClick={() => { setShowProductDetail(product); loadReviews(product.id); }}>
                      <div className="w-24 h-24 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {product.imageURI ? <img src={product.imageURI} alt={product.name} className="w-full h-full object-cover rounded-lg" /> : <Package size={24} className="text-surface-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <h3 className="text-sm font-semibold text-surface-800">{product.name}</h3>
                          <button onClick={e => { e.stopPropagation(); handleToggleWishlist(product.id); }}>
                            <Heart size={16} className={wishlist.includes(product.id) ? 'text-red-500 fill-red-500' : 'text-surface-300'} />
                          </button>
                        </div>
                        <p className="text-xs text-surface-500 line-clamp-1">{product.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Star size={12} className="text-yellow-400 fill-yellow-400" />
                          <span className="text-xs text-surface-600">{avgRating(product.totalRating, product.reviewCount)}</span>
                          <span className="text-xs text-surface-400">Đã bán {product.sold}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <p className="text-sm font-bold text-red-500">{formatPrice(product.price)}</p>
                          <button className="btn-primary btn-sm text-xs" onClick={e => { e.stopPropagation(); handleAddToCart(product.id); }}><ShoppingCart size={12} /> Thêm</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══════ TAB: MY SHOP ═══════ */}
          {tab === 'myShop' && (
            <div className="space-y-4">
              {myShops.length === 0 ? (
                <EmptyState lucideIcon={Store} title="Bạn chưa có shop" description="Tạo shop để bắt đầu bán hàng"
                  action={<button className="btn-primary btn-sm" onClick={() => setShowCreateShop(true)}><Plus size={14} /> Tạo Shop</button>} />
              ) : (
                <>
                  {myShops.map(shop => (
                    <div key={shop.id} className="card">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-14 h-14 rounded-xl bg-brand-50 flex items-center justify-center">
                          {shop.avatarURI ? <img src={shop.avatarURI} alt={shop.shopName} className="w-full h-full rounded-xl object-cover" /> : <Store size={24} className="text-brand-600" />}
                        </div>
                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-surface-800">{shop.shopName}</h3>
                          <p className="text-xs text-surface-500">{shop.description}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className="text-brand-600"><Package size={10} className="inline" /> {shop.totalProducts} SP</span>
                            <span className="text-success-600"><CheckCircle size={10} className="inline" /> {shop.totalSales} đơn</span>
                            <span className="text-warning-600"><Star size={10} className="inline" /> {avgRating(shop.totalRating, shop.reviewCount)} ({shop.reviewCount})</span>
                          </div>
                        </div>
                        <button className="btn-primary btn-sm" onClick={() => setShowListProduct(true)}><Plus size={14} /> Thêm SP</button>
                      </div>

                      {/* Shop products */}
                      {myShopProducts.filter(p => p.shopId === shop.id).length > 0 && (
                        <div className="border-t border-surface-100 pt-3">
                          <h4 className="text-sm font-medium text-surface-700 mb-2">Sản phẩm ({myShopProducts.filter(p => p.shopId === shop.id).length})</h4>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {myShopProducts.filter(p => p.shopId === shop.id).map(p => (
                              <div key={p.id} className="text-center p-2 rounded-lg bg-surface-50">
                                <div className="w-full aspect-square rounded bg-surface-200 flex items-center justify-center mb-1 overflow-hidden">
                                  {p.imageURI ? <img src={p.imageURI} alt={p.name} className="w-full h-full object-cover" /> : <Package size={20} className="text-surface-300" />}
                                </div>
                                <p className="text-xs font-medium text-surface-800 line-clamp-1">{p.name}</p>
                                <p className="text-xs text-red-500 font-semibold">{formatPrice(p.price)}</p>
                                <span className={`text-[10px] ${p.status === 0 ? 'text-success-600' : 'text-surface-400'}`}>{PRODUCT_STATUS[p.status]}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Shop orders */}
                      {shopOrders.filter(o => o.shopId === shop.id).length > 0 && (
                        <div className="border-t border-surface-100 pt-3 mt-3">
                          <h4 className="text-sm font-medium text-surface-700 mb-2">Đơn hàng cần xử lý</h4>
                          <div className="space-y-2">
                            {shopOrders.filter(o => o.shopId === shop.id).map(o => (
                              <div key={o.id} className="flex items-center justify-between p-2 rounded-lg bg-surface-50">
                                <div>
                                  <p className="text-xs font-medium text-surface-800">Đơn #{o.id} · {shortenAddress(o.buyer)}</p>
                                  <p className="text-xs text-surface-500">{formatPrice(o.totalAmount)} · {o.createdAt ? timeAgo(o.createdAt) : ''}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`badge ${ORDER_STATUS_COLORS[o.status]}`}>{ORDER_STATUS[o.status]}</span>
                                  {o.status === 0 && <button className="btn-primary btn-sm text-xs" onClick={() => handleConfirmOrder(o.id)} disabled={isLoading}>Xác nhận</button>}
                                  {o.status === 1 && (
                                    <div className="flex items-center gap-1">
                                      <input className="input text-xs py-1 w-24" placeholder="Mã vận đơn" value={trackingCode} onChange={e => setTrackingCode(e.target.value)} />
                                      <button className="btn-primary btn-sm text-xs" onClick={() => handleShipOrder(o.id)} disabled={isLoading}>Gửi</button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ═══════ TAB: CART ═══════ */}
          {tab === 'cart' && (
            <div className="space-y-4">
              {cart.length === 0 ? (
                <EmptyState lucideIcon={ShoppingCart} title="Giỏ hàng trống" description="Thêm sản phẩm vào giỏ hàng" />
              ) : (
                <>
                  <div className="space-y-3">
                    {cart.map((entry, idx) => {
                      const product = cartProducts.find(p => p.id === entry.productId);
                      if (!product) return null;
                      return (
                        <div key={idx} className="card flex items-center gap-4">
                          <div className="w-16 h-16 rounded-lg bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden">
                            {product.imageURI ? <img src={product.imageURI} alt={product.name} className="w-full h-full object-cover" /> : <Package size={20} className="text-surface-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-medium text-surface-800">{product.name}</h3>
                            <p className="text-xs text-surface-500">SL: {entry.quantity} · {formatPrice(product.price)}</p>
                          </div>
                          <button className="text-surface-400 hover:text-red-500" onClick={() => handleRemoveFromCart(entry.productId)}><X size={16} /></button>
                        </div>
                      );
                    })}
                  </div>

                  <div className="card">
                    <h3 className="text-sm font-semibold text-surface-800 mb-3">Thông tin giao hàng</h3>
                    <div className="space-y-3">
                      <div><label className="label">Địa chỉ</label><input className="input" placeholder="Phòng 301, Ký túc xá A..." value={orderForm.shippingAddress} onChange={e => setOrderForm(f => ({ ...f, shippingAddress: e.target.value }))} /></div>
                      <div><label className="label">Ghi chú</label><input className="input" placeholder="Ghi chú cho người bán..." value={orderForm.note} onChange={e => setOrderForm(f => ({ ...f, note: e.target.value }))} /></div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-surface-100">
                      <div>
                        <p className="text-xs text-surface-500">Tổng ({cart.length} SP)</p>
                        <p className="text-lg font-bold text-red-500">
                          {formatPrice(cart.reduce((sum, entry) => {
                            const p = cartProducts.find(pr => pr.id === entry.productId);
                            return sum + (p ? p.price * BigInt(entry.quantity) : 0n);
                          }, 0n))}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className="btn-ghost btn-sm" onClick={handleClearCart}>Xoá tất cả</button>
                        <button className="btn-primary" onClick={() => {
                          if (cart.length > 0 && cartProducts.length > 0) {
                            handleCheckout(cartProducts[0].shopId, cart);
                          }
                        }} disabled={isLoading || !orderForm.shippingAddress}>
                          {isLoading ? 'Đang đặt...' : 'Đặt hàng'}
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ═══════ TAB: ORDERS ═══════ */}
          {tab === 'orders' && (
            <div className="space-y-3">
              {myOrders.length === 0 ? (
                <EmptyState lucideIcon={Package} title="Chưa có đơn hàng" description="Mua sắm ngay!" />
              ) : (
                myOrders.map(order => (
                  <div key={order.id} className="card">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-surface-800">Đơn #{order.id}</h3>
                        <span className={`badge ${ORDER_STATUS_COLORS[order.status]}`}>{ORDER_STATUS[order.status]}</span>
                      </div>
                      <p className="text-xs text-surface-500">{order.createdAt ? timeAgo(order.createdAt) : ''}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-xs">
                      <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Tổng:</span> <span className="font-semibold">{formatPrice(order.totalAmount)}</span></div>
                      <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Địa chỉ:</span> <span className="font-medium">{order.shippingAddress || '—'}</span></div>
                      <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Mã VĐ:</span> <span className="font-medium">{order.trackingCode || '—'}</span></div>
                      <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Shop:</span> <span className="font-medium">#{order.shopId}</span></div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {order.status === 2 /* Shipping */ && (
                        <button className="btn-primary btn-sm text-xs" onClick={() => handleConfirmDelivery(order.id)} disabled={isLoading}><Truck size={12} /> Đã nhận hàng</button>
                      )}
                      {order.status === 3 /* Delivered */ && (
                        <button className="btn-primary btn-sm text-xs" onClick={() => handleCompleteOrder(order.id)} disabled={isLoading}><CheckCircle size={12} /> Hoàn thành</button>
                      )}
                      {(order.status === 3 || order.status === 4) && (
                        <button className="btn-ghost btn-sm text-xs" onClick={() => setShowOrderDetail(order)}><MessageSquare size={12} /> Đánh giá</button>
                      )}
                      {(order.status === 0 || order.status === 1) && (
                        <button className="btn-ghost btn-sm text-xs text-red-500" onClick={() => handleCancelOrder(order.id)} disabled={isLoading}><X size={12} /> Huỷ đơn</button>
                      )}
                      {(order.status === 1 || order.status === 2 || order.status === 3) && (
                        <button className="btn-ghost btn-sm text-xs text-warning-600" onClick={() => {
                          const reason = prompt('Lý do tranh chấp:');
                          if (reason) { setDisputeReason(reason); handleOpenDispute(order.id); }
                        }}><AlertTriangle size={12} /> Tranh chấp</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══════ TAB: WISHLIST ═══════ */}
          {tab === 'wishlist' && (
            <div className="space-y-4">
              {wishlistProducts.length === 0 ? (
                <EmptyState lucideIcon={Heart} title="Chưa có sản phẩm yêu thích" description="Nhấn ❤ để thêm sản phẩm vào danh sách" />
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {wishlistProducts.map(product => (
                    <div key={product.id} className="card card-hover cursor-pointer group" onClick={() => { setShowProductDetail(product); loadReviews(product.id); }}>
                      <div className="aspect-square rounded-lg bg-surface-100 flex items-center justify-center mb-3 relative overflow-hidden">
                        {product.imageURI ? <img src={product.imageURI} alt={product.name} className="w-full h-full object-cover rounded-lg" /> : <Package size={32} className="text-surface-300" />}
                        <button onClick={e => { e.stopPropagation(); handleToggleWishlist(product.id); }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 hover:bg-white">
                          <Heart size={14} className="text-red-500 fill-red-500" />
                        </button>
                      </div>
                      <h3 className="text-sm font-medium text-surface-800 line-clamp-2 mb-1">{product.name}</h3>
                      <p className="text-sm font-bold text-red-500">{formatPrice(product.price)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ═══════ MODALS ═══════ */}

      {/* Create Shop Modal */}
      <Modal open={showCreateShop} onClose={() => setShowCreateShop(false)} title="Tạo Shop mới"
        footer={<button className="btn-primary" onClick={handleCreateShop} disabled={isLoading}>{isLoading ? 'Đang tạo...' : 'Tạo Shop'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Tên Shop</label><input className="input" placeholder="Shop Sinh Viên ABC" value={shopForm.shopName} onChange={e => setShopForm(f => ({ ...f, shopName: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Giới thiệu shop của bạn..." value={shopForm.description} onChange={e => setShopForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div><label className="label">Avatar URL</label><input className="input" placeholder="https://..." value={shopForm.avatarURI} onChange={e => setShopForm(f => ({ ...f, avatarURI: e.target.value }))} /></div>
          <div><label className="label">Ngành hàng</label>
            <select className="select" value={shopForm.category} onChange={e => setShopForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">Chọn ngành hàng</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </Modal>

      {/* List Product Modal */}
      <Modal open={showListProduct} onClose={() => setShowListProduct(false)} title="Đăng bán sản phẩm" size="lg"
        footer={<button className="btn-primary" onClick={handleListProduct} disabled={isLoading}>{isLoading ? 'Đang đăng...' : 'Đăng bán'}</button>}>
        <div className="space-y-4">
          <div><label className="label">Shop</label>
            <select className="select" value={productForm.shopId} onChange={e => setProductForm(f => ({ ...f, shopId: e.target.value }))}>
              <option value="">Chọn shop</option>
              {myShops.map(s => <option key={s.id} value={s.id}>{s.shopName}</option>)}
            </select>
          </div>
          <div><label className="label">Tên sản phẩm</label><input className="input" placeholder="Sách Blockchain 101" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div><label className="label">Mô tả</label><textarea className="textarea" rows={3} placeholder="Mô tả chi tiết..." value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Giá (VNDC)</label><input className="input" type="number" placeholder="50000" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} /></div>
            <div><label className="label">Số lượng</label><input className="input" type="number" placeholder="10" value={productForm.stock} onChange={e => setProductForm(f => ({ ...f, stock: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Danh mục</label>
              <select className="select" value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Tình trạng</label>
              <select className="select" value={productForm.condition} onChange={e => setProductForm(f => ({ ...f, condition: e.target.value }))}>
                <option value="Mới">Mới 100%</option>
                <option value="Như mới">Như mới 99%</option>
                <option value="Đã sử dụng">Đã sử dụng</option>
              </select>
            </div>
          </div>
          <div><label className="label">Link hình ảnh</label><input className="input" placeholder="https://..." value={productForm.imageURI} onChange={e => setProductForm(f => ({ ...f, imageURI: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* Product Detail Modal */}
      <Modal open={!!showProductDetail} onClose={() => { setShowProductDetail(null); setProductReviews([]); }} title={showProductDetail?.name || ''} size="lg"
        footer={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => showProductDetail && handleToggleWishlist(showProductDetail.id)}>
              <Heart size={14} className={showProductDetail && wishlist.includes(showProductDetail.id) ? 'text-red-500 fill-red-500' : ''} /> Yêu thích
            </button>
            <button className="btn-primary" onClick={() => { if (showProductDetail) { handleAddToCart(showProductDetail.id); } }} disabled={isLoading}>
              <ShoppingCart size={14} /> Thêm vào giỏ
            </button>
          </div>
        }>
        {showProductDetail && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-48 h-48 rounded-xl bg-surface-100 flex items-center justify-center shrink-0 overflow-hidden">
                {showProductDetail.imageURI ? <img src={showProductDetail.imageURI} alt={showProductDetail.name} className="w-full h-full object-cover rounded-xl" /> : <Package size={48} className="text-surface-300" />}
              </div>
              <div className="flex-1">
                <p className="text-2xl font-bold text-red-500 mb-2">{formatPrice(showProductDetail.price)}</p>
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={14} className={s <= Math.round(showProductDetail.reviewCount > 0 ? showProductDetail.totalRating / showProductDetail.reviewCount : 0) ? 'text-yellow-400 fill-yellow-400' : 'text-surface-200'} />
                    ))}
                    <span className="text-xs text-surface-500 ml-1">({showProductDetail.reviewCount})</span>
                  </div>
                  <span className="text-xs text-surface-500">Đã bán {showProductDetail.sold}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Tình trạng:</span> <span className="font-medium">{showProductDetail.condition}</span></div>
                  <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Kho:</span> <span className="font-medium">{showProductDetail.stock} sản phẩm</span></div>
                  <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Danh mục:</span> <span className="font-medium">{showProductDetail.category}</span></div>
                  <div className="p-2 rounded bg-surface-50"><span className="text-surface-500">Shop:</span> <span className="font-medium">#{showProductDetail.shopId}</span></div>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-surface-700 mb-1">Mô tả sản phẩm</h4>
              <p className="text-sm text-surface-600">{showProductDetail.description}</p>
            </div>

            {/* Reviews section */}
            {productReviews.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-surface-700 mb-2">Đánh giá ({productReviews.length})</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {productReviews.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-surface-50">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-surface-700">{shortenAddress(r.reviewer)}</span>
                          <div className="flex">{[1, 2, 3, 4, 5].map(s => <Star key={s} size={10} className={s <= r.rating ? 'text-yellow-400 fill-yellow-400' : 'text-surface-200'} />)}</div>
                        </div>
                        <span className="text-[10px] text-surface-400">{r.timestamp ? timeAgo(r.timestamp) : ''}</span>
                      </div>
                      <p className="text-xs text-surface-600">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Order Detail / Review Modal */}
      <Modal open={!!showOrderDetail} onClose={() => setShowOrderDetail(null)} title={`Đánh giá đơn hàng #${showOrderDetail?.id}`}
        footer={<button className="btn-primary" onClick={() => {
          if (showOrderDetail) {
            // Get first product ID from order for review
            setShowReview({ productId: 0, orderId: showOrderDetail.id });
            setShowOrderDetail(null);
          }
        }}>Đánh giá sản phẩm</button>}>
        {showOrderDetail && (
          <div className="space-y-3">
            <p className="text-sm text-surface-600">Tổng: {formatPrice(showOrderDetail.totalAmount)}</p>
            <p className="text-sm text-surface-600">Trạng thái: {ORDER_STATUS[showOrderDetail.status]}</p>
            <p className="text-xs text-surface-500">Chọn sản phẩm cần đánh giá từ đơn hàng này</p>
          </div>
        )}
      </Modal>

      {/* Submit Review Modal */}
      <Modal open={!!showReview} onClose={() => setShowReview(null)} title="Đánh giá sản phẩm"
        footer={<button className="btn-primary" onClick={handleSubmitReview} disabled={isLoading}>{isLoading ? 'Đang gửi...' : 'Gửi đánh giá'}</button>}>
        <div className="space-y-4">
          <div>
            <label className="label">Product ID</label>
            <input className="input" type="number" placeholder="ID sản phẩm" value={showReview?.productId || ''}
              onChange={e => setShowReview(prev => prev ? { ...prev, productId: Number(e.target.value) } : null)} />
          </div>
          <div>
            <label className="label">Đánh giá</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))}>
                  <Star size={24} className={s <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-surface-200'} />
                </button>
              ))}
            </div>
          </div>
          <div><label className="label">Nhận xét</label><textarea className="textarea" rows={3} placeholder="Chia sẻ trải nghiệm..." value={reviewForm.comment} onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))} /></div>
          <div><label className="label">Link hình ảnh (tuỳ chọn)</label><input className="input" placeholder="https://..." value={reviewForm.imageURI} onChange={e => setReviewForm(f => ({ ...f, imageURI: e.target.value }))} /></div>
        </div>
      </Modal>
    </div>
  );
}
