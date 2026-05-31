import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import {
  Avatar,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Row,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
  Typography,
  message as antMessage,
} from 'antd'
import type { TabsProps } from 'antd'
import {
  AppstoreOutlined,
  BarChartOutlined,
  CompassOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  buyNFT,
  cancelSellerOrder,
  cancelMyPurchase,
  cancelListing,
  getListings,
  getMyListings,
  getMyNFTs,
  getMyPurchases,
  getNonce,
  getSellerOrders,
  getShopProfile,
  mintAndListNFT,
  toWei,
  updateListingPrice,
  updateSellerOrderStatus,
  type MarketplacePurchase,
  type NFTListing,
  type OwnedNFT,
  type SellerProfile,
} from '../lib/services'
import { buildTransferTypedData, signTypedData, switchChain } from '../lib/wallet'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

interface MarketplacePageProps { user?: AuthUser }

type VotePayMethod = 'TOKEN' | 'COD'

type SellerOrderStatus = 'RECEIVED' | 'PACKED' | 'SHIPPING' | 'DELIVERED'

const MARKETPLACE_STYLES = `
.market-page {
  --m-bg-1: #fbfdff;
  --m-bg-2: #eef6ff;
  --m-ink: #0f172a;
  --m-muted: #64748b;
  --m-brand: #2563eb;
  --m-accent: #0f766e;
  --m-border: rgba(148, 163, 184, 0.24);
  background:
    radial-gradient(900px 420px at 8% -10%, rgba(37,99,235,.12), transparent 60%),
    radial-gradient(900px 420px at 92% -10%, rgba(20,184,166,.14), transparent 60%),
    radial-gradient(900px 520px at 50% 110%, rgba(168,85,247,.08), transparent 55%),
    linear-gradient(180deg, var(--m-bg-1) 0%, var(--m-bg-2) 100%);
  border-radius: 22px;
  padding: 18px;
}
.market-page .glass-card {
  backdrop-filter: blur(8px);
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--m-border);
  border-radius: 16px;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.08);
  color: var(--m-ink);
}
.market-page .shop-hero {
  border-radius: 22px;
  box-shadow: 0 20px 60px rgba(67,56,202,.32);
  overflow: hidden;
  position: relative;
  background: linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 50%,#312E81 100%);
}
.market-page .shop-hero::before {
  content: '';
  position: absolute;
  right: -30px;
  top: -30px;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: rgba(99,102,241,.12);
  pointer-events: none;
}
.market-page .shop-hero::after {
  content: '';
  position: absolute;
  right: 80px;
  bottom: -80px;
  width: 220px;
  height: 220px;
  border-radius: 999px;
  background: radial-gradient(140px 140px at 50% 50%, rgba(129,140,248,.28), rgba(129,140,248,0) 72%);
  pointer-events: none;
}
.market-page .shop-hero-content {
  position: relative;
  z-index: 1;
}
.market-page .hero-subtext {
  color: #A5B4FC;
  font-size: 12px;
}
.market-page .shop-hero .hero-title {
  color: #fff;
  margin: 0;
  font-family: Georgia, serif;
  line-height: 1.15;
}
.market-page .shop-hero .hero-desc {
  color: #C7D2FE;
  margin-top: 8px;
  margin-bottom: 0;
}
.market-page .shop-hero .sync-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  margin-bottom: 6px;
}
.market-page .shop-hero .sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
}
.market-page .market-tabs .ant-tabs-nav {
  margin: 0 0 18px;
}
.market-page .market-tabs .ant-tabs-nav::before {
  border-bottom-color: rgba(148, 163, 184, 0.20);
}
.market-page .market-tabs .ant-tabs-tab {
  color: #475569;
  font-weight: 700;
  border-radius: 999px;
  padding: 10px 16px;
}
.market-page .market-tabs .ant-tabs-tab.ant-tabs-tab-active {
  background: linear-gradient(135deg, rgba(37,99,235,.10), rgba(20,184,166,.10));
}
.market-page .market-tabs .ant-tabs-tab .ant-tabs-tab-btn {
  color: inherit;
}
.market-page .market-tabs .ant-tabs-ink-bar {
  display: none;
}
.market-page .section-card {
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 20px;
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.08);
}
.market-page .section-shell {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.68);
  padding: 18px;
}
.market-page .section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.market-page .section-title {
  color: #0f172a;
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}
.market-page .section-desc {
  color: #64748b;
  margin-top: 4px;
  font-size: 13px;
}
.market-page .product-cover {
  position: relative;
  overflow: hidden;
  border-radius: 12px;
  height: 220px;
  background: linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%);
}
.market-page .product-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.market-page .nft-hero {
  border-radius: 24px;
  border: 1px solid rgba(37, 99, 235, 0.10);
  background: linear-gradient(135deg, #ffffff 0%, #f8fbff 42%, #eefdfc 100%);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
  overflow: hidden;
}
.market-page .nft-hero-copy {
  position: relative;
  z-index: 1;
}
.market-page .nft-hero-title {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
  color: #0f172a;
}
.market-page .nft-hero-text {
  color: #475569;
  max-width: 720px;
}
.market-page .nft-hero-panel {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: rgba(255, 255, 255, 0.82);
  padding: 16px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}
.market-page .nft-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}
.market-page .nft-toolbar .ant-input,
.market-page .nft-toolbar .ant-select-selector {
  border-radius: 12px !important;
}
.market-page .nft-chip {
  border-radius: 999px;
  padding: 4px 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(248, 251, 255, 0.9);
}
.market-page .nft-featured {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  gap: 16px;
  align-items: stretch;
}
.market-page .nft-featured-media {
  border-radius: 20px;
  overflow: hidden;
  min-height: 360px;
  background: linear-gradient(135deg, #dbeafe 0%, #ecfeff 100%);
  position: relative;
}
.market-page .nft-featured-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.market-page .nft-featured-info {
  border-radius: 20px;
  padding: 18px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  display: flex;
  flex-direction: column;
  gap: 12px;
  justify-content: space-between;
}
.market-page .nft-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.market-page .nft-price {
  font-size: 30px;
  font-weight: 900;
  color: #0f766e;
  letter-spacing: -0.02em;
}
.market-page .nft-card {
  border-radius: 20px;
  overflow: hidden;
  transition: transform .18s ease, box-shadow .18s ease;
}
.market-page .nft-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 20px 44px rgba(15, 23, 42, 0.10);
}
.market-page .nft-card-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.market-page .nft-mini-kpi {
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.16);
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  padding: 12px 14px;
}
.market-page .nft-mini-kpi .label {
  color: #64748b;
  font-size: 12px;
}
.market-page .nft-mini-kpi .value {
  color: #0f172a;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}
.market-page .status-pill {
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
}
.market-page .metric-title {
  color: #64748b;
  font-size: 12px;
}
.market-page .metric-value {
  font-size: 26px;
  font-weight: 800;
  color: #0f172a;
}
.market-page .hero-stat {
  text-align: center;
  min-width: 110px;
  border-radius: 16px;
  border: 1px solid rgba(148,163,184,.18);
  padding: 10px 12px;
  box-shadow: 0 12px 24px rgba(15,23,42,.08);
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(10px);
}
.market-page .hero-stat:nth-child(1) {
  background: linear-gradient(135deg, rgba(59,130,246,.10) 0%, rgba(37,99,235,.05) 100%);
}
.market-page .hero-stat:nth-child(2) {
  background: linear-gradient(135deg, rgba(16,185,129,.10) 0%, rgba(20,184,166,.05) 100%);
}
.market-page .hero-stat:nth-child(3) {
  background: linear-gradient(135deg, rgba(168,85,247,.10) 0%, rgba(139,92,246,.05) 100%);
}
.market-page .hero-stat .value {
  font-size: 28px;
  font-weight: 800;
  color: #0f172a;
}
.market-page .hero-stat .label {
  color: #64748b;
  font-size: 11px;
}
.market-page .buy-drawer-card {
  border-radius: 14px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(165deg, #ffffff 0%, #f8fbff 100%);
}
.market-page .buy-drawer-photo {
  width: 96px;
  height: 96px;
  border-radius: 12px;
  object-fit: cover;
}
.market-page .seller-panel {
  border-radius: 18px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
}
.market-page .metric-tile {
  border: 1px solid rgba(148, 163, 184, 0.16);
  border-radius: 14px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
}
.market-page .status-chart {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.market-page .status-bar {
  border-radius: 12px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.14);
  padding: 10px 8px;
  text-align: center;
}
.market-page .status-bar-track {
  width: 100%;
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
  margin-top: 8px;
}
.market-page .status-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb 0%, #14b8a6 100%);
}
.market-page .order-row {
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.16);
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  padding: 12px;
}
@media (max-width: 768px) {
  .market-page {
    padding: 12px;
    border-radius: 16px;
  }
  .market-page .shop-hero {
    border-radius: 14px;
  }
  .market-page .buy-drawer-photo {
    width: 84px;
    height: 84px;
  }
  .market-page .status-chart {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
`

