import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert, Badge, Button, Col, DatePicker, Descriptions, Divider, Empty,
  Form, Input, InputNumber, message as antMessage,
  Modal, QRCode, Row, Select, Space, Spin, Steps,
  Switch, Table, Tabs, Tag, Tooltip, Typography,
} from 'antd'
import {
  ClockCircleOutlined,
  DeleteOutlined, DownloadOutlined, PlusOutlined, QrcodeOutlined, ReloadOutlined,
  ShoppingOutlined, UnorderedListOutlined, SafetyCertificateOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import jsQR from 'jsqr'
import {
  getTicketProducts, getMyTicketPurchases, purchaseTicket,
  createTicketProduct,
  getTicketScanLogs,
  getTicketPurchase,
  scanTicketByCode,
  toWei, getNonce,
  type ScanTicketResult, type ServiceTicketProduct, type ServiceTicketPurchase, type ServiceTicketScanLog,
} from '../lib/services'
import { signTypedData, buildTransferTypedData, switchChain } from '../lib/wallet'
import { getActiveChainConfig, getRequiredContractAddress } from '../lib/chainConfig'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

const EVENTS_STYLES = `
.event-page {
  --ev-ink: var(--ink, #0f172a);
  --ev-muted: var(--ink-muted, #475569);
  --ev-subtle: var(--ink-subtle, #64748b);
  --ev-accent: var(--accent, #2563eb);
  --ev-accent-2: #0ea5e9;
  --ev-success: #10b981;
  --ev-warning: #d97706;
  --ev-danger: #dc2626;
  --ev-border: rgba(255, 255, 255, 0.68);
  --ev-page-bg: #eef6ff;
  --ev-paper: rgba(255, 255, 255, 0.42);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 30px;
  background:
    linear-gradient(118deg, rgba(255, 255, 255, 0.24), rgba(239, 246, 255, 0.08) 44%, rgba(236, 253, 245, 0.06)),
    var(--visual-events-bg, none) center top / cover no-repeat,
    radial-gradient(900px 420px at 8% -8%, rgba(37, 99, 235, 0.2), transparent 64%),
    radial-gradient(820px 420px at 94% 0%, rgba(14, 165, 233, 0.2), transparent 64%),
    radial-gradient(720px 400px at 52% 112%, rgba(16, 185, 129, 0.16), transparent 68%),
    linear-gradient(135deg, rgba(219, 234, 254, 0.72), rgba(224, 242, 254, 0.5) 52%, rgba(236, 253, 245, 0.46));
  background-blend-mode: screen, normal, normal, normal, normal, normal;
  box-shadow:
    0 38px 96px rgba(37, 99, 235, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    inset 0 -1px 0 rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(10px) saturate(1.2);
  -webkit-backdrop-filter: blur(10px) saturate(1.2);
  padding: 20px 20px 42px;
}
.event-page::before {
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
.event-page::after {
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
.event-page .ev-glass,
.event-page .ev-toolbar,
.event-page .ev-admin-kpi,
.event-page .ev-chart-card,
.event-page .ev-scan-result,
.event-page .ev-variant-card {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72) !important;
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.08)) !important;
  box-shadow:
    0 26px 64px rgba(37, 99, 235, 0.16),
    0 10px 24px rgba(15, 23, 42, 0.07),
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    inset 0 -1px 0 rgba(37, 99, 235, 0.1),
    inset 1px 0 0 rgba(255, 255, 255, 0.46) !important;
  backdrop-filter: blur(24px) saturate(1.95) contrast(1.06);
  -webkit-backdrop-filter: blur(24px) saturate(1.95) contrast(1.06);
  color: var(--ev-ink);
  transform-style: preserve-3d;
}
.event-page .ev-glass::before,
.event-page .ev-toolbar::before,
.event-page .ev-admin-kpi::before,
.event-page .ev-chart-card::before,
.event-page .ev-scan-result::before,
.event-page .ev-variant-card::before {
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
.event-page .ev-glass::after,
.event-page .ev-toolbar::after,
.event-page .ev-admin-kpi::after,
.event-page .ev-chart-card::after,
.event-page .ev-scan-result::after,
.event-page .ev-variant-card::after {
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
.event-page .ev-glass > *,
.event-page .ev-toolbar > *,
.event-page .ev-admin-kpi > *,
.event-page .ev-chart-card > *,
.event-page .ev-scan-result > *,
.event-page .ev-variant-card > * {
  position: relative;
  z-index: 1;
}
.event-page .ev-hero {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(191, 219, 254, 0.88);
  border-radius: 24px;
  background:
    linear-gradient(110deg, rgba(255, 255, 255, 0.94) 0%, rgba(239, 246, 255, 0.88) 48%, rgba(236, 253, 245, 0.72) 100%),
    var(--visual-events, none) center right / cover no-repeat !important;
  box-shadow: 0 24px 70px rgba(37, 99, 235, 0.14);
  margin-bottom: 18px;
  padding: 26px 30px;
}
.event-page .ev-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(420px 180px at 82% 18%, rgba(14, 165, 233, 0.2), transparent 70%),
    radial-gradient(280px 180px at 96% 92%, rgba(16, 185, 129, 0.2), transparent 72%);
  pointer-events: none;
}
.event-page .ev-hero::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 3px;
  background: linear-gradient(90deg, #2563eb, #0ea5e9, #10b981);
  pointer-events: none;
}
.event-page .ev-hero-title,
.event-page .vndc-hero-title {
  color: var(--ev-ink) !important;
  margin: 0 !important;
  font-family: var(--font-sans) !important;
  font-weight: 800 !important;
  line-height: 1.15 !important;
  letter-spacing: -0.02em;
}
.event-page .vndc-hero-kicker {
  color: var(--ev-accent);
  font-size: 11px;
  font-weight: 740;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.event-page .vndc-hero-desc {
  color: var(--ev-muted) !important;
  max-width: 780px;
}
.event-page .ev-hero-metric {
  min-width: 132px;
  border: 1px solid rgba(255, 255, 255, 0.62);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(255,255,255,.52), rgba(255,255,255,.16));
  box-shadow:
    0 18px 36px rgba(37, 99, 235, 0.12),
    inset 0 1px 0 rgba(255,255,255,.85);
  padding: 12px 14px;
  text-align: right;
  backdrop-filter: blur(14px) saturate(1.45);
  -webkit-backdrop-filter: blur(14px) saturate(1.45);
}
.event-page .ev-hero-metric .value {
  color: var(--ev-ink);
  display: block;
  font-size: 18px;
  font-weight: 820;
  line-height: 1.12;
}
.event-page .ev-hero-metric .label {
  color: var(--ev-subtle);
  display: block;
  font-size: 11px;
  font-weight: 680;
}
.event-page .ev-tabs .ant-tabs-nav {
  margin-bottom: 18px;
}
.event-page .ev-tabs .ant-tabs-nav::before {
  border-bottom-color: rgba(191, 219, 254, 0.7);
}
.event-page .ev-tabs .ant-tabs-tab {
  border-radius: 999px;
  color: var(--ev-muted);
  font-size: 13px;
  font-weight: 720;
  padding: 10px 16px;
  transition: background 180ms ease, transform 180ms ease, color 180ms ease;
}
.event-page .ev-tabs .ant-tabs-tab:hover {
  color: var(--accent-strong, #1d4ed8);
  transform: translateY(-1px);
}
.event-page .ev-tabs .ant-tabs-tab.ant-tabs-tab-active {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.13), rgba(14, 165, 233, 0.1) 58%, rgba(16, 185, 129, 0.1));
  box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.66);
}
.event-page .ev-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn {
  color: var(--accent-strong, #1d4ed8) !important;
}
.event-page .ev-tabs .ant-tabs-ink-bar {
  display: none;
}
.event-page .ev-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 12px;
}
.event-page .ev-toolbar .ant-input,
.event-page .ev-toolbar .ant-input-affix-wrapper,
.event-page .ev-toolbar .ant-select-selector,
.event-page .ev-toolbar .ant-input-number,
.event-page .ev-glass .ant-input,
.event-page .ev-glass .ant-input-affix-wrapper,
.event-page .ev-glass .ant-select-selector,
.event-page .ev-glass .ant-input-number {
  border-radius: 12px !important;
  border-color: rgba(191, 219, 254, 0.9) !important;
  background: rgba(255, 255, 255, 0.78) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.event-page .ev-ticket-grid {
  align-items: stretch;
}
.event-page .ev-ticket-grid > .ant-col {
  display: flex;
}
.event-page .ev-ticket-card {
  --ticket-cutout: rgba(238, 246, 255, 0.96);
  position: relative;
  width: 100%;
  min-height: 236px;
  height: 236px;
  cursor: pointer;
  user-select: none;
  display: grid;
  grid-template-columns: 9px minmax(0, 1fr) 38px 126px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.78) !important;
  border-radius: 24px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.1)) !important;
  box-shadow:
    0 26px 64px rgba(37, 99, 235, 0.16),
    0 10px 24px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    inset 0 -1px 0 rgba(37, 99, 235, 0.1) !important;
  backdrop-filter: blur(24px) saturate(1.95) contrast(1.06);
  -webkit-backdrop-filter: blur(24px) saturate(1.95) contrast(1.06);
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, filter 220ms ease;
}
.event-page .ev-ticket-card::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background:
    linear-gradient(112deg, rgba(255,255,255,.6), transparent 30%, rgba(255,255,255,.14) 54%, transparent 78%),
    radial-gradient(520px 130px at 12% 0%, rgba(255,255,255,.6), transparent 72%);
  opacity: .72;
  pointer-events: none;
}
.event-page .ev-ticket-card::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,.96), rgba(255,255,255,.1) 36%, rgba(14,165,233,.22) 68%, rgba(255,255,255,.46));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.event-page .ev-ticket-card > * {
  position: relative;
  z-index: 1;
}
.event-page .ev-ticket-card:hover {
  border-color: rgba(255, 255, 255, 0.92) !important;
  box-shadow:
    0 34px 78px rgba(37, 99, 235, 0.2),
    0 14px 30px rgba(15, 23, 42, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.98) !important;
  filter: saturate(1.06);
  transform: translateY(-4px) scale(1.004);
}
.event-page .ev-ticket-card:active {
  transform: translateY(-1px) scale(0.996);
}
.event-page .ev-ticket-card.is-inactive {
  opacity: .72;
}
.event-page .ev-ticket-stripe {
  background: var(--ticket-color);
  box-shadow: 8px 0 22px rgba(37, 99, 235, .14);
}
.event-page .ev-ticket-main {
  display: flex;
  min-width: 0;
  gap: 14px;
  padding: 16px 18px;
  background:
    linear-gradient(135deg, rgba(255,255,255,.42), rgba(255,255,255,.12)),
    radial-gradient(320px 120px at 18% 0%, rgba(255,255,255,.5), transparent 72%);
}
.event-page .ev-ticket-media {
  flex: 0 0 96px;
  width: 96px;
  height: 100%;
  min-height: 166px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: 18px;
  background:
    radial-gradient(130px 80px at 20% 12%, rgba(255,255,255,.76), transparent 70%),
    linear-gradient(135deg, var(--ticket-soft), rgba(255,255,255,.5));
  box-shadow: 0 16px 32px rgba(37, 99, 235, .14), inset 0 1px 0 rgba(255,255,255,.88);
}
.event-page .ev-ticket-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.event-page .ev-ticket-media-placeholder {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: var(--ticket-color);
  font-size: 34px;
}
.event-page .ev-ticket-content {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.event-page .ev-ticket-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.event-page .ev-ticket-chip {
  border: 1px solid rgba(255,255,255,.5);
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 11px;
  font-weight: 760;
  line-height: 1.35;
  box-shadow: 0 8px 16px rgba(15, 23, 42, .06), inset 0 1px 0 rgba(255,255,255,.72);
}
.event-page .ev-ticket-title {
  color: var(--ev-ink);
  font-size: 16px;
  font-weight: 840;
  line-height: 1.3;
  min-height: 42px;
}
.event-page .ev-ticket-desc {
  color: var(--ev-muted);
  font-size: 12px;
  line-height: 1.45;
  min-height: 34px;
}
.event-page .ev-line-clamp-1,
.event-page .ev-line-clamp-2 {
  display: -webkit-box !important;
  overflow: hidden;
  -webkit-box-orient: vertical;
  white-space: normal !important;
}
.event-page .ev-line-clamp-1 { -webkit-line-clamp: 1; }
.event-page .ev-line-clamp-2 { -webkit-line-clamp: 2; }
.event-page .ev-ticket-meta {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: auto;
}
.event-page .ev-ticket-stock {
  color: #047857;
  font-size: 12px;
  font-weight: 740;
}
.event-page .ev-ticket-stock.is-out {
  color: var(--ev-danger);
}
.event-page .ev-ticket-date {
  color: var(--ev-subtle);
  font-size: 11px;
}
.event-page .ev-ticket-seam {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(90deg, rgba(255,255,255,.08), rgba(255,255,255,.4) 48%, rgba(255,255,255,.08)),
    radial-gradient(circle at 50% 0%, rgba(255,255,255,.42), transparent 52%);
}
.event-page .ev-ticket-seam::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 26px;
  bottom: 26px;
  width: 2px;
  transform: translateX(-50%);
  background-image: repeating-linear-gradient(to bottom, rgba(71, 85, 105, .5) 0 8px, transparent 8px 15px);
  filter: drop-shadow(0 0 5px rgba(255,255,255,.7));
}
.event-page .ev-ticket-seam::after,
.event-page .ev-ticket-notch-bottom {
  content: "";
  position: absolute;
  left: 50%;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 50% 50%, rgba(255,255,255,.22), transparent 58%),
    var(--ticket-cutout);
  border: 1px solid rgba(191, 219, 254, 0.82);
  box-shadow:
    inset 0 3px 8px rgba(15, 23, 42, .1),
    0 0 0 6px rgba(255,255,255,.16);
  transform: translateX(-50%);
}
.event-page .ev-ticket-seam::after { top: -18px; }
.event-page .ev-ticket-notch-bottom { bottom: -18px; }
.event-page .ev-ticket-stub {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 12px 8px;
  color: #fff;
  text-align: center;
  border-left: 1px dashed rgba(255,255,255,.42);
  background:
    radial-gradient(120px 80px at 30% 0%, rgba(255,255,255,.32), transparent 70%),
    linear-gradient(160deg, color-mix(in srgb, var(--ticket-color), white 8%), var(--ticket-color));
}
.event-page .ev-ticket-stub-label {
  color: rgba(255,255,255,.78);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.event-page .ev-ticket-price {
  color: #fff;
  font-size: 21px;
  font-weight: 920;
  line-height: 1.1;
}
.event-page .ev-ticket-cta {
  margin-top: 8px;
  border: 1px solid rgba(255,255,255,.26);
  border-radius: 999px;
  background: rgba(255,255,255,.22);
  color: #fff;
  font-size: 10px;
  font-weight: 820;
  padding: 4px 9px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.28);
}
.event-page .ev-qr-shell {
  background:
    radial-gradient(circle at top, rgba(37, 99, 235, 0.72) 0%, rgba(15, 23, 42, 0.92) 68%),
    linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,.04));
  border: 1px solid rgba(255,255,255,.2);
  border-radius: 18px;
  padding: 18px;
  text-align: center;
  box-shadow: inset 0 0 0 1px rgba(165,180,252,.2), 0 12px 32px rgba(30,27,75,.35);
}
.event-page .ev-admin-hero {
  padding: 16px;
}
.event-page .ev-admin-kpi {
  min-height: 116px;
  padding: 14px;
}
.event-page .ev-admin-kpi .label,
.event-page .ev-chart-label {
  color: var(--ev-subtle);
  display: block;
  font-size: 12px;
  font-weight: 680;
}
.event-page .ev-admin-kpi .value {
  color: var(--ev-ink);
  display: block;
  font-size: 28px;
  font-weight: 860;
  letter-spacing: -0.03em;
  line-height: 1.1;
}
.event-page .ev-admin-kpi .hint {
  color: var(--ev-muted);
  display: block;
  font-size: 11px;
  margin-top: 5px;
}
.event-page .ev-chart-card {
  height: 100%;
  padding: 16px;
}
.event-page .ev-chart-title {
  color: var(--ev-ink);
  font-size: 15px;
  font-weight: 820;
  margin-bottom: 12px;
}
.event-page .ev-bar-row {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr) 42px;
  gap: 10px;
  align-items: center;
  margin-top: 10px;
}
.event-page .ev-bar-label {
  color: var(--ev-muted);
  font-size: 12px;
  font-weight: 680;
  min-width: 0;
}
.event-page .ev-bar-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(226, 232, 240, 0.86);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08);
}
.event-page .ev-bar-fill {
  height: 100%;
  min-width: 4px;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--bar-color), #0ea5e9);
}
.event-page .ev-bar-count {
  color: var(--ev-ink);
  font-size: 12px;
  font-weight: 820;
  text-align: right;
}
.event-page .ev-daily-chart {
  display: flex;
  align-items: end;
  gap: 10px;
  height: 164px;
  padding-top: 8px;
}
.event-page .ev-daily-item {
  flex: 1;
  min-width: 0;
  display: flex;
  height: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: end;
  gap: 8px;
}
.event-page .ev-daily-bar {
  width: 100%;
  max-width: 34px;
  min-height: 6px;
  border-radius: 999px 999px 8px 8px;
  background: linear-gradient(180deg, #2563eb, #0ea5e9 54%, #10b981);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.2);
}
.event-page .ev-daily-label {
  color: var(--ev-subtle);
  font-size: 11px;
  white-space: nowrap;
}
.event-page .ev-admin-donut-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.event-page .ev-donut-card {
  border: 1px solid rgba(255,255,255,.54);
  border-radius: 16px;
  background: rgba(255,255,255,.28);
  padding: 12px;
  text-align: center;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.65);
}
.event-page .ev-donut {
  --pct: 0;
  --donut-color: #2563eb;
  display: grid;
  place-items: center;
  width: 82px;
  height: 82px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background:
    radial-gradient(circle at center, rgba(255,255,255,.95) 0 54%, transparent 55%),
    conic-gradient(var(--donut-color) calc(var(--pct) * 1%), rgba(226, 232, 240, 0.8) 0);
  box-shadow: 0 12px 24px rgba(37,99,235,.12), inset 0 1px 0 rgba(255,255,255,.85);
}
.event-page .ev-donut strong {
  color: var(--ev-ink);
  font-size: 18px;
}
.event-page .ev-table-card {
  padding: 14px;
}
.event-page .ev-table-card .ant-table,
.event-page .ev-glass .ant-table {
  background: transparent !important;
}
.event-page .ev-table-card .ant-table-thead > tr > th,
.event-page .ev-glass .ant-table-thead > tr > th {
  background: rgba(239, 246, 255, 0.76) !important;
  color: var(--ev-ink);
  font-weight: 760;
}
.event-page .ev-table-card .ant-table-tbody > tr > td,
.event-page .ev-glass .ant-table-tbody > tr > td {
  background: rgba(255,255,255,.38);
  border-bottom-color: rgba(191, 219, 254, 0.42) !important;
}
.event-page .ev-table-card .ant-table-tbody > tr:hover > td,
.event-page .ev-glass .ant-table-tbody > tr:hover > td {
  background: rgba(239, 246, 255, 0.64) !important;
}
.event-page .ant-btn {
  border-radius: 12px;
  font-weight: 650;
}
.event-page .ant-btn:active,
.ev-liquid-modal .ant-btn:active {
  transform: translateY(1px);
}
.event-page .ant-btn-primary {
  border-color: #2563eb !important;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
}
.event-page .ant-empty-description,
.event-page .ant-typography-secondary,
.event-page .ant-descriptions-item-label {
  color: var(--ev-subtle) !important;
}
.ev-liquid-modal .ant-modal-content {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 22px !important;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.72), rgba(239, 246, 255, 0.48) 58%, rgba(236, 253, 245, 0.36)) !important;
  box-shadow:
    0 34px 88px rgba(37, 99, 235, 0.22),
    inset 0 1px 0 rgba(255, 255, 255, 0.96),
    inset 0 -1px 0 rgba(37, 99, 235, 0.08);
  backdrop-filter: blur(28px) saturate(1.85) contrast(1.06);
  -webkit-backdrop-filter: blur(28px) saturate(1.85) contrast(1.06);
}
.ev-liquid-modal .ant-modal-body {
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.08)),
    var(--visual-events-bg, none) center top / cover no-repeat;
  background-blend-mode: screen, normal;
}
.ev-liquid-modal img {
  box-shadow:
    0 22px 48px rgba(37, 99, 235, 0.16),
    inset 0 1px 0 rgba(255, 255, 255, 0.78);
}
.ev-liquid-modal .ant-modal-header {
  background: transparent !important;
  border-bottom-color: rgba(191, 219, 254, 0.72) !important;
}
.ev-liquid-modal .ant-modal-title {
  color: var(--ink, #0f172a);
  font-weight: 780;
}
.ev-liquid-modal .ant-input,
.ev-liquid-modal .ant-input-affix-wrapper,
.ev-liquid-modal .ant-input-number,
.ev-liquid-modal .ant-picker,
.ev-liquid-modal .ant-select-selector {
  border-radius: 12px !important;
  border-color: rgba(191, 219, 254, 0.9) !important;
  background: rgba(255, 255, 255, 0.78) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}
.ev-liquid-modal .ant-btn {
  border-radius: 12px;
  font-weight: 650;
}
.ev-liquid-modal .ant-btn-primary {
  border-color: #2563eb !important;
  background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%) !important;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.2);
}
.ev-liquid-modal .ant-descriptions-view,
.ev-liquid-modal .ant-steps,
.ev-liquid-modal .ev-qr-shell {
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.34);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}
@media (max-width: 992px) {
  .event-page .ev-ticket-card {
    grid-template-columns: 7px minmax(0, 1fr) 0 104px;
  }
  .event-page .ev-ticket-media {
    display: none;
  }
}
@media (max-width: 768px) {
  .event-page {
    padding: 12px;
    border-radius: 20px;
  }
  .event-page .ev-hero {
    padding: 18px;
    border-radius: 18px;
  }
  .event-page .ev-glass {
    border-radius: 18px;
  }
  .event-page .ev-ticket-card {
    grid-template-columns: 7px minmax(0, 1fr) 32px 104px;
    height: 220px;
    min-height: 220px;
  }
  .event-page .ev-ticket-main {
    padding: 14px;
  }
  .event-page .ev-ticket-stub {
    padding-inline: 6px;
  }
  .event-page .ev-ticket-price {
    font-size: 17px;
  }
  .event-page .ev-admin-donut-grid {
    grid-template-columns: 1fr;
  }
  .event-page .ev-bar-row {
    grid-template-columns: 96px minmax(0, 1fr) 34px;
  }
}

/* Events visual refresh: lighter page shell and more physical ticket cards. */
.event-page {
  background:
    linear-gradient(118deg, rgba(255,255,255,0.42), rgba(239,246,255,0.16) 44%, rgba(236,253,245,0.14)),
    radial-gradient(900px 420px at 8% -8%, rgba(37,99,235,0.22), transparent 64%),
    radial-gradient(820px 420px at 94% 0%, rgba(14,165,233,0.2), transparent 64%),
    radial-gradient(720px 400px at 52% 112%, rgba(16,185,129,0.16), transparent 68%),
    var(--visual-events-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, #dbeafe, #ecfeff 52%, #dcfce7) !important;
}
.event-page::before {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.2), rgba(246,248,251,0.42) 58%, rgba(255,255,255,0.68)),
    radial-gradient(900px 360px at 50% -10%, rgba(255,255,255,0.34), transparent 72%);
}
.event-page::after {
  opacity: 0.3;
}
.event-page .ev-hero {
  min-height: 218px;
  border-color: rgba(255,255,255,0.76) !important;
  background:
    linear-gradient(104deg, rgba(255,255,255,0.82) 0%, rgba(239,246,255,0.58) 42%, rgba(255,255,255,0.18) 100%),
    var(--visual-events, none) center right / cover no-repeat !important;
  backdrop-filter: blur(14px) saturate(1.28);
  -webkit-backdrop-filter: blur(14px) saturate(1.28);
}
.event-page .ev-hero::before {
  background:
    linear-gradient(90deg, rgba(255,255,255,0.18), transparent 55%),
    radial-gradient(420px 170px at 84% 12%, rgba(14,165,233,0.2), transparent 70%),
    radial-gradient(320px 180px at 96% 94%, rgba(16,185,129,0.18), transparent 72%);
}
.event-page .ev-hero-title,
.event-page .vndc-hero-title {
  font-size: clamp(25px, 3vw, 40px) !important;
  font-weight: 880 !important;
  letter-spacing: -0.045em !important;
}
.event-page .vndc-hero-desc {
  color: #334155 !important;
  line-height: 1.65;
}
.event-page .ev-tabs-shell {
  border: 0 !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  padding: 0;
}
.event-page .ev-tabs-shell::before,
.event-page .ev-tabs-shell::after {
  display: none !important;
}
.event-page .ev-tabs > .ant-tabs-nav {
  position: sticky;
  top: 84px;
  z-index: 3;
  margin: 0 0 18px;
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: 22px;
  background: rgba(255,255,255,0.5);
  box-shadow: 0 18px 42px rgba(37,99,235,0.1), inset 0 1px 0 rgba(255,255,255,0.86);
  backdrop-filter: blur(18px) saturate(1.45);
  -webkit-backdrop-filter: blur(18px) saturate(1.45);
  padding: 8px 10px 0;
}
.event-page .ev-ticket-card {
  --ticket-cutout: rgba(239, 246, 255, 0.98);
  --ticket-paper: #fff2dc;
  --ticket-paper-deep: #f9d9aa;
  --ticket-notch-r: 22px;
  --ticket-notch-x: calc(100% - 159px);
  min-height: 252px;
  height: 252px;
  grid-template-columns: 10px minmax(0, 1fr) 42px 138px;
  border-color: rgba(255,255,255,0.84) !important;
  border-radius: 26px;
  background:
    linear-gradient(135deg, rgba(255,246,230,0.98), rgba(255,234,202,0.82) 52%, rgba(249,217,170,0.56)) !important;
  box-shadow:
    0 28px 70px rgba(37,99,235,0.16),
    0 12px 28px rgba(15,23,42,0.09),
    inset 0 1px 0 rgba(255,255,255,0.98),
    inset 0 -18px 34px rgba(37,99,235,0.06) !important;
  backdrop-filter: blur(20px) saturate(1.58) contrast(1.03);
  -webkit-backdrop-filter: blur(20px) saturate(1.58) contrast(1.03);
  -webkit-mask:
    radial-gradient(circle var(--ticket-notch-r) at var(--ticket-notch-x) 0, transparent 98%, #000 100%),
    radial-gradient(circle var(--ticket-notch-r) at var(--ticket-notch-x) 100%, transparent 98%, #000 100%);
  -webkit-mask-composite: source-in;
  mask:
    radial-gradient(circle var(--ticket-notch-r) at var(--ticket-notch-x) 0, transparent 98%, #000 100%),
    radial-gradient(circle var(--ticket-notch-r) at var(--ticket-notch-x) 100%, transparent 98%, #000 100%);
  mask-composite: intersect;
}
.event-page .ev-ticket-card::before {
  background:
    linear-gradient(115deg, rgba(255,255,255,0.48), transparent 26%, rgba(255,244,224,0.2) 58%, transparent 80%),
    radial-gradient(580px 130px at 12% 0%, rgba(255,255,255,0.58), transparent 72%),
    repeating-linear-gradient(0deg, transparent 0 11px, rgba(146,64,14,0.035) 11px 12px);
  opacity: 0.76;
}
.event-page .ev-ticket-main {
  gap: 16px;
  padding: 18px 20px;
  background:
    linear-gradient(135deg, rgba(255,248,237,0.94), rgba(255,237,213,0.76)),
    radial-gradient(340px 120px at 18% 0%, rgba(255,255,255,0.62), transparent 72%);
}
.event-page .ev-ticket-media {
  flex-basis: 108px;
  width: 108px;
  min-height: 180px;
  border-radius: 20px;
}
.event-page .ev-ticket-title {
  font-size: 17px;
  font-weight: 880;
}
.event-page .ev-ticket-seam {
  background:
    linear-gradient(90deg, rgba(255,255,255,0.04), rgba(255,255,255,0.52) 48%, rgba(255,255,255,0.04)),
    repeating-linear-gradient(to bottom, transparent 0 12px, rgba(37,99,235,0.08) 12px 13px);
}
.event-page .ev-ticket-seam::before {
  top: 30px;
  bottom: 30px;
  width: 3px;
  background-image: repeating-linear-gradient(to bottom, rgba(71,85,105,0.58) 0 7px, transparent 7px 14px);
}
.event-page .ev-ticket-seam::after,
.event-page .ev-ticket-notch-bottom {
  width: 42px;
  height: 42px;
}
.event-page .ev-ticket-seam::after { top: -21px; }
.event-page .ev-ticket-notch-bottom { bottom: -21px; }
.event-page .ev-ticket-stub {
  justify-content: space-between;
  padding: 15px 10px;
  border-left: 1px dashed rgba(255,255,255,0.56);
}
.event-page .ev-ticket-mini-qr {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border: 1px solid rgba(255,255,255,0.38);
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,255,255,0.7)),
    repeating-linear-gradient(45deg, #0f172a 0 2px, transparent 2px 6px);
  color: var(--ticket-color);
  font-size: 23px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.82), 0 12px 24px rgba(15,23,42,0.12);
}
.event-page .ev-ticket-code {
  max-width: 96px;
  overflow: hidden;
  color: rgba(255,255,255,0.72);
  font-family: var(--font-mono);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.event-page .ev-ticket-price-block {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-width: 0;
}
.event-page .ev-ticket-price {
  font-size: 23px;
}
.event-page .ev-ticket-seam {
  z-index: 3;
  overflow: visible;
  background:
    linear-gradient(90deg, rgba(255,248,237,0.96), rgba(255,242,220,0.92)),
    radial-gradient(120px 92px at 0% 10%, rgba(255,255,255,0.48), transparent 72%);
}
.event-page .ev-ticket-seam::before {
  display: none;
}
.event-page .ev-ticket-seam::after,
.event-page .ev-ticket-notch-bottom {
  z-index: 3;
  left: 50%;
  width: 44px;
  height: 44px;
  background:
    linear-gradient(118deg, rgba(255,255,255,0.18), rgba(239,246,255,0.08) 44%, rgba(236,253,245,0.06)),
    var(--visual-events-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, rgba(219,234,254,0.72), rgba(224,242,254,0.5) 52%, rgba(236,253,245,0.46));
  border-color: rgba(255,255,255,0.82);
  box-shadow:
    inset 0 3px 10px rgba(15,23,42,0.1),
    0 0 0 1px rgba(148,163,184,0.12);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.event-page .ev-ticket-seam::after {
  top: 0;
  transform: translate(-50%, -50%);
}
.event-page .ev-ticket-notch-bottom {
  bottom: 0;
  transform: translate(-50%, 50%);
}
.event-page .ev-ticket-stub {
  z-index: 4;
  margin-left: -21px;
  padding-left: 31px;
  border-left: 0;
  background:
    radial-gradient(132px 88px at 28% 0%, rgba(255,255,255,0.32), transparent 70%),
    linear-gradient(160deg, color-mix(in srgb, var(--ticket-color), white 8%), var(--ticket-color));
}
.event-page .ev-toolbar,
.event-page .ev-glass,
.event-page .ev-admin-kpi,
.event-page .ev-chart-card,
.event-page .ev-variant-card {
  border-color: rgba(255,255,255,0.74) !important;
  background: linear-gradient(135deg, rgba(255,255,255,0.44), rgba(255,255,255,0.18) 52%, rgba(219,234,254,0.18)) !important;
}
@media (max-width: 992px) {
  .event-page .ev-ticket-card {
    --ticket-notch-r: 21px;
    --ticket-notch-x: calc(100% - 143px);
    grid-template-columns: 9px minmax(0, 1fr) 38px 124px;
  }
  .event-page .ev-ticket-stub {
    margin-left: -19px;
    padding-left: 29px;
  }
}
@media (max-width: 768px) {
  .event-page .ev-tabs > .ant-tabs-nav {
    position: relative;
    top: auto;
    overflow-x: auto;
  }
  .event-page .ev-ticket-card {
    grid-template-columns: 8px minmax(0, 1fr);
    height: auto;
    min-height: 0;
    -webkit-mask: none;
    mask: none;
  }
  .event-page .ev-ticket-seam {
    display: none;
  }
  .event-page .ev-ticket-stub {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 56px 1fr auto;
    align-items: center;
    gap: 12px;
    margin-left: 0;
    padding: 15px 10px;
    border-left: 0;
    border-top: 1px dashed rgba(255,255,255,0.56);
    text-align: left;
  }
  .event-page .ev-ticket-price-block {
    justify-items: start;
  }
  .event-page .ev-ticket-code {
    max-width: 100%;
  }
  .event-page .ev-ticket-media {
    display: none;
  }
}
`


// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fromWei(wei: string): number {
  if (!wei || wei === '0') return 0
  try { return Number(BigInt(wei)) / 1e18 } catch { return 0 }
}

