import { useState } from 'react'
import {
  Button, Typography, Space, Input, Form, Alert, Divider,
  message as antMessage,
} from 'antd'
import { CopyOutlined, CheckOutlined, DownloadOutlined } from '@ant-design/icons'

const { Text } = Typography

interface BackupCodesDisplayProps {
  codes: string[]
  /** If provided, shows a confirm button to proceed after acknowledging */
  onAcknowledged?: () => void
}

export function BackupCodesDisplay({ codes, onAcknowledged }: BackupCodesDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')

  function handleCopy() {
    const text = codes.join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    const content = [
      'VNDC Education Platform — Mã backup 2FA',
      '═══════════════════════════════════════',
      'Giữ các mã này ở nơi an toàn.',
      'Mỗi mã chỉ dùng được một lần.',
      '',
      ...codes,
      '',
      `Tạo lúc: ${new Date().toLocaleString('vi-VN')}`,
    ].join('\n')

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'vndc-2fa-backup-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    antMessage.success('Đã tải file backup codes')
  }

  const isConfirmed = confirmInput.toLowerCase().trim() === 'đã lưu'

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="Lưu các mã này ngay bây giờ!"
        description="Mỗi mã backup chỉ hiển thị một lần và dùng được một lần. Nếu mất điện thoại, đây là cách duy nhất để khôi phục tài khoản."
        style={{ borderRadius: 8 }}
      />

      {/* Codes grid */}
      <div
        style={{
          background: '#F9FAFB',
          border: '1px solid #E5E7EB',
          borderRadius: 10,
          padding: '16px 20px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 24px',
          }}
        >
          {codes.map((code, i) => (
            <Text
              key={i}
              style={{
                fontFamily: 'monospace',
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: 2,
                color: '#1E293B',
                padding: '4px 0',
              }}
            >
              {i + 1}. {code}
            </Text>
          ))}
        </div>
      </div>

      {/* Actions */}
      <Space style={{ width: '100%' }}>
        <Button
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          style={{ borderRadius: 8 }}
        >
          {copied ? 'Đã copy!' : 'Copy tất cả'}
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownload}
          style={{ borderRadius: 8 }}
        >
          Tải về .txt
        </Button>
      </Space>

      {onAcknowledged && (
        <>
          <Divider style={{ margin: '4px 0' }} />
          <Form.Item
            label={
              <Text style={{ fontSize: 13 }}>
                Nhập <Text code>đã lưu</Text> để xác nhận bạn đã lưu các mã này:
              </Text>
            }
            style={{ marginBottom: 8 }}
          >
            <Input
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="đã lưu"
              style={{ borderRadius: 8 }}
            />
          </Form.Item>
          <Button
            type="primary"
            block
            disabled={!isConfirmed}
            onClick={onAcknowledged}
            style={{ height: 44, borderRadius: 8, fontWeight: 600 }}
          >
            Tiếp tục →
          </Button>
        </>
      )}
    </Space>
  )
}
