import type { ThemeConfig } from 'antd'

const fontStack = '"Segoe UI", "Be Vietnam Pro", system-ui, -apple-system, BlinkMacSystemFont, sans-serif'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#2563EB',
    colorSuccess: '#059669',
    colorWarning: '#D97706',
    colorError: '#DC2626',
    colorInfo: '#0EA5E9',
    borderRadius: 12,
    borderRadiusSM: 8,
    borderRadiusLG: 16,
    fontFamily: fontStack,
    fontSize: 14,
    colorBgContainer: '#FFFFFF',
    colorBgLayout: '#F6F8FB',
    colorFillAlter: '#F8FAFC',
    colorText: '#0F172A',
    colorTextSecondary: '#475569',
    colorTextTertiary: '#64748B',
    colorBorder: '#D8E0EC',
    colorBorderSecondary: '#E8EEF6',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
    boxShadowSecondary: '0 8px 22px rgba(15, 23, 42, 0.06)',
    boxShadowTertiary: '0 18px 44px rgba(15, 23, 42, 0.09)',
  },
  components: {
    Layout: {
      bodyBg: '#F6F8FB',
      headerBg: '#FFFFFF',
      siderBg: '#0B1220',
      triggerBg: '#111A2E',
      triggerColor: '#CBD5E1',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 1px 2px rgba(15, 23, 42, 0.05)',
      headerBg: '#FFFFFF',
    },
    Button: {
      borderRadius: 8,
      primaryShadow: 'none',
      fontWeight: 620,
      controlHeight: 36,
      controlHeightLG: 44,
    },
    Table: {
      borderRadius: 12,
      headerBg: '#F8FAFC',
      headerColor: '#475569',
      rowHoverBg: '#F8FAFC',
    },
    Tabs: {
      inkBarColor: '#2563EB',
      itemActiveColor: '#2563EB',
      itemSelectedColor: '#2563EB',
      itemHoverColor: '#1D4ED8',
    },
    Tag: {
      borderRadiusSM: 999,
      defaultBg: '#F8FAFC',
    },
    Modal: {
      borderRadiusLG: 16,
      contentBg: '#FFFFFF',
      headerBg: '#FFFFFF',
    },
    Drawer: {
      colorBgElevated: '#FFFFFF',
    },
    Progress: {
      defaultColor: '#2563EB',
      remainingColor: '#E8EEF6',
    },
    Steps: {
      colorPrimary: '#2563EB',
      colorText: '#0F172A',
      colorTextDescription: '#64748B',
    },
    Alert: {
      borderRadiusLG: 12,
    },
    Select: {
      borderRadius: 8,
    },
    Input: {
      borderRadius: 8,
      activeBorderColor: '#2563EB',
      hoverBorderColor: '#93C5FD',
      activeShadow: '0 0 0 3px rgba(37, 99, 235, 0.18)',
    },
    InputNumber: {
      borderRadius: 8,
      activeBorderColor: '#2563EB',
      hoverBorderColor: '#93C5FD',
      activeShadow: '0 0 0 3px rgba(37, 99, 235, 0.18)',
    },
  },
}