function fmtVNDC(wei: string): string {
  const n = fromWei(wei)
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function shortWallet(w?: string): string {
  if (!w || w.length < 10) return w ?? ''
  return `${w.slice(0, 6)}…${w.slice(-4)}`
}

function checkIsAdmin(user?: AuthUser): boolean {
  return !!user?.roles?.some(r => r === 'ADMIN' || r === 'SUPER_ADMIN')
}

function getChainId(): number { return getActiveChainConfig().chainId }
function getTokenContract(): string { return getRequiredContractAddress('VNDCToken', 'VNDC Token') }

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CATEGORY_LABEL: Record<string, string> = {
  EVENT_SEAT: 'Sự kiện',
  RETAKE_EXAM: 'Thi lại',
  GRADE_UPGRADE: 'Nâng điểm',
  COMPUTER_RENTAL: 'Thuê máy tính',
  PARKING_MONTHLY: 'Vé xe tháng',
  OTHER: 'Khác',
}

const CATEGORY_COLORS: Record<string, { bg: string; light: string }> = {
  EVENT_SEAT:      { bg: '#7C3AED', light: '#EDE9FE' },
  RETAKE_EXAM:     { bg: '#DC2626', light: '#FEE2E2' },
  GRADE_UPGRADE:   { bg: '#059669', light: '#D1FAE5' },
  COMPUTER_RENTAL: { bg: '#2563EB', light: '#DBEAFE' },
  PARKING_MONTHLY: { bg: '#D97706', light: '#FEF3C7' },
  OTHER:           { bg: '#6B7280', light: '#F3F4F6' },
}

const PURCHASE_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  COMPLETED:       'Đã thanh toán',
  FAILED:          'Thất bại',
  USED:            'Đã sử dụng',
  EXPIRED:         'Hết hạn',
}

