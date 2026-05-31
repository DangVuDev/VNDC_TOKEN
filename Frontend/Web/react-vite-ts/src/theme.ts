import type { ThemeConfig } from 'antd'

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary:          '#4338CA',
    colorSuccess:          '#059669',
    colorWarning:          '#D97706',
    colorError:            '#DC2626',
    colorInfo:             '#6366F1',
    borderRadius:          10,
    fontFamily:            "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize:              14,
    colorBgContainer:      '#FFFFFF',
    colorBgLayout:         '#F4F3EF',
    colorText:             '#1F1E3D',
    colorTextSecondary:    '#6B7280',
    colorBorder:           '#E4E2DE',
    colorBorderSecondary:  '#EEE9E4',
    boxShadow:             '0 1px 3px rgba(67,56,202,0.07), 0 1px 2px rgba(0,0,0,0.05)',
    boxShadowSecondary:    '0 4px 12px rgba(67,56,202,0.10)',
  },
  components: {
    Layout: {
      siderBg:      '#1A1744',
      triggerBg:    '#252157',
      triggerColor: '#A5B4FC',
    },
    Card: {
      borderRadius:        12,
      boxShadowTertiary:   '0 0 0 1px rgba(67,56,202,0.05), 0 2px 8px rgba(67,56,202,0.08)',
    },
    Button: {
      borderRadius:  8,
      primaryShadow: 'none',
      fontWeight:    500,
    },
    Table: {
      borderRadius: 12,
      headerBg:     '#F0EFF8',
    },
    Tabs: {
      inkBarColor:          '#4338CA',
      itemActiveColor:      '#4338CA',
      itemSelectedColor:    '#4338CA',
      itemHoverColor:       '#6366F1',
    },
    Tag: {
      borderRadius: 6,
    },
    Modal: {
      borderRadius: 16,
    },
    Progress: {
      defaultColor: '#4338CA',
    },
    Steps: {
      colorPrimary: '#4338CA',
    },
    Alert: {
      borderRadius: 10,
    },
    Select: {
      borderRadius: 8,
    },
    Input: {
      borderRadius: 8,
    },
  },
}
