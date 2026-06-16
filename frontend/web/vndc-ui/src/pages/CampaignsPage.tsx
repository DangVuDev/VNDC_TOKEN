import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Card, Typography, Space, Button, Tag, Progress, Modal, Form, Input,
  InputNumber, Spin, Empty, message as antMessage, Divider, Row, Col,
  Tabs, Select, Drawer, Table, Steps, Tooltip, DatePicker,
  Popconfirm, Badge,
} from 'antd'
import {
  FundOutlined, PlusOutlined, HeartOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ClockCircleOutlined, UserOutlined, TrophyOutlined,
  MoneyCollectOutlined, DeleteOutlined, TeamOutlined, BookOutlined,
  SearchOutlined, ReloadOutlined, EditOutlined, ArrowRightOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  getFunds, getMyFunds, getFund, getFundSummary, getFundLedger,
  createFund, closeFund, reopenFund,
  addFundDeputy, removeFundDeputy,
  recordContribution, recordExpense,
  createFundPotOnChain, setFundContractStatus,
  recordFundContractContribution, spendFundContract,
  toWei, getNonce,
  type FundActivity, type FundLedgerEntry, type FundSummary,
} from '../lib/services'
import { signTypedData, buildTransferTypedData, switchChain } from '../lib/wallet'
import { getActiveChainConfig, getRequiredContractAddress } from '../lib/chainConfig'
import type { AuthUser } from '../hooks/useAuth'

const { Title, Text, Paragraph } = Typography

function fromWei(wei: string): number {
  if (!wei || wei === '0') return 0
  try {
    const n = BigInt(wei)
    const divisor = BigInt('1000000000000000000')
    const whole = n / divisor
    const remainder = n % divisor
    return Number(whole) + Number(remainder) / 1e18
  } catch { return 0 }
}