const PURCHASE_STATUS_COLOR: Record<string, 'success' | 'error' | 'default' | 'warning' | 'processing'> = {
  PENDING_PAYMENT: 'processing',
  COMPLETED:       'success',
  FAILED:          'error',
  USED:            'default',
  EXPIRED:         'warning',
}

// â”€â”€â”€ TicketCard â€” Physical ticket design â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TicketCard({
  product,
  onClick,
}: {
  product: ServiceTicketProduct
  onClick: () => void
}) {
  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isLimited = product.stock_mode === 'LIMITED'
  const outOfStock = isLimited && product.available_stock <= 0
  const isActive = product.status === 'ACTIVE'

  return (
    <div
      role="button"
      tabIndex={0}
      className={`ev-ticket-card ${isActive ? '' : 'is-inactive'}`}
      style={{ '--ticket-color': col.bg, '--ticket-soft': col.light } as React.CSSProperties}
      onClick={onClick}
      onKeyDown={e => e.key === 'Enter' && onClick()}
    >
      <div className="ev-ticket-stripe" />

      <div className="ev-ticket-main">
        <div className="ev-ticket-media">
          {product.image_uri ? (
            <img src={product.image_uri} alt={product.title} />
          ) : (
            <div className="ev-ticket-media-placeholder"><QrcodeOutlined /></div>
          )}
        </div>

        <div className="ev-ticket-content">
          <div className="ev-ticket-tags">
            <span className="ev-ticket-chip" style={{ background: col.light, color: col.bg }}>
              {CATEGORY_LABEL[product.category] ?? product.category}
            </span>
            <span className="ev-ticket-chip" style={{ background: 'rgba(248, 250, 252, 0.82)', color: '#64748B' }}>
              {product.ticket_type}
            </span> 
            {!isActive && (
              <span className="ev-ticket-chip" style={{ background: '#FFF7ED', color: '#C2410C' }}>
                {product.status}
              </span>
            )}
          </div>

          <div className="ev-ticket-title ev-line-clamp-2">
            {product.title}
          </div>

          <div className="ev-ticket-desc ev-line-clamp-2">
            {product.description || 'Vé dịch vụ/sự kiện trong hệ sinh thái VNDC campus.'}
          </div>

          <div className="ev-ticket-meta">
            {outOfStock ? (
              <span className="ev-ticket-stock is-out">Hết vé</span>
            ) : isLimited ? (
              <span className="ev-ticket-stock">
                Còn <strong>{product.available_stock.toLocaleString()}</strong> vé
              </span>
            ) : (
              <span className="ev-ticket-stock">Không giới hạn</span>
            )}
            {product.sale_ends_at && (
              <span className="ev-ticket-date">
                Đến {dayjs(product.sale_ends_at).format('DD/MM/YYYY')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="ev-ticket-seam">
        <div className="ev-ticket-notch-bottom" />
      </div>

      <div className="ev-ticket-stub">
        <div className="ev-ticket-mini-qr" aria-hidden="true">
          <QrcodeOutlined />
        </div>
        <div className="ev-ticket-price-block">
          <span className="ev-ticket-code">{product.code || product.id.slice(0, 10)}</span>
          <span className="ev-ticket-stub-label">Đơn giá</span>
          <span className="ev-ticket-price">{fmtVNDC(product.unit_price)}</span>
          <span className="ev-ticket-stub-label">VNDC</span>
        </div>
        {isActive && !outOfStock ? (
          <div className="ev-ticket-cta">Xem chi tiết</div>
        ) : outOfStock ? (
          <div className="ev-ticket-cta">Hết vé</div>
        ) : null}
      </div>
    </div>
  )
}

function PurchaseModal({
  product,
  user,
  open,
  onClose,
  onSuccess,
}: {
  product: ServiceTicketProduct
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [step, setStep] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [syncLabel, setSyncLabel] = useState('')

  useEffect(() => {
    if (!open) { setStep(-1); setError(''); setSyncLabel('') }
  }, [open])

  async function waitForSettlement(purchaseID: string): Promise<ServiceTicketPurchase | null> {
    const started = Date.now()
    while (Date.now() - started < 45000) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      try {
        const latest = await getTicketPurchase(purchaseID)
        if (latest.status === 'COMPLETED' || latest.status === 'FAILED') {
          return latest
        }
      } catch {
        // Keep polling transient failures.
      }
    }
    return null
  }

  async function handleBuy() {
    setLoading(true)
    setError('')
    try {
      setStep(0)
      await switchChain(getChainId())

      setStep(1)
      const { nonce } = await getNonce(user.wallet_address)

      setStep(2)
      const deadline = Math.floor(Date.now() / 1000) + 3600
      const typedData = buildTransferTypedData({
        chainId: getChainId(),
        verifyingContract: getTokenContract(),
        from: user.wallet_address,
        to: product.seller_wallet,
        amount: product.unit_price,
        nonce: String(nonce),
        deadline,
      })
      const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)

      setStep(3)
      const purchase = await purchaseTicket(product.id, {
        from_wallet: user.wallet_address,
        quantity: 1,
        nonce: String(nonce),
        deadline,
        signature: signature ?? '',
      })

      if (purchase.status === 'COMPLETED') {
        setStep(5)
        antMessage.success('Mua vé thành công!')
        onSuccess()
        return
      }

      setStep(4)
      setSyncLabel('Đang đợi batch settle on-chain và cập nhật DB...')
      const settled = await waitForSettlement(purchase.id)
      if (!settled) {
        setSyncLabel('Lệnh đã được gửi. Hệ thống sẽ tiếp tục đồng bộ trong nền.')
        antMessage.info('Lệnh mua vé đã gửi, đang chờ đồng bộ on-chain/off-chain.')
        onSuccess()
        return
      }
      if (settled.status === 'FAILED') {
        throw new Error(settled.failure_reason || 'Thanh toán thất bại trong quá trình settle')
      }

      setStep(5)
      setSyncLabel('Đồng bộ hoàn tất.')
      antMessage.success('Mua vé thành công!')
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isDone = step === 4

  return (
    <Modal
      className="ev-liquid-modal"
      open={open}
      onCancel={onClose}
      title="Xác nhận mua vé"
      footer={null}
      width={440}
      closable={!loading}
      maskClosable={!loading}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={16}>
        {/* Summary card */}
        <div style={{
          background: col.light, borderRadius: 8,
          padding: '12px 16px', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <Text strong style={{ color: col.bg, display: 'block' }}>{product.title}</Text>
            <Text style={{ fontSize: 12, color: '#6B7280' }}>{product.ticket_type}</Text>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Text strong style={{ fontSize: 20, color: col.bg }}>{fmtVNDC(product.unit_price)}</Text>
            <Text style={{ fontSize: 11, color: '#6B7280', display: 'block' }}>VNDC</Text>
          </div>
        </div>

        {/* Progress */}
        {step >= 0 && (
          <Steps
            current={step}
            size="small"
            status={error ? 'error' : isDone ? 'finish' : 'process'}
            items={[
              { title: 'Chuyển mạng' },
              { title: 'Lấy nonce' },
              { title: 'Ký EIP-712' },
              { title: 'Gửi lên server' },
              { title: 'Batch settle' },
              { title: 'Hoàn tất' },
            ]}
          />
        )}

        {syncLabel && !error && <Alert type="info" message={syncLabel} showIcon />}

        {error && <Alert type="error" message={error} showIcon />}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          {isDone ? (
            <Button type="primary" onClick={onClose}>Đóng</Button>
          ) : (
            <Button
              type="primary"
              loading={loading}
              onClick={handleBuy}
              style={{ background: col.bg, borderColor: col.bg }}
            >
              Thanh toán {fmtVNDC(product.unit_price)} VNDC
            </Button>
          )}
        </div>
      </Space>
    </Modal>
  )
}

// â”€â”€â”€ TicketDetailModal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TicketDetailModal({
  product,
  user,
  open,
  onClose,
  onBuySuccess,
}: {
  product: ServiceTicketProduct | null
  user?: AuthUser
  open: boolean
  onClose: () => void
  onBuySuccess: () => void
}) {
  const [showBuy, setShowBuy] = useState(false)

  useEffect(() => {
    if (!open) setShowBuy(false)
  }, [open])

  if (!product) return null

  const col = CATEGORY_COLORS[product.category] ?? CATEGORY_COLORS.OTHER
  const isLimited = product.stock_mode === 'LIMITED'
  const outOfStock = isLimited && product.available_stock <= 0
  const canBuy = product.status === 'ACTIVE' && !outOfStock && !!user

  return (
    <>
      <Modal
        className="ev-liquid-modal"
        open={open}
        onCancel={onClose}
        footer={null}
        width={520}
        title={
          <Space>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: col.bg, flexShrink: 0 }} />
            <Text strong style={{ fontSize: 16 }}>{product.title}</Text>
          </Space>
        }
      >
        {product.image_uri && (
          <div style={{ margin: '-8px -24px 16px', height: 200, overflow: 'hidden' }}>
            <img
              src={product.image_uri}
              alt={product.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="purple">{CATEGORY_LABEL[product.category] ?? product.category}</Tag>
            <Tag>{product.ticket_type}</Tag>
            <Tag color={product.status === 'ACTIVE' ? 'green' : 'orange'}>{product.status}</Tag>
          </Space>

          {product.description && (
            <Paragraph style={{ margin: 0, color: '#374151', lineHeight: 1.7 }}>
              {product.description}
            </Paragraph>
          )}

          <Descriptions column={2} size="small" bordered>
            <Descriptions.Item label="Đơn giá" span={2}>
              <Text strong style={{ fontSize: 20, color: col.bg }}>
                {fmtVNDC(product.unit_price)} VNDC
              </Text>
            </Descriptions.Item>

            {isLimited && (
              <>
                <Descriptions.Item label="Tổng SL">
                  {product.total_stock.toLocaleString()} vé
                </Descriptions.Item>
                <Descriptions.Item label="Còn lại">
                  <Text style={{ color: outOfStock ? '#DC2626' : '#059669', fontWeight: 600 }}>
                    {outOfStock ? 'Hết vé' : `${product.available_stock.toLocaleString()} vé`}
                  </Text>
                </Descriptions.Item>
              </>
            )}

            {product.sale_starts_at && (
              <Descriptions.Item label="Mở bán">
                {dayjs(product.sale_starts_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
            )}
            {product.sale_ends_at && (
              <Descriptions.Item label="Kết thúc">
                {dayjs(product.sale_ends_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
            )}

            <Descriptions.Item label="Ma SP" span={2}>
              <Text code>{product.code}</Text>
            </Descriptions.Item>
          </Descriptions>

          {canBuy ? (
            <Button
              type="primary"
              size="large"
              block
              onClick={() => setShowBuy(true)}
              style={{ background: col.bg, borderColor: col.bg, fontWeight: 700 }}
            >
              Mua vé | {fmtVNDC(product.unit_price)} VNDC
            </Button>
          ) : outOfStock ? (
            <Alert type="warning" showIcon message="Vé đã hết, không thể mua thêm." />
          ) : product.status !== 'ACTIVE' ? (
            <Alert type="warning" showIcon message="Sản phẩm này tạm thời không bán." />
          ) : (
            <Alert type="info" showIcon message="Đăng nhập để mua vé." />
          )}
        </Space>
      </Modal>

      {user && showBuy && (
        <PurchaseModal
          product={product}
          user={user}
          open={showBuy}
          onClose={() => setShowBuy(false)}
          onSuccess={() => {
            setShowBuy(false)
            onClose()
            onBuySuccess()
          }}
        />
      )}
    </>
  )
}

// â”€â”€â”€ MyTickets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function MyTickets({ user }: { user: AuthUser }) {
  const [purchases, setPurchases] = useState<ServiceTicketPurchase[]>([])
  const [productMap, setProductMap] = useState<Record<string, ServiceTicketProduct>>({})
  const [loading, setLoading] = useState(false)
  const [qrItem, setQrItem] = useState<ServiceTicketPurchase | null>(null)
  const [detailItem, setDetailItem] = useState<ServiceTicketPurchase | null>(null)
  const [hasPending, setHasPending] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanResultOpen, setScanResultOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanTicketResult | null>(null)
  const [scanCode, setScanCode] = useState('')
  const qrWrapRef = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ items }, productsResp] = await Promise.all([
        getMyTicketPurchases({ page: 1, page_size: 50 }),
        getTicketProducts({ page: 1, page_size: 200 }),
      ])
      setPurchases(items)
      setHasPending(items.some(item => item.status === 'PENDING_PAYMENT'))
      const map: Record<string, ServiceTicketProduct> = {}
      for (const product of productsResp.items) map[product.id] = product
      setProductMap(map)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!hasPending) return
    const timer = setInterval(() => { void load() }, 3000)
    return () => clearInterval(timer)
  }, [hasPending, load])

  function getProduct(item: ServiceTicketPurchase): ServiceTicketProduct | undefined {
    return productMap[item.product_id]
  }

  function getTicketName(item: ServiceTicketPurchase): string {
    const product = getProduct(item)
    if (product?.title) return product.title
    return `Vé #${item.product_id.slice(0, 8)}`
  }

  async function handleScanTicketCode(ticketCode: string) {
    setScanOpen(false)
    setScanCode(ticketCode)
    try {
      const result = await scanTicketByCode({ ticket_code: ticketCode, scanner_wallet: user.wallet_address })
      setScanResult(result)
      setScanResultOpen(true)
    } catch (e) {
      antMessage.error('Không thể quét vé: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function downloadTicketQr() {
    if (!qrItem || !qrWrapRef.current) return
    const canvas = qrWrapRef.current.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) {
      antMessage.error('Không tìm thấy QR để tải')
      return
    }
    const link = document.createElement('a')
    link.href = canvas.toDataURL('image/png')
    link.download = `ticket-qr-${qrItem.ticket_code}.png`
    link.click()
  }

  const columns = [
    {
      title: 'Tên vé', key: 'ticket_name',
      render: (_: unknown, row: ServiceTicketPurchase) => {
        const product = getProduct(row)
        return (
          <Space direction="vertical" size={0}>
            <Button
              type="link"
              style={{ padding: 0, height: 'auto', fontWeight: 600, textAlign: 'left' }}
              onClick={event => {
                event.stopPropagation()
                setDetailItem(row)
              }}
            >
              {getTicketName(row)}
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {product?.ticket_type ?? 'Ticket'}
            </Text>
          </Space>
        )
      },
    },
    { title: 'SL', dataIndex: 'quantity', key: 'quantity', width: 48, align: 'center' as const },
    {
      title: 'Tổng tiền', dataIndex: 'total_price', key: 'total_price',
      render: (v: string) => <Text>{fmtVNDC(v)} VNDC</Text>,
    },
    {
      title: 'Trạng thái', dataIndex: 'status', key: 'status',
      render: (v: string) => (
        <Badge
          status={PURCHASE_STATUS_COLOR[v] ?? 'default'}
          text={PURCHASE_STATUS_LABEL[v] ?? v}
        />
      ),
    },
    {
      title: 'Ngày mua', dataIndex: 'created_at', key: 'created_at',
      render: (v: string) => dayjs(v).format('DD/MM/YY HH:mm'),
    },
    {
      title: '', key: 'qr', width: 60,
      render: (_: unknown, row: ServiceTicketPurchase) => (
        <Tooltip title="Xem QR">
          <Button
            size="small"
            icon={<QrcodeOutlined />}
            onClick={event => {
              event.stopPropagation()
              setQrItem(row)
            }}
            disabled={row.status !== 'COMPLETED'}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text strong>Vé của tôi ({purchases.length})</Text>
          {hasPending && (
            <Tag color="processing" icon={<ClockCircleOutlined />}>Đang đồng bộ thanh toán...</Tag>
          )}
        </Space>
        <Space>
          <Button size="small" icon={<QrcodeOutlined />} onClick={() => setScanOpen(true)}>Quét vé</Button>
          <Button size="small" icon={<ReloadOutlined />} onClick={load} loading={loading}>Làm mới</Button>
        </Space>
      </div>

      <Table
        className="ev-glass-table"
        dataSource={purchases}
        columns={columns}
        rowKey="id"
        loading={loading}
        onRow={row => ({
          onClick: () => setDetailItem(row),
          style: { cursor: 'pointer' },
        })}
        pagination={{ pageSize: 10 }}
        size="small"
        locale={{ emptyText: <Empty description="Bạn chưa mua vé nào" /> }}
        scroll={{ x: 760 }}
      />

      <Modal
        className="ev-liquid-modal"
        open={!!detailItem}
        onCancel={() => setDetailItem(null)}
        title="Chi tiết vé"
        width={560}
        footer={
          <Space>
            <Button onClick={() => setDetailItem(null)}>Đóng</Button>
            <Button
              icon={<QrcodeOutlined />}
              disabled={!detailItem || detailItem.status !== 'COMPLETED'}
              onClick={() => {
                if (!detailItem || detailItem.status !== 'COMPLETED') return
                setQrItem(detailItem)
              }}
            >
              Xem QR
            </Button>
          </Space>
        }
      >
        {detailItem && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {getProduct(detailItem)?.image_uri && (
              <div style={{ margin: '-8px -24px 8px', height: 180, overflow: 'hidden' }}>
                <img
                  src={getProduct(detailItem)!.image_uri}
                  alt={getTicketName(detailItem)}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="Tên vé" span={2}>
                <Text strong>{getTicketName(detailItem)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Loại vé">
                {getProduct(detailItem)?.ticket_type ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Danh mục">
                {CATEGORY_LABEL[getProduct(detailItem)?.category ?? ''] ?? getProduct(detailItem)?.category ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Mã vé" span={2}>
                <Text code>{detailItem.ticket_code}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái" span={2}>
                <Badge status={PURCHASE_STATUS_COLOR[detailItem.status] ?? 'default'} text={PURCHASE_STATUS_LABEL[detailItem.status] ?? detailItem.status} />
              </Descriptions.Item>
              <Descriptions.Item label="Số lượng">{detailItem.quantity}</Descriptions.Item>
              <Descriptions.Item label="Đơn giá">{fmtVNDC(detailItem.unit_price)} VNDC</Descriptions.Item>
              <Descriptions.Item label="Tổng thanh toán" span={2}>
                <Text strong>{fmtVNDC(detailItem.total_price)} VNDC</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày mua">
                {dayjs(detailItem.created_at).format('HH:mm DD/MM/YYYY')}
              </Descriptions.Item>
              <Descriptions.Item label="Hoàn tất">
                {detailItem.completed_at ? dayjs(detailItem.completed_at).format('HH:mm DD/MM/YYYY') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="Người mua" span={2}>
                <Text code>{shortWallet(detailItem.buyer_wallet)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Giao dịch on-chain" span={2}>
                <Text code>{detailItem.payment_tx_hash ?? '-'}</Text>
              </Descriptions.Item>
              {detailItem.failure_reason && (
                <Descriptions.Item label="Lý do thất bại" span={2}>
                  <Text type="danger">{detailItem.failure_reason}</Text>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Space>
        )}
      </Modal>

      <Modal
        className="ev-liquid-modal"
        open={!!qrItem}
        onCancel={() => setQrItem(null)}
        title="QR Ticket"
        footer={
          <Space>
            <Button icon={<DownloadOutlined />} onClick={downloadTicketQr}>Tải QR</Button>
            <Button onClick={() => setQrItem(null)}>Đóng</Button>
          </Space>
        }
        width={380}
        centered
      >
        {qrItem && (
          <div className="ev-qr-shell">
            <Space direction="vertical" align="center" style={{ width: '100%' }} size={12}>
              <Tag color="cyan">{getTicketName(qrItem)}</Tag>
              <div ref={qrWrapRef} style={{ background: '#fff', borderRadius: 12, padding: 12, boxShadow: '0 8px 22px rgba(15,23,42,.2)' }}>
                <QRCode value={qrItem.ticket_code} size={220} />
              </div>
              <Text code style={{ fontSize: 13, color: '#C7D2FE' }}>{qrItem.ticket_code}</Text>
              <Text style={{ fontSize: 12, color: '#94A3B8' }}>
                Owner: {shortWallet(user.wallet_address)}
              </Text>
            </Space>
          </div>
        )}
      </Modal>

      <Modal
        className="ev-liquid-modal"
        open={scanOpen}
        onCancel={() => setScanOpen(false)}
        footer={null}
        title="Quét mã vé"
        width={560}
        destroyOnClose
        centered
      >
        <TicketScanner
          onDetected={code => { void handleScanTicketCode(code) }}
          onClose={() => setScanOpen(false)}
        />
      </Modal>

      <Modal
        className="ev-liquid-modal"
        open={scanResultOpen}
        onCancel={() => setScanResultOpen(false)}
        title="Kết quả quét vé"
        footer={<Button onClick={() => setScanResultOpen(false)}>Đóng</Button>}
        centered
      >
        {scanResult && (
          <ScanResultCard result={scanResult} scannedCode={scanCode} />
        )}
      </Modal>
    </>
  )
}

function TicketScanner({ onDetected, onClose }: { onDetected: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const [error, setError] = useState('')
  const [cameraHints, setCameraHints] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [manualCode, setManualCode] = useState('')

  useEffect(() => {
    void startCamera()
    return () => stopCamera()
  }, [])

  function stopCamera() {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(track => track.stop())
  }

  async function startCamera() {
    setError('')
    setCameraHints([])
    if (!window.isSecureContext) {
      setError('Môi trường hiện tại không an toàn cho camera.')
      setCameraHints([
        'Mở ứng dụng bằng http://localhost hoặc https:// (không dùng file://).',
        'Nếu đang mở từ IP LAN, hãy bật HTTPS hoặc dùng localhost tunnel.',
      ])
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Trình duyệt không hỗ trợ MediaDevices API.')
      setCameraHints([
        'Cập nhật Chrome/Edge phiên bản mới.',
        'Nếu đang trong chế độ private bị giới hạn camera, hãy mở tab thường.',
      ])
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      })
      streamRef.current = stream
      if (!videoRef.current) return
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      loop()
    } catch (primaryErr) {
      try {
        // Fallback for desktop/laptops where 'environment' camera is unavailable.
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
        streamRef.current = fallbackStream
        if (!videoRef.current) return
        videoRef.current.srcObject = fallbackStream
        await videoRef.current.play()
        loop()
      } catch (fallbackErr) {
        const domErr = (fallbackErr ?? primaryErr) as DOMException | Error
        const errName = (domErr as DOMException)?.name || 'UnknownError'
        if (errName === 'NotAllowedError') {
          setError('Camera bị từ chối quyền truy cập.')
          setCameraHints([
            'Bấm biểu tượng camera trên thanh địa chỉ và chọn Allow.',
            'Vào Site Settings -> Camera -> Allow cho trang này, sau đó tải lại.',
          ])
          return
        }
        if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setError('Không tìm thấy thiết bị camera trên máy.')
          setCameraHints([
            'Kiểm tra webcam đã cắm/được hệ điều hành nhận diện.',
            'Đóng ứng dụng khác đang chiếm camera (Zoom, Teams, OBS).',
          ])
          return
        }
        if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setError('Camera đang bị ứng dụng khác chiếm dụng.')
          setCameraHints([
            'Đóng tất cả app đang dùng camera rồi thử lại.',
            'Nếu vẫn lỗi, thử tắt/mở lại trình duyệt.',
          ])
          return
        }
        setError('Không thể mở camera. Hãy cấp quyền camera trong trình duyệt hoặc dùng quét từ ảnh/manual bên dưới.')
        setCameraHints([
          `Chi tiết lỗi: ${errName}`,
          'Bạn vẫn có thể quét bằng upload ảnh QR hoặc nhập mã vé thủ công.',
        ])
      }
    }
  }

  function extractTicketCode(raw: string): string | null {
    const data = raw.trim()
    if (!data) return null
    if (data.startsWith('{')) {
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>
        if (typeof parsed.ticket_code === 'string' && parsed.ticket_code.trim()) return parsed.ticket_code.trim()
      } catch {
        return null
      }
    }
    return data
  }

  function loop() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || busy) return
    if (video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      rafRef.current = requestAnimationFrame(loop)
      return
    }
    const sourceW = video.videoWidth
    const sourceH = video.videoHeight
    const sourceSide = Math.min(sourceW, sourceH)
    const sourceX = Math.floor((sourceW - sourceSide) / 2)
    const sourceY = Math.floor((sourceH - sourceSide) / 2)

    const targetSide = 720
    if (canvas.width !== targetSide || canvas.height !== targetSide) {
      canvas.width = targetSide
      canvas.height = targetSide
    }

    ctx.drawImage(video, sourceX, sourceY, sourceSide, sourceSide, 0, 0, targetSide, targetSide)

    const scanRegions = [
      { x: 0, y: 0, size: targetSide },
      { x: Math.floor(targetSide * 0.16), y: Math.floor(targetSide * 0.16), size: Math.floor(targetSide * 0.68) },
    ]

    for (const region of scanRegions) {
      const img = ctx.getImageData(region.x, region.y, region.size, region.size)
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
      if (code) {
        const ticketCode = extractTicketCode(code.data)
        if (ticketCode) {
          setBusy(true)
          stopCamera()
          onDetected(ticketCode)
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(loop)
  }

  function submitManualCode() {
    const code = manualCode.trim()
    if (!code) return
    stopCamera()
    setBusy(true)
    onDetected(code)
  }

  async function scanFromImage(file: File) {
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(new Error('read-failed'))
        reader.readAsDataURL(file)
      })

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('image-invalid'))
        image.src = dataUrl
      })

      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('canvas-unavailable')
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const code = jsQR(imageData.data, imageData.width, imageData.height)
      const parsed = code ? extractTicketCode(code.data) : null
      if (!parsed) {
        antMessage.warning('Không đọc được mã QR trong ảnh đã chọn')
        return
      }
      stopCamera()
      setBusy(true)
      onDetected(parsed)
    } catch {
      antMessage.error('Không thể quét từ ảnh. Vui lòng thử lại.')
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={14}>
      {error ? (
        <Alert
          type="error"
          message={error}
          description={
            <Space direction="vertical" size={6}>
              {cameraHints.map((hint, idx) => (
                <Text key={idx} style={{ fontSize: 12 }}>{`- ${hint}`}</Text>
              ))}
              <Button size="small" onClick={() => { void startCamera() }}>Thử mở camera lại</Button>
            </Space>
          }
          showIcon
        />
      ) : (
        <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} muted playsInline style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }} />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: 280,
              height: 280,
              border: '2px solid rgba(99,102,241,.65)',
              borderRadius: 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,.42)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ position: 'absolute', left: -2, top: -2, width: 34, height: 34, borderLeft: '4px solid #818CF8', borderTop: '4px solid #818CF8', borderTopLeftRadius: 12 }} />
            <div style={{ position: 'absolute', right: -2, top: -2, width: 34, height: 34, borderRight: '4px solid #818CF8', borderTop: '4px solid #818CF8', borderTopRightRadius: 12 }} />
            <div style={{ position: 'absolute', left: -2, bottom: -2, width: 34, height: 34, borderLeft: '4px solid #818CF8', borderBottom: '4px solid #818CF8', borderBottomLeftRadius: 12 }} />
            <div style={{ position: 'absolute', right: -2, bottom: -2, width: 34, height: 34, borderRight: '4px solid #818CF8', borderBottom: '4px solid #818CF8', borderBottomRightRadius: 12 }} />
          </div>
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 12 }}>
        Hệ thống đang theo dõi liên tục. Đưa QR vào khung là sẽ tự động quét ngay.
      </Text>

      <Space.Compact style={{ width: '100%' }}>
        <Input
          value={manualCode}
          onChange={event => setManualCode(event.target.value)}
          placeholder="Nhập mã vé nếu không mở được camera"
        />
        <Button onClick={submitManualCode} type="primary" disabled={!manualCode.trim()}>Quét mã</Button>
      </Space.Compact>

      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Input
          type="file"
          accept="image/*"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void scanFromImage(file)
            event.target.value = ''
          }}
          style={{ maxWidth: 220 }}
        />
        <Button onClick={onClose}>Đóng</Button>
      </Space>
    </Space>
  )
}

