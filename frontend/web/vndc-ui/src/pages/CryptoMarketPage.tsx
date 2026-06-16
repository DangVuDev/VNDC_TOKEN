import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
  WheelEvent as ReactWheelEvent,
} from 'react'
import {
  Alert,
  Badge,
  Button,
  Col,
  Empty,
  Input,
  Modal,
  Radio,
  Row,
  Skeleton,
  Slider,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  AreaChartOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  FireOutlined,
  FullscreenOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  StarOutlined,
  ThunderboltOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

const BINANCE_REST = 'https://api.binance.com'
const BINANCE_WS = 'wss://stream.binance.com:9443/ws'
const COINGECKO_REST = 'https://api.coingecko.com/api/v3'
const DEFAULT_SYMBOL = 'BTCUSDT'
const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const
type ChartInterval = typeof INTERVALS[number]
type MarketFilter = 'all' | 'hot' | 'gainers' | 'losers'

type BinanceTicker = {
  symbol: string
  lastPrice: string
  priceChangePercent: string
  highPrice: string
  lowPrice: string
  volume: string
  quoteVolume: string
  count: number
}

type CoinGeckoSearchCoin = {
  id: string
  name: string
  symbol: string
  market_cap_rank?: number | null
  thumb?: string
  small?: string
  large?: string
}

type TokenLogoMap = Record<string, string | null>

type BinanceKlineEvent = {
  k: {
    t: number
    o: string
    h: string
    l: string
    c: string
    v: string
  }
}

type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type MarketRow = {
  key: string
  symbol: string
  baseAsset: string
  quoteAsset: string
  lastPrice: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
  trades: number
}

const MARKET_STYLES = `
.crypto-market-page {
  --market-ink: var(--ink);
  --market-muted: var(--ink-muted);
  --market-soft: rgba(255,255,255,.58);
  --market-panel: rgba(255,255,255,.64);
  --market-panel-strong: rgba(255,255,255,.82);
  --market-line: rgba(255,255,255,.68);
  --market-accent: var(--accent);
  --market-accent-strong: var(--accent-strong);
  --market-accent-soft: rgba(37,99,235,.13);
  --market-green: #089981;
  --market-red: #f23645;
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.72);
  border-radius: 28px;
  padding: 18px 18px 40px;
  color: var(--market-ink);
  background:
    linear-gradient(115deg, rgba(255,255,255,.3), rgba(239,246,255,.12) 42%, rgba(236,253,245,.1)),
    var(--visual-dashboard-liquid) center top / cover no-repeat,
    linear-gradient(135deg, rgba(219,234,254,.72), rgba(236,253,245,.46));
  box-shadow: 0 34px 90px rgba(37,99,235,.16);
}
.crypto-market-page::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(760px 320px at 8% -4%, rgba(37,99,235,.18), transparent 68%),
    radial-gradient(720px 340px at 95% 2%, rgba(14,165,233,.18), transparent 66%),
    radial-gradient(620px 360px at 52% 108%, rgba(16,185,129,.13), transparent 64%),
    linear-gradient(180deg, rgba(255,255,255,.62), rgba(246,248,251,.78));
}
.crypto-market-page::after {
  content: '';
  position: absolute;
  inset: 1px;
  z-index: -1;
  border-radius: 27px;
  background: linear-gradient(125deg, rgba(255,255,255,.32), transparent 34%, rgba(255,255,255,.16) 62%, transparent 82%);
  opacity: .62;
  pointer-events: none;
}
.market-orb {
  position: absolute;
  z-index: 0;
  border-radius: 999px;
  filter: blur(64px);
  opacity: .22;
  pointer-events: none;
  mix-blend-mode: screen;
}
.market-orb-1 {
  width: 340px;
  height: 340px;
  left: -80px;
  top: 120px;
  background: rgba(37,99,235,.38);
  animation: marketFloatOne 16s ease-in-out infinite alternate;
}
.market-orb-2 {
  width: 420px;
  height: 420px;
  right: -140px;
  top: -70px;
  background: rgba(14,165,233,.34);
  animation: marketFloatTwo 18s ease-in-out infinite alternate;
}
.market-orb-3 {
  width: 360px;
  height: 360px;
  left: 38%;
  bottom: -150px;
  background: rgba(16,185,129,.28);
  animation: marketFloatThree 20s ease-in-out infinite alternate;
}
@keyframes marketFloatOne {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(78px, -34px, 0) scale(1.08); }
}
@keyframes marketFloatTwo {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(-72px, 88px, 0) scale(1.05); }
}
@keyframes marketFloatThree {
  from { transform: translate3d(0, 0, 0) scale(1); }
  to { transform: translate3d(86px, -58px, 0) scale(1.1); }
}
.market-content {
  position: relative;
  z-index: 1;
  max-width: 1420px;
  margin: 0 auto;
}
.market-glass {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.64);
  background:
    linear-gradient(135deg, rgba(255,255,255,.34), rgba(255,255,255,.12)) !important;
  box-shadow:
    0 22px 54px rgba(37,99,235,.13),
    0 8px 18px rgba(15,23,42,.06),
    inset 0 1px 0 rgba(255,255,255,.86),
    inset 0 -1px 0 rgba(37,99,235,.08);
  backdrop-filter: blur(18px) saturate(1.85) contrast(1.05);
  -webkit-backdrop-filter: blur(18px) saturate(1.85) contrast(1.05);
}
.market-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(255,255,255,.88), rgba(255,255,255,.08) 38%, rgba(14,165,233,.18) 68%, rgba(255,255,255,.42));
  opacity: .72;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  padding: 1px;
}
.market-hero {
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 18px;
  background:
    linear-gradient(110deg, rgba(255,255,255,.94) 0%, rgba(239,246,255,.88) 48%, rgba(236,253,245,.72) 100%),
    var(--visual-hero) center right / cover no-repeat !important;
  border-color: rgba(191,219,254,.88);
  box-shadow: 0 24px 70px rgba(37,99,235,.14);
}
.market-hero::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(420px 180px at 82% 18%, rgba(14,165,233,.2), transparent 70%),
    radial-gradient(280px 180px at 96% 92%, rgba(16,185,129,.2), transparent 72%);
  pointer-events: none;
}
.market-hero::after {
  inset: auto 0 0 0;
  height: 3px;
  border: 0;
  border-radius: 0;
  background: linear-gradient(90deg, #2563eb, #0ea5e9, #10b981);
  -webkit-mask: none;
  mask: none;
  opacity: 1;
}
.market-hero-main,
.market-section-content {
  position: relative;
  z-index: 1;
}
.market-chip {
  border-radius: 999px;
  border: 1px solid rgba(37,99,235,.22) !important;
  background: rgba(239,246,255,.68) !important;
  color: var(--market-accent-strong) !important;
  font-weight: 800;
}
.market-stat {
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  padding: 15px;
  border: 1px solid rgba(255,255,255,.62);
  background: rgba(255,255,255,.42);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.82), 0 12px 30px rgba(37,99,235,.07);
  transition: transform .26s ease, box-shadow .26s ease, border-color .26s ease;
}
.market-stat:hover {
  transform: translateY(-3px);
  border-color: rgba(191,219,254,.8);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.9), 0 18px 42px rgba(37,99,235,.12);
}
.market-chart-shell,
.market-side-card,
.market-table-panel {
  border-radius: 22px;
  padding: 18px;
}
.market-chart-shell {
  min-height: 510px;
}
.market-chart-header {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 14px;
}
.market-token-avatar {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #1d4ed8;
  font-size: 19px;
  font-weight: 950;
  background:
    radial-gradient(circle at 30% 18%, rgba(255,255,255,.62), transparent 34%),
    linear-gradient(135deg, #dbeafe, #e0f2fe 52%, #dcfce7);
  box-shadow: 0 12px 28px rgba(37,99,235,.16);
}
.market-chart-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.market-chart-tools .ant-radio-button-wrapper,
.market-table-actions .ant-radio-button-wrapper {
  border-color: rgba(191,219,254,.74) !important;
  background: rgba(255,255,255,.62) !important;
  font-weight: 750;
}
.market-chart-tools .ant-radio-button-wrapper-checked,
.market-table-actions .ant-radio-button-wrapper-checked {
  color: #1d4ed8 !important;
  border-color: rgba(37,99,235,.42) !important;
  background: linear-gradient(135deg, rgba(37,99,235,.14), rgba(14,165,233,.1) 58%, rgba(16,185,129,.1)) !important;
}
.market-chart-toolbar {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 8px 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(255,255,255,.58);
  border-radius: 18px;
  background: rgba(255,255,255,.36);
}
.market-chart-toolbar-left,
.market-chart-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.market-chart-toolbar .ant-btn {
  border-radius: 12px;
  border-color: rgba(191,219,254,.74);
  background: rgba(255,255,255,.66);
  font-weight: 750;
}
.market-chart-toolbar .ant-btn:hover {
  color: var(--market-accent-strong) !important;
  border-color: rgba(37,99,235,.42) !important;
}
.market-zoom-slider {
  width: 170px;
}
.market-chart-frame {
  position: relative;
  z-index: 1;
  border-radius: 20px;
  padding: 10px;
  border: 1px solid rgba(255,255,255,.62);
  background:
    radial-gradient(circle at 82% 12%, rgba(37,99,235,.08), transparent 28%),
    rgba(255,255,255,.5);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.82);
}
.market-candle-chart {
  display: block;
  width: 100%;
  user-select: none;
  touch-action: none;
  cursor: crosshair;
}
.market-candle-chart.dragging {
  cursor: grabbing;
}
.market-candle-chart text {
  font-family: var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.market-interaction-hint {
  margin-top: 9px;
  color: #64748b;
  font-size: 12px;
}
.market-list-button {
  position: relative;
  z-index: 1;
  width: 100%;
  border: 0;
  border-radius: 16px;
  padding: 11px 10px;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: transform .22s ease, background .22s ease;
}
.market-list-button:hover {
  transform: translateX(4px);
  background: rgba(37,99,235,.09);
}
.market-table-panel {
  margin-top: 16px;
}
.market-table-actions {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.market-table .ant-table {
  background: transparent;
}
.market-table .ant-table-container {
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(191,219,254,.58);
}
.market-table .ant-table-thead > tr > th {
  background: rgba(255,255,255,.72) !important;
  color: #475569;
  font-size: 12px;
  font-weight: 900;
  border-bottom: 1px solid rgba(15,23,42,.06) !important;
}
.market-table .ant-table-tbody > tr > td {
  background: rgba(255,255,255,.48);
  border-bottom: 1px solid rgba(15,23,42,.045) !important;
}
.market-table .ant-table-tbody > tr.ant-table-row:hover > td,
.market-table .ant-table-tbody > tr.market-row-selected > td {
  background: rgba(37,99,235,.1) !important;
}
.market-table .ant-pagination-item,
.market-table .ant-pagination-prev button,
.market-table .ant-pagination-next button {
  border-radius: 10px !important;
  background: rgba(255,255,255,.55) !important;
}
.market-input.ant-input-affix-wrapper {
  border-radius: 14px;
  background: rgba(255,255,255,.66);
  border-color: rgba(191,219,254,.74);
}
.market-footer-note {
  position: relative;
  z-index: 1;
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255,255,255,.38);
  border: 1px solid rgba(255,255,255,.58);
}
.market-fullscreen-modal .ant-modal-content {
  overflow: hidden;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,.5);
  background:
    radial-gradient(circle at 15% 8%, rgba(37,99,235,.16), transparent 24%),
    radial-gradient(circle at 84% 12%, rgba(14,165,233,.14), transparent 28%),
    rgba(248,250,252,.86);
  box-shadow: 0 30px 100px rgba(15,23,42,.25);
  backdrop-filter: blur(22px) saturate(155%);
  -webkit-backdrop-filter: blur(22px) saturate(155%);
}
.market-fullscreen-modal .ant-modal-body {
  padding: 18px;
}
.market-full-chart-body {
  min-height: calc(100vh - 150px);
}

.market-selected-card {
  min-height: 100%;
}
.market-selected-token {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
}
.market-selected-price {
  position: relative;
  z-index: 1;
  padding: 16px;
  border-radius: 22px;
  background:
    radial-gradient(circle at 90% 0%, rgba(37,99,235,.14), transparent 36%),
    rgba(255,255,255,.5);
  border: 1px solid rgba(255,255,255,.58);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.7);
}
.market-selected-metrics {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 12px;
}
.market-selected-metric {
  border-radius: 16px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,.54);
  background: rgba(255,255,255,.48);
}
.market-token-avatar {
  overflow: hidden;
  border: 1px solid rgba(255,255,255,.64);
  background-color: rgba(255,255,255,.78);
}
.market-token-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.market-token-strip {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}
.market-token-strip::-webkit-scrollbar {
  display: none;
}
.market-token-pill {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 142px;
  padding: 10px 12px;
  border-radius: 18px;
  border: 1px solid rgba(255,255,255,.56);
  background: rgba(255,255,255,.48);
  color: var(--market-ink);
  cursor: pointer;
  transition: transform .22s ease, background .22s ease, border-color .22s ease;
}
.market-token-pill:hover,
.market-token-pill.active {
  transform: translateY(-2px);
  background: rgba(37,99,235,.09);
  border-color: rgba(37,99,235,.28);
  box-shadow: 0 14px 28px rgba(37,99,235,.1), inset 0 1px 0 rgba(255,255,255,.84);
}
.market-layout-title {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.market-side-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 1180px) {
  .crypto-market-page {
    padding: 18px;
  }
  .market-chart-header {
    flex-direction: column;
  }
  .market-chart-tools {
    width: 100%;
    justify-content: flex-start;
  }
}
@media (max-width: 768px) {
  .crypto-market-page {
    padding: 14px;
  }
  .market-hero,
  .market-chart-shell,
  .market-side-card,
  .market-table-panel {
    border-radius: 22px;
    padding: 14px;
  }
  .market-chart-shell {
    min-height: 450px;
  }
  .market-chart-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .market-chart-toolbar-left,
  .market-chart-toolbar-right {
    width: 100%;
  }
  .market-zoom-slider {
    flex: 1;
    min-width: 150px;
  }
  .market-table-actions {
    align-items: stretch;
    flex-direction: column;
  }
  .market-table-actions > .ant-space,
  .market-table-actions .ant-radio-group,
  .market-table-actions .ant-input-affix-wrapper,
  .market-table-actions .ant-btn {
    width: 100% !important;
  }
}
@media (max-width: 520px) {
  .market-chart-tools .ant-radio-group {
    display: flex;
    width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .market-chart-tools .ant-radio-group::-webkit-scrollbar {
    display: none;
  }
  .market-chart-tools .ant-radio-button-wrapper {
    flex: 1 0 auto;
    text-align: center;
  }
  .market-token-avatar {
    width: 42px;
    height: 42px;
    border-radius: 16px;
  }
}
`

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

const STATIC_TOKEN_LOGOS: Record<string, string> = {
  BTC: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png?v=035',
  ETH: 'https://cryptologos.cc/logos/ethereum-eth-logo.png?v=035',
  BNB: 'https://cryptologos.cc/logos/bnb-bnb-logo.png?v=035',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.png?v=035',
  XRP: 'https://cryptologos.cc/logos/xrp-xrp-logo.png?v=035',
  ADA: 'https://cryptologos.cc/logos/cardano-ada-logo.png?v=035',
  DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.png?v=035',
  TRX: 'https://cryptologos.cc/logos/tron-trx-logo.png?v=035',
  TON: 'https://cryptologos.cc/logos/toncoin-ton-logo.png?v=035',
  AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.png?v=035',
  SHIB: 'https://cryptologos.cc/logos/shiba-inu-shib-logo.png?v=035',
  LINK: 'https://cryptologos.cc/logos/chainlink-link-logo.png?v=035',
  DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.png?v=035',
  BCH: 'https://cryptologos.cc/logos/bitcoin-cash-bch-logo.png?v=035',
  LTC: 'https://cryptologos.cc/logos/litecoin-ltc-logo.png?v=035',
  UNI: 'https://cryptologos.cc/logos/uniswap-uni-logo.png?v=035',
  NEAR: 'https://cryptologos.cc/logos/near-protocol-near-logo.png?v=035',
  APT: 'https://cryptologos.cc/logos/aptos-apt-logo.png?v=035',
  OP: 'https://cryptologos.cc/logos/optimism-ethereum-op-logo.png?v=035',
  ARB: 'https://cryptologos.cc/logos/arbitrum-arb-logo.png?v=035',
  ATOM: 'https://cryptologos.cc/logos/cosmos-atom-logo.png?v=035',
  ETC: 'https://cryptologos.cc/logos/ethereum-classic-etc-logo.png?v=035',
  FIL: 'https://cryptologos.cc/logos/filecoin-fil-logo.png?v=035',
  ICP: 'https://cryptologos.cc/logos/internet-computer-icp-logo.png?v=035',
  SUI: 'https://cryptologos.cc/logos/sui-sui-logo.png?v=035',
  PEPE: 'https://cryptologos.cc/logos/pepe-pepe-logo.png?v=035',
  WLD: 'https://cryptologos.cc/logos/worldcoin-org-wld-logo.png?v=035',
  XLM: 'https://cryptologos.cc/logos/stellar-xlm-logo.png?v=035',
  HBAR: 'https://cryptologos.cc/logos/hedera-hbar-logo.png?v=035',
  AAVE: 'https://cryptologos.cc/logos/aave-aave-logo.png?v=035',
  USDC: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=035',
}

const COINGECKO_QUERY_OVERRIDES: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  TRX: 'tron',
  TON: 'the open network',
  AVAX: 'avalanche',
  SHIB: 'shiba inu',
  LINK: 'chainlink',
  DOT: 'polkadot',
  BCH: 'bitcoin cash',
  LTC: 'litecoin',
  UNI: 'uniswap',
  NEAR: 'near protocol',
  APT: 'aptos',
  OP: 'optimism',
  ARB: 'arbitrum',
  ATOM: 'cosmos',
  ETC: 'ethereum classic',
  FIL: 'filecoin',
  INJ: 'injective',
  ICP: 'internet computer',
  SUI: 'sui',
  PEPE: 'pepe',
  WLD: 'worldcoin',
  XLM: 'stellar',
  HBAR: 'hedera',
  AAVE: 'aave',
  USDC: 'usd coin',
  FDUSD: 'first digital usd',
  TUSD: 'trueusd',
}

