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
import { getActiveChainConfig, getRequiredContractAddress } from '../lib/chainConfig'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

interface MarketplacePageProps { user?: AuthUser }

type VotePayMethod = 'TOKEN' | 'COD'

type SellerOrderStatus = 'RECEIVED' | 'PACKED' | 'SHIPPING' | 'DELIVERED'

const MARKETPLACE_STYLES = `
.market-page {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.32), rgba(239, 246, 255, 0.12) 42%, rgba(236, 253, 245, 0.1)),
    var(--visual-marketplace-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, rgba(219, 234, 254, 0.72), rgba(236, 253, 245, 0.46));
  box-shadow: 0 34px 90px rgba(37, 99, 235, 0.16);
  padding: 18px 18px 40px;
}

.market-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(760px 320px at 8% -4%, rgba(37, 99, 235, 0.18), transparent 68%),
    radial-gradient(720px 340px at 95% 2%, rgba(14, 165, 233, 0.18), transparent 66%),
    radial-gradient(620px 360px at 52% 108%, rgba(16, 185, 129, 0.13), transparent 64%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(246, 248, 251, 0.78));
  pointer-events: none;
}

.market-page::after {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: -1;
  border-radius: 27px;
  background:
    linear-gradient(125deg, rgba(255, 255, 255, 0.32), transparent 34%, rgba(255, 255, 255, 0.16) 62%, transparent 82%);
  opacity: 0.62;
  pointer-events: none;
}


.market-page .market-card-grid {
  align-items: stretch;
}

.market-page .market-card-grid > .ant-col {
  display: flex;
}

.market-page .market-card-grid .ant-card {
  width: 100%;
}

.market-page .market-card-grid .ant-card-body {
  min-width: 0;
}

.market-page .market-fixed-card {
  height: 100%;
}

.market-page .market-item-card,
.market-page .market-nft-card {
  height: 438px;
  min-height: 438px;
}

.market-page .market-item-card {
  height: 392px;
  min-height: 392px;
}

.market-page .market-owned-card {
  height: 430px;
  min-height: 430px;
}

.market-page .market-item-card > .ant-card-body,
.market-page .market-nft-card > .ant-card-body {
  height: 100%;
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.market-page .market-item-body,
.market-page .market-nft-body,
.market-page .market-owned-body {
  flex: 1;
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.market-page .market-item-body .ant-space,
.market-page .market-nft-body .ant-space,
.market-page .market-owned-body .ant-space {
  min-height: 0;
}

.market-page .market-item-footer,
.market-page .nft-card-footer,
.market-page .market-owned-actions {
  padding-top: 10px;
}

.market-page .market-line-clamp-1,
.market-page .market-line-clamp-2,
.market-page .market-line-clamp-3 {
  display: -webkit-box !important;
  overflow: hidden;
  -webkit-box-orient: vertical;
  white-space: normal !important;
}

.market-page .market-line-clamp-1 { -webkit-line-clamp: 1; }
.market-page .market-line-clamp-2 { -webkit-line-clamp: 2; }
.market-page .market-line-clamp-3 { -webkit-line-clamp: 3; }

.market-page .market-item-title,
.market-page .market-nft-title {
  min-height: 42px;
  color: var(--ink) !important;
  font-size: 16px;
  font-weight: 780 !important;
  line-height: 1.28;
}

.market-page .market-item-seller,
.market-page .market-nft-meta {
  min-height: 18px;
  color: var(--ink-subtle) !important;
  font-size: 12px;
}

.market-page .market-nft-description {
  min-height: 40px;
  color: var(--ink-muted) !important;
  line-height: 1.45;
}

.market-page .market-price-row {
  display: flex;
  align-items: baseline;
  gap: 5px;
  min-height: 36px;
}

.market-page .market-price-row .market-price-main {
  color: #047857 !important;
  font-size: 24px;
  font-weight: 900 !important;
  line-height: 1;
  letter-spacing: -0.02em;
}

.market-page .market-price-row .market-price-unit {
  color: var(--ink-subtle) !important;
  font-size: 13px;
  font-weight: 740;
}

.market-page .market-toolbar-card,
.market-page .market-tabs,
.market-page .shop-hero,
.market-page .market-featured-card {
  backdrop-filter: blur(20px) saturate(1.6);
  -webkit-backdrop-filter: blur(20px) saturate(1.6);
}

.market-page .market-featured-card {
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08));
  padding: 12px;
  box-shadow:
    0 24px 58px rgba(37, 99, 235, 0.14),
    inset 0 1px 0 rgba(255, 255, 255, 0.84);
}

.market-page .market-featured-card::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(120deg, rgba(255,255,255,0.42), transparent 34%, rgba(14,165,233,0.08) 72%),
    radial-gradient(520px 150px at 8% 0%, rgba(255,255,255,0.52), transparent 72%);
  pointer-events: none;
}

.market-page .market-featured-card > * {
  position: relative;
  z-index: 1;
}

.market-page .glass-card,
.market-page .section-card,
.market-page .section-shell,
.market-page .seller-panel,
.market-page .buy-drawer-card,
.market-page .metric-tile,
.market-page .status-bar,
.market-page .order-row,
.market-page .nft-featured-info,
.market-page .nft-hero-panel,
.market-page .hero-stat {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.62) !important;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.12)) !important;
  box-shadow:
    0 22px 54px rgba(37, 99, 235, 0.13),
    0 8px 18px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.86),
    inset 0 -1px 0 rgba(37, 99, 235, 0.08) !important;
  backdrop-filter: blur(18px) saturate(1.85) contrast(1.05);
  -webkit-backdrop-filter: blur(18px) saturate(1.85) contrast(1.05);
  color: var(--ink);
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
}


.market-page .glass-card,
.market-page .section-card,
.market-page .section-shell,
.market-page .seller-panel,
.market-page .buy-drawer-card,
.market-page .metric-tile,
.market-page .status-bar,
.market-page .order-row,
.market-page .nft-featured-info,
.market-page .nft-hero-panel,
.market-page .hero-stat {
  transform-style: preserve-3d;
}

.market-page .glass-card::after,
.market-page .section-card::after,
.market-page .section-shell::after,
.market-page .seller-panel::after,
.market-page .buy-drawer-card::after,
.market-page .metric-tile::after,
.market-page .status-bar::after,
.market-page .order-row::after,
.market-page .nft-featured-info::after,
.market-page .nft-hero-panel::after,
.market-page .hero-stat::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.88), rgba(255,255,255,0.08) 38%, rgba(14,165,233,0.18) 68%, rgba(255,255,255,0.42));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.market-page .glass-card::before,
.market-page .section-card::before,
.market-page .section-shell::before,
.market-page .seller-panel::before,
.market-page .buy-drawer-card::before,
.market-page .metric-tile::before,
.market-page .status-bar::before,
.market-page .order-row::before,
.market-page .nft-featured-info::before,
.market-page .nft-hero-panel::before,
.market-page .hero-stat::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.46), transparent 28%, rgba(255, 255, 255, 0.12) 56%, transparent 78%),
    radial-gradient(460px 110px at 12% 0%, rgba(255, 255, 255, 0.58), transparent 72%);
  opacity: 0.62;
  pointer-events: none;
}

.market-page .glass-card > *,
.market-page .section-card > *,
.market-page .section-shell > *,
.market-page .seller-panel > *,
.market-page .buy-drawer-card > *,
.market-page .metric-tile > *,
.market-page .status-bar > *,
.market-page .order-row > *,
.market-page .nft-featured-info > *,
.market-page .nft-hero-panel > *,
.market-page .hero-stat > * {
  position: relative;
  z-index: 1;
}

.market-page .glass-card:hover,
.market-page .nft-card:hover,
.market-page .market-related-card:hover,
.market-page .order-row:hover {
  border-color: rgba(255, 255, 255, 0.82) !important;
  box-shadow:
    0 30px 70px rgba(37, 99, 235, 0.18),
    0 12px 26px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95) !important;
  transform: translateY(-3px);
}

.market-page .shop-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(191, 219, 254, 0.88);
  border-radius: 24px;
  background:
    linear-gradient(110deg, rgba(255, 255, 255, 0.94) 0%, rgba(239, 246, 255, 0.88) 48%, rgba(236, 253, 245, 0.72) 100%),
    var(--visual-marketplace, none) center right / cover no-repeat !important;
  box-shadow: 0 24px 70px rgba(37, 99, 235, 0.14);
}

.market-page .shop-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(420px 180px at 82% 18%, rgba(14, 165, 233, 0.2), transparent 70%),
    radial-gradient(280px 180px at 96% 92%, rgba(16, 185, 129, 0.2), transparent 72%);
  pointer-events: none;
}

.market-page .shop-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: linear-gradient(90deg, #2563eb, #0ea5e9, #10b981);
  pointer-events: none;
}

.market-page .shop-hero-content {
  position: relative;
  z-index: 1;
}

.market-page .shop-hero .hero-title {
  color: var(--ink) !important;
  margin: 0 !important;
  font-family: var(--font-sans) !important;
  font-weight: 800 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.02em;
}

.market-page .shop-hero .hero-desc {
  max-width: 820px;
  color: var(--ink-muted) !important;
  margin-top: 8px;
  margin-bottom: 0 !important;
  font-size: 14px;
}

.market-page .hero-subtext {
  color: var(--accent);
  font-size: 11px;
  font-weight: 740;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.market-page .shop-hero .sync-badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  justify-content: flex-end;
  border: 1px solid rgba(16, 185, 129, 0.26);
  border-radius: 999px;
  background: rgba(236, 253, 245, 0.48);
  padding: 5px 10px;
  margin-bottom: 10px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.76);
}

.market-page .shop-hero .sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 0 5px rgba(16, 185, 129, 0.13);
}

.market-page .market-tabs {
  border-radius: 22px;
}

.market-page .market-tabs .ant-card-body {
  padding: 18px;
}

.market-page .market-tabs .ant-tabs-nav {
  margin: 0 0 18px;
}

.market-page .market-tabs .ant-tabs-nav::before {
  border-bottom-color: rgba(191, 219, 254, 0.7);
}

.market-page .market-tabs .ant-tabs-tab {
  border-radius: 999px;
  color: var(--ink-muted);
  font-size: 13px;
  font-weight: 720;
  padding: 10px 16px;
  transition: background 180ms ease, transform 180ms ease, color 180ms ease;
}

.market-page .market-tabs .ant-tabs-tab:hover {
  color: var(--accent-strong);
  transform: translateY(-1px);
}

.market-page .market-tabs .ant-tabs-tab.ant-tabs-tab-active {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.13), rgba(14, 165, 233, 0.1) 58%, rgba(16, 185, 129, 0.1));
  box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.66);
}

.market-page .market-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
  color: var(--accent-strong) !important;
}

.market-page .market-tabs .ant-tabs-ink-bar {
  display: none;
}

.market-page .market-tabs .ant-tabs-tab-btn {
  color: inherit;
}

.market-page .section-shell {
  padding: 18px;
}

.market-page .section-head,
.market-page .nft-meta-row,
.market-page .nft-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}

.market-page .section-title {
  color: var(--ink);
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}

.market-page .section-desc {
  color: var(--ink-muted);
  margin-top: 4px;
  font-size: 13px;
}

.market-page .market-toolbar-card {
  margin-bottom: 16px;
}

.market-page .market-toolbar-card .ant-input,
.market-page .market-toolbar-card .ant-input-affix-wrapper,
.market-page .market-toolbar-card .ant-select-selector,
.market-page .market-toolbar-card .ant-input-number,
.market-page .market-liquid-modal .ant-input,
.market-page .market-liquid-modal .ant-input-affix-wrapper,
.market-page .market-liquid-modal .ant-input-number,
.market-page .market-liquid-modal .ant-select-selector,
.market-page .market-liquid-drawer .ant-input,
.market-page .market-liquid-drawer .ant-input-affix-wrapper,
.market-page .market-liquid-drawer .ant-input-number,
.market-page .market-liquid-drawer .ant-select-selector {
  border-radius: 12px !important;
  border-color: rgba(191, 219, 254, 0.9) !important;
  background: rgba(255, 255, 255, 0.78) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.market-page .product-cover {
  position: relative;
  overflow: hidden;
  height: 196px;
  flex: 0 0 196px;
  border-radius: 16px;
  background:
    radial-gradient(280px 160px at 20% 8%, rgba(255, 255, 255, 0.72), transparent 70%),
    linear-gradient(135deg, #dbeafe 0%, #e0f2fe 48%, #dcfce7 100%);
}

.market-page .product-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 260ms ease, filter 260ms ease;
}

.market-page .nft-card:hover .product-cover img,
.market-page .market-item-card:hover .product-cover img {
  filter: saturate(1.05);
  transform: scale(1.035);
}

.market-page .market-cover-chip-left .ant-tag,
.market-page .market-cover-chip-right .ant-tag,
.market-page .product-cover .ant-tag {
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.market-page .nft-featured {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 16px;
  align-items: stretch;
}

.market-page .nft-featured-media {
  position: relative;
  min-height: 360px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.58);
  border-radius: 22px;
  background:
    radial-gradient(360px 160px at 12% 8%, rgba(255, 255, 255, 0.78), transparent 70%),
    linear-gradient(135deg, #dbeafe 0%, #ecfeff 56%, #dcfce7 100%);
  box-shadow: 0 20px 46px rgba(37, 99, 235, 0.13);
}

.market-page .nft-featured-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.market-page .nft-featured-info {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 12px;
  padding: 20px;
}

.market-page .nft-price,
.market-page .market-price-block > .ant-typography {
  color: #047857 !important;
  font-weight: 900 !important;
  letter-spacing: -0.02em;
}

.market-page .nft-price {
  font-size: 30px;
}

.market-page .nft-card,
.market-page .market-item-card,
.market-page .market-related-card {
  overflow: hidden;
  border-radius: 20px;
  transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
}

.market-page .nft-card-footer {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.market-page .market-item-title {
  color: var(--ink);
  line-height: 1.3;
}

.market-page .market-item-seller {
  color: var(--ink-subtle) !important;
}

.market-page .status-pill {
  border-radius: 999px;
  font-size: 11px;
  font-weight: 760;
  line-height: 1.35;
  padding: 3px 10px;
}

.market-page .nft-mini-kpi {
  border-radius: 16px;
  padding: 14px;
}

.market-page .nft-mini-kpi .label,
.market-page .metric-title,
.market-page .hero-stat .label {
  color: var(--ink-subtle);
  font-size: 12px;
  font-weight: 650;
}

.market-page .nft-mini-kpi .value,
.market-page .metric-value,
.market-page .hero-stat .value {
  color: var(--ink);
  font-size: 25px;
  font-weight: 820;
  line-height: 1.12;
  letter-spacing: -0.02em;
}

.market-page .buy-drawer-photo {
  width: 96px;
  height: 96px;
  flex: 0 0 auto;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.12);
}

.market-page .seller-panel {
  margin-bottom: 14px;
}

.market-page .metric-tile {
  min-height: 108px;
  padding: 14px;
}

.market-page .status-chart {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.market-page .status-bar {
  padding: 12px 10px;
  text-align: center;
}

.market-page .status-bar-track {
  width: 100%;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.9);
  margin-top: 8px;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
}

.market-page .status-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #2563eb 0%, #0ea5e9 52%, #10b981 100%);
}

.market-page .order-row {
  padding: 12px;
  border-radius: 16px;
}


.market-liquid-drawer .ant-drawer-content,
.market-liquid-modal .ant-modal-content {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.92) 58%, rgba(236, 253, 245, 0.86)) !important;
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow:
    0 30px 80px rgba(37, 99, 235, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(22px) saturate(1.65);
  -webkit-backdrop-filter: blur(22px) saturate(1.65);
}

.market-page .market-filter-bar {
  padding: 14px;
}

.market-liquid-drawer .ant-drawer-body,
.market-liquid-modal .ant-modal-body {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08)),
    var(--visual-marketplace-bg, none) center top / cover no-repeat;
  background-blend-mode: screen, normal;
}

.market-liquid-drawer .ant-drawer-header,
.market-liquid-modal .ant-modal-header {
  background: transparent !important;
  border-bottom-color: rgba(191, 219, 254, 0.72) !important;
}

.market-liquid-drawer .ant-drawer-title,
.market-liquid-modal .ant-modal-title {
  color: var(--ink);
  font-weight: 780;
}

.market-liquid-drawer .ant-input,
.market-liquid-drawer .ant-input-affix-wrapper,
.market-liquid-drawer .ant-input-number,
.market-liquid-drawer .ant-select-selector,
.market-liquid-modal .ant-input,
.market-liquid-modal .ant-input-affix-wrapper,
.market-liquid-modal .ant-input-number,
.market-liquid-modal .ant-select-selector {
  border-radius: 12px !important;
  border-color: rgba(191, 219, 254, 0.9) !important;
  background: rgba(255, 255, 255, 0.78) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.market-liquid-drawer .ant-btn,
.market-liquid-modal .ant-btn {
  border-radius: 12px;
  font-weight: 650;
}

.market-liquid-drawer .ant-btn-primary,
.market-liquid-modal .ant-btn-primary {
  border-color: #2563eb !important;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
}

.market-liquid-drawer .market-detail-image,
.market-liquid-drawer .market-nft-detail-drawer img,
.market-liquid-modal img {
  box-shadow:
    0 22px 48px rgba(37, 99, 235, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

.market-page .market-liquid-drawer .ant-drawer-content,
.market-page .market-liquid-modal .ant-modal-content {
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.92) 58%, rgba(236, 253, 245, 0.86)) !important;
  backdrop-filter: blur(18px) saturate(1.45);
  -webkit-backdrop-filter: blur(18px) saturate(1.45);
}

.market-page .market-liquid-drawer .ant-drawer-header,
.market-page .market-liquid-modal .ant-modal-header {
  background: transparent !important;
  border-bottom-color: rgba(191, 219, 254, 0.72) !important;
}

.market-page .ant-btn-primary {
  border-color: #2563eb !important;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
}

.market-page .ant-btn {
  border-radius: 12px;
  font-weight: 650;
}

.market-page .ant-card-head {
  border-bottom-color: rgba(191, 219, 254, 0.66) !important;
  background: transparent !important;
}

.market-page .ant-card-head-title {
  color: var(--ink);
  font-weight: 780;
}

.market-page .ant-divider {
  border-color: rgba(191, 219, 254, 0.62);
}

.market-page .ant-empty-description,
.market-page .ant-typography-secondary,
.market-page .ant-descriptions-item-label {
  color: var(--ink-subtle) !important;
}


.market-page .market-owned-card .product-cover {
  height: 180px !important;
  flex-basis: 180px;
}

.market-page .market-featured-card .nft-featured-media {
  min-height: 340px;
}

.market-page .market-toolbar-card .ant-card-body {
  padding: 14px !important;
}

.market-page .market-tabs > .ant-card-body {
  padding: 18px !important;
}


/* Stronger liquid-glass pass: clearer refraction, thinner edges, brighter highlights */
.market-page {
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.18), rgba(239, 246, 255, 0.08) 42%, rgba(236, 253, 245, 0.06)),
    radial-gradient(900px 440px at 8% -4%, rgba(37, 99, 235, 0.22), transparent 68%),
    radial-gradient(840px 420px at 94% 0%, rgba(14, 165, 233, 0.22), transparent 66%),
    radial-gradient(720px 380px at 54% 108%, rgba(16, 185, 129, 0.15), transparent 64%),
    var(--visual-marketplace-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, rgba(219, 234, 254, 0.72), rgba(236, 253, 245, 0.46));
}

.market-page .glass-card,
.market-page .section-card,
.market-page .section-shell,
.market-page .seller-panel,
.market-page .buy-drawer-card,
.market-page .metric-tile,
.market-page .status-bar,
.market-page .order-row,
.market-page .nft-featured-info,
.market-page .nft-hero-panel,
.market-page .hero-stat,
.market-page .seller-chart-card,
.market-page .seller-analytics-card,
.market-page .seller-order-card {
  border: 1px solid rgba(255, 255, 255, 0.78) !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.07) 48%, rgba(219, 234, 254, 0.12)) !important;
  box-shadow:
    0 30px 76px rgba(37, 99, 235, 0.18),
    0 12px 28px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.98),
    inset 0 -18px 36px rgba(37, 99, 235, 0.08),
    inset 18px 0 36px rgba(255, 255, 255, 0.18),
    inset -18px 0 36px rgba(14, 165, 233, 0.06) !important;
  backdrop-filter: blur(30px) saturate(2.1) contrast(1.08) brightness(1.04);
  -webkit-backdrop-filter: blur(30px) saturate(2.1) contrast(1.08) brightness(1.04);
}

.market-page .glass-card::before,
.market-page .section-card::before,
.market-page .section-shell::before,
.market-page .seller-panel::before,
.market-page .buy-drawer-card::before,
.market-page .metric-tile::before,
.market-page .status-bar::before,
.market-page .order-row::before,
.market-page .nft-featured-info::before,
.market-page .nft-hero-panel::before,
.market-page .hero-stat::before,
.market-page .seller-chart-card::before,
.market-page .seller-analytics-card::before,
.market-page .seller-order-card::before {
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.64), transparent 24%, rgba(255, 255, 255, 0.1) 52%, transparent 78%),
    radial-gradient(560px 120px at 12% 0%, rgba(255, 255, 255, 0.72), transparent 72%),
    radial-gradient(220px 220px at 100% 0%, rgba(14, 165, 233, 0.14), transparent 78%);
  opacity: 0.78;
}

.market-page .glass-card::after,
.market-page .section-card::after,
.market-page .section-shell::after,
.market-page .seller-panel::after,
.market-page .buy-drawer-card::after,
.market-page .metric-tile::after,
.market-page .status-bar::after,
.market-page .order-row::after,
.market-page .nft-featured-info::after,
.market-page .nft-hero-panel::after,
.market-page .hero-stat::after,
.market-page .seller-chart-card::after,
.market-page .seller-analytics-card::after,
.market-page .seller-order-card::after {
  background:
    linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,255,255,0.04) 32%, rgba(14,165,233,0.22) 66%, rgba(255,255,255,0.56)),
    linear-gradient(45deg, rgba(255,255,255,0.4), transparent 24%, rgba(255,255,255,0.28) 82%);
  opacity: 1;
}

.market-page .market-toolbar-card .ant-card-body,
.market-page .glass-card .ant-card-body,
.market-page .section-card .ant-card-body {
  background: transparent !important;
}

.market-page .product-cover,
.market-page .nft-featured-media {
  border: 1px solid rgba(255, 255, 255, 0.64);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.86),
    inset 0 -20px 38px rgba(37,99,235,0.08),
    0 18px 42px rgba(37, 99, 235, 0.12);
}

.market-page .product-cover::after,
.market-page .nft-featured-media::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(130deg, rgba(255,255,255,0.46), transparent 28%, rgba(255,255,255,0.12) 62%, transparent 82%),
    radial-gradient(220px 90px at 12% 2%, rgba(255,255,255,0.56), transparent 72%);
  mix-blend-mode: screen;
  pointer-events: none;
}

/* Seller Center analytics layout */
.market-page .seller-dashboard {
  display: grid;
  gap: 16px;
}

.market-page .seller-summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.market-page .seller-kpi-card {
  min-height: 128px;
  padding: 16px;
}

.market-page .seller-kpi-card .metric-title {
  font-size: 12px;
  font-weight: 760;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.market-page .seller-kpi-card .metric-value {
  margin-top: 8px;
  font-size: 30px;
}

.market-page .seller-kpi-caption {
  margin-top: 8px;
  color: var(--ink-subtle);
  font-size: 12px;
}

.market-page .seller-chart-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
  gap: 14px;
  align-items: stretch;
}

.market-page .seller-chart-card,
.market-page .seller-analytics-card {
  position: relative;
  overflow: hidden;
  border-radius: 24px;
  padding: 18px;
}

.market-page .seller-chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.market-page .seller-chart-title {
  color: var(--ink);
  font-size: 17px;
  font-weight: 820;
  line-height: 1.2;
}

.market-page .seller-chart-subtitle {
  color: var(--ink-subtle);
  font-size: 12px;
  margin-top: 4px;
}

.market-page .seller-funnel {
  display: grid;
  gap: 12px;
}

.market-page .seller-funnel-row {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr) 48px;
  align-items: center;
  gap: 10px;
}

.market-page .seller-funnel-label {
  color: var(--ink-muted);
  font-size: 12px;
  font-weight: 720;
}

.market-page .seller-funnel-track {
  position: relative;
  height: 36px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.32);
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.74),
    inset 0 -10px 18px rgba(37, 99, 235, 0.06);
}

.market-page .seller-funnel-fill {
  height: 100%;
  min-width: 8px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(37, 99, 235, 0.86), rgba(14, 165, 233, 0.78), rgba(16, 185, 129, 0.72));
  box-shadow:
    0 12px 24px rgba(37, 99, 235, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.market-page .seller-funnel-value {
  color: var(--ink);
  font-size: 20px;
  font-weight: 840;
  text-align: right;
}

.market-page .seller-revenue-bars {
  display: flex;
  align-items: end;
  gap: 9px;
  height: 210px;
  padding: 14px 8px 4px;
}

.market-page .seller-revenue-bar-item {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 100%;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}

.market-page .seller-revenue-bar-track {
  position: relative;
  width: 100%;
  max-width: 38px;
  flex: 1;
  display: flex;
  align-items: flex-end;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.26);
  border: 1px solid rgba(255, 255, 255, 0.56);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
  overflow: hidden;
}

.market-page .seller-revenue-bar-fill {
  width: 100%;
  min-height: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(16, 185, 129, 0.9), rgba(14, 165, 233, 0.72));
  box-shadow:
    0 -10px 24px rgba(16, 185, 129, 0.18),
    inset 0 1px 0 rgba(255,255,255,0.78);
}

.market-page .seller-revenue-day {
  color: var(--ink-subtle);
  font-size: 11px;
  white-space: nowrap;
}

.market-page .seller-ring-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.market-page .seller-ring-card {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 150px;
  border-radius: 20px;
  background: rgba(255,255,255,0.18);
  border: 1px solid rgba(255,255,255,0.58);
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.72),
    inset 0 -14px 28px rgba(37,99,235,0.05);
}

.market-page .seller-ring {
  position: relative;
  display: grid;
  place-items: center;
  width: 92px;
  height: 92px;
  border-radius: 50%;
  box-shadow:
    inset 0 1px 0 rgba(255,255,255,0.86),
    0 16px 34px rgba(37,99,235,0.12);
}

.market-page .seller-ring::after {
  content: "";
  position: absolute;
  inset: 12px;
  border-radius: 50%;
  background: rgba(255,255,255,0.76);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.86);
}

.market-page .seller-ring-value {
  position: relative;
  z-index: 1;
  color: var(--ink);
  font-size: 20px;
  font-weight: 860;
}

.market-page .seller-ring-label {
  margin-top: 10px;
  color: var(--ink-muted);
  font-size: 12px;
  font-weight: 720;
  text-align: center;
}

.market-page .seller-order-board {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
  gap: 14px;
}

.market-page .seller-order-card {
  border-radius: 22px;
  padding: 14px;
}

.market-page .seller-orders-card,
.market-page .seller-recent-orders-card {
  min-height: 100%;
}

.market-page .seller-orders-card .ant-card-body,
.market-page .seller-recent-orders-card .ant-card-body {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06)),
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), transparent 46%) !important;
}

.market-page .seller-order-line {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: start;
}

.market-page .seller-order-name {
  color: var(--ink);
  font-size: 14px;
  font-weight: 780;
}

.market-page .seller-order-meta {
  margin-top: 4px;
  color: var(--ink-subtle);
  font-size: 12px;
}

.market-page .seller-action-area {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.market-page .seller-recent-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 108px 112px;
  gap: 10px;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid rgba(191, 219, 254, 0.52);
}

.market-page .seller-recent-row:last-child {
  border-bottom: 0;
}

.market-page .seller-recent-row {
  border-radius: 14px;
  padding: 10px 8px;
  transition: background 180ms ease, transform 180ms ease;
}

.market-page .seller-recent-row:hover {
  background: rgba(255, 255, 255, 0.28);
  transform: translateX(2px);
}

.market-page .market-liquid-drawer .ant-drawer-body,
.market-page .market-liquid-modal .ant-modal-body {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.06)),
    var(--visual-marketplace-bg, none) center top / cover no-repeat;
  background-blend-mode: screen, normal;
}

.market-page .market-detail-image,
.market-page .market-nft-detail-drawer img {
  box-shadow:
    0 22px 48px rgba(37, 99, 235, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
}

@media (max-width: 1100px) {
  .market-page .seller-summary-grid,
  .market-page .seller-chart-grid,
  .market-page .seller-order-board {
    grid-template-columns: 1fr;
  }

  .market-page .seller-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .market-page .seller-summary-grid,
  .market-page .seller-ring-grid {
    grid-template-columns: 1fr;
  }

  .market-page .seller-funnel-row {
    grid-template-columns: 92px minmax(0, 1fr) 36px;
  }

  .market-page .seller-recent-row {
    grid-template-columns: 1fr;
  }

  .market-page .seller-action-area {
    justify-content: flex-start;
  }
}

@media (max-width: 992px) {
  .market-page .nft-featured {
    grid-template-columns: 1fr;
  }

  .market-page .nft-featured-media {
    min-height: 280px;
  }
}

@media (max-width: 768px) {
  .market-page {
    padding: 12px;
    border-radius: 20px;
  }

  .market-page .shop-hero {
    border-radius: 18px;
  }

  .market-page .market-tabs .ant-card-body,
  .market-page .section-shell {
    padding: 12px;
  }

  .market-page .buy-drawer-photo {
    width: 84px;
    height: 84px;
  }


  .market-page .market-item-card,
  .market-page .market-nft-card,
  .market-page .market-owned-card {
    height: auto;
    min-height: 0;
  }

  .market-page .product-cover,
  .market-page .market-owned-card .product-cover {
    height: 210px !important;
    flex-basis: 210px;
  }

  .market-page .status-chart {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

/* Marketplace flattening pass: keep the page atmospheric, remove stacked card shells. */
.market-page {
  border-color: rgba(255, 255, 255, 0.78) !important;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.42), rgba(239, 246, 255, 0.18) 38%, rgba(236, 253, 245, 0.14)),
    radial-gradient(880px 420px at 6% -4%, rgba(37, 99, 235, 0.24), transparent 68%),
    radial-gradient(760px 380px at 94% 0%, rgba(14, 165, 233, 0.22), transparent 66%),
    radial-gradient(660px 420px at 52% 108%, rgba(16, 185, 129, 0.16), transparent 66%),
    var(--visual-marketplace-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, #dbeafe, #ecfeff 54%, #dcfce7) !important;
  background-blend-mode: screen, normal, normal, normal, normal, normal;
}

.market-page::before {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(246, 248, 251, 0.42) 58%, rgba(255, 255, 255, 0.62)),
    radial-gradient(900px 360px at 50% -10%, rgba(255, 255, 255, 0.36), transparent 72%);
}

.market-page::after {
  opacity: 0.32;
}

.market-page .shop-hero {
  min-height: 218px;
  margin-bottom: 18px;
  padding: 28px 32px;
  border: 1px solid rgba(255, 255, 255, 0.76) !important;
  border-radius: 26px !important;
  background:
    linear-gradient(104deg, rgba(255, 255, 255, 0.82) 0%, rgba(239, 246, 255, 0.58) 42%, rgba(255, 255, 255, 0.18) 100%),
    var(--visual-marketplace, none) center right / cover no-repeat !important;
  box-shadow:
    0 28px 72px rgba(37, 99, 235, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(14px) saturate(1.28);
  -webkit-backdrop-filter: blur(14px) saturate(1.28);
}

.market-page .shop-hero::before {
  display: block !important;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.18), transparent 55%),
    radial-gradient(420px 170px at 84% 12%, rgba(14, 165, 233, 0.2), transparent 70%),
    radial-gradient(320px 180px at 96% 94%, rgba(16, 185, 129, 0.18), transparent 72%);
}

.market-page .shop-hero .hero-title {
  font-size: clamp(25px, 3vw, 40px) !important;
  font-weight: 880 !important;
  letter-spacing: -0.045em !important;
}

.market-page .shop-hero .hero-desc {
  max-width: 760px;
  color: #334155 !important;
  font-size: 14.5px;
  line-height: 1.68;
}

.market-page .shop-hero .hero-subtext {
  color: #1d4ed8 !important;
}

.market-page .market-tabs {
  border: 0 !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.market-page .market-tabs > .ant-tabs > .ant-tabs-nav,
.market-page .market-tabs.ant-tabs > .ant-tabs-nav {
  position: sticky;
  top: 84px;
  z-index: 3;
  margin: 0 0 18px;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.48);
  box-shadow:
    0 18px 42px rgba(37, 99, 235, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(18px) saturate(1.45);
  -webkit-backdrop-filter: blur(18px) saturate(1.45);
  padding: 8px 10px 0;
}

.market-page .market-tabs > .ant-tabs > .ant-tabs-content-holder,
.market-page .market-tabs.ant-tabs > .ant-tabs-content-holder {
  position: relative;
}

.market-page .market-tabs .ant-tabs-nav::before {
  display: none;
}

.market-page .section-shell {
  overflow: visible;
  border: 0 !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  padding: 0;
}

.market-page .section-shell::before,
.market-page .section-shell::after {
  display: none !important;
}

.market-page .market-toolbar-card {
  overflow: visible;
  border: 1px solid rgba(255, 255, 255, 0.7) !important;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.62), rgba(255, 255, 255, 0.28)) !important;
  box-shadow:
    0 20px 52px rgba(37, 99, 235, 0.11),
    inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
  backdrop-filter: blur(18px) saturate(1.48);
  -webkit-backdrop-filter: blur(18px) saturate(1.48);
}

.market-page .market-toolbar-card::before,
.market-page .market-toolbar-card::after {
  display: none !important;
}

.market-page .glass-card,
.market-page .metric-tile,
.market-page .status-bar,
.market-page .order-row,
.market-page .nft-featured-info,
.market-page .seller-chart-card,
.market-page .seller-analytics-card,
.market-page .seller-order-card {
  border-color: rgba(255, 255, 255, 0.74) !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0.18) 52%, rgba(219, 234, 254, 0.2)) !important;
  box-shadow:
    0 24px 60px rgba(37, 99, 235, 0.14),
    0 10px 22px rgba(15, 23, 42, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.95),
    inset 0 -16px 30px rgba(37, 99, 235, 0.06) !important;
  backdrop-filter: blur(22px) saturate(1.72) contrast(1.04);
  -webkit-backdrop-filter: blur(22px) saturate(1.72) contrast(1.04);
}

.market-page .market-featured-card {
  border-color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.2);
  box-shadow: none;
}

.market-page .market-featured-card::before {
  opacity: 0.46;
}

@media (max-width: 768px) {
  .market-page .shop-hero {
    padding: 22px;
  }

  .market-page .market-tabs > .ant-tabs-nav {
    position: relative;
    top: auto;
    overflow-x: auto;
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
  if (!iso) return 'Chưa xác định'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return 'Chưa xác định'
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function etaText(iso?: string): string {
  if (!iso) return 'Chưa có lịch giao'
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Dự kiến đã đến hạn giao'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  if (d > 0) return `Còn ${d} ngày ${h} giờ`
  const m = Math.floor((diff % 3600000) / 60000)
  return `Còn ${h} giờ ${m} phút`
}

const CATEGORIES = [
  { value: '', label: 'Tất cả' },
  { value: 'normal', label: 'Sản phẩm thường' },
  { value: 'digital', label: 'Hàng số' },
  { value: 'service', label: 'Dịch vụ' },
  { value: 'nft', label: 'Vật phẩm NFT' },
]

function categoryLabel(category?: string): string {
  return CATEGORIES.find(c => c.value === (category || ''))?.label ?? (category || 'Khác')
}

function purchaseStatusTag(status: MarketplacePurchase['status']) {
  const map: Record<string, { color: string; text: string }> = {
    PENDING_PAYMENT: { color: 'orange', text: 'Đã đặt hàng' },
    PENDING_COD: { color: 'purple', text: 'Chờ shop xác nhận' },
    CANCELLED: { color: 'red', text: 'Đã hủy bởi người mua' },
    RECEIVED: { color: 'cyan', text: 'Đã nhận đơn' },
    PACKED: { color: 'geekblue', text: 'Đã đóng gói' },
    SHIPPING: { color: 'blue', text: 'Đang vận chuyển' },
    DELIVERED: { color: 'green', text: 'Đã giao' },
    COMPLETED: { color: 'green', text: 'Hoàn thành' },
    FAILED: { color: 'red', text: 'Thất bại' },
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
    ACTIVE: { color: 'green', text: 'Đang bán' },
    SOLD: { color: 'blue', text: 'Đã bán' },
    CANCELLED: { color: 'default', text: 'Đã hủy' },
  }
  const s = map[status] ?? { color: 'default', text: status }
  return <Tag color={s.color} className="status-pill">{s.text}</Tag>
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
    <Card className="glass-card product-card market-item-card market-fixed-card" styles={{ body: { padding: 12 } }}>
      <div className="product-cover">
        <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.title} />
        <div className="market-cover-chip market-cover-chip-left" style={{ position: 'absolute', top: 10, left: 10 }}>
          <Tag color="blue" className="status-pill">{categoryLabel(item.category)}</Tag>
        </div>
        <div className="market-cover-chip market-cover-chip-right" style={{ position: 'absolute', top: 10, right: 10 }}>
          {listingStatusTag(item.status)}
        </div>
      </div>
      <div className="market-item-body" style={{ marginTop: 10 }}>
        <Text className="market-item-title market-line-clamp-2" strong>{item.title}</Text>
        <Text className="market-item-seller market-line-clamp-1" type="secondary" style={{ display: 'block' }}>
          Shop: {shortAddr(item.seller_wallet)}
        </Text>
        <Space className="market-item-footer" align="end" style={{ width: '100%', justifyContent: 'space-between', marginTop: 10 }}>
          <div className="market-price-block market-price-row">
            <Text className="market-price-main">{fmtVNDC(item.price)}</Text>
            <Text className="market-price-unit">VNDC</Text>
          </div>
        </Space>
        <Space>
            <Button size="small" onClick={() => onView(item)}>Chi tiết</Button>
            {!isMine && item.status === 'ACTIVE' && (
              <Button type="primary" size="small" icon={<ShoppingCartOutlined />} onClick={() => onBuy(item)}>Mua</Button>
            )}
            {isMine && item.status === 'ACTIVE' && (
              <Popconfirm title="Hủy niêm yết sản phẩm này?" onConfirm={() => onCancel(item)}>
                <Button danger size="small">Hủy</Button>
              </Popconfirm>
            )}
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
        const activeChain = getActiveChainConfig()
        const chainId = activeChain.chainId
        const tokenContract = getRequiredContractAddress('VNDCToken', 'VNDC Token', activeChain)
        await switchChain(chainId)
        const { nonce } = await getNonce(user.wallet_address)
        const deadline = Math.floor(Date.now() / 1000) + 3600
        const typedData = buildTransferTypedData({
          chainId,
          verifyingContract: tokenContract,
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
          signature: signature || '',
          ...(isNFTBuy ? {} : values),
        })
      } else {
        await buyNFT(item.id, {
          from_wallet: user.wallet_address,
          payment_method: 'COD',
          ...values,
        })
      }
      antMessage.success('Đặt hàng thành công')
      onDone()
      onClose()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Đặt hàng thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer className="market-liquid-drawer market-buy-drawer" title="Thông tin đặt hàng" open={open} onClose={onClose} width="min(560px, 100vw)">
      {item && (
        <>
          <Card size="small" className="buy-drawer-card market-order-card" style={{ marginBottom: 14 }}>
            <Space align="start" size={12}>
              <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/80/80`} alt={item.title} className="buy-drawer-photo" />
              <div>
                <Text strong style={{ fontSize: 16 }}>{item.title}</Text>
                <div>
                  <Text style={{ fontWeight: 800, color: '#b91c1c', fontSize: 20 }}>{fmtVNDC(item.price)} VNDC</Text>
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>Shop {shortAddr(item.seller_wallet)}</Text>
                <div><Tag color="gold" className="status-pill">Đặt hàng ngay, shop xác nhận theo từng bước</Tag></div>
              </div>
            </Space>
          </Card>

          <Text strong style={{ display: 'block', marginBottom: 8 }}>Chọn phương thức thanh toán</Text>
          <Radio.Group value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as VotePayMethod)} style={{ marginBottom: 16, width: '100%' }}>
            <Space>
              <Radio.Button value="TOKEN">Thanh toán VNDC</Radio.Button>
              {!isNFTBuy && <Radio.Button value="COD">Thanh toán khi nhận</Radio.Button>}
            </Space>
          </Radio.Group>

          <Form layout="vertical" form={form} onFinish={handleSubmit}>
            {!isNFTBuy && (
              <>
                <Form.Item name="recipient_name" label="Người nhận" rules={[{ required: true, message: 'Nhập người nhận' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="recipient_phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="shipping_address" label="Địa chỉ giao hàng" rules={[{ required: true, message: 'Nhập địa chỉ' }]}>
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="delivery_note" label="Ghi chú giao hàng">
                  <Input.TextArea rows={2} />
                </Form.Item>
              </>
            )}
            <Button htmlType="submit" type="primary" block loading={submitting} icon={<ShoppingCartOutlined />}>
              {isNFTBuy ? 'Xác nhận mua NFT ngay' : 'Xác nhận mua'}
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
    <Drawer className="market-liquid-drawer market-detail-drawer" open={open} onClose={onClose} width={760} title="Chi tiết sản phẩm">
      {!item ? <Empty /> : (
        <>
          <Row gutter={18}>
            <Col xs={24} md={12}>
              <img className="market-detail-image" src={item.image_uri || `https://picsum.photos/seed/${item.id}/800/700`} alt={item.title} style={{ width: '100%', borderRadius: 12, objectFit: 'cover' }} />
            </Col>
            <Col xs={24} md={12}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Tag color="blue">{categoryLabel(item.category)}</Tag>
                <Title level={4} style={{ margin: 0 }}>{item.title}</Title>
                <Text type="secondary">{item.description || 'Không có mô tả'}</Text>
                <div>
                  <Text style={{ fontWeight: 800, fontSize: 28, color: '#b91c1c' }}>{fmtVNDC(item.price)}</Text>
                  <Text type="secondary" style={{ marginLeft: 6 }}>VNDC</Text>
                </div>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Token ID">{item.token_id || '0'}</Descriptions.Item>
                  <Descriptions.Item label="Số lượng">{item.amount}</Descriptions.Item>
                  <Descriptions.Item label="Trạng thái">{listingStatusTag(item.status)}</Descriptions.Item>
                </Descriptions>
              </Space>
            </Col>
          </Row>

          <Divider />
          <Card className="glass-card market-shop-card" title="Thông tin gian hàng" size="small">
            <Space align="start" size={14}>
              <Avatar size={56} src={shopProfile?.avatar_uri} icon={<UserOutlined />} />
              <div>
                <Text strong>{shopProfile?.display_name || shortAddr(item.seller_wallet)}</Text>
                <Text type="secondary" style={{ display: 'block' }}>{shopProfile?.bio || 'Shop uy tín trên sàn VNDC'}</Text>
                <Space size={14} style={{ marginTop: 4 }}>
                  <Text type="secondary">Sản phẩm: <Text strong>{shopProfile?.total_listings ?? 0}</Text></Text>
                  <Text type="secondary">Đang bán: <Text strong>{shopProfile?.active_listings ?? 0}</Text></Text>
                  <Text type="secondary">Doanh thu: <Text strong>{fmtVNDC(shopProfile?.total_revenue_wei ?? '0')} VNDC</Text></Text>
                </Space>
              </div>
            </Space>
          </Card>

          <Divider titlePlacement="left">Sản phẩm khác của shop</Divider>
          <Row gutter={[12, 12]}>
            {shopListings.slice(0, 4).map(s => (
              <Col xs={24} md={12} key={s.id}>
                <Card className="market-related-card" size="small" hoverable onClick={() => onOpenShopListing(s)}>
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
      antMessage.error('Không thể tải sản phẩm')
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
      antMessage.success('Đã hủy niêm yết')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể hủy')
    }
  }

  return (
    <>
      <div className="market-toolbar-card market-filter-bar" style={{ marginBottom: 14 }}>
        <Row gutter={[10, 10]} align="middle">
          <Col flex={1}>
            <Input prefix={<CompassOutlined />} placeholder="Tìm sản phẩm" value={search} onChange={e => setSearch(e.target.value)} allowClear />
          </Col>
          <Col>
            <Select value={category} style={{ width: 180 }} onChange={setCategory} options={CATEGORIES} />
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Làm mới</Button>
          </Col>
        </Row>
      </div>

      <Spin spinning={loading}>
        {filtered.length === 0 ? <Empty description="Chưa có sản phẩm" /> : (
          <Row gutter={[14, 14]} className="market-card-grid">
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
      antMessage.error('Không thể tải sàn NFT')
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
        antMessage.error('Không thể tải NFT của bạn')
      }
      if (listingRes.status === 'fulfilled') {
        setMineListings((listingRes.value.items || []).filter(item => (item.category || '').toLowerCase() === 'nft'))
      } else {
        setMineListings([])
      }
    } catch {
        antMessage.error('Không thể tải NFT của bạn')
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
      antMessage.error('Cần kết nối ví để tạo NFT')
      return
    }
    setCreateLoading(true)
    try {
      await mintAndListNFT({
        title: values.title,
        description: values.description,
        image_uri: values.image_uri,
        metadata_uri: values.metadata_uri || values.image_uri,
        royalty_percentage: Number(values.royalty_percentage || 0),
      })
      antMessage.success('Đã tạo NFT thành công')
      createForm.resetFields()
      setCreateOpen(false)
      setActiveInnerTab('mine')
      void loadAll()
      void loadMine()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tạo NFT thất bại'
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
      antMessage.error('Nhập giá bán NFT')
      return
    }
    if (!draftListing) {
      antMessage.error('Không tìm thấy listing nháp cho NFT này để đăng bán')
      return
    }
    try {
      const priceWei = toWei(priceInput)
      if (BigInt(priceWei) <= 0n) {
        antMessage.error('Giá bán phải lớn hơn 0')
        return
      }
      setSellingTokenId(tokenID)
      await updateListingPrice(draftListing.id, priceWei)
      antMessage.success('Đã đăng bán NFT')
      setPriceDrafts(prev => ({ ...prev, [tokenID]: '' }))
      void loadAll()
      void loadMine()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể đăng bán NFT')
    } finally {
      setSellingTokenId('')
    }
  }

  async function handleStopSelling(listing: NFTListing) {
    try {
      await cancelListing(listing.id)
      antMessage.success('Đã ngừng bán NFT')
      void loadAll()
      void loadMine()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể ngừng bán NFT')
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

        <div className="market-toolbar-card market-filter-bar" style={{ marginTop: 5, marginBottom: 16 }}>
          <div className="nft-toolbar">
            <Input
              allowClear
              prefix={<CompassOutlined />}
              placeholder="Tìm NFT, mô tả, token ID hoặc ví bán"
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
        </div>

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
                    <div className="nft-featured market-featured-card">
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
                          <Text type="secondary">Shop {shortAddr(featured.seller_wallet)} | Token #{featured.token_id || '0'}</Text>
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
                    <Row gutter={[16, 16]} className="market-card-grid">
                      {browseGrid.map(item => (
                        <Col xs={24} sm={12} xl={8} key={item.id}>
                          <Card className="glass-card nft-card market-nft-card market-fixed-card" styles={{ body: { padding: 0 } }}>
                            <div className="product-cover">
                              <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.title} />
                              <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                <Tag color="blue" className="status-pill">NFT</Tag>
                              </div>
                              <div style={{ position: 'absolute', top: 10, right: 10 }}>{listingStatusTag(item.status)}</div>
                            </div>
                            <div className="market-nft-body" style={{ padding: 14 }}>
                              <Space direction="vertical" size={8} style={{ width: '100%', height: '100%' }}>
                                <Text className="market-nft-title market-line-clamp-2" strong>{item.title}</Text>
                                <Text className="market-nft-meta market-line-clamp-1" type="secondary">Shop {shortAddr(item.seller_wallet)} | Token #{item.token_id || '0'}</Text>
                                <div className="market-price-row"><Text className="market-price-main">{fmtVNDC(item.price)}</Text><Text className="market-price-unit">VNDC</Text></div>
                                <Text className="market-nft-description market-line-clamp-2" type="secondary">{item.description || 'NFT đang chờ bạn khám phá.'}</Text>
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
                    <Row gutter={[16, 16]} className="market-card-grid">
                      {visibleMine.map(item => {
                        const tokenID = String(item.token_id || '')
                        const activeListing = myActiveListingByToken.get(tokenID)
                        const isSelling = !!activeListing
                        return (
                          <Col xs={24} sm={12} xl={8} key={item.id}>
                            <Card className="glass-card nft-card market-nft-card market-owned-card market-fixed-card" styles={{ body: { padding: 0 } }}>
                              <div className="product-cover">
                                <img src={item.image_uri || `https://picsum.photos/seed/${item.id}/700/500`} alt={item.name} />
                                <div style={{ position: 'absolute', top: 10, left: 10 }}>
                                  <Tag color="purple" className="status-pill">NFT của tôi</Tag>
                                </div>
                                <div style={{ position: 'absolute', top: 10, right: 10 }}>
                                  {isSelling ? <Tag color="green" className="status-pill">Đang bán</Tag> : <Tag className="status-pill">Không bán</Tag>}
                                </div>
                              </div>
                              <div className="market-owned-body" style={{ padding: 14 }}>
                                <Space direction="vertical" size={8} style={{ width: '100%', height: '100%' }}>
                                  <Text className="market-nft-title market-line-clamp-2" strong>{item.name}</Text>
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

      <Modal className="market-liquid-modal market-create-nft-modal"
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
          <Form.Item name="metadata_uri" label="Metadata URI (tùy chọn)">
            <Input placeholder="Để trống nếu muốn dùng ảnh làm metadata" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={4} placeholder="Mô tả NFT, bộ sưu tập, sự kiện..." />
          </Form.Item>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
            <Button type="primary" htmlType="submit" loading={createLoading} icon={<PlusOutlined />}>
              Tạo NFT
            </Button>
          </Space>
        </Form>
      </Modal>

      <Drawer className="market-liquid-drawer market-nft-detail-drawer"
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
      antMessage.error('Không thể tải đơn hàng')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load, refreshKey])

  async function cancelOrder(orderId: string) {
    try {
      await cancelMyPurchase(orderId)
      antMessage.success('Đã hủy đơn hàng')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể hủy đơn')
    }
  }

  return (
    <Spin spinning={loading}>
      {orders.length === 0 ? <Empty description="Chưa có đơn hàng" /> : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {orders.map(order => (
            <Card key={order.id} className="glass-card" styles={{ body: { padding: 14 } }}>
              <Row gutter={14}>
                <Col xs={24} md={16}>
                  <Space align="start" size={12}>
                    <img src={order.listing_image_uri || `https://picsum.photos/seed/${order.listing_id}/90/90`} alt={order.listing_title || 'listing'} style={{ width: 90, height: 90, borderRadius: 10, objectFit: 'cover' }} />
                    <div>
                      <Text strong>{order.listing_title || `Sản phẩm ${order.listing_id.slice(0, 8)}`}</Text>
                      <div><Text type="secondary">Shop {shortAddr(order.seller_wallet)}</Text></div>
                      <div><Text style={{ fontWeight: 700, color: '#b91c1c' }}>{fmtVNDC(order.price)} VNDC</Text></div>
                      <div><Text type="secondary">Đặt lúc {fmtDateTime(order.created_at)}</Text></div>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={8}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {purchaseStatusTag(order.status)}
                    <Text type="secondary" style={{ fontSize: 12 }}>Dự kiến giao: {fmtDateTime(order.expected_delivery)}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{etaText(order.expected_delivery)}</Text>
                    {(order.payment_method !== 'TOKEN' && (order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT')) && (
                      <Popconfirm title="Bạn chắc chắn muốn hủy đơn này?" onConfirm={() => cancelOrder(order.id)}>
                        <Button danger size="small">Hủy đơn</Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Col>
              </Row>
              <Divider style={{ margin: '10px 0' }} />
              <Descriptions size="small" column={1} styles={{ label: { width: 170 } }}>
                <Descriptions.Item label="Người nhận">{order.recipient_name || '---'}</Descriptions.Item>
                <Descriptions.Item label="Số điện thoại">{order.recipient_phone || '---'}</Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">{order.shipping_address || '---'}</Descriptions.Item>
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
      antMessage.error('Không thể tải dữ liệu shop')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const completedStatuses = ['COMPLETED', 'DELIVERED']
  const pendingOrders = orders.filter(o => ['PENDING_PAYMENT', 'PENDING_COD', 'RECEIVED', 'PACKED', 'SHIPPING'].includes(o.status))
  const completedOrders = orders.filter(o => completedStatuses.includes(o.status))
  const cancelledOrders = orders.filter(o => ['CANCELLED', 'FAILED'].includes(o.status))
  const tokenOrders = orders.filter(o => o.payment_method === 'TOKEN').length
  const codOrders = orders.filter(o => o.payment_method === 'COD').length

  const revenueWei = useMemo(() => orders.reduce((sum, o) => {
    if (!completedStatuses.includes(o.status)) return sum
    try {
      return sum + BigInt(o.price || '0')
    } catch {
      return sum
    }
  }, BigInt(0)).toString(), [orders])

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

  const completionRate = orders.length ? Math.round((completedOrders.length / orders.length) * 100) : 0
  const pendingRate = orders.length ? Math.round((pendingOrders.length / orders.length) * 100) : 0
  const cancelRate = orders.length ? Math.round((cancelledOrders.length / orders.length) * 100) : 0
  const tokenRate = orders.length ? Math.round((tokenOrders / orders.length) * 100) : 0

  const pipelineRows = ([
    ['PENDING', 'Đặt hàng', 'Chờ shop xác nhận'],
    ['RECEIVED', 'Nhận đơn', 'Shop đã tiếp nhận'],
    ['PACKED', 'Đóng gói', 'Chuẩn bị giao hàng'],
    ['SHIPPING', 'Vận chuyển', 'Đơn đang trên đường'],
    ['COMPLETED', 'Hoàn thành', 'Đã giao / hoàn tất'],
  ] as const).map(([key, label, caption]) => ({
    key,
    label,
    caption,
    value: statusBuckets[key],
    width: Math.max(4, Math.round((statusBuckets[key] / maxBucket) * 100)),
  }))

  const revenueByDay = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now)
      d.setDate(d.getDate() - (6 - i))
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      const end = new Date(start.getTime() + 86400000)
      const revenue = orders.reduce((sum, order) => {
        const created = new Date(order.created_at)
        if (Number.isNaN(created.getTime()) || created < start || created >= end) return sum
        if (!completedStatuses.includes(order.status)) return sum
        return sum + fromWei(order.price || '0')
      }, 0)
      return {
        label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
        revenue,
      }
    })
  }, [orders])
  const maxRevenue = Math.max(1, ...revenueByDay.map(d => d.revenue))

  async function updateStatus(order: MarketplacePurchase, status: SellerOrderStatus) {
    try {
      await updateSellerOrderStatus(order.id, status, status === 'RECEIVED' ? 72 : undefined)
      antMessage.success('Cập nhật trạng thái thành công')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể cập nhật')
    }
  }

  async function cancelOrderBySeller(order: MarketplacePurchase) {
    try {
      if (order.payment_method === 'TOKEN') {
        if (!user?.wallet_address) {
          antMessage.error('Cần kết nối ví seller để hủy đơn token')
          return
        }
        const activeChain = getActiveChainConfig()
        const chainId = activeChain.chainId
        const tokenContract = getRequiredContractAddress('VNDCToken', 'VNDC Token', activeChain)
        await switchChain(chainId)
        const { nonce } = await getNonce(user.wallet_address)
        const deadline = Math.floor(Date.now() / 1000) + 3600
        const typedData = buildTransferTypedData({
          chainId,
          verifyingContract: tokenContract,
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
          signature: signature || '',
        })
      } else {
        await cancelSellerOrder(order.id)
      }
      antMessage.success('Đã hủy đơn hàng')
      void load()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể hủy đơn')
    }
  }

  return (
    <Spin spinning={loading}>
      <div className="seller-dashboard">
        <div className="seller-summary-grid">
          <div className="metric-tile seller-kpi-card">
            <div className="metric-title">Đơn cần xử lý</div>
            <div className="metric-value">{pendingOrders.length}</div>
            <div className="seller-kpi-caption">{pendingRate}% tổng số đơn đang nằm trong pipeline</div>
          </div>
          <div className="metric-tile seller-kpi-card">
            <div className="metric-title">Tỷ lệ hoàn thành</div>
            <div className="metric-value">{completionRate}%</div>
            <div className="seller-kpi-caption">{completedOrders.length} / {orders.length || 0} đơn đã hoàn tất</div>
          </div>
          <div className="metric-tile seller-kpi-card">
            <div className="metric-title">Doanh thu</div>
            <div className="metric-value">{fmtVNDC(revenueWei)}</div>
            <div className="seller-kpi-caption">VNDC từ đơn đã giao hoặc hoàn thành</div>
          </div>
          <div className="metric-tile seller-kpi-card">
            <div className="metric-title">AOV trung bình</div>
            <div className="metric-value">{fmtVNDC(avgOrderValue)}</div>
            <div className="seller-kpi-caption">VNDC / đơn hàng</div>
          </div>
        </div>

        <div className="seller-chart-grid">
          <div className="seller-chart-card">
            <div className="seller-chart-head">
              <div>
                <div className="seller-chart-title">Pipeline xử lý đơn hàng</div>
                <div className="seller-chart-subtitle">Theo dõi số đơn ở từng trạng thái vận hành của shop.</div>
              </div>
              <Tag color="blue" className="status-pill"><BarChartOutlined /> {orders.length} đơn</Tag>
            </div>

            <div className="seller-funnel">
              {pipelineRows.map(row => (
                <div className="seller-funnel-row" key={row.key}>
                  <div>
                    <div className="seller-funnel-label">{row.label}</div>
                    <Text type="secondary" style={{ fontSize: 11 }}>{row.caption}</Text>
                  </div>
                  <div className="seller-funnel-track">
                    <div className="seller-funnel-fill" style={{ width: `${row.width}%` }} />
                  </div>
                  <div className="seller-funnel-value">{row.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="seller-analytics-card">
            <div className="seller-chart-head">
              <div>
                <div className="seller-chart-title">Tổng quan trạng thái</div>
                <div className="seller-chart-subtitle">Biểu đồ vòng giúp nhìn nhanh sức khỏe shop.</div>
              </div>
            </div>

            <div className="seller-ring-grid">
              <div className="seller-ring-card">
                <div
                  className="seller-ring"
                  style={{ background: `conic-gradient(rgba(16, 185, 129, 0.9) ${completionRate * 3.6}deg, rgba(255,255,255,0.32) 0deg)` }}
                >
                  <div className="seller-ring-value">{completionRate}%</div>
                </div>
                <div className="seller-ring-label">Hoàn thành</div>
              </div>
              <div className="seller-ring-card">
                <div
                  className="seller-ring"
                  style={{ background: `conic-gradient(rgba(245, 158, 11, 0.9) ${pendingRate * 3.6}deg, rgba(255,255,255,0.32) 0deg)` }}
                >
                  <div className="seller-ring-value">{pendingRate}%</div>
                </div>
                <div className="seller-ring-label">Đang xử lý</div>
              </div>
              <div className="seller-ring-card">
                <div
                  className="seller-ring"
                  style={{ background: `conic-gradient(rgba(37, 99, 235, 0.9) ${tokenRate * 3.6}deg, rgba(255,255,255,0.32) 0deg)` }}
                >
                  <div className="seller-ring-value">{tokenRate}%</div>
                </div>
                <div className="seller-ring-label">Thanh toán VNDC</div>
              </div>
              <div className="seller-ring-card">
                <div
                  className="seller-ring"
                  style={{ background: `conic-gradient(rgba(220, 38, 38, 0.78) ${cancelRate * 3.6}deg, rgba(255,255,255,0.32) 0deg)` }}
                >
                  <div className="seller-ring-value">{cancelRate}%</div>
                </div>
                <div className="seller-ring-label">Đã hủy / lỗi</div>
              </div>
            </div>
          </div>
        </div>

        <div className="seller-chart-card">
          <div className="seller-chart-head">
            <div>
              <div className="seller-chart-title">Doanh thu 7 ngày gần đây</div>
              <div className="seller-chart-subtitle">Chỉ tính các đơn đã giao hoặc hoàn thành.</div>
            </div>
            <Space wrap>
              <Tag color="green" className="status-pill">COD: {codOrders}</Tag>
              <Tag color="cyan" className="status-pill">VNDC: {tokenOrders}</Tag>
            </Space>
          </div>

          <div className="seller-revenue-bars">
            {revenueByDay.map(day => {
              const h = Math.max(4, Math.round((day.revenue / maxRevenue) * 100))
              return (
                <div className="seller-revenue-bar-item" key={day.label}>
                  <TooltipLikeText value={`${day.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} VNDC`} />
                  <div className="seller-revenue-bar-track" title={`${day.revenue.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} VNDC`}>
                    <div className="seller-revenue-bar-fill" style={{ height: `${h}%` }} />
                  </div>
                  <div className="seller-revenue-day">{day.label}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="seller-order-board">
          <Card
            className="glass-card seller-orders-card"
            title="Đơn cần thao tác"
            extra={<Button size="small" icon={<ReloadOutlined />} onClick={() => void load()}>Làm mới</Button>}
          >
            {pendingOrders.length === 0 ? <Empty description="Không có đơn cần xử lý" /> : (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {pendingOrders.map(order => (
                  <div key={order.id} className="seller-order-card">
                    <div className="seller-order-line">
                      <div>
                        <div className="seller-order-name">{order.listing_title || shortAddr(order.listing_id)}</div>
                        <div className="seller-order-meta">Người mua {shortAddr(order.buyer_wallet)} · {fmtDateTime(order.created_at)}</div>
                        <div style={{ marginTop: 6 }}>{purchaseStatusTag(order.status)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <Text strong style={{ color: '#047857', fontSize: 16 }}>{fmtVNDC(order.price)} VNDC</Text>
                        <div><Text type="secondary" style={{ fontSize: 12 }}>{order.payment_method === 'TOKEN' ? 'VNDC Token' : 'COD'}</Text></div>
                      </div>
                    </div>

                    <Divider style={{ margin: '10px 0' }} />

                    <Row gutter={[10, 8]} align="middle">
                      <Col xs={24} lg={14}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Địa chỉ: {order.shipping_address || '---'}</Text><br />
                        <Text type="secondary" style={{ fontSize: 12 }}>SĐT: {order.recipient_phone || '---'}</Text>
                      </Col>
                      <Col xs={24} lg={10}>
                        <div className="seller-action-area">
                          {(() => {
                            const next = nextSellerStatus(order.status)
                            if (!next) return <Text type="secondary">Không có thao tác</Text>
                            const labelMap: Record<SellerOrderStatus, string> = {
                              RECEIVED: 'Xác nhận đơn',
                              PACKED: 'Đã đóng gói',
                              SHIPPING: 'Đang giao',
                              DELIVERED: 'Đã giao',
                            }
                            return (
                              <Button type="primary" size="small" onClick={() => updateStatus(order, next)}>
                                {labelMap[next]}
                              </Button>
                            )
                          })()}
                          {(order.status === 'PENDING_COD' || order.status === 'PENDING_PAYMENT' || order.status === 'RECEIVED') && (
                            <Popconfirm title="Hủy đơn hàng này?" onConfirm={() => cancelOrderBySeller(order)}>
                              <Button danger size="small">Hủy đơn</Button>
                            </Popconfirm>
                          )}
                        </div>
                      </Col>
                    </Row>
                  </div>
                ))}
              </Space>
            )}
          </Card>

          <Card className="glass-card seller-recent-orders-card" title="Đơn hàng gần đây">
            {orders.length === 0 ? <Empty description="Chưa có đơn hàng" /> : (
              <div>
                {orders.slice(0, 8).map(order => (
                  <div key={order.id} className="seller-recent-row">
                    <div>
                      <Text strong className="market-line-clamp-1">{order.listing_title || shortAddr(order.listing_id)}</Text>
                      <div><Text type="secondary" style={{ fontSize: 12 }}>{fmtDateTime(order.created_at)}</Text></div>
                    </div>
                    <div>{purchaseStatusTag(order.status)}</div>
                    <Text strong style={{ textAlign: 'right', color: '#047857' }}>{fmtVNDC(order.price)} VNDC</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </Spin>
  )
}

function TooltipLikeText({ value }: { value: string }) {
  return <Text type="secondary" style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{value}</Text>
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
    { key: 'orders', label: <Space><HistoryOutlined />Đơn hàng của tôi</Space>, children: <MyOrdersTab refreshKey={orderRefreshTick} /> },
    { key: 'seller', label: <Space><SolutionOutlined />Seller Center</Space>, children: <SellerCenterTab user={user} /> },
  ]

  return (
    <div className="market-page" style={{ maxWidth: 1420, margin: '0 auto' }}>
      <style>{MARKETPLACE_STYLES}</style>

      <section className="shop-hero">
        <Row gutter={[20, 20]} align="middle" className="shop-hero-content">
          <Col xs={24} lg={14}>
            <Title level={2} className="hero-title">
              <ShopOutlined /> VNDC Commerce Hub
            </Title>
            <Paragraph className="hero-desc">
              Giao diện sàn thương mại đầy đủ: chi tiết sản phẩm, profile shop, mua hàng có địa chỉ và số điện thoại,
              theo dõi đơn hàng và seller center quản lý vận chuyển như sàn thực tế.
            </Paragraph>
            <div className="hero-subtext" style={{ marginTop: 8, letterSpacing: '.03em', textTransform: 'uppercase', fontSize: 11 }}>Mua sắm NFT và hàng hóa theo một trải nghiệm đồng nhất</div>
          </Col>

          <Col xs={24} lg={10} style={{ textAlign: 'right' }}>
            <div className="sync-badge">
              <span className="sync-dot" />
              <Text style={{ color: '#059669', fontSize: 12, fontWeight: 600 }}>Đã đồng bộ</Text>
            </div>
            <Space size={12} style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
              <Tag color="blue">On-chain transfer</Tag>
              <Tag color="cyan">Off-chain order</Tag>
              <Tag color="green">DB finalize</Tag>
            </Space>
            <Text style={{ color: 'var(--ink-subtle)', fontSize: 12 }}>Cập nhật trạng thái mua bán liên tục</Text>
          </Col>
        </Row>
      </section>

      <div className="market-tabs">
        <Tabs defaultActiveKey="nft-shop" size="large" items={tabs} />
      </div>
    </div>
  )
}