function ScanResultCard({ result, scannedCode }: { result: ScanTicketResult; scannedCode: string }) {
  const visual = {
    SUCCESS: { color: '#059669', label: 'Check-in thành công', type: 'success' as const },
    ALREADY_USED: { color: '#D97706', label: 'Vé đã được sử dụng', type: 'warning' as const },
    EXPIRED: { color: '#DC2626', label: 'Vé đã hết hạn', type: 'error' as const },
    INVALID_CODE: { color: '#DC2626', label: 'Mã vé không hợp lệ', type: 'error' as const },
    UNAUTHORIZED_SCANNER: { color: '#7C3AED', label: 'Ví quét không được cấp quyền', type: 'warning' as const },
    NOT_FOUND: { color: '#334155', label: 'Không tìm thấy vé', type: 'warning' as const },
    PRODUCT_INACTIVE: { color: '#B45309', label: 'Sự kiện tạm ngưng', type: 'warning' as const },
  }[result.result]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      <Alert type={visual.type} showIcon message={visual.label} />
      <div className="ev-scan-result" style={{ background: `${visual.color}10` }}>
        <Descriptions size="small" column={1}>
          <Descriptions.Item label="Mã quét">
            <Text code>{scannedCode}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Tên vé">
            <Text strong>{result.product?.title ?? 'Không xác định'}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Loại vé">
            {result.product?.ticket_type ?? '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Trạng thái hiện tại">
            <Tag color={visual.type === 'success' ? 'green' : visual.type === 'error' ? 'red' : 'orange'}>
              {result.purchase?.status ?? '-'}
            </Tag>
          </Descriptions.Item>
          {result.used_at && (
            <Descriptions.Item label="Đã dùng lúc">
              {dayjs(result.used_at).format('HH:mm DD/MM/YYYY')}
            </Descriptions.Item>
          )}
          {result.used_by_wallet && (
            <Descriptions.Item label="Ví quét trước đó">
              <Text code>{shortWallet(result.used_by_wallet)}</Text>
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    </Space>
  )
}

// â”€â”€â”€ CreateProductModal (Admin only, multi-variant) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TicketVariant {
  ticket_type: string
  description: string
  unit_price: number
  total_stock: number
  is_limited: boolean
}

const DEFAULT_VARIANT: TicketVariant = {
  ticket_type: 'STANDARD',
  description: '',
  unit_price: 0,
  total_stock: 100,
  is_limited: true,
}

function CreateProductModal({
  user,
  open,
  onClose,
  onSuccess,
}: {
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [imageUri, setImageUri] = useState('')
  const [saleStart, setSaleStart] = useState<ReturnType<typeof dayjs> | null>(null)
  const [saleEnd, setSaleEnd] = useState<ReturnType<typeof dayjs> | null>(null)
  const [variants, setVariants] = useState<TicketVariant[]>([{ ...DEFAULT_VARIANT }])

  function resetForm() {
    setTitle(''); setCategory(''); setImageUri(''); setSaleStart(null); setSaleEnd(null)
    setVariants([{ ...DEFAULT_VARIANT }])
  }

  function updateVariant(idx: number, field: keyof TicketVariant, value: unknown) {
    setVariants(vs => vs.map((v, i) => i === idx ? { ...v, [field]: value } : v))
  }

  function addVariant() {
    setVariants(vs => [...vs, { ...DEFAULT_VARIANT, ticket_type: '' }])
  }

  function removeVariant(idx: number) {
    if (variants.length <= 1) return
    setVariants(vs => vs.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    if (!title.trim()) { antMessage.warning('Vui lòng nhập tiêu đề'); return }
    if (!category) { antMessage.warning('Vui lòng chọn danh mục'); return }
    const invalid = variants.find(v => !v.ticket_type.trim() || v.unit_price <= 0)
    if (invalid) { antMessage.warning('Mỗi loại vé cần có tên loại và đơn giá > 0'); return }

    const hasDates = !!saleStart && !!saleEnd
    if (hasDates && saleEnd!.isBefore(saleStart!)) {
      antMessage.warning('Ngày kết thúc phải sau ngày bắt đầu'); return
    }

    setLoading(true)
    try {
      await Promise.all(
        variants.map(v => createTicketProduct({
          title: title.trim(),
          category,
          image_uri: imageUri.trim() || undefined,
          ticket_type: v.ticket_type.trim().toUpperCase(),
          description: v.description.trim() || undefined,
          unit_price: toWei(String(v.unit_price)),
          stock_mode: v.is_limited ? 'LIMITED' : 'UNLIMITED',
          total_stock: v.is_limited ? v.total_stock : undefined,
          seller_wallet: user.wallet_address,
          sale_mode: hasDates ? 'WINDOWED' : 'ALWAYS_ON',
          sale_starts_at: hasDates ? saleStart!.unix() : undefined,
          sale_ends_at: hasDates ? saleEnd!.unix() : undefined,
        }))
      )
      antMessage.success(`Tạo thành công ${variants.length} loại vé!`)
      resetForm()
      onSuccess()
      onClose()
    } catch (e) {
      antMessage.error('Lỗi: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  function handleClose() {
    if (!loading) { resetForm(); onClose() }
  }

  return (
    <Modal
      className="ev-liquid-modal"
      open={open}
      onCancel={handleClose}
      title="Tạo vé mới"
      footer={null}
      width={680}
      destroyOnClose
    >
      <Space direction="vertical" style={{ width: '100%' }} size={0}>
        <Divider style={{ marginTop: 8, marginBottom: 14 }}>Thông tin sự kiện / dịch vụ</Divider>

        <Row gutter={12}>
          <Col span={16}>
            <Form.Item label="Tiêu đề" required style={{ marginBottom: 12 }}>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="VD: Lễ hội Âm nhạc 2025"
                maxLength={200}
              />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item label="Danh mục" required style={{ marginBottom: 12 }}>
              <Select
                value={category || undefined}
                onChange={setCategory}
                style={{ width: '100%' }}
                placeholder="Chọn danh mục"
                options={Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label }))}
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="URL ảnh bìa (tùy chọn)" style={{ marginBottom: 12 }}>
          <Input
            value={imageUri}
            onChange={e => setImageUri(e.target.value)}
            placeholder="https://example.com/banner.jpg"
          />
        </Form.Item>

        <Row gutter={12} style={{ marginBottom: 14 }}>
          <Col span={12}>
            <Form.Item label="Bắt đầu bán (tùy chọn)" style={{ marginBottom: 0 }}>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                value={saleStart}
                onChange={val => setSaleStart(val)}
                style={{ width: '100%' }}
                placeholder="Chọn ngày bắt đầu"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Kết thúc bán (tùy chọn)" style={{ marginBottom: 0 }}>
              <DatePicker
                showTime
                format="DD/MM/YYYY HH:mm"
                value={saleEnd}
                onChange={val => setSaleEnd(val)}
                style={{ width: '100%' }}
                placeholder="Chọn ngày kết thúc"
                disabledDate={curr => !!saleStart && curr.isBefore(saleStart, 'day')}
              />
            </Form.Item>
          </Col>
        </Row>

        <Divider style={{ marginBottom: 14 }}>Các loại vé</Divider>

        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          {variants.map((v, idx) => (
            <div
              key={idx}
              className="ev-variant-card"
              style={{ padding: '14px 16px 10px', position: 'relative' }}
            >
              {variants.length > 1 && (
                <Button
                  size="small"
                  danger
                  type="text"
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => removeVariant(idx)}
                />
              )}

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="Loại vé" required style={{ marginBottom: 10 }}>
                    <Input
                      value={v.ticket_type}
                      onChange={e => updateVariant(idx, 'ticket_type', e.target.value)}
                      placeholder="VD: VIP, STANDARD"
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Đơn giá (VNDC)" required style={{ marginBottom: 10 }}>
                    <InputNumber
                      min={0}
                      style={{ width: '100%' }}
                      value={v.unit_price}
                      onChange={val => updateVariant(idx, 'unit_price', val ?? 0)}
                      formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                      parser={value => Number(value?.replace(/,/g, '') ?? 0)}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Giới hạn SL" style={{ marginBottom: 10 }}>
                    <Switch
                      checked={v.is_limited}
                      onChange={val => updateVariant(idx, 'is_limited', val)}
                      checkedChildren="Có"
                      unCheckedChildren="Không"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={v.is_limited ? 16 : 24}>
                  <Form.Item label="Mô tả loại vé" style={{ marginBottom: 8 }}>
                    <Input.TextArea
                      rows={2}
                      value={v.description}
                      onChange={e => updateVariant(idx, 'description', e.target.value)}
                      placeholder="Mô tả chi tiết cho loại vé này..."
                    />
                  </Form.Item>
                </Col>
                {v.is_limited && (
                  <Col span={8}>
                    <Form.Item label="Số lượng vé" required style={{ marginBottom: 8 }}>
                      <InputNumber
                        min={1}
                        style={{ width: '100%' }}
                        value={v.total_stock}
                        onChange={val => updateVariant(idx, 'total_stock', val ?? 1)}
                      />
                    </Form.Item>
                  </Col>
                )}
              </Row>
            </div>
          ))}

          <Button icon={<PlusOutlined />} onClick={addVariant} type="dashed" block>
            Thêm loại vé
          </Button>
        </Space>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
          <Button onClick={handleClose}>Hủy</Button>
          <Button type="primary" loading={loading} onClick={handleSubmit}>
            {`Tạo ${variants.length > 1 ? `${variants.length} loại vé` : 'vé'}`}
          </Button>
        </div>
      </Space>
    </Modal>
  )
}

// â”€â”€â”€ BrowseProducts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BrowseProducts({
  user,
  isAdmin,
}: {
  user?: AuthUser
  isAdmin: boolean
}) {
  const [products, setProducts] = useState<ServiceTicketProduct[]>([])
  const [loading, setLoading] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSearch, setFilterSearch] = useState('')
  const [selected, setSelected] = useState<ServiceTicketProduct | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await getTicketProducts({
        category: filterCategory || undefined,
        status: 'ACTIVE',
        search: filterSearch || undefined,
        page: 1,
        page_size: 100,
      })
      setProducts(items)
    } finally {
      setLoading(false)
    }
  }, [filterCategory, filterSearch])

  useEffect(() => { void load() }, [load])

  function openDetail(p: ServiceTicketProduct) {
    setSelected(p)
    setShowDetail(true)
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="ev-toolbar">
        <Input.Search
          placeholder="Tìm kiếm vé..."
          allowClear
          onSearch={v => setFilterSearch(v)}
          onChange={e => { if (!e.target.value) setFilterSearch('') }}
          style={{ width: 260, flex: '1 1 260px' }}
        />
        <Select
          allowClear
          placeholder="Danh mục"
          value={filterCategory || undefined}
          onChange={v => setFilterCategory(v ?? '')}
          style={{ width: 190 }}
          options={[
            { value: '', label: 'Tất cả danh mục' },
            ...Object.entries(CATEGORY_LABEL).map(([value, label]) => ({ value, label })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
        {isAdmin && user && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowCreate(true)}
            style={{ marginLeft: 'auto' }}
          >
            Tạo vé mới
          </Button>
        )}
      </div>

      {/* Product list */}
      <Spin spinning={loading}>
        {products.length === 0 && !loading ? (
          <Empty description="Không có sản phẩm nào" style={{ margin: '48px 0' }} />
        ) : (
          <Row gutter={[16, 16]} className="ev-ticket-grid">
            {products.map(p => (
              <Col key={p.id} xs={24} lg={12}>
                <TicketCard product={p} onClick={() => openDetail(p)} />
              </Col>
            ))}
          </Row>
        )}
      </Spin>

      <TicketDetailModal
        product={selected}
        user={user}
        open={showDetail}
        onClose={() => setShowDetail(false)}
        onBuySuccess={load}
      />

      {isAdmin && user && (
        <CreateProductModal
          user={user}
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}

function EventAdminTab({ user }: { user: AuthUser }) {
  const [scanOpen, setScanOpen] = useState(false)
  const [scanResultOpen, setScanResultOpen] = useState(false)
  const [scanResult, setScanResult] = useState<ScanTicketResult | null>(null)
  const [scanCode, setScanCode] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [scanLogs, setScanLogs] = useState<ServiceTicketScanLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsResult, setLogsResult] = useState('')

  const loadLogs = useCallback(async () => {
    setLogsLoading(true)
    try {
      const { items } = await getTicketScanLogs({ page: 1, page_size: 50, result: logsResult || undefined })
      setScanLogs(items)
    } finally {
      setLogsLoading(false)
    }
  }, [logsResult])

  useEffect(() => { void loadLogs() }, [loadLogs])

  async function handleScan(ticketCode: string) {
    setScanOpen(false)
    setScanCode(ticketCode)
    try {
      const result = await scanTicketByCode({ ticket_code: ticketCode, scanner_wallet: user.wallet_address })
      setScanResult(result)
      setScanResultOpen(true)
      void loadLogs()
    } catch (e) {
      antMessage.error('Không thể quét vé: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const resultOptions = [
    { value: 'SUCCESS', label: 'Thành công', color: '#10B981' },
    { value: 'ALREADY_USED', label: 'Đã dùng', color: '#D97706' },
    { value: 'EXPIRED', label: 'Hết hạn', color: '#DC2626' },
    { value: 'INVALID_CODE', label: 'Sai mã', color: '#EF4444' },
    { value: 'UNAUTHORIZED_SCANNER', label: 'Sai quyền', color: '#7C3AED' },
    { value: 'NOT_FOUND', label: 'Không thấy', color: '#64748B' },
    { value: 'PRODUCT_INACTIVE', label: 'Tạm ngưng', color: '#B45309' },
  ]

  const scanDashboard = useMemo(() => {
    const counts = new Map<string, number>()
    for (const log of scanLogs) counts.set(log.result, (counts.get(log.result) || 0) + 1)
    const buckets = resultOptions.map(opt => ({ ...opt, count: counts.get(opt.value) || 0 }))
    const total = scanLogs.length
    const success = counts.get('SUCCESS') || 0
    const denied = total - success
    const today = scanLogs.filter(log => dayjs(log.created_at).isSame(dayjs(), 'day')).length
    const uniqueScanners = new Set(scanLogs.map(log => log.scanner_wallet).filter(Boolean)).size
    const successRate = total ? Math.round((success / total) * 100) : 0
    const maxBucket = Math.max(1, ...buckets.map(b => b.count))
    const daily = Array.from({ length: 7 }, (_, idx) => {
      const day = dayjs().subtract(6 - idx, 'day')
      const count = scanLogs.filter(log => dayjs(log.created_at).isSame(day, 'day')).length
      return { label: day.format('DD/MM'), count }
    })
    const maxDaily = Math.max(1, ...daily.map(d => d.count))
    return { total, success, denied, today, uniqueScanners, successRate, buckets, maxBucket, daily, maxDaily }
  }, [scanLogs])

  const columns = [
    {
      title: 'Thời gian', dataIndex: 'created_at', key: 'created_at', width: 140,
      render: (v: string) => dayjs(v).format('DD/MM HH:mm:ss'),
    },
    {
      title: 'Tên vé', key: 'product_title',
      render: (_: unknown, row: ServiceTicketScanLog) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.product_title || '(Không xác định)'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{row.ticket_type || '-'}</Text>
        </Space>
      ),
    },
    {
      title: 'Kết quả', dataIndex: 'result', key: 'result', width: 180,
      render: (v: ServiceTicketScanLog['result']) => {
        const colorMap: Record<ServiceTicketScanLog['result'], string> = {
          SUCCESS: 'success',
          ALREADY_USED: 'warning',
          EXPIRED: 'error',
          INVALID_CODE: 'error',
          UNAUTHORIZED_SCANNER: 'processing',
          NOT_FOUND: 'default',
          PRODUCT_INACTIVE: 'orange',
        }
        return <Tag color={colorMap[v]}>{v}</Tag>
      },
    },
    {
      title: 'Mã vé', dataIndex: 'ticket_code', key: 'ticket_code',
      render: (v: string) => <Text code style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: 'Người quét', dataIndex: 'scanner_wallet', key: 'scanner_wallet', width: 120,
      render: (v: string) => <Text type="secondary">{shortWallet(v)}</Text>,
    },
  ]

  return (
    <Space direction="vertical" style={{ width: '100%' }} size={16}>
      <div className="ev-glass ev-admin-hero">
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 14 }}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 17 }}>Dashboard quản trị sự kiện</Text>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Theo dõi check-in, tỷ lệ vé hợp lệ và lịch sử quét theo thời gian thực.
            </Text>
          </Space>
          <Space wrap>
            <Button icon={<QrcodeOutlined />} type="primary" onClick={() => setScanOpen(true)}>Quét vé</Button>
            <Button icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>Tạo vé mới</Button>
            <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={logsLoading}>Làm mới</Button>
          </Space>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        {[
          { label: 'Tổng lượt quét', value: scanDashboard.total, hint: '50 log gần nhất', color: '#2563EB' },
          { label: 'Check-in hợp lệ', value: scanDashboard.success, hint: `${scanDashboard.successRate}% thành công`, color: '#10B981' },
          { label: 'Cần xử lý', value: scanDashboard.denied, hint: 'Đã dùng / sai mã / hết hạn', color: '#D97706' },
          { label: 'Hôm nay', value: scanDashboard.today, hint: `${scanDashboard.uniqueScanners} ví scanner`, color: '#0EA5E9' },
        ].map(item => (
          <Col xs={12} lg={6} key={item.label}>
            <div className="ev-admin-kpi">
              <Text className="label">{item.label}</Text>
              <Text className="value" style={{ color: item.color }}>{item.value}</Text>
              <Text className="hint">{item.hint}</Text>
            </div>
          </Col>
        ))}
      </Row>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={14}>
          <div className="ev-chart-card">
            <div className="ev-chart-title">Phân bổ kết quả quét</div>
            {scanDashboard.buckets.map(bucket => (
              <div className="ev-bar-row" key={bucket.value}>
                <div className="ev-bar-label ev-line-clamp-1">{bucket.label}</div>
                <div className="ev-bar-track">
                  <div
                    className="ev-bar-fill"
                    style={{ width: `${Math.max(4, Math.round((bucket.count / scanDashboard.maxBucket) * 100))}%`, '--bar-color': bucket.color } as React.CSSProperties}
                  />
                </div>
                <div className="ev-bar-count">{bucket.count}</div>
              </div>
            ))}
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <div className="ev-chart-card">
            <div className="ev-chart-title">Tỷ lệ vận hành</div>
            <div className="ev-admin-donut-grid">
              {[
                { label: 'Thành công', pct: scanDashboard.successRate, color: '#10B981' },
                { label: 'Cần kiểm tra', pct: scanDashboard.total ? Math.round((scanDashboard.denied / scanDashboard.total) * 100) : 0, color: '#D97706' },
                { label: 'Hôm nay', pct: scanDashboard.total ? Math.round((scanDashboard.today / scanDashboard.total) * 100) : 0, color: '#0EA5E9' },
                { label: 'Scanner', pct: Math.min(100, scanDashboard.uniqueScanners * 20), color: '#7C3AED' },
              ].map(item => (
                <div className="ev-donut-card" key={item.label}>
                  <div className="ev-donut" style={{ '--pct': item.pct, '--donut-color': item.color } as React.CSSProperties}>
                    <strong>{item.pct}%</strong>
                  </div>
                  <Text className="ev-chart-label">{item.label}</Text>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col xs={24}>
          <div className="ev-chart-card">
            <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 4 }}>
              <div className="ev-chart-title" style={{ marginBottom: 0 }}>Lượt quét 7 ngày gần đây</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Dựa trên log hiện đang tải</Text>
            </Space>
            <div className="ev-daily-chart">
              {scanDashboard.daily.map(day => (
                <div className="ev-daily-item" key={day.label}>
                  <Text strong style={{ fontSize: 12 }}>{day.count}</Text>
                  <div className="ev-daily-bar" style={{ height: `${Math.max(6, Math.round((day.count / scanDashboard.maxDaily) * 120))}px` }} />
                  <span className="ev-daily-label">{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      <div className="ev-glass ev-table-card">
        <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 12, flexWrap: 'wrap' }}>
          <Space direction="vertical" size={0}>
            <Text strong>Lịch sử quét</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Lọc nhanh các trạng thái lỗi để xử lý tại cổng.</Text>
          </Space>
          <Space wrap>
            <Select
              allowClear
              style={{ width: 190 }}
              placeholder="Lọc kết quả"
              value={logsResult || undefined}
              onChange={value => setLogsResult(value ?? '')}
              options={resultOptions.map(({ value, label }) => ({ value, label: `${label} (${value})` }))}
            />
            <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={logsLoading}>Làm mới</Button>
          </Space>
        </Space>
        <Table
          className="ev-glass-table"
          rowKey="id"
          dataSource={scanLogs}
          columns={columns}
          loading={logsLoading}
          size="small"
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: <Empty description="Chưa có log quét nào" /> }}
          scroll={{ x: 900 }}
        />
      </div>

      <Modal
        className="ev-liquid-modal"
        open={scanOpen}
        onCancel={() => setScanOpen(false)}
        footer={null}
        title="Quét mã vé"
        width={560}
        destroyOnClose
        centered
      >
        <TicketScanner onDetected={code => { void handleScan(code) }} onClose={() => setScanOpen(false)} />
      </Modal>

      <Modal
        className="ev-liquid-modal"
        open={scanResultOpen}
        onCancel={() => setScanResultOpen(false)}
        title="Kết quả quét"
        footer={<Button onClick={() => setScanResultOpen(false)}>Đóng</Button>}
        centered
      >
        {scanResult && <ScanResultCard result={scanResult} scannedCode={scanCode} />}
      </Modal>

      <CreateProductModal
        user={user}
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => {
          antMessage.success('Đã tạo vé thành công')
          void loadLogs()
        }}
      />
    </Space>
  )
}