function fmtVNDC(wei: string): string {
  const n = fromWei(wei)
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function addWei(base: string, delta: string): string {
  try {
    const b = BigInt(base || '0')
    const d = BigInt(delta || '0')
    return (b + d).toString()
  } catch {
    return base || '0'
  }
}

function resolveFundImage(activity: FundActivity): string {
  const legacy = (activity as FundActivity & { image_url?: string }).image_url
  return (activity.image_uri || legacy || '').trim()
}

function shortWallet(w: string) {
  if (!w) return ''
  return `${w.slice(0, 6)}...${w.slice(-4)}`
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  DRAFT:     { color: 'default', label: 'Sắp mở',        icon: <ClockCircleOutlined /> },
  ACTIVE:    { color: 'blue',    label: 'Đang gây quỹ',  icon: <FundOutlined /> },
  CLOSED:    { color: 'green',   label: 'Đã đóng',       icon: <CheckCircleOutlined /> },
  CANCELLED: { color: 'red',     label: 'Đã hủy',        icon: <CloseCircleOutlined /> },
}

const CATEGORY_OPTIONS = [
  { value: 'EDUCATION',   label: 'Giáo dục' },
  { value: 'HEALTH',      label: 'Sức khỏe' },
  { value: 'ENVIRONMENT', label: 'Môi trường' },
  { value: 'COMMUNITY',   label: 'Cộng đồng' },
  { value: 'CHARITY',     label: 'Từ thiện' },
  { value: 'DISASTER',    label: 'Thiên tai' },
  { value: 'BUSINESS',    label: 'Kinh doanh' },
  { value: 'OTHER',       label: 'Khác' },
]

const CAMPAIGN_STYLES = `
.fund-page {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 28px;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.30), rgba(239, 246, 255, 0.12) 42%, rgba(236, 253, 245, 0.10)),
    var(--visual-campaigns-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, rgba(219, 234, 254, 0.72), rgba(236, 253, 245, 0.54));
  box-shadow: 0 34px 90px rgba(37, 99, 235, 0.16);
  padding: 18px 18px 40px;
}
.fund-page::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -2;
  background:
    radial-gradient(760px 320px at 8% -4%, rgba(37, 99, 235, 0.18), transparent 68%),
    radial-gradient(720px 340px at 94% 2%, rgba(14, 165, 233, 0.18), transparent 66%),
    radial-gradient(640px 360px at 52% 108%, rgba(16, 185, 129, 0.14), transparent 64%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(246, 248, 251, 0.80));
  pointer-events: none;
}
.fund-page::after {
  content: "";
  position: absolute;
  inset: 1px;
  z-index: -1;
  border-radius: 27px;
  background: linear-gradient(125deg, rgba(255, 255, 255, 0.34), transparent 34%, rgba(255, 255, 255, 0.16) 62%, transparent 82%);
  opacity: 0.64;
  pointer-events: none;
}
.fund-page .liquid-glass,
.fund-page .glass,
.fund-page .hero,
.fund-page .fund-card,
.fund-page .fund-toolbar,
.fund-page .admin-shell,
.fund-page .admin-kpi-card,
.fund-page .contract-grid-card,
.fund-page .admin-tab-panel,
.fund-page .fund-chart-card,
.fund-page .fund-dashboard-card,
.fund-page .fund-management-card,
.fund-page .fund-detail-panel {
  position: relative;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.62) !important;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0.12)) !important;
  box-shadow: 0 22px 54px rgba(37, 99, 235, 0.13), 0 8px 18px rgba(15, 23, 42, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.88), inset 0 -1px 0 rgba(37, 99, 235, 0.08) !important;
  backdrop-filter: blur(20px) saturate(1.9) contrast(1.04);
  -webkit-backdrop-filter: blur(20px) saturate(1.9) contrast(1.04);
  color: var(--ink);
  transform-style: preserve-3d;
}
.fund-page .liquid-glass::before,
.fund-page .glass::before,
.fund-page .hero::before,
.fund-page .fund-card::before,
.fund-page .fund-toolbar::before,
.fund-page .admin-shell::before,
.fund-page .admin-kpi-card::before,
.fund-page .contract-grid-card::before,
.fund-page .admin-tab-panel::before,
.fund-page .fund-chart-card::before,
.fund-page .fund-dashboard-card::before,
.fund-page .fund-management-card::before,
.fund-page .fund-detail-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  background: linear-gradient(115deg, rgba(255, 255, 255, 0.48), transparent 28%, rgba(255, 255, 255, 0.12) 56%, transparent 78%), radial-gradient(460px 120px at 12% 0%, rgba(255, 255, 255, 0.60), transparent 72%);
  opacity: 0.66;
  pointer-events: none;
}
.fund-page .liquid-glass::after,
.fund-page .glass::after,
.fund-page .hero::after,
.fund-page .fund-card::after,
.fund-page .fund-toolbar::after,
.fund-page .admin-shell::after,
.fund-page .admin-kpi-card::after,
.fund-page .contract-grid-card::after,
.fund-page .admin-tab-panel::after,
.fund-page .fund-chart-card::after,
.fund-page .fund-dashboard-card::after,
.fund-page .fund-management-card::after,
.fund-page .fund-detail-panel::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 0;
  border-radius: inherit;
  padding: 1px;
  background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.08) 38%, rgba(14,165,233,0.18) 68%, rgba(255,255,255,0.42));
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  pointer-events: none;
}
.fund-page .liquid-glass > *, .fund-page .glass > *, .fund-page .hero > *, .fund-page .fund-card > *, .fund-page .fund-toolbar > *, .fund-page .admin-shell > *, .fund-page .admin-kpi-card > *, .fund-page .contract-grid-card > *, .fund-page .admin-tab-panel > *, .fund-page .fund-chart-card > *, .fund-page .fund-dashboard-card > *, .fund-page .fund-management-card > *, .fund-page .fund-detail-panel > * { position: relative; z-index: 1; }
.fund-page .hero { border-radius: 24px; box-shadow: 0 24px 70px rgba(37, 99, 235, 0.14) !important; animation: heroIn .45s ease both; }
.fund-page .vndc-hero-icon { display: inline-flex; width: 58px; height: 58px; flex: 0 0 auto; align-items: center; justify-content: center; border: 1px solid rgba(191, 219, 254, 0.95); border-radius: 18px; background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 52%, #10b981 100%); box-shadow: 0 16px 34px rgba(37, 99, 235, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.42); color: #fff; font-size: 26px; }
.fund-page .vndc-hero-kicker { margin-bottom: 4px; color: var(--accent); font-size: 12px; font-weight: 740; letter-spacing: 0.08em; text-transform: uppercase; }
.fund-page .vndc-hero-title { color: var(--ink) !important; font-family: var(--font-sans) !important; font-weight: 820 !important; letter-spacing: -0.02em; }
.fund-page .vndc-hero-desc, .fund-page .section-desc { color: var(--ink-muted) !important; }
.fund-page .fund-card-grid { align-items: stretch; }
.fund-page .fund-card-grid > .ant-col { display: flex; }
.fund-page .fund-card-grid .ant-card { width: 100%; }
.fund-page .fund-card { height: 430px; min-height: 430px; border-radius: 22px; transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease, filter 220ms ease; animation: cardIn .35s ease both; }
.fund-page .fund-card:hover, .fund-page .fund-management-card:hover, .fund-page .contract-grid-card:hover { border-color: rgba(255, 255, 255, 0.84) !important; box-shadow: 0 30px 70px rgba(37, 99, 235, 0.18), 0 12px 26px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.95) !important; transform: translateY(-3px); }
.fund-page .fund-card:hover { filter: saturate(1.04); }
.fund-page .fund-card .ant-card-body { height: 100%; display: flex; flex-direction: column; }
.fund-page .fund-cover { position: relative; width: 100%; height: 150px; flex: 0 0 150px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.62); border-radius: 18px; background: radial-gradient(320px 160px at 18% 0%, rgba(255, 255, 255, 0.76), transparent 68%), linear-gradient(135deg, #dbeafe 0%, #e0f2fe 48%, #dcfce7 100%); background-size: cover; background-position: center; box-shadow: 0 16px 34px rgba(37, 99, 235, 0.13), inset 0 1px 0 rgba(255,255,255,.72); }
.fund-page .fund-cover::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(15,23,42,0.02), rgba(15,23,42,0.22)); pointer-events: none; }
.fund-page .fund-card-content { display: flex; flex: 1; min-height: 0; flex-direction: column; }
.fund-page .fund-card-title { min-height: 42px; color: var(--ink) !important; font-size: 16px; font-weight: 780 !important; line-height: 1.28; }
.fund-page .fund-card-desc { min-height: 40px; color: var(--ink-muted) !important; font-size: 12.5px; line-height: 1.45; }
.fund-page .line-clamp-1, .fund-page .line-clamp-2, .fund-page .line-clamp-3 { display: -webkit-box !important; overflow: hidden; -webkit-box-orient: vertical; white-space: normal !important; }
.fund-page .line-clamp-1 { -webkit-line-clamp: 1; }
.fund-page .line-clamp-2 { -webkit-line-clamp: 2; }
.fund-page .line-clamp-3 { -webkit-line-clamp: 3; }
.fund-page .fund-card-actions { margin-top: auto; padding-top: 10px; }
.fund-page .fund-toolbar { border-radius: 18px; padding: 12px; }
.fund-page .fund-toolbar .ant-input, .fund-page .fund-toolbar .ant-input-affix-wrapper, .fund-page .fund-toolbar .ant-select-selector, .fund-page .fund-toolbar .ant-input-number, .fund-page .fund-tabs-shell .ant-input, .fund-page .fund-tabs-shell .ant-input-affix-wrapper, .fund-page .fund-tabs-shell .ant-select-selector, .fund-page .fund-tabs-shell .ant-input-number { border-radius: 12px !important; border-color: rgba(191, 219, 254, 0.88) !important; background: rgba(255, 255, 255, 0.76) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.68); }
.fund-page .fund-tabs .ant-tabs-nav { margin-bottom: 18px; }
.fund-page .fund-tabs .ant-tabs-nav::before { border-bottom-color: rgba(191, 219, 254, 0.68); }
.fund-page .fund-tabs .ant-tabs-tab, .fund-page .admin-tabs .ant-tabs-tab { border-radius: 999px; color: var(--ink-muted); font-size: 13px; font-weight: 730; padding: 10px 16px; transition: background 180ms ease, transform 180ms ease, color 180ms ease; }
.fund-page .fund-tabs .ant-tabs-tab:hover, .fund-page .admin-tabs .ant-tabs-tab:hover { color: var(--accent-strong); transform: translateY(-1px); }
.fund-page .fund-tabs .ant-tabs-tab.ant-tabs-tab-active, .fund-page .admin-tabs .ant-tabs-tab.ant-tabs-tab-active { background: linear-gradient(135deg, rgba(37, 99, 235, 0.13), rgba(14, 165, 233, 0.10) 58%, rgba(16, 185, 129, 0.10)); box-shadow: inset 0 0 0 1px rgba(191, 219, 254, 0.66); }
.fund-page .fund-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn, .fund-page .admin-tabs .ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn { color: var(--accent-strong) !important; }
.fund-page .fund-tabs .ant-tabs-ink-bar, .fund-page .admin-tabs .ant-tabs-ink-bar { display: none; }
.fund-page .admin-shell, .fund-page .admin-tab-panel, .fund-page .fund-chart-card, .fund-page .fund-dashboard-card { border-radius: 20px; padding: 16px; }
.fund-page .admin-kpi-card { min-height: 112px; border-radius: 18px; }
.fund-page .admin-kpi-card .kpi-label, .fund-page .fund-dashboard-label { color: var(--ink-subtle) !important; font-size: 12px; font-weight: 660; }
.fund-page .admin-kpi-card .kpi-value, .fund-page .fund-dashboard-value { color: var(--ink); font-size: 25px; font-weight: 830; line-height: 1.1; letter-spacing: -0.02em; }
.fund-page .fund-dashboard-grid { display: grid; grid-template-columns: 1.45fr 0.9fr; gap: 14px; }
.fund-page .fund-dashboard-card-title { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.fund-page .fund-dashboard-title { color: var(--ink); font-size: 16px; font-weight: 800; }
.fund-page .dashboard-bar { display: grid; grid-template-columns: 130px minmax(0, 1fr) 48px; align-items: center; gap: 10px; margin: 10px 0; }
.fund-page .dashboard-bar-label { color: var(--ink-muted); font-size: 12px; font-weight: 700; }
.fund-page .dashboard-bar-track { height: 12px; overflow: hidden; border-radius: 999px; background: rgba(226, 232, 240, 0.72); box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.08); }
.fund-page .dashboard-bar-fill { height: 100%; min-width: 5px; border-radius: inherit; background: linear-gradient(90deg, #2563eb 0%, #0ea5e9 52%, #10b981 100%); box-shadow: 0 8px 18px rgba(37, 99, 235, 0.18); }
.fund-page .dashboard-bar-value { color: var(--ink); font-size: 12px; font-weight: 800; text-align: right; }
.fund-page .fund-donut-list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.fund-page .fund-donut-card { display: grid; place-items: center; gap: 8px; min-height: 168px; border-radius: 18px; border: 1px solid rgba(255,255,255,.56); background: linear-gradient(135deg, rgba(255,255,255,.28), rgba(255,255,255,.10)); box-shadow: inset 0 1px 0 rgba(255,255,255,.74); }
.fund-page .fund-donut { width: 86px; height: 86px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(#2563eb 0 var(--fund-donut-value), rgba(226, 232, 240, 0.78) var(--fund-donut-value) 100%); box-shadow: 0 14px 30px rgba(37, 99, 235, 0.14), inset 0 1px 0 rgba(255,255,255,.82); }
.fund-page .fund-donut::after { content: attr(data-value); width: 62px; height: 62px; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,.86); color: var(--ink); font-size: 18px; font-weight: 850; box-shadow: inset 0 1px 0 rgba(255,255,255,.86); }
.fund-page .fund-donut-label { color: var(--ink); font-size: 13px; font-weight: 780; text-align: center; }
.fund-page .fund-donut-caption { color: var(--ink-subtle); font-size: 11px; text-align: center; }
.fund-page .fund-management-card { border-radius: 20px; min-height: 184px; transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease; }
.fund-page .fund-management-title { min-height: 40px; color: var(--ink) !important; font-size: 15px; font-weight: 780 !important; line-height: 1.3; }
.fund-page .fund-mini-progress { height: 8px; overflow: hidden; border-radius: 999px; background: rgba(226, 232, 240, 0.8); }
.fund-page .fund-mini-progress > span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #2563eb, #0ea5e9, #10b981); }
.fund-liquid-drawer .ant-drawer-content, .fund-liquid-modal .ant-modal-content { overflow: hidden; background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.92) 58%, rgba(236, 253, 245, 0.86)) !important; border: 1px solid rgba(255, 255, 255, 0.72); box-shadow: 0 30px 80px rgba(37, 99, 235, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.90); backdrop-filter: blur(22px) saturate(1.65); -webkit-backdrop-filter: blur(22px) saturate(1.65); }
.fund-liquid-drawer .ant-drawer-body, .fund-liquid-modal .ant-modal-body { background: linear-gradient(145deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.08)), var(--visual-campaigns-bg, none) center top / cover no-repeat; background-blend-mode: screen, normal; }
.fund-liquid-drawer .ant-drawer-header, .fund-liquid-modal .ant-modal-header { background: transparent !important; border-bottom-color: rgba(191, 219, 254, 0.72) !important; }
.fund-liquid-drawer .ant-drawer-title, .fund-liquid-modal .ant-modal-title { color: var(--ink); font-weight: 780; }
.fund-liquid-drawer .ant-input, .fund-liquid-drawer .ant-input-affix-wrapper, .fund-liquid-drawer .ant-input-number, .fund-liquid-drawer .ant-select-selector, .fund-liquid-modal .ant-input, .fund-liquid-modal .ant-input-affix-wrapper, .fund-liquid-modal .ant-input-number, .fund-liquid-modal .ant-select-selector { border-radius: 12px !important; border-color: rgba(191, 219, 254, 0.88) !important; background: rgba(255, 255, 255, 0.78) !important; box-shadow: inset 0 1px 0 rgba(255,255,255,.68); }
.fund-page .ant-btn, .fund-liquid-drawer .ant-btn, .fund-liquid-modal .ant-btn { border-radius: 12px; font-weight: 650; }
.fund-page .ant-btn:active, .fund-liquid-drawer .ant-btn:active, .fund-liquid-modal .ant-btn:active { transform: translateY(1px); }
.fund-page .ant-btn-primary, .fund-liquid-drawer .ant-btn-primary, .fund-liquid-modal .ant-btn-primary { border-color: #2563eb !important; background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%) !important; box-shadow: 0 12px 24px rgba(37, 99, 235, 0.20); }
.fund-page .ant-card-head { border-bottom-color: rgba(191, 219, 254, 0.66) !important; background: transparent !important; }
.fund-page .ant-card-head-title { color: var(--ink); font-weight: 780; }
.fund-page .ant-divider { border-color: rgba(191, 219, 254, 0.62); }
.fund-page .ant-empty-description, .fund-page .ant-typography-secondary, .fund-page .ant-descriptions-item-label { color: var(--ink-subtle) !important; }
.fund-page .status-pill { border-radius: 999px; font-size: 11px; font-weight: 760; line-height: 1.35; padding: 3px 10px; }
.fund-page .ant-progress-bg { box-shadow: 0 8px 18px rgba(37, 99, 235, 0.16); }
.fund-page .ant-table { background: rgba(255, 255, 255, 0.34) !important; border-radius: 16px; overflow: hidden; }
.fund-page .ant-table-thead > tr > th { background: rgba(239, 246, 255, 0.72) !important; color: var(--ink) !important; border-bottom-color: rgba(191, 219, 254, 0.58) !important; }
.fund-page .ant-table-tbody > tr > td { background: rgba(255, 255, 255, 0.34); border-bottom-color: rgba(191, 219, 254, 0.38) !important; }
@keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes heroIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 992px) { .fund-page .fund-dashboard-grid { grid-template-columns: 1fr; } .fund-page .fund-donut-list { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 768px) { .fund-page { padding: 12px; border-radius: 20px; } .fund-page .hero { border-radius: 18px; padding: 18px !important; } .fund-page .fund-card { height: auto; min-height: 0; } .fund-page .fund-cover { height: 190px; flex-basis: 190px; } .fund-page .fund-donut-list { grid-template-columns: 1fr; } .fund-page .dashboard-bar { grid-template-columns: 92px minmax(0, 1fr) 42px; } }

/* Campaign visual refresh: one atmospheric page surface, fewer nested card shells. */
.fund-page.campaign-liquid-page {
  border-color: rgba(255, 255, 255, 0.78) !important;
  background:
    linear-gradient(115deg, rgba(255, 255, 255, 0.42), rgba(239, 246, 255, 0.16) 42%, rgba(236, 253, 245, 0.14)),
    radial-gradient(880px 420px at 7% -4%, rgba(37, 99, 235, 0.23), transparent 68%),
    radial-gradient(760px 380px at 95% 2%, rgba(14, 165, 233, 0.2), transparent 66%),
    radial-gradient(680px 420px at 52% 110%, rgba(16, 185, 129, 0.17), transparent 66%),
    var(--visual-campaigns-bg, none) center top / cover no-repeat,
    linear-gradient(135deg, #dbeafe, #ecfeff 54%, #dcfce7) !important;
  background-blend-mode: screen, normal, normal, normal, normal, normal;
}
.fund-page.campaign-liquid-page::before {
  background:
    linear-gradient(180deg, rgba(255,255,255,0.22), rgba(246,248,251,0.42) 58%, rgba(255,255,255,0.68)),
    radial-gradient(900px 360px at 50% -10%, rgba(255,255,255,0.36), transparent 72%);
}
.fund-page.campaign-liquid-page::after {
  opacity: 0.32;
}
.fund-page .hero {
  min-height: 218px;
  border-color: rgba(255,255,255,0.76) !important;
  background:
    linear-gradient(104deg, rgba(255,255,255,0.82) 0%, rgba(239,246,255,0.6) 46%, rgba(255,255,255,0.2) 100%),
    var(--visual-campaigns, none) center right / cover no-repeat !important;
  backdrop-filter: blur(14px) saturate(1.28);
  -webkit-backdrop-filter: blur(14px) saturate(1.28);
}
.fund-page .hero::before {
  background:
    linear-gradient(90deg, rgba(255,255,255,0.2), transparent 58%),
    radial-gradient(420px 170px at 84% 12%, rgba(14,165,233,0.2), transparent 70%),
    radial-gradient(320px 180px at 96% 94%, rgba(16,185,129,0.18), transparent 72%);
  opacity: 1;
}
.fund-page .vndc-hero-title {
  font-size: clamp(25px, 3vw, 40px) !important;
  font-weight: 880 !important;
  letter-spacing: -0.045em !important;
}
.fund-page .vndc-hero-desc {
  color: #334155 !important;
  line-height: 1.65;
}
.fund-page .fund-tabs-shell {
  overflow: visible;
  border: 0 !important;
  border-radius: 0;
  background: transparent !important;
  box-shadow: none !important;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  padding: 0;
}
.fund-page .fund-tabs-shell::before,
.fund-page .fund-tabs-shell::after {
  display: none !important;
}
.fund-page .fund-tabs > .ant-tabs-nav {
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
.fund-page .fund-toolbar {
  border-color: rgba(255,255,255,0.72) !important;
  background: linear-gradient(135deg, rgba(255,255,255,0.62), rgba(255,255,255,0.28)) !important;
  box-shadow: 0 20px 52px rgba(37,99,235,0.11), inset 0 1px 0 rgba(255,255,255,0.9) !important;
  backdrop-filter: blur(18px) saturate(1.48);
  -webkit-backdrop-filter: blur(18px) saturate(1.48);
}
.fund-page .fund-card,
.fund-page .admin-kpi-card,
.fund-page .contract-grid-card,
.fund-page .fund-chart-card,
.fund-page .fund-management-card {
  border-color: rgba(255,255,255,0.74) !important;
  background: linear-gradient(135deg, rgba(255,255,255,0.44), rgba(255,255,255,0.18) 52%, rgba(219,234,254,0.18)) !important;
  backdrop-filter: blur(22px) saturate(1.72) contrast(1.04);
  -webkit-backdrop-filter: blur(22px) saturate(1.72) contrast(1.04);
}
@media (max-width: 768px) {
  .fund-page .fund-tabs > .ant-tabs-nav {
    position: relative;
    top: auto;
    overflow-x: auto;
  }
}
`


function categoryLabel(cat: string) {
  return CATEGORY_OPTIONS.find(c => c.value === cat)?.label ?? cat
}

function getProgress(a: FundActivity): number {
  const raised = fromWei(a.total_raised)
  const target = fromWei(a.target_amount)
  if (target <= 0) return 0
  return Math.min(Math.round((raised / target) * 100), 100)
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

function MiniDonut({ value, label, caption }: { value: number; label: string; caption: string }) {
  const safe = clampPercent(value)
  return (
    <div className="fund-donut-card">
      <div className="fund-donut" data-value={`${safe}%`} style={{ '--fund-donut-value': `${safe}%` } as React.CSSProperties} />
      <div>
        <div className="fund-donut-label">{label}</div>
        <div className="fund-donut-caption">{caption}</div>
      </div>
    </div>
  )
}

function DashboardBar({ label, value, max, suffix = '' }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max <= 0 ? 0 : clampPercent((value / max) * 100)
  return (
    <div className="dashboard-bar">
      <div className="dashboard-bar-label">{label}</div>
      <div className="dashboard-bar-track">
        <div className="dashboard-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="dashboard-bar-value">{value}{suffix}</div>
    </div>
  )
}


// ─── FundCard ──────────────────────────────────────────────────────

function FundCard({ activity, onContribute, onDetail, isOwner }: {
  activity: FundActivity
  onContribute: () => void
  onDetail: () => void
  isOwner: boolean
}) {
  const imageUrl = resolveFundImage(activity)
  const st = STATUS_CONFIG[activity.status] ?? STATUS_CONFIG.ACTIVE
  const pct = getProgress(activity)
  const hasStarted = !activity.starts_at || !dayjs(activity.starts_at).isAfter(dayjs())
  const hasEnded = !!activity.ends_at && dayjs(activity.ends_at).isBefore(dayjs())
  const canContribute = (activity.status === 'ACTIVE' || activity.status === 'DRAFT') && hasStarted && !hasEnded
  const syncReady = !!activity.onchain_pot_id && !!activity.contract_address

  return (
    <Card className="fund-card liquid-glass" bodyStyle={{ padding: 14, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="fund-cover" style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}>
        <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}>
          <Tag color={st.color} icon={st.icon} className="status-pill">{st.label}</Tag>
        </div>
        <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>
          <Tag color={syncReady ? 'cyan' : 'orange'} className="status-pill">{syncReady ? 'On-chain' : 'Pending'}</Tag>
        </div>
      </div>

      <div className="fund-card-content" style={{ marginTop: 12 }}>
        <Space direction="vertical" size={10} style={{ width: '100%', height: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%', gap: 8 }}>
            <Tag color="blue" className="status-pill">{categoryLabel(activity.category)}</Tag>
            {isOwner && <Tag color="purple" className="status-pill">Của bạn</Tag>}
          </Space>

          <div>
            <Text strong className="fund-card-title line-clamp-2">{activity.title}</Text>
            <Text className="line-clamp-1" style={{ display: 'block', fontSize: 11, color: 'var(--ink-subtle)' }}>
              <UserOutlined /> {shortWallet(activity.owner_wallet)}
            </Text>
          </div>

          <Paragraph className="fund-card-desc line-clamp-2" style={{ margin: 0 }}>
            {activity.description || 'Không có mô tả'}
          </Paragraph>

          <div>
            <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
              <Text style={{ fontSize: 11, color: 'var(--ink-subtle)' }}>
                {fmtVNDC(activity.total_raised)} / {fmtVNDC(activity.target_amount)} VNDC
              </Text>
              <Text strong style={{ color: pct >= 100 ? '#10B981' : '#2563EB', fontSize: 13 }}>{pct}%</Text>
            </Space>
            <Progress percent={pct} showInfo={false} strokeWidth={7}
              strokeColor={pct >= 100 ? '#10B981' : '#2563EB'} trailColor="rgba(226,232,240,.78)" />
          </div>

          <Space className="fund-card-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button size="small" icon={<BookOutlined />} onClick={onDetail}>Chi tiết</Button>
            {canContribute && (
              <Button size="small" type="primary" icon={<HeartOutlined />} onClick={onContribute}>Đóng góp</Button>
            )}
          </Space>
        </Space>
      </div>
    </Card>
  )
}

// ─── ContributeModal (EIP-712) ─────────────────────────────────────

function ContributeModal({ activity, user, open, onClose, onSuccess }: {
  activity: FundActivity | null
  user: AuthUser
  open: boolean
  onClose: () => void
  onSuccess: (payload: { activityId: string; amountWei: string }) => void
}) {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => { if (!open) { setStep(0); form.resetFields() } }, [open, form])

  if (!activity) return null

  async function handleSubmit(values: { amount: number; note?: string }) {
    if (!user?.wallet_address || !activity) return
    setLoading(true)
    try {
      const activeChain = getActiveChainConfig()
      const chainId = activeChain.chainId
      const tokenContract = getRequiredContractAddress('VNDCToken', 'VNDC Token', activeChain)
      await switchChain(chainId)
      setStep(1)

      const { nonce: nonceNum } = await getNonce(user.wallet_address)
      const nonceStr = nonceNum.toString()
      const deadline = Math.floor(Date.now() / 1000) + 3600
      setStep(2)

      const amountWei = toWei(values.amount.toString())
      const toAddress = activity.contract_address
      if (!toAddress) {
        throw new Error('Quỹ chưa sẵn sàng on-chain, chưa thể đóng góp')
      }

      const typedData = buildTransferTypedData({
        chainId,
        verifyingContract: tokenContract,
        from: user.wallet_address,
        to: toAddress,
        amount: amountWei,
        nonce: nonceStr,
        deadline,
      })
      const signature = await signTypedData(undefined, user.wallet_address, typedData as Record<string, unknown>)
      setStep(3)

      await recordContribution(activity.id, {
        amount: amountWei,
        from_wallet: user.wallet_address,
        nonce: nonceStr,
        deadline,
        signature: signature ?? '',
        note: values.note,
      })
      setStep(4)
      antMessage.success(`Đóng góp ${values.amount} VNDC thành công!`)
      onSuccess({ activityId: activity.id, amountWei })
      onClose()
    } catch (err: unknown) {
      antMessage.error('Lỗi: ' + (err instanceof Error ? err.message : String(err)))
      setStep(0)
    } finally {
      setLoading(false)
    }
  }

  const pct = getProgress(activity)

  return (
    <Modal
      className="fund-liquid-modal"
      title={<Space><HeartOutlined style={{ color: '#10B981' }} />Đóng góp vào quỹ</Space>}
      open={open} onCancel={onClose} footer={null} width={480}
    >
      <Divider />
      <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 14 }}>{activity.title}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {fmtVNDC(activity.total_raised)} / {fmtVNDC(activity.target_amount)} VNDC ({pct}%)
        </Text>
        <Progress percent={pct} showInfo={false} strokeColor="#10B981" strokeWidth={4} />
        <Text style={{ fontSize: 11, color: '#9CA3AF' }}>
          Tiền sẽ chuyển đến: {shortWallet(activity.contract_address || activity.owner_wallet)}
        </Text>
      </Space>

      <Steps size="small" current={step} style={{ marginBottom: 20 }} items={[
        { title: 'Kết nối' },
        { title: 'Nonce' },
        { title: 'Ký EIP-712' },
        { title: 'Xác nhận' },
      ]} />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Số tiền đóng góp (VNDC)" name="amount"
          rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập số tiền tối thiểu 0.01 VNDC' }]}
        >
          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonAfter="VNDC"
            placeholder="Nhập số tiền..." />
        </Form.Item>
        <Form.Item label="Ghi chú (tuỳ chọn)" name="note">
          <Input placeholder="Ví dụ: Ủng hộ chương trình học bổng..." maxLength={200} />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={loading} icon={<ArrowRightOutlined />}
            style={{ background: '#10B981', borderColor: '#10B981' }}>
            Ký &amp; Đóng góp
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── RecordExpenseModal ────────────────────────────────────────────

function RecordExpenseModal({ activity, open, onClose, onSuccess }: {
  activity: FundActivity
  open: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  useEffect(() => { if (!open) form.resetFields() }, [open, form])

  async function handleSubmit(values: { amount: number; note: string; beneficiary_wallet: string; reference?: string }) {
    setLoading(true)
    try {
      await recordExpense(activity.id, {
        amount: toWei(values.amount.toString()),
        note: values.note,
        beneficiary_wallet: values.beneficiary_wallet,
        reference: values.reference,
      })
      antMessage.success('Ghi chi tiêu thành công!')
      onSuccess(); onClose()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Ghi chi tiêu thất bại')
    } finally { setLoading(false) }
  }

  return (
    <Modal className="fund-liquid-modal" title={<Space><MoneyCollectOutlined style={{ color: '#EF4444' }} />Ghi chi tiêu từ quỹ</Space>}
      open={open} onCancel={onClose} footer={null} width={460}>
      <Divider />
      <Space direction="vertical" size={4} style={{ width: '100%', marginBottom: 16 }}>
        <Text strong>{activity.title}</Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Số dư khả dụng: <Text strong style={{ color: '#10B981' }}>{fmtVNDC(activity.available_balance)} VNDC</Text>
        </Text>
      </Space>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Số tiền (VNDC)" name="amount"
          rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập số tiền' }]}>
          <InputNumber min={0.01} precision={2} style={{ width: '100%' }} addonAfter="VNDC" />
        </Form.Item>
        <Form.Item label="Ví nhận tiền" name="beneficiary_wallet"
          rules={[{ required: true, message: 'Nhập địa chỉ ví người nhận' }]}>
          <Input placeholder="0x..." maxLength={42} />
        </Form.Item>
        <Form.Item label="Nội dung chi" name="note"
          rules={[{ required: true, message: 'Nhập nội dung' }]}>
          <Input.TextArea rows={2} placeholder="Mô tả mục đích chi tiêu..." maxLength={500} />
        </Form.Item>
        <Form.Item label="Mã tham chiếu (tuỳ chọn)" name="reference">
          <Input placeholder="VD: HD-2026-001" maxLength={100} />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" danger htmlType="submit" loading={loading} icon={<MoneyCollectOutlined />}>
            Xác nhận chi
          </Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── CreateFundModal ───────────────────────────────────────────────

function CreateFundModal({ open, onClose, onSuccess }: {
  open: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [deputies, setDeputies] = useState<string[]>([])
  const [deputyInput, setDeputyInput] = useState('')
  const [form] = Form.useForm()

  useEffect(() => { if (!open) { form.resetFields(); setDeputies([]); setDeputyInput('') } }, [open, form])

  function addDeputy() {
    const w = deputyInput.trim()
    if (!w || deputies.includes(w)) return
    setDeputies(prev => [...prev, w])
    setDeputyInput('')
  }

  async function handleSubmit(values: {
    title: string; description?: string; category: string
    image_uri?: string
    target_amount: number; starts_at?: dayjs.Dayjs; ends_at?: dayjs.Dayjs
  }) {
    setLoading(true)
    try {
      await createFund({
        title: values.title,
        description: values.description,
        image_uri: values.image_uri?.trim() || undefined,
        image_url: values.image_uri?.trim() || undefined,
        category: values.category,
        target_amount: toWei(values.target_amount.toString()),
        currency: 'VNDC',
        deputy_wallets: deputies,
        starts_at: values.starts_at?.toISOString(),
        ends_at: values.ends_at?.toISOString(),
      })
      antMessage.success('Tạo quỹ gây quỹ thành công!')
      onSuccess(); onClose()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Tạo quỹ thất bại')
    } finally { setLoading(false) }
  }

  return (
    <Modal className="fund-liquid-modal" title={<Space><PlusOutlined style={{ color: '#10B981' }} />Tạo quỹ gây quỹ mới</Space>}
      open={open} onCancel={onClose} footer={null} width={580}>
      <Divider />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item label="Tên quỹ" name="title"
          rules={[{ required: true, min: 5, max: 200, message: 'Tên quỹ từ 5-200 ký tự' }]}>
          <Input placeholder="Ví dụ: Quỹ học bổng cho sinh viên khó khăn" maxLength={200} showCount />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Danh mục" name="category" rules={[{ required: true, message: 'Chọn danh mục' }]}>
              <Select placeholder="Chọn danh mục" options={CATEGORY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Mục tiêu (VNDC)" name="target_amount"
              rules={[{ required: true, type: 'number', min: 1, message: 'Nhập mục tiêu ≥ 1 VNDC' }]}>
              <InputNumber min={1} precision={2} style={{ width: '100%' }} addonAfter="VNDC" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label="Mô tả" name="description">
          <Input.TextArea rows={3} placeholder="Mô tả mục tiêu và kế hoạch sử dụng quỹ..." maxLength={1000} showCount />
        </Form.Item>
        <Form.Item
          label="URL ảnh quỹ (tuỳ chọn)"
          name="image_uri"
          rules={[{ type: 'url', message: 'URL ảnh không hợp lệ' }]}
        >
          <Input placeholder="https://example.com/fund-cover.jpg" maxLength={500} />
        </Form.Item>
        <Row gutter={12}>
          <Col span={12}>
            <Form.Item label="Bắt đầu (tuỳ chọn)" name="starts_at">
              <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" placeholder="Ngay lập tức" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Kết thúc (tuỳ chọn)" name="ends_at">
              <DatePicker style={{ width: '100%' }} showTime format="DD/MM/YYYY HH:mm" placeholder="Không giới hạn" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item label={<Space><TeamOutlined />Đại diện phụ (tuỳ chọn)</Space>}>
          <Space.Compact style={{ width: '100%' }}>
            <Input value={deputyInput} onChange={e => setDeputyInput(e.target.value)}
              placeholder="Địa chỉ ví đại diện (0x...)" maxLength={42}
              onPressEnter={e => { e.preventDefault(); addDeputy() }} />
            <Button onClick={addDeputy} icon={<PlusOutlined />}>Thêm</Button>
          </Space.Compact>
          <div style={{ marginTop: 8 }}>
            {deputies.map(w => (
              <Tag key={w} closable onClose={() => setDeputies(prev => prev.filter(d => d !== w))}
                style={{ marginBottom: 4 }}>{shortWallet(w)}</Tag>
            ))}
          </div>
        </Form.Item>
        <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
          <Button onClick={onClose} disabled={loading}>Hủy</Button>
          <Button type="primary" htmlType="submit" loading={loading}
            style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ</Button>
        </Space>
      </Form>
    </Modal>
  )
}

// ─── FundDetailDrawer ──────────────────────────────────────────────

function FundDetailDrawer({ activityId, user, open, onClose, onReload, initialTab = 'summary' }: {
  activityId: string | null; user?: AuthUser
  open: boolean; onClose: () => void; onReload: () => void
  initialTab?: string
}) {
  const [activity, setActivity] = useState<FundActivity | null>(null)
  const [summary, setSummary] = useState<FundSummary | null>(null)
  const [ledger, setLedger] = useState<FundLedgerEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('summary')
  const [expenseOpen, setExpenseOpen] = useState(false)
  const [contributeOpen, setContributeOpen] = useState(false)
  const [deputyInput, setDeputyInput] = useState('')
  const [deputyLoading, setDeputyLoading] = useState(false)
  const [contractLoading, setContractLoading] = useState(false)
  const [contractStatus, setContractStatus] = useState<'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'>('ACTIVE')
  const [manualContribForm] = Form.useForm()
  const [manualSpendForm] = Form.useForm()

  const load = useCallback(async () => {
    if (!activityId) return
    setLoading(true)
    try {
      const [act, sum, led] = await Promise.all([
        getFund(activityId),
        getFundSummary(activityId),
        getFundLedger(activityId, 1, 50),
      ])
      setActivity(act); setSummary(sum); setLedger(led.items)
    } catch { antMessage.error('Không tải được chi tiết quỹ') }
    finally { setLoading(false) }
  }, [activityId])

  useEffect(() => {
    if (open && activityId) { setActiveTab(initialTab); void load() }
  }, [open, activityId, load, initialTab])

  const isOwner = !!(activity && user?.wallet_address &&
    activity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase())
  const isDeputy = !!(activity && user?.wallet_address &&
    activity.deputy_wallets.some(d => d.toLowerCase() === user.wallet_address!.toLowerCase()))
  const canManage = isOwner || isDeputy

  async function handleClose() {
    if (!activity) return
    try { await closeFund(activity.id); antMessage.success('Đã đóng quỹ'); void load(); onReload() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleReopen() {
    if (!activity) return
    try { await reopenFund(activity.id); antMessage.success('Đã mở lại quỹ'); void load(); onReload() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleAddDeputy() {
    if (!activity || !deputyInput.trim()) return
    setDeputyLoading(true)
    try { await addFundDeputy(activity.id, deputyInput.trim()); antMessage.success('Đã thêm đại diện'); setDeputyInput(''); void load() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
    finally { setDeputyLoading(false) }
  }

  async function handleRemoveDeputy(wallet: string) {
    if (!activity) return
    try { await removeFundDeputy(activity.id, wallet); antMessage.success('Đã xóa đại diện'); void load() }
    catch (err: unknown) { antMessage.error(err instanceof Error ? err.message : 'Thất bại') }
  }

  async function handleCreatePotOnChain() {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await createFundPotOnChain(activity.id)
      antMessage.success(`Đã tạo pot on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Tạo pot on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleSetContractStatus() {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await setFundContractStatus(activity.id, contractStatus)
      antMessage.success(`Đã cập nhật trạng thái on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Cập nhật trạng thái thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleManualContractContribution(values: { contributor_wallet: string; amount: number; transfer_tx_hash: string; note?: string }) {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await recordFundContractContribution(activity.id, {
        contributor_wallet: values.contributor_wallet,
        amount: toWei(values.amount.toString()),
        transfer_tx_hash: values.transfer_tx_hash,
        note: values.note,
      })
      antMessage.success(`Đã ghi đóng góp on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      manualContribForm.resetFields()
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Ghi đóng góp on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  async function handleManualContractSpend(values: { beneficiary_wallet: string; amount: number; note: string; reference?: string }) {
    if (!activity) return
    setContractLoading(true)
    try {
      const resp = await spendFundContract(activity.id, {
        beneficiary_wallet: values.beneficiary_wallet,
        amount: toWei(values.amount.toString()),
        note: values.note,
        reference: values.reference,
      })
      antMessage.success(`Đã chi on-chain: ${resp.tx_hash.slice(0, 12)}...`)
      manualSpendForm.resetFields()
      void load(); onReload()
    } catch (err: unknown) {
      antMessage.error(err instanceof Error ? err.message : 'Chi on-chain thất bại')
    } finally {
      setContractLoading(false)
    }
  }

  const st = activity ? (STATUS_CONFIG[activity.status] ?? STATUS_CONFIG.ACTIVE) : null

  const ledgerColumns = [
    { title: 'Loại', dataIndex: 'entry_type', width: 100,
      render: (t: string) => <Tag color={t === 'CONTRIBUTION' ? 'blue' : t === 'EXPENSE' ? 'red' : 'default'}>
        {t === 'CONTRIBUTION' ? 'Đóng góp' : t === 'EXPENSE' ? 'Chi tiêu' : 'Điều chỉnh'}
      </Tag> },
    { title: 'Số tiền', dataIndex: 'amount', width: 130,
      render: (a: string, r: FundLedgerEntry) =>
        <Text strong style={{ color: r.entry_type === 'CONTRIBUTION' ? '#10B981' : '#EF4444' }}>
          {r.entry_type === 'CONTRIBUTION' ? '+' : '-'}{fmtVNDC(a)} VNDC
        </Text> },
    { title: 'Tác nhân', dataIndex: 'actor_wallet',
      render: (w: string) => <Text code style={{ fontSize: 11 }}>{shortWallet(w)}</Text> },
    { title: 'Ghi chú', dataIndex: 'note',
      render: (n: string) => <Text style={{ fontSize: 12 }}>{n || '—'}</Text> },
    { title: 'Thời gian', dataIndex: 'created_at', width: 120,
      render: (d: string) => <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{dayjs(d).format('DD/MM HH:mm')}</Text> },
  ]

  return (
    <>
      <Drawer
        className="fund-liquid-drawer"
        title={activity ? (
          <Space direction="vertical" size={2}>
            <Space>
              {st && <Tag color={st.color} icon={st.icon}>{st.label}</Tag>}
              <Text strong style={{ fontSize: 15 }}>{activity.title}</Text>
            </Space>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Dashboard quản trị quỹ: tổng quan, vận hành và thao tác hợp đồng on-chain.
            </Text>
          </Space>
        ) : 'Chi tiết quỹ'}
        open={open} onClose={onClose} width={680}
        extra={activity && user && (
          <Space>
            {canManage && (
              <Button size="small" danger icon={<MoneyCollectOutlined />} onClick={() => setExpenseOpen(true)}>
                Ghi chi tiêu
              </Button>
            )}
            {(activity.status === 'ACTIVE' || activity.status === 'DRAFT') && (
              <Button size="small" type="primary" icon={<HeartOutlined />} onClick={() => setContributeOpen(true)}
                style={{ background: '#10B981', borderColor: '#10B981' }}>
                Đóng góp
              </Button>
            )}
          </Space>
        )}
      >
        <Spin spinning={loading}>
          {activity && summary && (
            <Tabs className="admin-tabs" activeKey={activeTab} onChange={setActiveTab} items={[
              {
                key: 'summary',
                label: <Space><TrophyOutlined />Tổng quan</Space>,
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <div className="admin-shell">
                      <Row gutter={[10, 10]}>
                        {[
                          { label: 'Mục tiêu', value: fmtVNDC(summary.target_amount), color: '#374151' },
                          { label: 'Đã gây quỹ', value: fmtVNDC(summary.total_raised), color: '#10B981' },
                          { label: 'Đã chi', value: fmtVNDC(summary.total_spent), color: '#EF4444' },
                          { label: 'Số dư', value: fmtVNDC(summary.available_balance), color: '#3B82F6' },
                        ].map(s => (
                          <Col xs={12} sm={6} key={s.label}>
                            <Card className="admin-kpi-card liquid-glass" bodyStyle={{ padding: '10px 12px', textAlign: 'center' }}>
                              <Text className="kpi-label">{s.label}</Text>
                              <Text className="kpi-value" style={{ color: s.color }}>{s.value}</Text>
                              <Text style={{ fontSize: 10, color: '#9CA3AF' }}> {summary.currency}</Text>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </div>

                    <div className="admin-shell">
                      <Space style={{ justifyContent: 'space-between', width: '100%', marginBottom: 6 }}>
                        <Text strong>{getProgress(activity)}% đạt mục tiêu</Text>
                        <Space>
                          <Badge count={summary.contribution_count} showZero color="#3B82F6" />
                          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>đóng góp</Text>
                          <Badge count={summary.expense_count} showZero color="#EF4444" />
                          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>chi tiêu</Text>
                        </Space>
                      </Space>
                      <Progress percent={getProgress(activity)} strokeColor="#10B981" trailColor="#E5E7EB" strokeWidth={10} />
                    </div>

                    <Card className="contract-grid-card liquid-glass" bodyStyle={{ padding: 16 }}>
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        <Space><Text type="secondary">Danh mục:</Text><Text>{categoryLabel(activity.category)}</Text></Space>
                        <Space><Text type="secondary">Chủ quỹ:</Text><Text code>{shortWallet(activity.owner_wallet)}</Text></Space>
                        {activity.contract_address && (
                          <Space><Text type="secondary">Contract:</Text><Text code style={{ fontSize: 11 }}>{shortWallet(activity.contract_address)}</Text></Space>
                        )}
                        {activity.starts_at && (
                          <Space><Text type="secondary">Bắt đầu:</Text><Text>{dayjs(activity.starts_at).format('DD/MM/YYYY HH:mm')}</Text></Space>
                        )}
                        {activity.ends_at && (
                          <Space><Text type="secondary">Kết thúc:</Text><Text>{dayjs(activity.ends_at).format('DD/MM/YYYY HH:mm')}</Text></Space>
                        )}
                        {activity.description && (
                          <div>
                            <Text type="secondary">Mô tả:</Text>
                            <Paragraph style={{ margin: '4px 0 0', fontSize: 13 }}>{activity.description}</Paragraph>
                          </div>
                        )}
                      </Space>
                    </Card>
                    {isOwner && (
                      <Space>
                        {activity.status === 'ACTIVE' && (
                          <Popconfirm title="Đóng quỹ?" onConfirm={() => void handleClose()} okText="Đóng" cancelText="Hủy">
                            <Button danger icon={<CloseCircleOutlined />}>Đóng quỹ</Button>
                          </Popconfirm>
                        )}
                        {activity.status === 'CLOSED' && (
                          <Popconfirm title="Mở lại quỹ?" onConfirm={() => void handleReopen()} okText="Mở lại" cancelText="Hủy">
                            <Button icon={<CheckCircleOutlined />}>Mở lại quỹ</Button>
                          </Popconfirm>
                        )}
                      </Space>
                    )}
                  </Space>
                ),
              },
              {
                key: 'ledger',
                label: <Space><BookOutlined />Sổ quỹ ({ledger.length})</Space>,
                children: (
                  <Table dataSource={ledger} columns={ledgerColumns} rowKey="id"
                    size="small" pagination={false} scroll={{ x: 500 }}
                    locale={{ emptyText: <Empty description="Chưa có giao dịch" /> }} />
                ),
              },
              {
                key: 'deputies',
                label: <Space><TeamOutlined />Đại diện ({activity.deputy_wallets.length})</Space>,
                children: (
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    {activity.deputy_wallets.length === 0
                      ? <Empty description="Chưa có đại diện phụ" />
                      : activity.deputy_wallets.map(w => (
                        <Card key={w} bodyStyle={{ padding: '10px 16px' }}>
                          <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                            <Space><UserOutlined /><Text code>{w}</Text></Space>
                            {isOwner && (
                              <Popconfirm title="Xóa đại diện này?" onConfirm={() => void handleRemoveDeputy(w)}
                                okText="Xóa" cancelText="Hủy">
                                <Button danger size="small" icon={<DeleteOutlined />}>Xóa</Button>
                              </Popconfirm>
                            )}
                          </Space>
                        </Card>
                      ))
                    }
                    {isOwner && (
                      <div>
                        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                          Thêm đại diện mới:
                        </Text>
                        <Space.Compact style={{ width: '100%' }}>
                          <Input value={deputyInput} onChange={e => setDeputyInput(e.target.value)}
                            placeholder="Địa chỉ ví (0x...)" maxLength={42}
                            onPressEnter={e => { e.preventDefault(); void handleAddDeputy() }} />
                          <Button type="primary" loading={deputyLoading} onClick={() => void handleAddDeputy()}>Thêm</Button>
                        </Space.Compact>
                      </div>
                    )}
                  </Space>
                ),
              },
              ...(canManage ? [{
                key: 'contract',
                label: <Space><FundOutlined />Hợp đồng</Space>,
                children: (
                  <Space direction="vertical" size={14} style={{ width: '100%' }}>
                    <Card className="contract-grid-card liquid-glass" bodyStyle={{ padding: 14 }}>
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Text strong>Quản trị pot on-chain</Text>
                        <Space wrap>
                          <Tag color={activity.onchain_pot_id ? 'cyan' : 'orange'}>
                            PotID: {activity.onchain_pot_id ? shortWallet(activity.onchain_pot_id) : 'Chưa có'}
                          </Tag>
                          <Tag color={activity.contract_address ? 'blue' : 'orange'}>
                            Contract: {activity.contract_address ? shortWallet(activity.contract_address) : 'Chưa gán'}
                          </Tag>
                        </Space>
                        <Space wrap>
                          <Button onClick={() => void handleCreatePotOnChain()} loading={contractLoading}>
                            Create pot on-chain
                          </Button>
                          <Select
                            style={{ width: 180 }}
                            value={contractStatus}
                            onChange={value => setContractStatus(value)}
                            options={[
                              { value: 'DRAFT', label: 'DRAFT' },
                              { value: 'ACTIVE', label: 'ACTIVE' },
                              { value: 'CLOSED', label: 'CLOSED' },
                              { value: 'CANCELLED', label: 'CANCELLED' },
                            ]}
                          />
                          <Button type="primary" onClick={() => void handleSetContractStatus()} loading={contractLoading}>
                            Set status
                          </Button>
                        </Space>
                      </Space>
                    </Card>

                    <Row gutter={[12, 12]}>
                      <Col xs={24} lg={12}>
                        <Card className="contract-grid-card liquid-glass" bodyStyle={{ padding: 14 }} title="Manual recordContribution">
                          <Form layout="vertical" form={manualContribForm} onFinish={values => void handleManualContractContribution(values)}>
                            <Form.Item name="contributor_wallet" label="Contributor wallet"
                              rules={[{ required: true, message: 'Nhập ví contributor' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="amount" label="Amount (VNDC)"
                              rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập amount > 0' }]}
                            >
                              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
                            </Form.Item>
                            <Form.Item name="transfer_tx_hash" label="Transfer tx hash"
                              rules={[{ required: true, message: 'Nhập transfer tx hash' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="note" label="Note">
                              <Input placeholder="Manual sync from contract" />
                            </Form.Item>
                            <Button htmlType="submit" type="primary" loading={contractLoading}>Submit contribution</Button>
                          </Form>
                        </Card>
                      </Col>

                      <Col xs={24} lg={12}>
                        <Card className="contract-grid-card liquid-glass" bodyStyle={{ padding: 14 }} title="Manual spend">
                          <Form layout="vertical" form={manualSpendForm} onFinish={values => void handleManualContractSpend(values)}>
                            <Form.Item name="beneficiary_wallet" label="Beneficiary wallet"
                              rules={[{ required: true, message: 'Nhập ví nhận tiền' }]}
                            >
                              <Input placeholder="0x..." />
                            </Form.Item>
                            <Form.Item name="amount" label="Amount (VNDC)"
                              rules={[{ required: true, type: 'number', min: 0.01, message: 'Nhập amount > 0' }]}
                            >
                              <InputNumber style={{ width: '100%' }} min={0.01} precision={2} />
                            </Form.Item>
                            <Form.Item name="note" label="Note"
                              rules={[{ required: true, message: 'Nhập nội dung chi' }]}
                            >
                              <Input placeholder="Chi cho hoạt động..." />
                            </Form.Item>
                            <Form.Item name="reference" label="Reference">
                              <Input placeholder="Optional reference" />
                            </Form.Item>
                            <Button htmlType="submit" danger type="primary" loading={contractLoading}>Submit spend</Button>
                          </Form>
                        </Card>
                      </Col>
                    </Row>
                  </Space>
                ),
              }] : []),
            ]} />
          )}
        </Spin>
      </Drawer>

      {activity && user && (
        <>
          <RecordExpenseModal activity={activity} open={expenseOpen}
            onClose={() => setExpenseOpen(false)}
            onSuccess={() => { void load(); onReload() }} />
          <ContributeModal activity={activity} user={user} open={contributeOpen}
            onClose={() => setContributeOpen(false)}
            onSuccess={() => { void load(); onReload() }} />
        </>
      )}
    </>
  )
}

function FundAdminTab({ user, onOpenContract, onOpenSummary, onCreate }: {
  user: AuthUser
  onOpenContract: (id: string) => void
  onOpenSummary: (id: string) => void
  onCreate: () => void
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { items } = await getMyFunds(user.wallet_address)
      setFunds(items)
    } catch {
      setFunds([])
    } finally {
      setLoading(false)
    }
  }, [user.wallet_address])

  useEffect(() => { void load() }, [load])

  const dashboard = useMemo(() => {
    const readyCount = funds.filter(f => !!f.onchain_pot_id && !!f.contract_address).length
    const activeCount = funds.filter(f => f.status === 'ACTIVE' || f.status === 'DRAFT').length
    const closedCount = funds.filter(f => f.status === 'CLOSED').length
    const cancelledCount = funds.filter(f => f.status === 'CANCELLED').length
    const totalRaised = funds.reduce((sum, f) => sum + fromWei(f.total_raised), 0)
    const totalTarget = funds.reduce((sum, f) => sum + fromWei(f.target_amount), 0)
    const avgProgress = funds.length ? funds.reduce((sum, f) => sum + getProgress(f), 0) / funds.length : 0
    const targetProgress = totalTarget > 0 ? (totalRaised / totalTarget) * 100 : 0
    const statusBuckets = [
      { label: 'Sắp mở', value: funds.filter(f => f.status === 'DRAFT').length },
      { label: 'Đang gây quỹ', value: funds.filter(f => f.status === 'ACTIVE').length },
      { label: 'Đã đóng', value: closedCount },
      { label: 'Đã hủy', value: cancelledCount },
    ]
    const categoryBuckets = CATEGORY_OPTIONS.map(c => ({ label: c.label, value: funds.filter(f => f.category === c.value).length })).filter(item => item.value > 0)
    const progressBuckets = [
      { label: '0-25%', value: funds.filter(f => getProgress(f) < 25).length },
      { label: '25-50%', value: funds.filter(f => getProgress(f) >= 25 && getProgress(f) < 50).length },
      { label: '50-75%', value: funds.filter(f => getProgress(f) >= 50 && getProgress(f) < 75).length },
      { label: '75-100%', value: funds.filter(f => getProgress(f) >= 75).length },
    ]
    return {
      readyCount, activeCount, closedCount, cancelledCount, totalRaised, totalTarget, avgProgress, targetProgress,
      readyPercent: funds.length ? (readyCount / funds.length) * 100 : 0,
      activePercent: funds.length ? (activeCount / funds.length) * 100 : 0,
      closedPercent: funds.length ? (closedCount / funds.length) * 100 : 0,
      statusBuckets, categoryBuckets, progressBuckets,
    }
  }, [funds])

  const maxStatus = Math.max(1, ...dashboard.statusBuckets.map(item => item.value))
  const maxCategory = Math.max(1, ...dashboard.categoryBuckets.map(item => item.value))
  const maxProgress = Math.max(1, ...dashboard.progressBuckets.map(item => item.value))

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div className="admin-tab-panel liquid-glass">
        <Space style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
          <Space direction="vertical" size={2}>
            <Text strong style={{ fontSize: 18 }}>Trung tâm Quản trị Gây quỹ</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>Theo dõi sức khỏe quỹ bằng biểu đồ: tiến độ, trạng thái, danh mục và đồng bộ on-chain.</Text>
          </Space>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Làm mới</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>Tạo quỹ mới</Button>
          </Space>
        </Space>
      </div>

      <Row gutter={[12, 12]}>
        {[
          { label: 'Tổng quỹ quản trị', value: funds.length, hint: 'quỹ', color: '#2563EB' },
          { label: 'Tổng đã gây quỹ', value: dashboard.totalRaised.toLocaleString('vi-VN', { maximumFractionDigits: 2 }), hint: 'VNDC', color: '#10B981' },
          { label: 'Mục tiêu tổng', value: dashboard.totalTarget.toLocaleString('vi-VN', { maximumFractionDigits: 2 }), hint: 'VNDC', color: '#0EA5E9' },
          { label: 'On-chain ready', value: dashboard.readyCount, hint: `/${funds.length || 0} quỹ`, color: '#7C3AED' },
        ].map(s => (
          <Col xs={12} lg={6} key={s.label}>
            <Card className="admin-kpi-card liquid-glass" bodyStyle={{ padding: 14 }}>
              <Text className="kpi-label">{s.label}</Text>
              <div style={{ marginTop: 8 }}>
                <Text className="kpi-value" style={{ color: s.color }}>{s.value}</Text>
                <Text style={{ fontSize: 11, color: 'var(--ink-subtle)', marginLeft: 4 }}>{s.hint}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="fund-dashboard-grid">
        <Card className="fund-chart-card liquid-glass" bodyStyle={{ padding: 16 }}>
          <div className="fund-dashboard-card-title">
            <div>
              <div className="fund-dashboard-title">Pipeline trạng thái quỹ</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Phân bổ quỹ theo trạng thái vận hành hiện tại.</Text>
            </div>
            <Tag color="blue" className="status-pill">{funds.length} quỹ</Tag>
          </div>
          {dashboard.statusBuckets.map(item => <DashboardBar key={item.label} label={item.label} value={item.value} max={maxStatus} />)}
        </Card>

        <Card className="fund-chart-card liquid-glass" bodyStyle={{ padding: 16 }}>
          <div className="fund-dashboard-card-title">
            <div>
              <div className="fund-dashboard-title">Tình trạng tổng quan</div>
              <Text type="secondary" style={{ fontSize: 12 }}>Các tỷ lệ chính của danh mục quỹ.</Text>
            </div>
          </div>
          <div className="fund-donut-list">
            <MiniDonut value={dashboard.readyPercent} label="On-chain" caption="đã sẵn sàng" />
            <MiniDonut value={dashboard.activePercent} label="Đang chạy" caption="đang mở" />
            <MiniDonut value={dashboard.targetProgress} label="Mục tiêu" caption="đã đạt" />
          </div>
        </Card>
      </div>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card className="fund-chart-card liquid-glass" bodyStyle={{ padding: 16 }}>
            <div className="fund-dashboard-card-title">
              <div>
                <div className="fund-dashboard-title">Cơ cấu danh mục</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Nhóm quỹ theo lĩnh vực gây quỹ.</Text>
              </div>
            </div>
            {dashboard.categoryBuckets.length === 0 ? <Empty description="Chưa có dữ liệu danh mục" /> : dashboard.categoryBuckets.map(item => <DashboardBar key={item.label} label={item.label} value={item.value} max={maxCategory} />)}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card className="fund-chart-card liquid-glass" bodyStyle={{ padding: 16 }}>
            <div className="fund-dashboard-card-title">
              <div>
                <div className="fund-dashboard-title">Phân bổ tiến độ</div>
                <Text type="secondary" style={{ fontSize: 12 }}>Số lượng quỹ theo mức hoàn thành mục tiêu.</Text>
              </div>
              <Tag color="cyan" className="status-pill">TB {clampPercent(dashboard.avgProgress)}%</Tag>
            </div>
            {dashboard.progressBuckets.map(item => <DashboardBar key={item.label} label={item.label} value={item.value} max={maxProgress} />)}
          </Card>
        </Col>
      </Row>

      <Spin spinning={loading}>
        {funds.length === 0 && !loading ? (
          <Empty description="Chưa có quỹ để quản trị" />
        ) : (
          <Row gutter={[12, 12]} className="fund-card-grid">
            {funds.map(f => {
              const st = STATUS_CONFIG[f.status] ?? STATUS_CONFIG.ACTIVE
              const pct = getProgress(f)
              return (
                <Col xs={24} md={12} xl={8} key={f.id}>
                  <Card className="fund-management-card liquid-glass" bodyStyle={{ padding: 14 }}>
                    <Space direction="vertical" style={{ width: '100%' }} size={10}>
                      <Space style={{ justifyContent: 'space-between', width: '100%', gap: 8 }}>
                        <Tag color={st.color} icon={st.icon} className="status-pill">{st.label}</Tag>
                        <Tag color={f.onchain_pot_id && f.contract_address ? 'cyan' : 'orange'} className="status-pill">{f.onchain_pot_id && f.contract_address ? 'On-chain ready' : 'Sync pending'}</Tag>
                      </Space>
                      <Text strong className="fund-management-title line-clamp-2">{f.title}</Text>
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Đã gây quỹ</Text>
                        <Text strong style={{ color: '#10B981' }}>{fmtVNDC(f.total_raised)} VNDC</Text>
                      </Space>
                      <div className="fund-mini-progress"><span style={{ width: `${pct}%` }} /></div>
                      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tiến độ {pct}%</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>{categoryLabel(f.category)}</Text>
                      </Space>
                      <Space style={{ justifyContent: 'flex-end', width: '100%', marginTop: 4 }}>
                        <Button size="small" onClick={() => onOpenSummary(f.id)}>Tổng quan</Button>
                        <Button size="small" type="primary" onClick={() => onOpenContract(f.id)}>Hợp đồng</Button>
                      </Space>
                    </Space>
                  </Card>
                </Col>
              )
            })}
          </Row>
        )}
      </Spin>
    </Space>
  )
}

// ─── BrowseTab ─────────────────────────────────────────────────────

function BrowseTab({ user, onDetail, onContribute, optimisticRaised }: {
  user?: AuthUser
  onDetail: (id: string) => void
  onContribute: (a: FundActivity) => void
  optimisticRaised: Record<string, bigint>
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [status, setStatus] = useState<string>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const statusFilter = status === 'ALL' ? undefined : status
      const { items } = await getFunds(1, 50, statusFilter, category, search)
      setFunds(items)
    } catch { setFunds([]) }
    finally { setLoading(false) }
  }, [status, category, search])

  useEffect(() => { void load() }, [load])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[12, 12]} align="middle" className="fund-toolbar">
        <Col xs={24} sm={10}>
          <Input.Search placeholder="Tìm kiếm quỹ..." allowClear
            onSearch={v => setSearch(v)} onChange={e => { if (!e.target.value) setSearch('') }}
            prefix={<SearchOutlined />} />
        </Col>
        <Col xs={12} sm={7}>
          <Select style={{ width: '100%' }} placeholder="Danh mục" allowClear
            options={CATEGORY_OPTIONS} value={category} onChange={v => setCategory(v)} />
        </Col>
        <Col xs={8} sm={5}>
          <Select style={{ width: '100%' }} placeholder="Trạng thái" value={status}
            onChange={v => setStatus(v)}
            options={[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'ACTIVE', label: 'Đang gây quỹ' },
              { value: 'DRAFT', label: 'Sắp mở' },
              { value: 'CLOSED', label: 'Đã đóng' },
              { value: 'CANCELLED', label: 'Đã hủy' },
            ]} />
        </Col>
        <Col xs={4} sm={2}>
          <Tooltip title="Làm mới">
            <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} />
          </Tooltip>
        </Col>
      </Row>
      <Spin spinning={loading}>
        {funds.length === 0 && !loading
          ? <Empty description="Không tìm thấy quỹ nào" style={{ padding: 48 }} />
          : <Row gutter={[16, 16]} className="fund-card-grid">
              {funds.map(a => (
                (() => {
                  const delta = optimisticRaised[a.id] ?? 0n
                  const displayActivity = delta > 0n
                    ? { ...a, total_raised: addWei(a.total_raised, delta.toString()) }
                    : a
                  return (
                <Col xs={24} sm={12} lg={8} key={a.id}>
                  <FundCard activity={displayActivity}
                    isOwner={!!(user?.wallet_address && displayActivity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase())}
                    onContribute={() => onContribute(a)} onDetail={() => onDetail(displayActivity.id)} />
                </Col>
                  )
                })()
              ))}
            </Row>
        }
      </Spin>
    </Space>
  )
}

// ─── MyFundsTab ────────────────────────────────────────────────────

function MyFundsTab({ user, onDetail, onContribute, onCreate, optimisticRaised }: {
  user: AuthUser
  onDetail: (id: string) => void
  onContribute: (a: FundActivity) => void
  onCreate: () => void
  optimisticRaised: Record<string, bigint>
}) {
  const [funds, setFunds] = useState<FundActivity[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!user.wallet_address) return
    setLoading(true)
    try { const { items } = await getMyFunds(user.wallet_address); setFunds(items) }
    catch { setFunds([]) }
    finally { setLoading(false) }
  }, [user.wallet_address])

  useEffect(() => { void load() }, [load])

  const totalRaised = funds.reduce((sum, f) => {
    const delta = optimisticRaised[f.id] ?? 0n
    const raised = delta > 0n ? addWei(f.total_raised, delta.toString()) : f.total_raised
    return sum + fromWei(raised)
  }, 0)

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <Row gutter={[12, 12]}>
        {[
          { label: 'Đang hoạt động', value: funds.filter(f => f.status === 'ACTIVE' || f.status === 'DRAFT').length, color: '#3B82F6' },
          { label: 'Đã kết thúc', value: funds.filter(f => f.status === 'CLOSED' || f.status === 'CANCELLED').length, color: '#6B7280' },
          { label: 'Tổng đã gây quỹ (VNDC)', value: totalRaised.toLocaleString('vi-VN', { maximumFractionDigits: 2 }), color: '#10B981' },
        ].map(s => (
          <Col xs={24} sm={8} key={s.label}>
            <Card className="liquid-glass admin-kpi-card" bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}>
              <Text style={{ fontSize: 11, color: '#9CA3AF', display: 'block' }}>{s.label}</Text>
              <Text strong style={{ color: s.color, fontSize: 20 }}>{s.value}</Text>
            </Card>
          </Col>
        ))}
      </Row>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Text strong>Danh sách quỹ của tôi ({funds.length})</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}
            style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ mới</Button>
        </Space>
      </Space>
      <Spin spinning={loading}>
        {funds.length === 0 && !loading
          ? <Empty description="Bạn chưa có quỹ nào">
              <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}
                style={{ background: '#10B981', borderColor: '#10B981' }}>Tạo quỹ đầu tiên</Button>
            </Empty>
          : <Row gutter={[16, 16]} className="fund-card-grid">
              {funds.map(a => (
                (() => {
                  const delta = optimisticRaised[a.id] ?? 0n
                  const displayActivity = delta > 0n
                    ? { ...a, total_raised: addWei(a.total_raised, delta.toString()) }
                    : a
                  return (
                <Col xs={24} sm={12} lg={8} key={a.id}>
                  <FundCard activity={displayActivity}
                    isOwner={displayActivity.owner_wallet.toLowerCase() === user.wallet_address.toLowerCase()}
                    onContribute={() => onContribute(a)} onDetail={() => onDetail(displayActivity.id)} />
                </Col>
                  )
                })()
              ))}
            </Row>
        }
      </Spin>
    </Space>
  )
}

// ─── CampaignsPage (main) ──────────────────────────────────────────

interface CampaignsPageProps { user?: AuthUser }

export function CampaignsPage({ user }: CampaignsPageProps) {
  const [tab, setTab] = useState('browse')
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailTab, setDetailTab] = useState('summary')
  const [contributeActivity, setContributeActivity] = useState<FundActivity | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [optimisticRaised, setOptimisticRaised] = useState<Record<string, bigint>>({})

  function applyOptimisticContribution(activityId: string, amountWei: string) {
    let amount = 0n
    try {
      amount = BigInt(amountWei)
    } catch {
      return
    }
    if (amount <= 0n) return

    setOptimisticRaised(prev => ({
      ...prev,
      [activityId]: (prev[activityId] ?? 0n) + amount,
    }))

    // Auto-clear optimistic delta after settlement window to avoid double counting.
    setTimeout(() => {
      setOptimisticRaised(prev => {
        const current = prev[activityId] ?? 0n
        const next = current - amount
        if (next <= 0n) {
          const { [activityId]: _removed, ...rest } = prev
          return rest
        }
        return { ...prev, [activityId]: next }
      })
    }, 20000)
  }

  function reload() { setReloadKey(k => k + 1) }

  function openDetail(id: string, targetTab: 'summary' | 'contract' | 'ledger' | 'deputies' = 'summary') {
    setDetailTab(targetTab)
    setDetailId(id)
  }

  const tabItems = [
    {
      key: 'browse',
      label: <Space><SearchOutlined />Khám phá</Space>,
      children: (
        <BrowseTab key={`browse-${reloadKey}`} user={user}
          onDetail={id => openDetail(id, 'summary')} onContribute={setContributeActivity} optimisticRaised={optimisticRaised} />
      ),
    },
    ...(user ? [{
      key: 'mine',
      label: <Space><EditOutlined />Quỹ của tôi</Space>,
      children: (
        <MyFundsTab key={`mine-${reloadKey}`} user={user}
          onDetail={id => openDetail(id, 'summary')} onContribute={setContributeActivity} optimisticRaised={optimisticRaised}
          onCreate={() => setCreateOpen(true)} />
      ),
    }] : []),
    ...(user ? [{
      key: 'admin',
      label: <Space><EditOutlined />Quản trị</Space>,
      children: (
        <FundAdminTab
          user={user}
          onOpenSummary={id => openDetail(id, 'summary')}
          onOpenContract={id => openDetail(id, 'contract')}
          onCreate={() => setCreateOpen(true)}
        />
      ),
    }] : []),
  ]

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }} className="fund-page campaign-liquid-page">
      <style>{CAMPAIGN_STYLES}</style>

      <div
        className="hero"
        style={{
          padding: '24px 28px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
        }}
      >
        <div className="vndc-hero-icon">
          <FundOutlined />
        </div>

        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="vndc-hero-kicker">Quỹ cộng đồng</div>
          <Title level={3} className="vndc-hero-title" style={{ margin: 0, fontFamily: 'var(--font-sans)', fontWeight: 800, lineHeight: 1.2 }}>
            Gây quỹ cộng đồng
          </Title>
          <Text className="vndc-hero-desc" style={{ fontSize: 13 }}>
            Thiết kế quỹ tinh gọn metadata on-chain, dữ liệu chi tiết và vận hành nằm ở off-chain/DB.
          </Text>
        </div>

        <div style={{ textAlign: 'right', minWidth: 210 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10B981' }} />
            <Text style={{ color: '#059669', fontSize: 12, fontWeight: 600 }}>Đồng bộ On-chain / Off-chain</Text>
          </div>
          <Text style={{ color: 'var(--ink-subtle)', fontSize: 11 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />Pot · Ledger · DB
          </Text>
          {user && (
            <div style={{ marginTop: 10 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}
                style={{ boxShadow: '0 8px 22px rgba(37,99,235,.18)' }}>
                Tạo quỹ mới
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="fund-tabs-shell">
        <Tabs className="fund-tabs" activeKey={tab} onChange={setTab} items={tabItems} />
      </div>

      <CreateFundModal open={createOpen} onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); reload() }} />

      <FundDetailDrawer activityId={detailId} user={user} open={!!detailId}
        onClose={() => { setDetailId(null); setDetailTab('summary') }} onReload={reload} initialTab={detailTab} />

      {contributeActivity && user && (
        <ContributeModal activity={contributeActivity} user={user} open={!!contributeActivity}
          onClose={() => setContributeActivity(null)}
          onSuccess={({ activityId, amountWei }) => {
            applyOptimisticContribution(activityId, amountWei)
            setContributeActivity(null)
            reload()
          }} />
      )}

      {contributeActivity && !user && (
        <Modal className="fund-liquid-modal" open title={<Space><ExclamationCircleOutlined style={{ color: '#F59E0B' }} />Yêu cầu đăng nhập</Space>}
          onCancel={() => setContributeActivity(null)} footer={null}>
          <Text>Vui lòng đăng nhập để đóng góp vào quỹ.</Text>
        </Modal>
      )}
    </div>
  )
}