async function fetchTokenLogo(baseAsset: string): Promise<string | null> {
  const staticLogo = STATIC_TOKEN_LOGOS[baseAsset]
  if (staticLogo) return staticLogo

  const query = COINGECKO_QUERY_OVERRIDES[baseAsset] ?? baseAsset
  try {
    const response = await fetch(`${COINGECKO_REST}/search?query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = await response.json() as { coins?: CoinGeckoSearchCoin[] }
    const coins = data.coins ?? []
    const exactSymbol = coins.find((coin) => coin.symbol?.toUpperCase() === baseAsset && (coin.thumb || coin.small || coin.large))
    const ranked = [...coins]
      .filter((coin) => coin.thumb || coin.small || coin.large)
      .sort((a, b) => (a.market_cap_rank ?? Number.MAX_SAFE_INTEGER) - (b.market_cap_rank ?? Number.MAX_SAFE_INTEGER))
    const match = exactSymbol ?? ranked[0]
    return match?.small ?? match?.thumb ?? match?.large ?? null
  } catch {
    return null
  }
}

function getVisibleCount(length: number, zoom: number) {
  if (length <= 0) return 0
  return clamp(Math.round(length / zoom), Math.min(24, length), length)
}

function getMaxOffset(length: number, zoom: number) {
  const visibleCount = getVisibleCount(length, zoom)
  return Math.max(0, length - visibleCount)
}

function getVisibleCandles(candles: Candle[], zoom: number, offset: number) {
  const visibleCount = getVisibleCount(candles.length, zoom)
  const safeOffset = clamp(offset, 0, getMaxOffset(candles.length, zoom))
  const end = candles.length - safeOffset
  const start = Math.max(0, end - visibleCount)
  return candles.slice(start, end)
}

function isTradableUSDT(symbol: string) {
  if (!symbol.endsWith('USDT')) return false
  return !/(UP|DOWN|BULL|BEAR)USDT$/.test(symbol)
}

function toMarketRow(ticker: BinanceTicker): MarketRow {
  const quoteAsset = 'USDT'
  const baseAsset = ticker.symbol.slice(0, -quoteAsset.length)
  return {
    key: ticker.symbol,
    symbol: ticker.symbol,
    baseAsset,
    quoteAsset,
    lastPrice: Number(ticker.lastPrice),
    priceChangePercent: Number(ticker.priceChangePercent),
    highPrice: Number(ticker.highPrice),
    lowPrice: Number(ticker.lowPrice),
    volume: Number(ticker.volume),
    quoteVolume: Number(ticker.quoteVolume),
    trades: ticker.count,
  }
}

function parseKline(row: unknown[]): Candle {
  return {
    time: Math.floor(Number(row[0]) / 1000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }
}

function formatPrice(value: number) {
  if (!Number.isFinite(value)) return '--'
  const digits = value >= 1000 ? 2 : value >= 1 ? 4 : value >= 0.01 ? 6 : 8
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '--'
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 }).format(value)
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '--'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTime(seconds: number, interval?: ChartInterval) {
  const date = new Date(seconds * 1000)
  if (interval === '1d') {
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
  }
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function formatDateTime(seconds: number) {
  return new Date(seconds * 1000).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function PriceChange({ value }: { value: number }) {
  const up = value >= 0
  return (
    <Text strong style={{ color: up ? '#089981' : '#f23645', fontFamily: 'var(--font-mono)' }}>
      {up ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {formatPercent(value)}
    </Text>
  )
}

function TokenAvatar({
  label,
  imageUrl,
  size = 42,
}: {
  label: string
  imageUrl?: string | null
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const resolvedImageUrl = imageUrl ?? STATIC_TOKEN_LOGOS[label.toUpperCase()] ?? null

  useEffect(() => {
    setFailed(false)
  }, [resolvedImageUrl])

  return (
    <div
      className="market-token-avatar"
      style={{ width: size, height: size, fontSize: Math.max(14, size * 0.4) }}
      title={label}
    >
      {resolvedImageUrl && !failed ? (
        <img
          src={resolvedImageUrl}
          alt={`${label} logo`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        label.slice(0, 1)
      )}
    </div>
  )
}

function MiniMarketList({
  title,
  icon,
  items,
  metric,
  selectedSymbol,
  tokenLogos,
  onSelect,
}: {
  title: string
  icon: ReactNode
  items: MarketRow[]
  metric: (item: MarketRow) => ReactNode
  selectedSymbol: string
  tokenLogos: TokenLogoMap
  onSelect: (symbol: string) => void
}) {
  return (
    <div className="market-glass market-side-card">
      <div className="market-section-content">
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
          <Space>
            <span style={{ color: 'var(--market-accent-strong)', fontSize: 17 }}>{icon}</span>
            <Text strong>{title}</Text>
          </Space>
          <Tag className="market-chip">{items.length}</Tag>
        </Space>

        <div>
          {items.map((item) => (
            <button key={item.symbol} type="button" className="market-list-button" onClick={() => onSelect(item.symbol)}>
              <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
                <Space size={10}>
                  <TokenAvatar label={item.baseAsset} imageUrl={tokenLogos[item.baseAsset]} size={34} />
                  <div>
                    <Text strong style={{ display: 'block' }}>{item.baseAsset}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.symbol}</Text>
                  </div>
                </Space>
                <div style={{ textAlign: 'right' }}>
                  {metric(item)}
                  {selectedSymbol === item.symbol && <div><Tag color="blue" style={{ margin: 0, marginTop: 4 }}>Đang xem</Tag></div>}
                </div>
              </Space>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}


function SelectedTokenCard({
  market,
  currentCandle,
  logoUrl,
  lastUpdated,
  onRefresh,
}: {
  market?: MarketRow
  currentCandle?: Candle
  logoUrl?: string | null
  lastUpdated: Date | null
  onRefresh: () => void
}) {
  const baseAsset = market?.baseAsset ?? 'BTC'
  const currentPrice = currentCandle?.close ?? market?.lastPrice ?? 0

  return (
    <div className="market-glass market-side-card market-selected-card">
      <div className="market-section-content">
        <div className="market-layout-title">
          <Text strong>Token đang xem</Text>
          <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>Nạp lại</Button>
        </div>

        <div className="market-selected-token">
          <TokenAvatar label={baseAsset} imageUrl={logoUrl} size={62} />
          <div>
            <Title level={4} style={{ margin: 0 }}>{market?.symbol ?? DEFAULT_SYMBOL}</Title>
            <Text type="secondary">{baseAsset} / USDT Spot</Text>
          </div>
        </div>

        <div className="market-selected-price">
          <Text type="secondary">Giá realtime</Text>
          <div>
            <Text strong style={{ fontSize: 28, fontFamily: 'var(--font-mono)' }}>
              ${formatPrice(currentPrice)}
            </Text>
          </div>
          {market && <PriceChange value={market.priceChangePercent} />}
        </div>

        <div className="market-selected-metrics">
          <div className="market-selected-metric">
            <Text type="secondary">Cao 24h</Text>
            <div><Text strong>${formatPrice(market?.highPrice ?? 0)}</Text></div>
          </div>
          <div className="market-selected-metric">
            <Text type="secondary">Thấp 24h</Text>
            <div><Text strong>${formatPrice(market?.lowPrice ?? 0)}</Text></div>
          </div>
          <div className="market-selected-metric">
            <Text type="secondary">Volume</Text>
            <div><Text strong>{formatCompact(market?.quoteVolume ?? 0)}</Text></div>
          </div>
          <div className="market-selected-metric">
            <Text type="secondary">Trades</Text>
            <div><Text strong>{formatCompact(market?.trades ?? 0)}</Text></div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Logo token ưu tiên ảnh thật từ CryptoLogos, sau đó tìm qua CoinGecko khi token xuất hiện trên UI. Cập nhật giá: {lastUpdated ? lastUpdated.toLocaleTimeString('vi-VN') : '--'}.
          </Text>
        </div>
      </div>
    </div>
  )
}

function FeaturedTokenStrip({
  items,
  selectedSymbol,
  tokenLogos,
  onSelect,
}: {
  items: MarketRow[]
  selectedSymbol: string
  tokenLogos: TokenLogoMap
  onSelect: (symbol: string) => void
}) {
  return (
    <div className="market-token-strip" aria-label="Token nổi bật">
      {items.map((item) => (
        <button
          key={item.symbol}
          type="button"
          className={`market-token-pill${item.symbol === selectedSymbol ? ' active' : ''}`}
          onClick={() => onSelect(item.symbol)}
        >
          <TokenAvatar label={item.baseAsset} imageUrl={tokenLogos[item.baseAsset]} size={34} />
          <div style={{ textAlign: 'left' }}>
            <Text strong style={{ display: 'block', lineHeight: 1.1 }}>{item.baseAsset}</Text>
            <PriceChange value={item.priceChangePercent} />
          </div>
        </button>
      ))}
    </div>
  )
}

function ChartToolbar({
  zoom,
  maxOffset,
  offset,
  onZoom,
  onOffset,
  onReset,
  onFullScreen,
  isFullScreen,
}: {
  zoom: number
  maxOffset: number
  offset: number
  onZoom: (next: number) => void
  onOffset: (next: number) => void
  onReset: () => void
  onFullScreen?: () => void
  isFullScreen?: boolean
}) {
  return (
    <div className="market-chart-toolbar">
      <div className="market-chart-toolbar-left">
        <Tooltip title="Thu nhỏ biểu đồ">
          <Button icon={<ZoomOutOutlined />} onClick={() => onZoom(clamp(Number((zoom - 0.35).toFixed(2)), 1, 6))} />
        </Tooltip>
        <div className="market-zoom-slider">
          <Slider
            min={1}
            max={6}
            step={0.25}
            value={zoom}
            tooltip={{ formatter: (value) => `${value?.toFixed(2)}x` }}
            onChange={onZoom}
          />
        </div>
        <Tooltip title="Phóng to biểu đồ">
          <Button icon={<ZoomInOutlined />} onClick={() => onZoom(clamp(Number((zoom + 0.35).toFixed(2)), 1, 6))} />
        </Tooltip>
        <Tag className="market-chip">Zoom {zoom.toFixed(2)}x</Tag>
      </div>

      <div className="market-chart-toolbar-right">
        {maxOffset > 0 && (
          <Tooltip title="Kéo để xem các nến cũ hơn">
            <div className="market-zoom-slider">
              <Slider
                min={0}
                max={maxOffset}
                step={1}
                value={offset}
                tooltip={{ formatter: (value) => `${value ?? 0} nến` }}
                onChange={onOffset}
              />
            </div>
          </Tooltip>
        )}
        <Button onClick={onReset}>Reset</Button>
        {!isFullScreen && onFullScreen && (
          <Button type="primary" icon={<FullscreenOutlined />} onClick={onFullScreen}>
            Xem full
          </Button>
        )}
      </div>
    </div>
  )
}

function CandleChart({
  candles,
  selected,
  interval,
  zoom,
  offset,
  height = 390,
  onZoomChange,
  onOffsetChange,
}: {
  candles: Candle[]
  selected?: MarketRow
  interval: ChartInterval
  zoom: number
  offset: number
  height?: number
  onZoomChange: (next: number) => void
  onOffsetChange: (next: number) => void
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef<{ startX: number; startOffset: number } | null>(null)

  const visibleCandles = useMemo(() => getVisibleCandles(candles, zoom, offset), [candles, offset, zoom])
  const maxOffset = getMaxOffset(candles.length, zoom)

  if (candles.length === 0 || visibleCandles.length === 0) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có dữ liệu nến" />
      </div>
    )
  }

  const width = 1120
  const left = 70
  const right = 26
  const top = 22
  const bottom = 34
  const volumeHeight = Math.max(58, height * 0.16)
  const gap = 16
  const priceBottom = height - bottom - volumeHeight - gap
  const chartWidth = width - left - right
  const minLow = Math.min(...visibleCandles.map((c) => c.low))
  const maxHigh = Math.max(...visibleCandles.map((c) => c.high))
  const maxVolume = Math.max(...visibleCandles.map((c) => c.volume), 1)
  const priceRange = Math.max(maxHigh - minLow, Number.EPSILON)
  const candleSlot = chartWidth / visibleCandles.length
  const candleWidth = Math.max(4, Math.min(16, candleSlot * 0.58))
  const last = visibleCandles[visibleCandles.length - 1]
  const yForPrice = (value: number) => top + ((maxHigh - value) / priceRange) * (priceBottom - top)
  const xForIndex = (index: number) => left + index * candleSlot + candleSlot / 2
  const lastY = yForPrice(last.close)
  const ticks = Array.from({ length: 5 }, (_, index) => maxHigh - (priceRange * index) / 4)
  const hovered = hoverIndex === null ? undefined : visibleCandles[hoverIndex]

  function getIndexFromEvent(event: ReactMouseEvent<SVGSVGElement> | ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const svgX = ((event.clientX - rect.left) / rect.width) * width
    const index = Math.floor((svgX - left) / candleSlot)
    if (index < 0 || index >= visibleCandles.length) return null
    return index
  }

  function handleMouseMove(event: ReactMouseEvent<SVGSVGElement>) {
    setHoverIndex(getIndexFromEvent(event))
  }

  function handleWheel(event: ReactWheelEvent<SVGSVGElement>) {
    event.preventDefault()
    const direction = event.deltaY > 0 ? -0.3 : 0.3
    onZoomChange(clamp(Number((zoom + direction).toFixed(2)), 1, 6))
  }

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    dragRef.current = { startX: event.clientX, startOffset: offset }
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    setHoverIndex(getIndexFromEvent(event))
    if (!dragRef.current) return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = event.clientX - dragRef.current.startX
    const candleDelta = Math.round((dx / Math.max(rect.width, 1)) * visibleCandles.length)
    onOffsetChange(clamp(dragRef.current.startOffset + candleDelta, 0, maxOffset))
  }

  function handlePointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    dragRef.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div>
      <svg
        className={`market-candle-chart${isDragging ? ' dragging' : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${selected?.symbol ?? ''} candlestick chart`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIndex(null)}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <defs>
          <linearGradient id="marketChartBg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="1" stopColor="#fff8db" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="marketVolumeUp" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#089981" stopOpacity="0.26" />
            <stop offset="1" stopColor="#089981" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="marketVolumeDown" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#f23645" stopOpacity="0.25" />
            <stop offset="1" stopColor="#f23645" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="24" fill="url(#marketChartBg)" />
        <rect x="10" y="10" width={width - 20} height={height - 20} rx="20" fill="rgba(255,255,255,.34)" stroke="rgba(15,23,42,.05)" />

        {ticks.map((tick) => {
          const y = yForPrice(tick)
          return (
            <g key={tick}>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="#dbe6f3" strokeDasharray="5 7" opacity=".82" />
              <text x={left - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#64748b">{formatPrice(tick)}</text>
            </g>
          )
        })}

        <line x1={left} x2={width - right} y1={lastY} y2={lastY} stroke={last.close >= last.open ? '#089981' : '#f23645'} strokeDasharray="6 6" opacity=".72" />
        <rect x={width - 112} y={lastY - 13} width="86" height="26" rx="10" fill={last.close >= last.open ? '#089981' : '#f23645'} />
        <text x={width - 69} y={lastY + 4} textAnchor="middle" fontSize="11" fontWeight="900" fill="#fff">{formatPrice(last.close)}</text>

        {visibleCandles.map((candle, index) => {
          const x = xForIndex(index)
          const up = candle.close >= candle.open
          const color = up ? '#089981' : '#f23645'
          const yHigh = yForPrice(candle.high)
          const yLow = yForPrice(candle.low)
          const yOpen = yForPrice(candle.open)
          const yClose = yForPrice(candle.close)
          const bodyY = Math.min(yOpen, yClose)
          const bodyHeight = Math.max(2, Math.abs(yClose - yOpen))
          const volumeY = height - bottom - (candle.volume / maxVolume) * volumeHeight
          return (
            <g key={`${candle.time}-${index}`} opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.72}>
              <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth="1.6" strokeLinecap="round" />
              <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyHeight} rx="2.5" fill={color} />
              <rect x={x - candleWidth / 2} y={volumeY} width={candleWidth} height={height - bottom - volumeY} rx="2.5" fill={up ? 'url(#marketVolumeUp)' : 'url(#marketVolumeDown)'} />
            </g>
          )
        })}

        {visibleCandles.filter((_, index) => index % Math.max(1, Math.ceil(visibleCandles.length / 7)) === 0).map((candle) => {
          const originalIndex = visibleCandles.findIndex((item) => item.time === candle.time)
          return (
            <text key={`${candle.time}-time`} x={xForIndex(originalIndex)} y={height - 10} textAnchor="middle" fontSize="11" fill="#64748b">
              {formatTime(candle.time, interval)}
            </text>
          )
        })}
        <text x={left} y={height - bottom - volumeHeight - 6} fontSize="11" fill="#64748b">Volume</text>

        {hovered && hoverIndex !== null && (() => {
          const hoverX = xForIndex(hoverIndex)
          const hoverY = yForPrice(hovered.close)
          const tooltipWidth = 232
          const tooltipHeight = 118
          const tooltipX = clamp(hoverX + 18, left + 8, width - tooltipWidth - 22)
          const tooltipY = clamp(hoverY - 76, top + 8, height - tooltipHeight - bottom - 8)
          const up = hovered.close >= hovered.open
          return (
            <g>
              <line x1={hoverX} x2={hoverX} y1={top} y2={height - bottom} stroke="#334155" strokeDasharray="4 7" opacity=".42" />
              <line x1={left} x2={width - right} y1={hoverY} y2={hoverY} stroke="#334155" strokeDasharray="4 7" opacity=".36" />
              <circle cx={hoverX} cy={hoverY} r="4" fill={up ? '#089981' : '#f23645'} stroke="#fff" strokeWidth="2" />
              <rect x={tooltipX} y={tooltipY} width={tooltipWidth} height={tooltipHeight} rx="16" fill="rgba(15,23,42,.9)" />
              <text x={tooltipX + 14} y={tooltipY + 22} fontSize="12" fontWeight="900" fill="#fff">{selected?.symbol ?? 'Market'} · {formatDateTime(hovered.time)}</text>
              <text x={tooltipX + 14} y={tooltipY + 45} fontSize="11" fill="#cbd5e1">O: {formatPrice(hovered.open)}  H: {formatPrice(hovered.high)}</text>
              <text x={tooltipX + 14} y={tooltipY + 66} fontSize="11" fill="#cbd5e1">L: {formatPrice(hovered.low)}  C: {formatPrice(hovered.close)}</text>
              <text x={tooltipX + 14} y={tooltipY + 88} fontSize="11" fill="#cbd5e1">Volume: {formatCompact(hovered.volume)}</text>
              <text x={tooltipX + 14} y={tooltipY + 108} fontSize="11" fontWeight="900" fill={up ? '#5eead4' : '#fca5a5'}>{up ? 'Nến tăng' : 'Nến giảm'}</text>
            </g>
          )
        })()}
      </svg>

      <div className="market-interaction-hint">
        Hover để xem OHLC · Lăn chuột để zoom · Kéo biểu đồ sang trái/phải để pan · Dùng thanh trượt để xem vùng nến cũ hơn.
      </div>
    </div>
  )
}

export function CryptoMarketPage() {
  const [markets, setMarkets] = useState<MarketRow[]>([])
  const [selectedSymbol, setSelectedSymbol] = useState(DEFAULT_SYMBOL)
  const [interval, setIntervalValue] = useState<ChartInterval>('1m')
  const [candles, setCandles] = useState<Candle[]>([])
  const [marketLoading, setMarketLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<MarketFilter>('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [chartZoom, setChartZoom] = useState(1)
  const [chartOffset, setChartOffset] = useState(0)
  const [fullChartOpen, setFullChartOpen] = useState(false)
  const [tokenLogos, setTokenLogos] = useState<TokenLogoMap>({})
  const requestedLogosRef = useRef<Set<string>>(new Set())

  const selectedMarket = useMemo(() => markets.find((item) => item.symbol === selectedSymbol), [markets, selectedSymbol])
  const currentCandle = candles[candles.length - 1]
  const chartMaxOffset = getMaxOffset(candles.length, chartZoom)

  const setSafeZoom = useCallback((next: number) => {
    setChartZoom(clamp(next, 1, 6))
  }, [])

  const setSafeOffset = useCallback((next: number) => {
    setChartOffset(clamp(next, 0, getMaxOffset(candles.length, chartZoom)))
  }, [candles.length, chartZoom])

  const resetChartView = useCallback(() => {
    setChartZoom(1)
    setChartOffset(0)
  }, [])

  const fetchMarkets = useCallback(async () => {
    try {
      const response = await fetch(`${BINANCE_REST}/api/v3/ticker/24hr`)
      if (!response.ok) throw new Error(`Binance ticker ${response.status}`)
      const data = await response.json() as BinanceTicker[]
      const rows = data
        .filter((item) => isTradableUSDT(item.symbol))
        .map(toMarketRow)
        .sort((a, b) => b.quoteVolume - a.quoteVolume)
      setMarkets(rows)
      setLastUpdated(new Date())
      setError(null)
      if (!rows.some((item) => item.symbol === selectedSymbol)) {
        setSelectedSymbol(rows[0]?.symbol ?? DEFAULT_SYMBOL)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu thị trường')
    } finally {
      setMarketLoading(false)
    }
  }, [selectedSymbol])

  const fetchCandles = useCallback(async (symbol: string, currentInterval: ChartInterval) => {
    setChartLoading(true)
    try {
      const response = await fetch(`${BINANCE_REST}/api/v3/klines?symbol=${symbol}&interval=${currentInterval}&limit=220`)
      if (!response.ok) throw new Error(`Binance klines ${response.status}`)
      const data = await response.json() as unknown[][]
      setCandles(data.map(parseKline))
      setChartOffset(0)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu nến')
    } finally {
      setChartLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchMarkets()
    const timer = window.setInterval(() => void fetchMarkets(), 15000)
    return () => window.clearInterval(timer)
  }, [fetchMarkets])

  useEffect(() => {
    void fetchCandles(selectedSymbol, interval)
  }, [fetchCandles, selectedSymbol, interval])

  useEffect(() => {
    setChartOffset((prev) => clamp(prev, 0, getMaxOffset(candles.length, chartZoom)))
  }, [candles.length, chartZoom])

  useEffect(() => {
    const socket = new WebSocket(`${BINANCE_WS}/${selectedSymbol.toLowerCase()}@kline_${interval}`)
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data as string) as BinanceKlineEvent
      const kline = payload.k
      const next: Candle = {
        time: Math.floor(kline.t / 1000),
        open: Number(kline.o),
        high: Number(kline.h),
        low: Number(kline.l),
        close: Number(kline.c),
        volume: Number(kline.v),
      }
      setCandles((prev) => {
        if (prev.length === 0) return [next]
        const last = prev[prev.length - 1]
        const merged = last.time === next.time ? [...prev.slice(0, -1), next] : [...prev, next]
        return merged.slice(-220)
      })
    }
    socket.onerror = () => setError('WebSocket thị trường đang gián đoạn')
    return () => socket.close()
  }, [selectedSymbol, interval])

  const hotMarkets = useMemo(() => markets.slice(0, 8), [markets])
  const topGainers = useMemo(() => [...markets].sort((a, b) => b.priceChangePercent - a.priceChangePercent).slice(0, 8), [markets])
  const topLosers = useMemo(() => [...markets].sort((a, b) => a.priceChangePercent - b.priceChangePercent).slice(0, 8), [markets])
  const highPriceTokens = useMemo(() => [...markets].sort((a, b) => b.lastPrice - a.lastPrice).slice(0, 8), [markets])
  const totalVolume = useMemo(() => markets.reduce((sum, item) => sum + item.quoteVolume, 0), [markets])
  const upCount = useMemo(() => markets.filter((item) => item.priceChangePercent >= 0).length, [markets])
  const downCount = useMemo(() => markets.length - upCount, [markets.length, upCount])

  const visibleMarkets = useMemo(() => {
    const normalized = search.trim().toUpperCase()
    let source = markets
    if (filter === 'hot') source = hotMarkets
    if (filter === 'gainers') source = topGainers
    if (filter === 'losers') source = topLosers
    return source.filter((item) => !normalized || item.symbol.includes(normalized) || item.baseAsset.includes(normalized))
  }, [filter, hotMarkets, markets, search, topGainers, topLosers])

  const logoTargets = useMemo(() => {
    const prioritized = [
      selectedMarket,
      ...hotMarkets,
      ...topGainers,
      ...topLosers,
      ...highPriceTokens,
      ...visibleMarkets,
    ].filter(Boolean) as MarketRow[]
    return Array.from(new Set(prioritized.map((item) => item.baseAsset)))
  }, [highPriceTokens, hotMarkets, selectedMarket, topGainers, topLosers, visibleMarkets])

  useEffect(() => {
    const missing = logoTargets.filter((asset) => !requestedLogosRef.current.has(asset))
    if (missing.length === 0) return

    let cancelled = false
    missing.forEach((asset) => requestedLogosRef.current.add(asset))

    async function loadLogos() {
      let cursor = 0
      const workerCount = Math.min(5, missing.length)
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (cursor < missing.length) {
          const asset = missing[cursor]
          cursor += 1
          const logo = await fetchTokenLogo(asset)
          if (!cancelled) {
            setTokenLogos((prev) => ({ ...prev, [asset]: logo }))
          }
          await sleep(80)
        }
      }))
    }

    void loadLogos()

    return () => {
      cancelled = true
    }
  }, [logoTargets])

  const chartStats = [
    ['Open', currentCandle?.open],
    ['High', currentCandle?.high],
    ['Low', currentCandle?.low],
    ['Close', currentCandle?.close],
  ] as const

  const columns: ColumnsType<MarketRow> = [
    {
      title: 'Token',
      dataIndex: 'symbol',
      fixed: 'left',
      width: 170,
      render: (_value, row) => (
        <Space>
          <TokenAvatar label={row.baseAsset} imageUrl={tokenLogos[row.baseAsset]} size={36} />
          <div>
            <Text strong>{row.baseAsset}</Text>
            <div><Text type="secondary" style={{ fontSize: 12 }}>{row.quoteAsset}</Text></div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Giá cuối',
      dataIndex: 'lastPrice',
      align: 'right',
      render: (value: number) => <Text style={{ fontFamily: 'var(--font-mono)' }}>${formatPrice(value)}</Text>,
      sorter: (a, b) => a.lastPrice - b.lastPrice,
    },
    {
      title: '24h',
      dataIndex: 'priceChangePercent',
      align: 'right',
      render: (value: number) => <PriceChange value={value} />,
      sorter: (a, b) => a.priceChangePercent - b.priceChangePercent,
    },
    {
      title: 'Cao 24h',
      dataIndex: 'highPrice',
      align: 'right',
      render: (value: number) => <Text type="secondary">${formatPrice(value)}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Thấp 24h',
      dataIndex: 'lowPrice',
      align: 'right',
      render: (value: number) => <Text type="secondary">${formatPrice(value)}</Text>,
      responsive: ['md'],
    },
    {
      title: 'Volume USDT',
      dataIndex: 'quoteVolume',
      align: 'right',
      render: (value: number) => <Text strong>{formatCompact(value)}</Text>,
      sorter: (a, b) => a.quoteVolume - b.quoteVolume,
    },
  ]

  const renderChartBlock = (isFullScreen = false) => (
    <>
      <div className="market-chart-header">
        <Space size={12} align="center">
          <TokenAvatar label={selectedMarket?.baseAsset ?? selectedSymbol} imageUrl={tokenLogos[selectedMarket?.baseAsset ?? '']} size={48} />
          <div>
            <Space wrap>
              <Title level={isFullScreen ? 3 : 4} style={{ margin: 0 }}>{selectedSymbol}</Title>
              <Badge status="processing" color="#2563eb" text="Realtime" />
            </Space>
            <div>
              <Text strong style={{ fontSize: isFullScreen ? 30 : 24, fontFamily: 'var(--font-mono)' }}>
                ${formatPrice(currentCandle?.close ?? selectedMarket?.lastPrice ?? 0)}
              </Text>
              {selectedMarket && <span style={{ marginLeft: 12 }}><PriceChange value={selectedMarket.priceChangePercent} /></span>}
            </div>
          </div>
        </Space>

        <div className="market-chart-tools">
          <Radio.Group value={interval} onChange={(event) => setIntervalValue(event.target.value as ChartInterval)} buttonStyle="solid">
            {INTERVALS.map((item) => <Radio.Button key={item} value={item}>{item}</Radio.Button>)}
          </Radio.Group>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchCandles(selectedSymbol, interval)}>Nạp nến</Button>
        </div>
      </div>

      <ChartToolbar
        zoom={chartZoom}
        maxOffset={chartMaxOffset}
        offset={chartOffset}
        onZoom={setSafeZoom}
        onOffset={setSafeOffset}
        onReset={resetChartView}
        onFullScreen={() => setFullChartOpen(true)}
        isFullScreen={isFullScreen}
      />

      <div className="market-chart-frame">
        {chartLoading ? (
          <Skeleton.Node active style={{ width: '100%', height: isFullScreen ? 610 : 390, borderRadius: 24 }} />
        ) : (
          <CandleChart
            candles={candles}
            selected={selectedMarket}
            interval={interval}
            zoom={chartZoom}
            offset={chartOffset}
            height={isFullScreen ? 610 : 390}
            onZoomChange={setSafeZoom}
            onOffsetChange={setSafeOffset}
          />
        )}
      </div>
    </>
  )

  return (
    <>
      <style>{MARKET_STYLES}</style>
      <div className="crypto-market-page">
        <div className="market-orb market-orb-1" />
        <div className="market-orb market-orb-2" />
        <div className="market-orb market-orb-3" />

        <div className="market-content">
          <div className="market-glass market-hero">
            <div className="market-hero-main">
              <Row gutter={[18, 18]} align="middle">
                <Col xs={24} lg={10}>
                  <Space direction="vertical" size={8}>
                    <Tag className="market-chip"><ThunderboltOutlined /> Binance public market data</Tag>
                    <Title level={2} style={{ margin: 0, lineHeight: 1.12 }}>Thị trường crypto realtime</Title>
                    <Text style={{ color: 'var(--ink-muted)', fontSize: 14 }}>
                      Theo dõi token USDT spot, nến realtime, top volume, top tăng giảm và mở biểu đồ full màn hình để phân tích rõ hơn.
                    </Text>
                  </Space>
                </Col>
                <Col xs={24} lg={14}>
                  <Row gutter={[12, 12]}>
                    <Col xs={12} md={6}>
                      <div className="market-stat">
                        <Text type="secondary">Cặp USDT</Text>
                        <div><Text strong style={{ fontSize: 22 }}>{markets.length || '--'}</Text></div>
                      </div>
                    </Col>
                    <Col xs={12} md={6}>
                      <div className="market-stat">
                        <Text type="secondary">Volume 24h</Text>
                        <div><Text strong style={{ fontSize: 22 }}>{formatCompact(totalVolume)}</Text></div>
                      </div>
                    </Col>
                    <Col xs={12} md={6}>
                      <div className="market-stat">
                        <Text type="secondary">Đang tăng</Text>
                        <div><Text strong style={{ fontSize: 22, color: '#089981' }}>{upCount}</Text></div>
                      </div>
                    </Col>
                    <Col xs={12} md={6}>
                      <div className="market-stat">
                        <Text type="secondary">Đang giảm</Text>
                        <div><Text strong style={{ fontSize: 22, color: '#f23645' }}>{downCount}</Text></div>
                      </div>
                    </Col>
                  </Row>
                </Col>
              </Row>

              <div style={{ marginTop: 16 }}>
                <FeaturedTokenStrip
                  items={hotMarkets.slice(0, 10)}
                  selectedSymbol={selectedSymbol}
                  tokenLogos={tokenLogos}
                  onSelect={(symbol) => { setSelectedSymbol(symbol); setChartOffset(0) }}
                />
              </div>
            </div>
          </div>

          {error && (
            <Alert
              type="warning"
              showIcon
              message="Dữ liệu thị trường đang gián đoạn"
              description={`${error}. Trang sẽ tự thử lại khi lần cập nhật tiếp theo chạy.`}
              action={<Button size="small" icon={<ReloadOutlined />} onClick={() => { void fetchMarkets(); void fetchCandles(selectedSymbol, interval) }}>Tải lại</Button>}
              style={{ marginBottom: 16, borderRadius: 18 }}
            />
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={17}>
              <div className="market-glass market-chart-shell">
                <div className="market-section-content">
                  {renderChartBlock(false)}

                  <Row gutter={[10, 10]} style={{ marginTop: 12 }}>
                    {chartStats.map(([label, value]) => (
                      <Col xs={12} md={6} key={label}>
                        <div className="market-stat">
                          <Text type="secondary">{label}</Text>
                          <div><Text strong style={{ fontFamily: 'var(--font-mono)' }}>${formatPrice(Number(value ?? 0))}</Text></div>
                        </div>
                      </Col>
                    ))}
                  </Row>
                </div>
              </div>
            </Col>

            <Col xs={24} xl={7}>
              <div className="market-side-stack">
                <SelectedTokenCard
                  market={selectedMarket}
                  currentCandle={currentCandle}
                  logoUrl={tokenLogos[selectedMarket?.baseAsset ?? '']}
                  lastUpdated={lastUpdated}
                  onRefresh={() => { void fetchMarkets(); void fetchCandles(selectedSymbol, interval) }}
                />
                <MiniMarketList
                  title="Token hot"
                  icon={<FireOutlined />}
                  items={hotMarkets.slice(0, 6)}
                  selectedSymbol={selectedSymbol}
                  tokenLogos={tokenLogos}
                  onSelect={(symbol) => { setSelectedSymbol(symbol); setChartOffset(0) }}
                  metric={(item) => <Text strong>{formatCompact(item.quoteVolume)}</Text>}
                />
              </div>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} md={12} xl={8}>
              <MiniMarketList
                title="Tăng mạnh"
                icon={<RiseOutlined />}
                items={topGainers.slice(0, 6)}
                selectedSymbol={selectedSymbol}
                tokenLogos={tokenLogos}
                onSelect={(symbol) => { setSelectedSymbol(symbol); setChartOffset(0) }}
                metric={(item) => <PriceChange value={item.priceChangePercent} />}
              />
            </Col>
            <Col xs={24} md={12} xl={8}>
              <MiniMarketList
                title="Giảm mạnh"
                icon={<ArrowDownOutlined />}
                items={topLosers.slice(0, 6)}
                selectedSymbol={selectedSymbol}
                tokenLogos={tokenLogos}
                onSelect={(symbol) => { setSelectedSymbol(symbol); setChartOffset(0) }}
                metric={(item) => <PriceChange value={item.priceChangePercent} />}
              />
            </Col>
            <Col xs={24} md={24} xl={8}>
              <MiniMarketList
                title="Giá cao"
                icon={<StarOutlined />}
                items={highPriceTokens.slice(0, 6)}
                selectedSymbol={selectedSymbol}
                tokenLogos={tokenLogos}
                onSelect={(symbol) => { setSelectedSymbol(symbol); setChartOffset(0) }}
                metric={(item) => <Text strong>${formatPrice(item.lastPrice)}</Text>}
              />
            </Col>
          </Row>

          <div className="market-glass market-table-panel">
            <div className="market-table-actions">
              <Space>
                <LineChartOutlined style={{ color: 'var(--market-accent-strong)', fontSize: 18 }} />
                <Text strong style={{ fontSize: 16 }}>Danh sách token</Text>
                {marketLoading && <Tag color="processing">Đang tải</Tag>}
                {lastUpdated && <Tag className="market-chip">Cập nhật {lastUpdated.toLocaleTimeString('vi-VN')}</Tag>}
              </Space>

              <Space wrap>
                <Radio.Group value={filter} onChange={(event) => setFilter(event.target.value as MarketFilter)}>
                  <Radio.Button value="all"><AreaChartOutlined /> Tất cả</Radio.Button>
                  <Radio.Button value="hot"><FireOutlined /> Hot</Radio.Button>
                  <Radio.Button value="gainers"><ArrowUpOutlined /> Tăng</Radio.Button>
                  <Radio.Button value="losers"><ArrowDownOutlined /> Giảm</Radio.Button>
                </Radio.Group>
                <Input
                  className="market-input"
                  allowClear
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  prefix={<SearchOutlined />}
                  placeholder="Tìm BTC, ETH..."
                  style={{ width: 230 }}
                />
                <Button icon={<ReloadOutlined />} onClick={() => void fetchMarkets()}>Làm mới</Button>
              </Space>
            </div>

            <div className="market-section-content">
              <Table<MarketRow>
                className="market-table"
                rowKey="symbol"
                columns={columns}
                dataSource={visibleMarkets}
                loading={marketLoading}
                size="middle"
                scroll={{ x: 860 }}
                pagination={{ pageSize: 12, showSizeChanger: false }}
                rowClassName={(row) => row.symbol === selectedSymbol ? 'market-row-selected' : ''}
                onRow={(row) => ({
                  onClick: () => { setSelectedSymbol(row.symbol); setChartOffset(0) },
                  style: { cursor: 'pointer' },
                })}
              />
            </div>
          </div>

          <div className="market-footer-note">
            <Text type="secondary" style={{ fontSize: 12 }}>
              Dữ liệu giá lấy từ Binance Spot public endpoints. Logo token ưu tiên CryptoLogos cho các tài sản phổ biến và dùng CoinGecko Search API cho token còn lại. Đây là màn hình theo dõi thị trường, không phải lời khuyên đầu tư.
            </Text>
          </div>
        </div>

        <Modal
          className="market-fullscreen-modal"
          open={fullChartOpen}
          onCancel={() => setFullChartOpen(false)}
          footer={null}
          width="96vw"
          style={{ top: 18 }}
          destroyOnClose={false}
        >
          <div className="market-full-chart-body">
            {renderChartBlock(true)}
          </div>
        </Modal>
      </div>
    </>
  )
}