// â”€â”€â”€ EventsPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface EventsPageProps {
  user?: AuthUser
}

export default function EventsPage({ user }: EventsPageProps) {
  const admin = checkIsAdmin(user)

  const tabItems = [
    {
      key: 'browse',
          label: <Space><UnorderedListOutlined />Mua vé</Space>,
      children: <BrowseProducts user={user} isAdmin={admin} />,
    },
    ...(user
      ? [{
          key: 'my',
          label: <Space><ShoppingOutlined />Vé của tôi</Space>,
          children: <MyTickets user={user} />,
        }]
      : []),
    ...(admin && user
      ? [{
          key: 'admin',
          label: <Space><SafetyCertificateOutlined />Quản trị</Space>,
          children: <EventAdminTab user={user} />,
        }]
      : []),
  ]

  return (
    <div className="event-page" style={{ maxWidth: 1280, margin: '0 auto' }}>
      <style>{EVENTS_STYLES}</style>

      <div className="ev-hero">
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 18, position: 'relative', zIndex: 1 }}>
          <Space direction="vertical" size={8} style={{ flex: '1 1 360px', minWidth: 240 }}>
            <div className="vndc-hero-kicker">Dịch vụ campus</div>
            <Title level={2} className="vndc-hero-title">
              Sự kiện & Ticketing
            </Title>
            <Text className="vndc-hero-desc" style={{ fontSize: 13 }}>
              Mua vé, quản lý QR ticket và check-in tại cổng với luồng đồng bộ on-chain / off-chain / DB.
            </Text>
            <Space wrap>
              <Tag color="blue">On-chain transfer</Tag>
              <Tag color="cyan">Off-chain order</Tag>
              <Tag color="green">DB finalize</Tag>
            </Space>
          </Space>

          <Space wrap style={{ justifyContent: 'flex-end' }}>
            <div className="ev-hero-metric">
              <span className="value">EIP-712</span>
              <span className="label">Ký giao dịch</span>
            </div>
            <div className="ev-hero-metric">
              <span className="value">QR</span>
              <span className="label">Check-in nhanh</span>
            </div>
            <div className="ev-hero-metric">
              <span className="value">Live</span>
              <span className="label">Theo dõi pending</span>
            </div>
          </Space>
        </Space>
      </div>

      <div className="ev-tabs-shell">
        <Tabs className="ev-tabs" items={tabItems} defaultActiveKey="browse" />
      </div>
    </div>
  )
}