function fromWei(wei: string): number {
  try {
    const n = BigInt(wei || '0')
    return Number(n) / 1e18
  } catch {
    return 0
  }
}

function fmtVNDC(wei: string): string {
  return fromWei(wei).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function isPositiveWei(value?: string): boolean {
  try {
    return BigInt(value || '0') > 0n
  } catch {
    return false
  }
}

function shortAddr(addr?: string): string {
  if (!addr) return '---'
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function fmtDateTime(iso?: string): string {
  if (!iso) return 'Chua xac dinh'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Chua xac dinh'
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function etaText(iso?: string): string {
  if (!iso) return 'Chua co lich giao'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Du kien da den han giao'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `Con ${d} ngay ${h} gio`
  const m = Math.floor((diff % 3600000) / 60000)
  return `Con ${h} gio ${m} phut`
}

const CATEGORIES = [
  { value: '', label: 'Tat ca' },
  { value: 'normal', label: 'San pham thuong' },
  { value: 'digital', label: 'Hang so' },
  { value: 'service', label: 'Dich vu' },
  { value: 'nft', label: 'Vat pham NFT' },
]

function categoryLabel(category?: string): string {
  return CATEGORIES.find(c => c.value === (category || ''))?.label ?? (category || 'Khac')
}

function purchaseStatusTag(status: MarketplacePurchase['status']) {
  const map: Record<string, { color: string; text: string }> = {
    PENDING_PAYMENT: { color: 'orange', text: 'Da dat hang' },
    PENDING_COD: { color: 'purple', text: 'Da dat hang - cho shop xac nhan' },
    CANCELLED: { color: 'red', text: 'Da huy boi nguoi mua' },
    RECEIVED: { color: 'cyan', text: 'Da nhan don' },
    PACKED: { color: 'geekblue', text: 'Da dong goi' },
    SHIPPING: { color: 'blue', text: 'Dang van chuyen' },
    DELIVERED: { color: 'green', text: 'Da giao' },
    COMPLETED: { color: 'green', text: 'Hoan thanh' },
    FAILED: { color: 'red', text: 'That bai' },
  }
  const s = map[status] ?? { color: 'default', text: status }
  return <Tag color={s.color} className="status-pill">{s.text}</Tag>
}

function nextSellerStatus(status: MarketplacePurchase['status']): SellerOrderStatus | null {
  if (status === 'PENDING_COD' || status === 'PENDING_PAYMENT') return 'RECEIVED'
  if (status === 'RECEIVED') return 'PACKED'
  if (status === 'PACKED') return 'SHIPPING'
  if (status === 'SHIPPING') return 'DELIVERED'
  return null
}

function listingStatusTag(status: string) {
  const map: Record<string, { color: string; text: string }> = {
    ACTIVE: { color: 'green', text: 'Dang ban' },
    SOLD: { color: 'blue', text: 'Da ban' },
    CANCELLED: { color: 'default', text: 'Da huy' },
  }
  const s = map[status] ?? { color: 'default', text: status }
  return <Tag color={s.color} className="status-pill">{s.text}</Tag>
}

function statusText(status: MarketplacePurchase['status']): string {
  const map: Record<string, string> = {
    PENDING_PAYMENT: 'Dat hang',
    PENDING_COD: 'Cho xac nhan',
    RECEIVED: 'Da nhan don',
    PACKED: 'Da dong goi',
    SHIPPING: 'Dang giao',
    DELIVERED: 'Da giao',
    COMPLETED: 'Hoan thanh',
    CANCELLED: 'Da huy',
    FAILED: 'That bai',
  }
  return map[status] ?? status
}

function ProductCard({
  item,
  onView,
  onBuy,
  onCancel,
  isMine,
}: {
  item: NFTListing
  onView: (item: NFTListing) => void
  onBuy: (item: NFTListing) => void
  onCancel: (item: NFTListing) => void
  isMine: boolean
}) {
  return (
    <Card className="glass-card product-card" styles={{ body: { padding: 12 } }}>
      <div className="product-cover">
        <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.title} />
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <Tag color="blue" className="status-pill">{categoryLabel(item.category)}</Tag>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          {listingStatusTag(item.status)}
        </div>
      </div>
      <div style={{ marginTop: 10 }}>
        <Text strong style={{ fontSize: 15 }}>{item.title}</Text>
        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
          Shop: {shortAddr(item.seller_wallet)}
        </Text>
        <Space align="end" style={{ width: '100%', justifyContent: 'space-between', marginTop: 8 }}>
          <div>
            <Text style={{ fontWeight: 800, fontSize: 24, color: '#b91c1c' }}>{fmtVNDC(item.price)}</Text>
            <Text type="secondary" style={{ marginLeft: 4 }}>VNDC</Text>
          </div>
          <Space>
            <Button size="small" onClick={() => onView(item)}>Chi tiet</Button>
            {!isMine && item.status === 'ACTIVE' && (
              <Button type="primary" size="small" icon={<ShoppingCartOutlined />} onClick={() => onBuy(item)}>Mua</Button>
            )}
            {isMine && item.status === 'ACTIVE' && (
              <Popconfirm title="Huy niem yet san pham nay?" onConfirm={() => onCancel(item)}>
                <Button danger size="small">Huy</Button>
              </Popconfirm>
            )}
          </Space>
        </Space>
      </div>
    </Card>
  )
}

function BuyDrawer({
  user,
  item,
  open,
  onClose,
  onDone,
}: {
  user?: AuthUser
  item: NFTListing | null
  open: boolean
  onClose: () => void
  onDone: () => void
}) {
  const [paymentMethod, setPaymentMethod] = useState<VotePayMethod>('TOKEN')
  const [submitting, setSubmitting] = useState(false)
  const [form] = Form.useForm()
  const isNFTBuy = (item?.category || '').toLowerCase() === 'nft'

  useEffect(() => {
    if (open) {
      form.resetFields()
      setPaymentMethod('TOKEN')
    }
  }, [open, form])

  async function handleSubmit(values: { recipient_name?: string; recipient_phone?: string; shipping_address?: string; delivery_note?: string }) {
    if (!item || !user?.wallet_address) return
    setSubmitting(true)
    try {
      if (paymentMethod === 'TOKEN') {
        const chainId = parseInt(import.meta.env.VITE_CHAIN_ID ?? '31337', 10)
        await switchChain(chainId)
        const { nonce } = await getNonce(user.wallet_address)
        const deadline = Math.floor(Date.now() / 1000) + 3600
        const typedData = buildTransferTypedData({
          chainId,
          verifyingContract: import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS,
          from: user.wallet_address,
          to: item.seller_wallet,
          amount: item.price,
          nonce: String(nonce),
          deadline,
        })
        const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)
        await buyNFT(item.id, {
          from_wallet: user.wallet_address,
          payment_method: 'TOKEN',
          nonce: String(nonce),
          deadline,
          signature: signature ?? '',
          ...(isNFTBuy ? {} : values),
        })
      } else {
        await buyNFT(item.id, {
          from_wallet: user.wallet_address,
          payment_method: 'COD',
          ...values,
        })
      }
      antMessage.success('Dat hang thanh cong')
      onDone()
      onClose()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Dat hang that bai')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer title="Thong tin dat hang" open={open} onClose={onClose} width="min(560px, 100vw)">
      {item && (
        <>
          <Card size="small" className="buy-drawer-card" style={{ marginBottom: 14 }}>
            <Space align="start" size={12}>
              <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/80/80`} alt={item.title} className="buy-drawer-photo" />
              <div>
                <Text strong style={{ fontSize: 16 }}>{item.title}</Text>
                <div>
                  <Text style={{ fontWeight: 800, color: '#b91c1c', fontSize: 20 }}>{fmtVNDC(item.price)} VNDC</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>Shop {shortAddr(item.seller_wallet)}</Text>
                <div><Tag color="gold">Dat hang ngay, shop xac nhan theo tung buoc</Tag></div>
              </div>
            </Space>
          </Card>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>Chon phuong thuc thanh toan</Text>
          <Radio.Group value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as VotePayMethod)} style={{ marginBottom: 16, width: '100%' }}>
            <Space>
              <Radio.Button value="TOKEN">Thanh toan VNDC</Radio.Button>
              {!isNFTBuy && <Radio.Button value="COD">Thanh toan khi nhan</Radio.Button>}
            </Space>
          </Radio.Group>

          <Form layout="vertical" form={form} onFinish={handleSubmit}>
            {!isNFTBuy && (
              <>
                <Form.Item name="recipient_name" label="Nguoi nhan" rules={[{ required: true, message: 'Nhap nguoi nhan' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="recipient_phone" label="So dien thoai" rules={[{ required: true, message: 'Nhap so dien thoai' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="shipping_address" label="Dia chi giao hang" rules={[{ required: true, message: 'Nhap dia chi' }]}>
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="delivery_note" label="Ghi chu giao hang">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </>
            )}
            <Button htmlType="submit" type="primary" block loading={submitting} icon={<ShoppingCartOutlined />}>
              {isNFTBuy ? 'Xac nhan mua NFT ngay' : 'Xac nhan mua'}
            </Button>
          </Form>
        </>
      )}
    </Drawer>
  )
}

function ProductDetailDrawer({
  open,
  item,
  shopProfile,
  shopListings,
  onClose,
  onOpenShopListing,
}: {
  open: boolean
  item: NFTListing | null
  shopProfile?: SellerProfile | null
  shopListings: NFTListing[]
  onClose: () => void
  onOpenShopListing: (item: NFTListing) => void
}) {
  return (
    <Drawer open={open} onClose={onClose} width={760} title="Chi tiet san pham">
      {!item ? <Empty /> : (
        <>
          <Row gutter={18}>
            <Col xs={24} md={12}>
              <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/800/700`} alt={item.title} style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }} />
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Tag color="blue">{categoryLabel(item.category)}</Tag>
                <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                <Text type="secondary">{item.description || 'Khong co mo ta'}</Text>
                <div>
                  <Text style={{ fontWeight: 800, fontSize: 28, color: '#b91c1c' }}>{fmtVNDC(item.price)}</Text>
                  <Text type="secondary" style={{ marginLeft: 6 }}>VNDC</Text>
                </div>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Token ID">{item.token_id || '0'}</Descriptions.Item>
                  <Descriptions.Item label="So luong">{item.amount}</Descriptions.Item>
                  <Descriptions.Item label="Trang thai">{listingStatusTag(item.status)}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Col>
          </Row>

          <Divider />
          <Card className="glass-card" title="Thong tin gian hang" size="small">
            <Space align="start" size={14}>
              <Avatar size={56} src={shopProfile?.avatar_uri} icon={<UserOutlined />} />
              <div>
                <Text strong>{shopProfile?.display_name || shortAddr(item.seller_wallet)}</Text>
                <Text type="secondary" style={{ display: 'block' }}>{shopProfile?.bio || 'Shop uy tin tren san VNDC'}</Text>
                <Space size={14} style={{ marginTop: 4 }}>
                  <Text type="secondary">San pham: <Text strong>{shopProfile?.total_listings ?? 0}</Text></Text>
                  <Text type="secondary">Dang ban: <Text strong>{shopProfile?.active_listings ?? 0}</Text></Text>
                  <Text type="secondary">Doanh thu: <Text strong>{fmtVNDC(shopProfile?.total_revenue_wei ?? '0')} VNDC</Text></Text>
                </Space>
              </div>
            </Space>
          </Card>

          <Divider titlePlacement="left">San pham khac cua shop</Divider>
          <Row gutter={[12, 12]}>
            {shopListings.slice(0, 4).map(s => (
              <Col xs={24} md={12} key={s.id}>
                <Card size="small" hoverable onClick={() => onOpenShopListing(s)}>
                  <Space>
                    <img src={s.image_uri || `https://picsum.photos/seed/${s.id}/90/70`} alt={s.title} style={{ width: 90, height: 70, borderRadius: 8, objectFit: 'cover' }} />
                    <div>
                      <Text strong>{s.title}</Text>
                      <div><Text type="secondary">{fmtVNDC(s.price)} VNDC</Text></div>
                    </div>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}
    </Drawer>
  )
}

function BrowseTab({ user, onOrderPlaced }: { user?: AuthUser; onOrderPlaced: () => void }) {
  const [items, setItems] = useState<NFTListing[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [selected, setSelected] = useState<NFTListing | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showBuy, setShowBuy] = useState(false)
  const [shopProfile, setShopProfile] = useState<SellerProfile | null>(null)
  const [shopListings, setShopListings] = useState<NFTListing[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getListings(1, 60)
      setItems(res.items)
    } catch {
      antMessage.error('Khong the tai san pham')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => items.filter(i => {
    const m1 = !search || i.title.toLowerCase().includes(search.toLowerCase())
    const m2 = !category || i.category === category
    return m1 && m2
  }), [items, search, category])

  async function openDetail(item: NFTListing) {
    setSelected(item)
    setShowDetail(true)
    try {
      const [profile, listingRes] = await Promise.all([
        getShopProfile(item.seller_wallet),
        getMyListings(item.seller_wallet, 1, 12),
      ])
      setShopProfile(profile)
      setShopListings(listingRes.items)
    } catch {
      setShopProfile(null)
      setShopListings([])
    }
  }

  async function onCancel(item: NFTListing) {
    try {
      await cancelListing(item.id)
      antMessage.success('Da huy niem yet')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the huy')
    }
  }

  return (
    <>
      <Card className="glass-card" style={{ marginBottom: 14 }}>
        <Row gutter={[10, 10]} align="middle">
          <Col flex={1}>
            <Input prefix={<CompassOutlined />} placeholder="Tim san pham" value={search} onChange={e => setSearch(e.target.value)} allowClear />
          </Col>
          <Col>
            <Select value={category} style={{ width: 180 }} onChange={setCategory} options={CATEGORIES} />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Lam moi</Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {filtered.length === 0 ? <Empty description="Chua co san pham" /> : (
          <Row gutter={[14, 14]}>
            {filtered.map(item => (
              <Col xs={24} sm={12} lg={8} xl={6} key={item.id}>
                <ProductCard
                  item={item}
                  isMine={item.seller_wallet.toLowerCase() === (user?.wallet_address || '').toLowerCase()}
                  onView={openDetail}
                  onBuy={(i) => { setSelected(i); setShowBuy(true) }}
                  onCancel={onCancel}
                />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <ProductDetailDrawer
        open={showDetail}
        item={selected}
        shopProfile={shopProfile}
        shopListings={shopListings}
        onClose={() => setShowDetail(false)}
        onOpenShopListing={openDetail}
      />
      <BuyDrawer
        open={showBuy}
        item={selected}
        user={user}
        onClose={() => setShowBuy(false)}
        onDone={() => {
          void load()
          onOrderPlaced()
        }}
      />
    </>
  )
}

function NFTShopTab({ user }: { user?: AuthUser }) {
  const [createForm] = Form.useForm()
  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [loadingAll, setLoadingAll] = useState(false)
  const [loadingMine, setLoadingMine] = useState(false)
  const [allListings, setAllListings] = useState<NFTListing[]>([])
  const [mineNFTs, setMineNFTs] = useState<OwnedNFT[]>([])
  const [mineListings, setMineListings] = useState<NFTListing[]>([])
  const [activeInnerTab, setActiveInnerTab] = useState<'all' | 'mine'>('all')
  const [searchText, setSearchText] = useState('')
  const [sortMode, setSortMode] = useState<'featured' | 'newest' | 'price-low' | 'price-high'>('featured')
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [sellingTokenId, setSellingTokenId] = useState('')
  const [selectedListing, setSelectedListing] = useState<NFTListing | null>(null)
  const [showBuy, setShowBuy] = useState(false)
  const [detailListing, setDetailListing] = useState<NFTListing | null>(null)
  const [showDetail, setShowDetail] = useState(false)

  const wallet = user?.wallet_address || ''

  const loadAll = useCallback(async () => {
    setLoadingAll(true)
    try {
      const res = await getListings(1, 80, '')
      setAllListings((res.items || []).filter(item => (item.category || '').toLowerCase() === 'nft'))
    } catch {
      antMessage.error('Khong the tai san NFT')
    } finally {
      setLoadingAll(false)
    }
  }, [])

  const loadMine = useCallback(async () => {
    if (!wallet) {
      setMineNFTs([])
      setMineListings([])
      return
    }
    setLoadingMine(true)
    try {
      const [nftRes, listingRes] = await Promise.allSettled([
        getMyNFTs(wallet, 1, 80),
        getMyListings(wallet, 1, 200),
      ])
      if (nftRes.status === 'fulfilled') {
        setMineNFTs(nftRes.value.items || [])
      } else {
        setMineNFTs([])
        antMessage.error('Khong the tai NFT cua ban')
      }
      if (listingRes.status === 'fulfilled') {
        setMineListings((listingRes.value.items || []).filter(item => (item.category || '').toLowerCase() === 'nft'))
      } else {
        setMineListings([])
      }
    } catch {
      antMessage.error('Khong the tai NFT cua ban')
    } finally {
      setLoadingMine(false)
    }
  }, [wallet])

  useEffect(() => {
    void loadAll()
    void loadMine()
  }, [loadAll, loadMine])

  async function handleCreate(values: { title: string; description?: string; image_uri: string; metadata_uri?: string; royalty_percentage?: number }) {
    if (!wallet) {
      antMessage.error('Can ket noi vi de tao NFT')
      return
    }
    setCreateLoading(true)
    try {
      await mintAndListNFT({
        title: values.title,
        description: values.description,
        image_uri: values.image_uri,
        metadata_uri: values.metadata_uri || values.image_uri,
        royalty_percentage: Number(values.royalty_percentage ?? 0),
      })
      antMessage.success('Da tao NFT thanh cong')
      createForm.resetFields()
      setCreateOpen(false)
      setActiveInnerTab('mine')
      void loadAll()
      void loadMine()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tao NFT that bai'
      antMessage.error(msg)
    } finally {
      setCreateLoading(false)
    }
  }

  const normalize = (v: string) => v.trim().toLowerCase()
  const matchesSearch = (item: NFTListing) => {
    const q = normalize(searchText)
    if (!q) return true
    return [item.title, item.description, item.seller_wallet, item.token_id, item.category].some(v => (v || '').toLowerCase().includes(q))
  }
  const sortListings = (items: NFTListing[]) => {
    const next = [...items]
    if (sortMode === 'newest') return next.sort((a, b) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
    if (sortMode === 'price-low') return next.sort((a, b) => Number(a.price || '0') - Number(b.price || '0'))
    if (sortMode === 'price-high') return next.sort((a, b) => Number(b.price || '0') - Number(a.price || '0'))
    return next
  }
  const matchesOwnedSearch = (item: OwnedNFT) => {
    const q = normalize(searchText)
    if (!q) return true
    return [item.name, item.description, item.owner, item.creator, item.token_id].some(v => (v || '').toLowerCase().includes(q))
  }
  const sortOwnedNFTs = (items: OwnedNFT[]) => {
    const next = [...items]
    if (sortMode === 'newest') return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return next.sort((a, b) => Number(b.token_id || '0') - Number(a.token_id || '0'))
  }

  const visibleAll = sortListings(allListings.filter(matchesSearch))
  const visibleMine = sortOwnedNFTs(mineNFTs.filter(matchesOwnedSearch))
  const featured = visibleAll.length > 1 ? visibleAll[0] : null
  const featuredIsMine = !!featured && !!wallet && featured.seller_wallet.toLowerCase() === wallet.toLowerCase()
  const featuredCanBuy = !!featured && featured.status === 'ACTIVE' && !featuredIsMine && isPositiveWei(featured.price)
  const browseGrid = featured ? visibleAll.slice(1) : visibleAll
  const myActiveListingByToken = new Map(
    mineListings
      .filter(item => item.status === 'ACTIVE' && isPositiveWei(item.price))
      .map(item => [String(item.token_id || ''), item]),
  )
  const myDraftListingByToken = new Map(
    mineListings
      .filter(item => item.status === 'ACTIVE' && !isPositiveWei(item.price))
      .map(item => [String(item.token_id || ''), item]),
  )

  function openDetail(item: NFTListing) {
    setDetailListing(item)
    setShowDetail(true)
  }

  async function handleSellNFT(nft: OwnedNFT) {
    const tokenID = String(nft.token_id || '')
    const priceInput = (priceDrafts[tokenID] || '').trim()
    const draftListing = myDraftListingByToken.get(tokenID)
    if (!priceInput) {
      antMessage.error('Nhap gia ban NFT')
      return
    }
    if (!draftListing) {
      antMessage.error('Khong tim thay listing nhap cho NFT nay de dang ban')
      return
    }
    try {
      const priceWei = toWei(priceInput)
      if (BigInt(priceWei) <= 0n) {
        antMessage.error('Gia ban phai lon hon 0')
        return
      }
      setSellingTokenId(tokenID)
      await updateListingPrice(draftListing.id, priceWei)
      antMessage.success('Da dang ban NFT')
      setPriceDrafts(prev => ({ ...prev, [tokenID]: '' }))
      void loadAll()
      void loadMine()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the dang ban NFT')
    } finally {
      setSellingTokenId('')
    }
  }

  async function handleStopSelling(listing: NFTListing) {
    try {
      await cancelListing(listing.id)
      antMessage.success('Da dung ban NFT')
      void loadAll()
      void loadMine()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the dung ban NFT')
    }
  }

  return (
    <Spin spinning={loadingAll || loadingMine}>
      <div className="section-shell">
        {/* <Card className="nft-hero" styles={{ body: { padding: 18 } }}>
          <Row gutter={[18, 18]} align="middle">
            <Col xs={24} lg={14} className="nft-hero-copy">
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Space wrap>
                  <Tag color="blue" className="status-pill">NFT Shop</Tag>
                  <Tag color="cyan" className="status-pill">Marketplace</Tag>
                </Space>
                <Title className="nft-hero-title">Sàn NFT được trình bày như một cửa hàng thật</Title>
                <Paragraph className="nft-hero-text">
                  Người dùng vào tab này sẽ thấy NFT đang bán trước, lọc nhanh theo tên hoặc giá, xem chi tiết nổi bật, và chuyển sang khu “NFT của tôi” để quản lý bộ sưu tập cá nhân.
                </Paragraph>
                <Space wrap>
                  <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
                    Tạo NFT
                  </Button>
                  <Button size="large" onClick={() => setActiveInnerTab('all')}>
                    Khám phá NFT
                  </Button>
                </Space>
              </Space>
            </Col>
            <Col xs={24} lg={10}>
              <div className="nft-hero-panel">
                <Row gutter={[12, 12]}>
                  <Col xs={12}>
                    <div className="nft-mini-kpi">
                      <div className="label">NFT thị trường</div>
                      <div className="value">{allListings.length}</div>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="nft-mini-kpi">
                      <div className="label">NFT của tôi</div>
                      <div className="value">{mineNFTs.length}</div>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="nft-mini-kpi">
                      <div className="label">Chưa đặt giá</div>
                      <div className="value">{myDraftCount}</div>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="nft-mini-kpi">
                      <div className="label">UX style</div>
                      <div className="value">Storefront</div>
                    </div>
                  </Col>
                </Row>
              </div>
            </Col>
          </Row>
        </Card> */}

        <Card className="section-card" style={{ marginTop: 5, marginBottom: 16 }} styles={{ body: { padding: 14 } }}>
          <div className="nft-toolbar">
            <Input
              allowClear
              prefix={<CompassOutlined />}
              placeholder="Tìm NFT, mô tả, token ID, hoặc ví bán"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{ flex: '1 1 300px' }}
            />
            <Select
              value={sortMode}
              onChange={setSortMode}
              style={{ width: 220 }}
              options={[
                { value: 'featured', label: 'Nổi bật' },
                { value: 'newest', label: 'Mới nhất' },
                { value: 'price-low', label: 'Giá tăng dần' },
                { value: 'price-high', label: 'Giá giảm dần' },
              ]}
            />
            
          </div>
        </Card>

        <Tabs
          className="market-tabs"
          activeKey={activeInnerTab}
          onChange={key => setActiveInnerTab(key as 'all' | 'mine')}
          items={[
            {
              key: 'all',
              label: <Space><AppstoreOutlined />NFT thị trường</Space>,
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div className="nft-meta-row">
                    <Text className="section-desc">{visibleAll.length} NFT phù hợp với bộ lọc hiện tại</Text>
                    <Button icon={<ReloadOutlined />} onClick={() => void loadAll()}>Làm mới</Button>
                  </div>

                  {featured && (
                    <div className="nft-featured">
                      <div className="nft-featured-media">
                        <img src={featured.image_uri || `https://picsum.photos/seed/${featured.id}/1200/900`} alt={featured.title} />
                        <div style={{ position: 'absolute', top: 14, left: 14 }}>
                          <Tag color="blue" className="status-pill">Featured NFT</Tag>
                        </div>
                      </div>
                      <div className="nft-featured-info">
                        <Space direction="vertical" size={8}>
                          <Text type="secondary">NFT nổi bật</Text>
                          <Title level={3} style={{ margin: 0, color: '#0f172a' }}>{featured.title}</Title>
                          <Text type="secondary">Shop {shortAddr(featured.seller_wallet)} · Token #{featured.token_id || '0'}</Text>
                          <Text className="nft-price">{fmtVNDC(featured.price)} <span style={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>VNDC</span></Text>
                          <Text type="secondary">{featured.description || 'Mô tả sản phẩm sẽ hiển thị ở đây để người mua hiểu nhanh hơn.'}</Text>
                        </Space>
                        <Space wrap>
                          {featuredCanBuy ? (
                            <Button
                              type="primary"
                              size="large"
                              icon={<ShoppingCartOutlined />}
                              onClick={() => {
                                setSelectedListing(featured)
                                setShowBuy(true)
                              }}
                            >
                              Mua ngay
                            </Button>
                          ) : (
                            <Button size="large" onClick={() => openDetail(featured)}>
                              Chi tiết
                            </Button>
                          )}
                          <Tag color="cyan" className="status-pill">Royalty {featured.royalty_percentage}%</Tag>
                          <Tag className="status-pill">{listingStatusTag(featured.status)}</Tag>
                        </Space>
                      </div>
                    </div>
                  )}

                  {browseGrid.length === 0 ? <Empty description="Chưa có NFT nào đang bán" /> : (
                    <Row gutter={[16, 16]}>
                      {browseGrid.map(item => (
                        <Col xs={24} sm={12} xl={8} key={item.id}>
                          <Card className="glass-card nft-card" styles={{ body: { padding: 0 } }}>
                            <div className="product-cover">
                              <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.title} />
                              <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                <Tag color="blue" className="status-pill">NFT</Tag>
                              </div>
                              <div style={{ position: 'absolute', top: 10, right: 10 }}>{listingStatusTag(item.status)}</div>
                            </div>
                            <div style={{ padding: 14 }}>
                              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{item.title}</Text>
                                <Text type="secondary" style={{ fontSize: 12 }}>Shop {shortAddr(item.seller_wallet)} · Token #{item.token_id || '0'}</Text>
                                <Text style={{ fontWeight: 900, fontSize: 24, color: '#0f766e' }}>{fmtVNDC(item.price)} <span style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>VNDC</span></Text>
                                <Text type="secondary" ellipsis={{ tooltip: item.description }}>{item.description || 'NFT đang chờ bạn khám phá.'}</Text>
                                <div className="nft-card-footer">
                                  <Space wrap>
                                    {item.status === 'ACTIVE' && !isPositiveWei(item.price) ? (
                                      <Button onClick={() => openDetail(item)}>Chi tiết</Button>
                                    ) : item.status === 'ACTIVE' && item.seller_wallet.toLowerCase() !== wallet.toLowerCase() ? (
                                      <Button
                                        type="primary"
                                        icon={<ShoppingCartOutlined />}
                                        onClick={() => {
                                          setSelectedListing(item)
                                          setShowBuy(true)
                                        }}
                                      >
                                        Mua ngay
                                      </Button>
                                    ) : (
                                      <Button onClick={() => openDetail(item)}>Chi tiết</Button>
                                    )}
                                    <Tag color="cyan" className="status-pill">Royalty {item.royalty_percentage}%</Tag>
                                  </Space>
                                </div>
                              </Space>
                            </div>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  )}
                </Space>
              ),
            },
            {
              key: 'mine',
              label: <Space><ShopOutlined />NFT của tôi</Space>,
              children: (
                <Space direction="vertical" size={16} style={{ width: '100%' }}>
                  <div className="nft-meta-row">
                    <Text className="section-desc">Bộ sưu tập NFT bạn đang sở hữu, hiển thị theo owner thật thay vì theo listing của người bán.</Text>
                    <Space>
                      <Button icon={<ReloadOutlined />} onClick={() => void loadMine()}>Làm mới</Button>
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>Tạo NFT</Button>
                    </Space>
                  </div>

                  {visibleMine.length === 0 ? <Empty description="Bạn chưa có NFT nào" /> : (
                    <Row gutter={[16, 16]}>
                      {visibleMine.map(item => {
                        const tokenID = String(item.token_id || '')
                        const activeListing = myActiveListingByToken.get(tokenID)
                        const isSelling = !!activeListing
                        return (
                          <Col xs={24} sm={12} xl={8} key={item.id}>
                            <Card className="glass-card nft-card" styles={{ body: { padding: 0 } }}>
                              <div className="product-cover" style={{ height: 200 }}>
                                <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.name} />
                                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                  <Tag color="purple" className="status-pill">NFT của tôi</Tag>
                                </div>
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                  {isSelling ? <Tag color="green" className="status-pill">Đang bán</Tag> : <Tag className="status-pill">Không bán</Tag>}
                                </div>
                              </div>
                              <div style={{ padding: 14 }}>
                                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                                  <Text strong style={{ fontSize: 16, color: '#0f172a' }}>{item.name}</Text>
                                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Token #{tokenID || '0'}</Text>
                                  <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Owner: {shortAddr(item.owner)}</Text>
                                  {isSelling && activeListing ? (
                                    <>
                                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Giá đang bán: {fmtVNDC(activeListing.price)} VNDC</Text>
                                      <Popconfirm title="Dừng bán NFT này?" onConfirm={() => void handleStopSelling(activeListing)}>
                                        <Button danger block>Ngừng bán</Button>
                                      </Popconfirm>
                                    </>
                                  ) : (
                                    <>
                                      <Input
                                        value={priceDrafts[tokenID] || ''}
                                        onChange={e => setPriceDrafts(prev => ({ ...prev, [tokenID]: e.target.value }))}
                                        placeholder="Nhập giá bán (VNDC), ví dụ 12.5"
                                      />
                                      <Button type="primary" block loading={sellingTokenId === tokenID} onClick={() => void handleSellNFT(item)}>
                                        Bán NFT
                                      </Button>
                                    </>
                                  )}
                                </Space>
                              </div>
                            </Card>
                          </Col>
                        )
                      })}
                    </Row>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={<Space><PlusOutlined /><span>Tạo NFT mới</span></Space>}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        centered
        width={720}
      >
        <Form layout="vertical" form={createForm} onFinish={handleCreate} initialValues={{ royalty_percentage: 0 }}>
          <Row gutter={12}>
            <Col xs={24} md={14}>
              <Form.Item name="title" label="Tên NFT" rules={[{ required: true, message: 'Nhập tên NFT' }]}>
                <Input placeholder="VD: VNDC Founder Badge" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item name="royalty_percentage" label="Royalty (%)">
                <InputNumber min={0} max={50} placeholder="0" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="image_uri" label="Link ảnh IPFS" rules={[{ required: true, message: 'Nhập link ảnh IPFS' }]}>
            <Input placeholder="ipfs://... hoặc https://gateway.ipfs/..." />
          </Form.Item>
          <Form.Item name="metadata_uri" label="Metadata URI (tuỳ chọn)">
            <Input placeholder="Để trống nếu muốn dùng ảnh làm metadata" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={4} placeholder="Mô tả NFT, bộ sưu tập, sự kiện..." />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Huỷ</Button>
            <Button type="primary" htmlType="submit" loading={createLoading} icon={<PlusOutlined />}>
              Tạo NFT
            </Button>
          </Space>
        </Form>
      </Modal>

      <Drawer
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title="Chi tiết NFT"
        width={560}
      >
        {!detailListing ? <Empty /> : (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <img
              src={detailListing.image_uri || `https://picsum.photos/seed/${detailListing.id}/900/640`}
              alt={detailListing.title}
              style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }}
            />
            <Title level={4} style={{ margin: 0 }}>{detailListing.title}</Title>
            <Text type="secondary">Shop {shortAddr(detailListing.seller_wallet)} · Token #{detailListing.token_id || '0'}</Text>
            <Text>{detailListing.description || 'NFT chưa có mô tả.'}</Text>
            <Space>
              {listingStatusTag(detailListing.status)}
              {isPositiveWei(detailListing.price) && <Tag color="cyan" className="status-pill">Giá {fmtVNDC(detailListing.price)} VNDC</Tag>}
            </Space>
          </Space>
        )}
      </Drawer>

      <BuyDrawer
        open={showBuy}
        item={selectedListing}
        user={user}
        onClose={() => setShowBuy(false)}
        onDone={() => {
          void loadAll()
          void loadMine()
        }}
      />
    </Spin>
  )
}

function MyOrdersTab({ refreshKey }: { refreshKey: number }) {
  const [orders, setOrders] = useState<MarketplacePurchase[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMyPurchases(1, 80)
      setOrders(res.items)
    } catch {
      antMessage.error('Khong the tai don hang')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  async function cancelOrder(orderId: string) {
    try {
      await cancelMyPurchase(orderId)
      antMessage.success('Da huy don hang')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the huy don')
    }
  }

  return (
    <Spin spinning={loading}>
      {orders.length === 0 ? <Empty description="Chua co don hang" /> : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {orders.map(order => (
            <Card key={order.id} className="glass-card" styles={{ body: { padding: 14 } }}>
              <Row gutter={14}>
                <Col xs={24} md={16}>
                  <Space align="start" size={12}>
                    <img src={order.listing_image_uri || `https://picsum.photos/seed/${order.listing_id}/90/90`} alt={order.listing_title || 'listing'} style={{ width: 90, height: 90, borderRadius: 10, objectFit: 'cover' }} />
                    <div>
                      <Text strong>{order.listing_title || `San pham ${order.listing_id.slice(0, 8)}`}</Text>
                      <div><Text type="secondary">Shop {shortAddr(order.seller_wallet)}</Text></div>
                      <div><Text style={{ fontWeight: 700, color: '#b91c1c' }}>{fmtVNDC(order.price)} VNDC</Text></div>
                      <div><Text type="secondary">Dat luc {fmtDateTime(order.created_at)}</Text></div>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={8}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {purchaseStatusTag(order.status)}
                    <Text type="secondary" style={{ fontSize: 12 }}>Du kien giao: {fmtDateTime(order.expected_delivery)}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{etaText(order.expected_delivery)}</Text>
                    {(order.payment_method !== 'TOKEN' && (order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT')) && (
                      <Popconfirm title="Ban chac chan muon huy don nay?" onConfirm={() => cancelOrder(order.id)}>
                        <Button danger size="small">Huy don</Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Col>
              </Row>
              <Divider style={{ margin: '10px 0' }} />
              <Descriptions size="small" column={1} styles={{ label: { width: 170 } }}>
                <Descriptions.Item label="Nguoi nhan">{order.recipient_name || '---'}</Descriptions.Item>
                <Descriptions.Item label="So dien thoai">{order.recipient_phone || '---'}</Descriptions.Item>
                <Descriptions.Item label="Dia chi">{order.shipping_address || '---'}</Descriptions.Item>
              </Descriptions>
            </Card>
          ))}
        </Space>
      )}
    </Spin>
  )
}

function SellerCenterTab({ user }: { user?: AuthUser }) {
  const [orders, setOrders] = useState<MarketplacePurchase[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const orderRes = await getSellerOrders(1, 120)
      setOrders(orderRes.items)
    } catch {
      antMessage.error('Khong the tai du lieu shop')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const revenueWei = useMemo(() => orders.reduce((sum, o) => {
    if (o.status !== 'COMPLETED' && o.status !== 'DELIVERED') return sum
    try {
      return sum + BigInt(o.price || '0')
    } catch {
      return sum
    }
  }, BigInt(0)).toString(), [orders])

  const pendingOrders = orders.filter(o => ['PENDING_PAYMENT', 'PENDING_COD', 'RECEIVED', 'PACKED', 'SHIPPING'].includes(o.status))
  const statusBuckets = useMemo(() => {
    const base: Record<string, number> = {
      PENDING: 0,
      RECEIVED: 0,
      PACKED: 0,
      SHIPPING: 0,
      COMPLETED: 0,
    }
    for (const order of orders) {
      if (order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT') base.PENDING += 1
      else if (order.status === 'RECEIVED') base.RECEIVED += 1
      else if (order.status === 'PACKED') base.PACKED += 1
      else if (order.status === 'SHIPPING') base.SHIPPING += 1
      else if (order.status === 'COMPLETED' || order.status === 'DELIVERED') base.COMPLETED += 1
    }
    return base
  }, [orders])
  const maxBucket = Math.max(1, ...Object.values(statusBuckets))
  const avgOrderValue = useMemo(() => {
    if (!orders.length) return '0'
    let total = BigInt(0)
    for (const order of orders) {
      try { total += BigInt(order.price || '0') } catch {}
    }
    return (total / BigInt(orders.length)).toString()
  }, [orders])

  async function updateStatus(order: MarketplacePurchase, status: SellerOrderStatus) {
    try {
      await updateSellerOrderStatus(order.id, status, status === 'RECEIVED' ? 72 : undefined)
      antMessage.success('Cap nhat trang thai thanh cong')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the cap nhat')
    }
  }

  async function cancelOrderBySeller(order: MarketplacePurchase) {
    try {
      if (order.payment_method === 'TOKEN') {
        if (!user?.wallet_address) {
          antMessage.error('Can ket noi vi seller de huy don token')
          return
        }
        const chainId = parseInt(import.meta.env.VITE_CHAIN_ID ?? '31337', 10)
        await switchChain(chainId)
        const { nonce } = await getNonce(user.wallet_address)
        const deadline = Math.floor(Date.now() / 1000) + 3600
        const typedData = buildTransferTypedData({
          chainId,
          verifyingContract: import.meta.env.VITE_TOKEN_CONTRACT_ADDRESS,
          from: user.wallet_address,
          to: order.buyer_wallet,
          amount: order.price,
          nonce: String(nonce),
          deadline,
        })
        const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)
        await cancelSellerOrder(order.id, {
          from_wallet: user.wallet_address,
          nonce: String(nonce),
          deadline,
          signature: signature ?? '',
        })
      } else {
        await cancelSellerOrder(order.id)
      }
      antMessage.success('Da huy don hang')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Khong the huy don')
    }
  }

  return (
    <Spin spinning={loading}>
      <Card className="seller-panel" style={{ marginBottom: 14 }}>
        <Row gutter={[12, 12]}>
          <Col xs={12} md={6}>
            <div className="metric-tile">
              <div className="metric-title">Don can xu ly</div>
              <div className="metric-value">{pendingOrders.length}</div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div className="metric-tile">
              <div className="metric-title">Don hoan thanh</div>
              <div className="metric-value">{orders.filter(o => o.status === 'COMPLETED').length}</div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div className="metric-tile">
              <div className="metric-title">Doanh thu</div>
              <div className="metric-value">{fmtVNDC(revenueWei)}</div>
              <div className="metric-title">VNDC</div>
            </div>
          </Col>
          <Col xs={12} md={6}>
            <div className="metric-tile">
              <div className="metric-title">AOV trung binh</div>
              <div className="metric-value">{fmtVNDC(avgOrderValue)}</div>
              <div className="metric-title">VNDC / don</div>
            </div>
          </Col>
        </Row>

        <Divider style={{ margin: '14px 0' }} />

        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space>
            <BarChartOutlined />
            <Text strong>Phan tich pipeline don hang</Text>
          </Space>
          <div className="status-chart">
            {([
              ['PENDING', 'Dat hang'],
              ['RECEIVED', 'Nhan don'],
              ['PACKED', 'Dong goi'],
              ['SHIPPING', 'Van chuyen'],
              ['COMPLETED', 'Hoan thanh'],
            ] as const).map(([key, label]) => (
              <div className="status-bar" key={key}>
                <Text strong>{label}</Text>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a' }}>{statusBuckets[key]}</div>
                <div className="status-bar-track">
                  <div className="status-bar-fill" style={{ width: `${Math.round((statusBuckets[key] / maxBucket) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Space>
      </Card>

      <Card className="glass-card" title="Quan ly don hang" extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void load()}>Lam moi</Button>}>
        {pendingOrders.length === 0 ? <Empty description="Khong co don can xu ly" /> : (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            {pendingOrders.map(order => (
              <div key={order.id} className="order-row">
                <Row gutter={10} align="middle">
                  <Col xs={24} md={7}>
                    <Text strong>{order.listing_title || shortAddr(order.listing_id)}</Text>
                    <div><Text type="secondary">Nguoi mua {shortAddr(order.buyer_wallet)}</Text></div>
                    <div>{purchaseStatusTag(order.status)}</div>
                  </Col>
                  <Col xs={24} md={7}>
                    <Text type="secondary">Dia chi: {order.shipping_address || '---'}</Text><br />
                    <Text type="secondary">SDT: {order.recipient_phone || '---'}</Text>
                  </Col>
                  <Col xs={24} md={5}>
                    <Text type="secondary">Gia tri</Text>
                    <div><Text strong style={{ color: '#0f766e' }}>{fmtVNDC(order.price)} VNDC</Text></div>
                    <Text type="secondary" style={{ fontSize: 12 }}>Dat luc {fmtDateTime(order.created_at)}</Text>
                  </Col>
                  <Col xs={24} md={5}>
                    <Space wrap>
                      {(() => {
                        const next = nextSellerStatus(order.status)
                        if (!next) return <Text type="secondary">Khong co thao tac</Text>
                        const labelMap: Record<SellerOrderStatus, string> = {
                          RECEIVED: 'Xac nhan da nhan don',
                          PACKED: 'Cap nhat da dong goi',
                          SHIPPING: 'Cap nhat dang giao',
                          DELIVERED: 'Xac nhan da giao',
                        }
                        return (
                          <Button type="primary" size="small" onClick={() => updateStatus(order, next)}>
                            {labelMap[next]}
                          </Button>
                        )
                      })()}
                      {(order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT' || order.status === 'RECEIVED') && (
                        <Popconfirm title="Huy don hang nay?" onConfirm={() => cancelOrderBySeller(order)}>
                          <Button danger size="small">Huy don</Button>
                        </Popconfirm>
                      )}
                    </Space>
                  </Col>
                </Row>
              </div>
            ))}
          </Space>
        )}
      </Card>

      <Card className="glass-card" style={{ marginTop: 14 }} title="Don hang gan day">
        {orders.slice(0, 5).map(order => (
          <Row key={order.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
            <Col span={10}><Text>{order.listing_title || shortAddr(order.listing_id)}</Text></Col>
            <Col span={6}><Text type="secondary">{statusText(order.status)}</Text></Col>
            <Col span={8} style={{ textAlign: 'right' }}><Text strong>{fmtVNDC(order.price)} VNDC</Text></Col>
          </Row>
        ))}
      </Card>
    </Spin>
  )
}

export default function MarketplacePage({ user }: MarketplacePageProps): ReactElement {
  const [orderRefreshTick, setOrderRefreshTick] = useState(0)

  const tabs: TabsProps['items'] = [
    {
      key: 'market',
      label: <Space><AppstoreOutlined />Marketplace</Space>,
      children: <BrowseTab user={user} onOrderPlaced={() => setOrderRefreshTick(v => v + 1)} />,
    },
    {
      key: 'nft-shop',
      label: <Space><ShopOutlined />NFT Shop</Space>,
      children: <NFTShopTab user={user} />,
    },
    { key: 'orders', label: <Space><HistoryOutlined />Don hang cua toi</Space>, children: <MyOrdersTab refreshKey={orderRefreshTick} /> },
    { key: 'seller', label: <Space><SolutionOutlined />Seller Center</Space>, children: <SellerCenterTab user={user} /> },
  ]

  return (
    <div className="market-page" style={{ maxWidth: 1420, margin: '0 auto' }}>
      <style>{MARKETPLACE_STYLES}</style>

      <Card className="shop-hero" style={{ marginBottom: 18 }} styles={{ body: { padding: '22px 24px' } }}>
        <Row gutter={[20, 20]} align="middle" className="shop-hero-content">
          <Col xs={24} lg={14}>
            <Title level={2} className="hero-title">
              <ShopOutlined /> VNDC Commerce Hub
            </Title>
            <Paragraph className="hero-desc">
              Giao dien san thuong mai day du: chi tiet san pham, profile shop, mua hang co dia chi - SDT,
              theo doi don hang va seller center quan ly van chuyen nhu san thuc te.
            </Paragraph>
            <div className="hero-subtext" style={{ marginTop: 8, letterSpacing: '.03em', textTransform: 'uppercase', fontSize: 11 }}>Mua sắm NFT và hàng hóa theo một trải nghiệm đồng nhất</div>
          </Col>

          <Col xs={24} lg={10} style={{ textAlign: 'right' }}>
            <div className="sync-badge">
              <span className="sync-dot" />
              <Text style={{ color: '#6EE7B7', fontSize: 12, fontWeight: 600 }}>Da dong bo</Text>
            </div>
            <Space size={12} style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
              <Tag color="blue">On-chain transfer</Tag>
              <Tag color="cyan">Off-chain order</Tag>
              <Tag color="green">DB finalize</Tag>
            </Space>
            <Text style={{ color: '#93C5FD', fontSize: 12 }}>Cap nhat trang thai mua ban lien tuc</Text>
          </Col>
        </Row>
      </Card>

      <Card className="glass-card market-tabs">
        <Tabs defaultActiveKey="nft-shop" size="large" items={tabs} />
      </Card>
    </div>
  )
}
