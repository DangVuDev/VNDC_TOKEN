import { useState } from 'react'
import {
  Modal, Steps, Button, Typography, Space, Input, Form, Alert,
  QRCode, Divider, message as antMessage, Spin,
} from 'antd'
import { CopyOutlined, CheckOutlined, KeyOutlined } from '@ant-design/icons'
import { BackupCodesDisplay } from './BackupCodesDisplay'

const { Title, Text } = Typography

interface TwoFASetupModalProps {
  open: boolean
  onClose: () => void
  onSetup: () => Promise<{ secret: string; otp_auth_uri: string; backup_codes: string[] } | undefined>
  onEnable: (code: string) => Promise<unknown>
}

type SetupData = {
  secret: string
  otp_auth_uri: string
  backup_codes: string[]
}

export function TwoFASetupModal({ open, onClose, onSetup, onEnable }: TwoFASetupModalProps) {
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2>(0)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [secretCopied, setSecretCopied] = useState(false)

  async function handleStart() {
    setLoading(true)
    setError(null)
    try {
      const data = await onSetup()
      if (!data) throw new Error('Không nhận được dữ liệu TOTP từ server')
      setSetupData(data)
      setWizardStep(1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lỗi khi tạo TOTP secret')
    } finally {
      setLoading(false)
    }
  }

  async function handleEnable() {
    if (!totpCode || totpCode.length !== 6) return
    setEnabling(true)
    setError(null)
    try {
      await onEnable(totpCode)
      antMessage.success('2FA đã được kích hoạt thành công!')
      handleClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Mã TOTP không đúng')
      setTotpCode('')
    } finally {
      setEnabling(false)
    }
  }

  function handleClose() {
    setWizardStep(0)
    setSetupData(null)
    setTotpCode('')
    setError(null)
    setLoading(false)
    setEnabling(false)
    onClose()
  }

  function copySecret() {
    if (!setupData?.secret) return
    navigator.clipboard.writeText(setupData.secret).then(() => {
      setSecretCopied(true)
      setTimeout(() => setSecretCopied(false), 2000)
    })
  }

  const WIZARD_STEPS = [
    { title: 'Quét QR' },
    { title: 'Backup codes' },
    { title: 'Xác nhận' },
  ]

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={
        <Title level={4} style={{ margin: 0 }}>
          🔐 Cài đặt xác thực 2 bước (TOTP)
        </Title>
      }
      footer={null}
      width={520}
      destroyOnClose
    >
      <Space direction="vertical" size={24} style={{ width: '100%', paddingTop: 8 }}>

        <Steps size="small" current={wizardStep} items={WIZARD_STEPS} />

        {error && (
          <Alert type="error" message={error} closable onClose={() => setError(null)} style={{ borderRadius: 8 }} />
        )}

        {/* Step 0 — Scan QR */}
        {wizardStep === 0 && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Mở ứng dụng Authenticator (Google Authenticator, Authy...) và quét QR code bên dưới.
            </Text>

            {!setupData ? (
              <div style={{ textAlign: 'center' }}>
                <Button
                  type="primary"
                  size="large"
                  loading={loading}
                  onClick={handleStart}
                  style={{ height: 48, borderRadius: 10, minWidth: 200 }}
                >
                  Bắt đầu cài đặt
                </Button>
              </div>
            ) : (
              <Spin spinning={loading}>
                <Space direction="vertical" size={16} style={{ width: '100%', alignItems: 'center' }}>
                  {/* QR Code */}
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #E5E7EB',
                      borderRadius: 12,
                      padding: 16,
                      display: 'inline-flex',
                    }}
                  >
                    <QRCode value={setupData.otp_auth_uri} size={180} />
                  </div>

                  <Divider plain style={{ margin: 0 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>hoặc nhập thủ công</Text>
                  </Divider>

                  {/* Manual secret */}
                  <div style={{ width: '100%' }}>
                    <Text style={{ fontSize: 12, color: '#6B7280', display: 'block', marginBottom: 6 }}>
                      Secret key:
                    </Text>
                    <Input
                      value={setupData.secret}
                      readOnly
                      style={{ fontFamily: 'monospace', letterSpacing: 2, borderRadius: 8 }}
                      addonAfter={
                        <Button
                          type="text"
                          size="small"
                          icon={secretCopied ? <CheckOutlined style={{ color: '#10B981' }} /> : <CopyOutlined />}
                          onClick={copySecret}
                        />
                      }
                    />
                  </div>

                  <Button
                    type="primary"
                    block
                    onClick={() => setWizardStep(1)}
                    style={{ height: 44, borderRadius: 8 }}
                  >
                    Tiếp theo → Lưu mã backup
                  </Button>
                </Space>
              </Spin>
            )}
          </Space>
        )}

        {/* Step 1 — Backup codes */}
        {wizardStep === 1 && setupData && (
          <BackupCodesDisplay
            codes={setupData.backup_codes}
            onAcknowledged={() => setWizardStep(2)}
          />
        )}

        {/* Step 2 — Confirm TOTP */}
        {wizardStep === 2 && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="info"
              showIcon
              message="Xác nhận kích hoạt"
              description="Nhập mã 6 chữ số từ ứng dụng Authenticator để xác nhận cài đặt thành công."
              style={{ borderRadius: 8 }}
            />

            <Form onFinish={handleEnable} layout="vertical">
              <Form.Item label="Mã TOTP từ ứng dụng" style={{ marginBottom: 16 }}>
                <Input
                  size="large"
                  prefix={<KeyOutlined style={{ color: '#9CA3AF' }} />}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  style={{
                    borderRadius: 10,
                    fontSize: 24,
                    letterSpacing: 8,
                    textAlign: 'center',
                  }}
                  autoFocus
                />
              </Form.Item>

              <Button
                type="primary"
                block
                size="large"
                htmlType="submit"
                loading={enabling}
                disabled={totpCode.length !== 6}
                style={{ height: 48, borderRadius: 10, fontWeight: 600 }}
              >
                Kích hoạt 2FA
              </Button>
            </Form>

            <Button type="link" block onClick={() => setWizardStep(0)} style={{ color: '#6B7280' }}>
              ← Quay lại
            </Button>
          </Space>
        )}
      </Space>
    </Modal>
  )
}
