import { useEffect, useState, useCallback } from 'react'
import {
  Card, Typography, Space, Button, Tag, Alert,
  Descriptions, Divider, Popconfirm, Form, Input, Switch,
  message as antMessage, Modal, Spin, Row, Col, Avatar,
  Table, Tooltip, Select, Menu, Statistic, Badge, Segmented,
} from 'antd'
import type { MenuProps } from 'antd'
import {
  UserOutlined, SafetyCertificateOutlined, LogoutOutlined,
  ReloadOutlined, KeyOutlined, WarningOutlined, EditOutlined,
  CheckCircleOutlined, CloseCircleOutlined, GiftOutlined,
  FileProtectOutlined, BellOutlined, LockOutlined, HistoryOutlined,
  CopyOutlined, TeamOutlined, MailOutlined, PhoneOutlined,
  SaveOutlined, TrophyOutlined, CrownOutlined, SearchOutlined,
  StopOutlined, CheckSquareOutlined, PlusCircleOutlined,
  IdcardOutlined, DeleteOutlined, SafetyOutlined,
} from '@ant-design/icons'
import { SessionsTable } from '../components/auth/SessionsTable'
import { TwoFASetupModal } from '../components/auth/TwoFASetupModal'
import type { AuthUser, Session } from '../hooks/useAuth'
import { useAuthContext } from '../context/AuthContext'
import {
  getMyProfile, updateMyProfile, getPreferences, updatePreferences,
  getReferralInfo, listReferrals, getAuditLogs, requestEmailChange, requestPhoneChange,
  verifyEmail, verifyPhone, generateBackupCodes, deactivateAccount,
  getKYCLevel1Status, submitKYCLevel1, submitKYCLevel2, uploadKYCDocument,
  adminListUsers, adminGetUser, adminSuspendUser, adminUnsuspendUser,
  adminAssignRole, adminRemoveRole, adminApproveKYC,
  adminListKYCSubmissions, adminReviewKYCSubmission,
  type UserProfile, type UserPreferences, type AuditLogEntry,
  type ReferralInfo, type ReferralRecord, type KYCSubmission,
} from '../lib/services'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleColor(role: string): string {
  const r = role.toLowerCase()
  if (r === 'admin' || r === 'super_admin') return 'red'
  if (r === 'moderator') return 'orange'
  if (r === 'lecturer') return 'blue'
  return 'default'
}

function kycColor(status: string) {
  if (status === 'VERIFIED') return 'success'
  if (status === 'PENDING') return 'warning'
  if (status === 'REJECTED') return 'error'
  return 'default'
}

function statusColor(status: string) {
  if (status === 'ACTIVE') return 'success'
  if (status === 'SUSPENDED') return 'error'
  if (status === 'BANNED') return 'error'
  if (status === 'PENDING_VERIFICATION') return 'warning'
  return 'default'
}

function shortenAddr(addr: string) {
  if (!addr || addr.length < 10) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function getAvatarUri(profile?: UserProfile | null, fallback?: AuthUser | null) {
  return profile?.avatar_uri || (fallback as { avatar_uri?: string } | null | undefined)?.avatar_uri || ''
}

function getAvatarLabel(profile?: UserProfile | null, fallback?: AuthUser | null) {
  return profile?.full_name || profile?.username || fallback?.full_name || fallback?.username || shortenAddr(fallback?.wallet_address ?? '')
}

function timeAgo(iso?: string) {
  if (!iso) return '—'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Vừa xong'
    if (mins < 60) return `${mins} phút trước`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} giờ trước`
    return `${Math.floor(hrs / 24)} ngày trước`
  } catch { return iso }
}

function isAdmin(roles?: string[]) {
  return (roles ?? []).some((r) => r === 'ADMIN' || r === 'SUPER_ADMIN')
}

// ─── Section: Thông tin hồ sơ ────────────────────────────────────────────────

function AccountSection({ profile, onRefresh }: { profile: UserProfile | null; onRefresh: () => void }) {
  const [form] = Form.useForm()
  const [emailForm] = Form.useForm()
  const [verifyEmailForm] = Form.useForm()
  const [phoneForm] = Form.useForm()
  const [verifyPhoneForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [verifyingEmail, setVerifyingEmail] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [verifyingPhone, setVerifyingPhone] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [deactivateModal, setDeactivateModal] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  useEffect(() => {
    if (profile) {
      form.setFieldsValue({
        class: profile.class ?? '',
        full_name: profile.full_name ?? '',
        username: profile.username ?? '',
        bio: profile.bio ?? '',
        avatar_uri: profile.avatar_uri ?? '',
        country: profile.country ?? '',
        language: profile.language ?? '',
        timezone: profile.timezone ?? '',
      })
    }
  }, [profile, form])

  async function handleSaveProfile(values: {
    class?: string
    full_name?: string; username?: string; bio?: string
    avatar_uri?: string; country?: string; language?: string; timezone?: string
  }) {
    setSaving(true)
    try {
      await updateMyProfile({
        class: values.class?.trim().toUpperCase() || undefined,
        full_name: values.full_name || undefined,
        username: values.username || undefined,
        bio: values.bio || undefined,
        avatar_uri: values.avatar_uri || undefined,
        country: values.country || undefined,
        language: values.language || undefined,
        timezone: values.timezone || undefined,
      })
      antMessage.success('Đã cập nhật hồ sơ!')
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Cập nhật thất bại')
    } finally { setSaving(false) }
  }

  async function handleChangeEmail(values: { email: string }) {
    setSavingEmail(true)
    try {
      await requestEmailChange(values.email)
      antMessage.success('Yêu cầu đổi email đã gửi! Kiểm tra hộp thư.')
      emailForm.resetFields()
      setEmailSent(true)
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể đổi email')
    } finally { setSavingEmail(false) }
  }

  async function handleVerifyEmail(values: { token: string }) {
    setVerifyingEmail(true)
    try {
      await verifyEmail(values.token)
      antMessage.success('Email đã được xác thực thành công!')
      verifyEmailForm.resetFields()
      setEmailSent(false)
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Mã xác thực không hợp lệ')
    } finally { setVerifyingEmail(false) }
  }

  async function handleRequestPhone(values: { phone: string }) {
    setSavingPhone(true)
    try {
      await requestPhoneChange(values.phone)
      antMessage.success('Đã gửi mã OTP đến số điện thoại!')
      phoneForm.resetFields()
      setOtpSent(true)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể gửi OTP')
    } finally { setSavingPhone(false) }
  }

  async function handleVerifyPhone(values: { code: string }) {
    setVerifyingPhone(true)
    try {
      await verifyPhone(values.code)
      antMessage.success('Số điện thoại đã được xác thực!')
      verifyPhoneForm.resetFields()
      setOtpSent(false)
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Mã OTP không hợp lệ')
    } finally { setVerifyingPhone(false) }
  }

  async function handleDeactivate() {
    setDeactivating(true)
    try {
      await deactivateAccount()
      antMessage.success('Tài khoản đã được vô hiệu hóa')
      setDeactivateModal(false)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể vô hiệu hóa tài khoản')
    } finally { setDeactivating(false) }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card
        style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #E0E7FF', boxShadow: '0 12px 32px rgba(15,23,42,0.06)' }}
        styles={{ body: { padding: 0 } }}
      >
        <div style={{ background: 'linear-gradient(135deg,#1E1A5C 0%,#312E81 55%,#4338CA 100%)', padding: '18px 22px', color: '#fff' }}>
          <Space align="center" size={12}>
            <UserOutlined style={{ fontSize: 18 }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Thông tin cơ bản</div>
              <div style={{ fontSize: 12, color: '#C7D2FE' }}>Cập nhật hồ sơ, ảnh đại diện và cấu hình cá nhân</div>
            </div>
          </Space>
        </div>
        <div style={{ padding: 24 }}>
          <Form form={form} layout="vertical" onFinish={handleSaveProfile}>
            {/* <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <Avatar
                size={88}
                src={getAvatarUri(profile)}
                icon={<UserOutlined />}
                style={{ background: '#3B82F6', fontSize: 32, boxShadow: '0 10px 24px rgba(59,130,246,0.24)', border: '4px solid #fff' }}
              />
            </div> */}
            <Row gutter={16}>
              <Col xs={24} sm={12}>
                <Form.Item label="Tên đầy đủ" name="full_name" rules={[{ max: 128 }]}>
                  <Input placeholder="Nguyễn Văn A" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item label="Tên người dùng" name="username"
                  rules={[{ min: 3 }, { max: 32 }, { pattern: /^[a-zA-Z0-9]*$/, message: 'Chỉ chữ cái và chữ số' }]}
                >
                  <Input prefix={<Text type="secondary">@</Text>} placeholder="tenngdung" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item label="Lớp" name="class" rules={[{ max: 64 }]}>
              <Input placeholder="Ví dụ: CNTT-K2024" />
            </Form.Item>
            <Form.Item label="Giới thiệu bản thân" name="bio" rules={[{ max: 500 }]}>
              <Input.TextArea rows={3} placeholder="Một vài điều về bạn..." showCount maxLength={500} />
            </Form.Item>
            <Form.Item label="URL ảnh đại diện" name="avatar_uri"
              rules={[{ type: 'url', message: 'URL không hợp lệ', warningOnly: true }]}
            >
              <Input placeholder="https://..." />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={8}>
                <Form.Item label="Quốc gia (ISO 3166)" name="country">
                  <Input placeholder="VN" maxLength={2} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Ngôn ngữ" name="language">
                  <Select placeholder="Chọn" allowClear options={[
                    { value: 'vi', label: 'Tiếng Việt' }, { value: 'en', label: 'English' },
                    { value: 'zh', label: '中文' }, { value: 'ja', label: '日本語' }, { value: 'ko', label: '한국어' },
                  ]} />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item label="Múi giờ" name="timezone">
                  <Select placeholder="Chọn" allowClear options={[
                    { value: 'Asia/Ho_Chi_Minh', label: 'GMT+7 (Hà Nội)' },
                    { value: 'Asia/Singapore', label: 'GMT+8 (Singapore)' },
                    { value: 'UTC', label: 'UTC' },
                    { value: 'America/New_York', label: 'EST (New York)' },
                  ]} />
                </Form.Item>
              </Col>
            </Row>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />}>Lưu thay đổi</Button>
          </Form>
        </div>
      </Card>

      <Card style={{ borderRadius: 12 }}
        title={<Space><MailOutlined style={{ color: '#3B82F6' }} /><span>Địa chỉ Email</span></Space>}
      >
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Email hiện tại">
            {profile?.email ? (
              <Space>
                <Text>{profile.email}</Text>
                <Tag color={profile.email_verified ? 'success' : 'warning'}
                  icon={profile.email_verified ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                >
                  {profile.email_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                </Tag>
              </Space>
            ) : <Text type="secondary">Chưa cập nhật</Text>}
          </Descriptions.Item>
        </Descriptions>

        {!emailSent ? (
          <Form form={emailForm} layout="vertical" onFinish={handleChangeEmail}>
            <Form.Item label="Email mới" name="email" rules={[{ required: true, type: 'email', message: 'Email không hợp lệ' }]}>
              <Input prefix={<MailOutlined style={{ color: '#9CA3AF' }} />} placeholder="user@example.com" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingEmail} icon={<MailOutlined />}>Yêu cầu đổi email</Button>
          </Form>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="Đã gửi email xác thực. Kiểm tra hộp thư và nhập mã bên dưới." />
            <Form form={verifyEmailForm} layout="vertical" onFinish={handleVerifyEmail}>
              <Form.Item label="Mã xác thực (token từ email)" name="token" rules={[{ required: true }]}>
                <Input prefix={<KeyOutlined style={{ color: '#9CA3AF' }} />} placeholder="Nhập token từ email..." />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={verifyingEmail} icon={<CheckCircleOutlined />}>Xác thực email</Button>
                <Button onClick={() => setEmailSent(false)}>Gửi lại</Button>
              </Space>
            </Form>
          </Space>
        )}
      </Card>

      <Card style={{ borderRadius: 12 }}
        title={<Space><PhoneOutlined style={{ color: '#3B82F6' }} /><span>Số điện thoại</span></Space>}
      >
        <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="SĐT hiện tại">
            {profile?.phone ? (
              <Space>
                <Text>{profile.phone}</Text>
                <Tag color={profile.phone_verified ? 'success' : 'warning'}
                  icon={profile.phone_verified ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                >
                  {profile.phone_verified ? 'Đã xác thực' : 'Chưa xác thực'}
                </Tag>
              </Space>
            ) : <Text type="secondary">Chưa cập nhật</Text>}
          </Descriptions.Item>
        </Descriptions>

        {!otpSent ? (
          <Form form={phoneForm} layout="vertical" onFinish={handleRequestPhone}>
            <Form.Item label="Số điện thoại (chuẩn E.164)" name="phone" help="Ví dụ: +84912345678"
              rules={[{ required: true, pattern: /^\+[1-9]\d{1,14}$/, message: 'Định dạng E.164' }]}
            >
              <Input prefix={<PhoneOutlined style={{ color: '#9CA3AF' }} />} placeholder="+84912345678" />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={savingPhone} icon={<PhoneOutlined />}>Gửi mã OTP</Button>
          </Form>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Alert type="info" showIcon message="Đã gửi mã OTP 6 chữ số đến điện thoại của bạn." />
            <Form form={verifyPhoneForm} layout="vertical" onFinish={handleVerifyPhone}>
              <Form.Item label="Mã OTP (6 chữ số)" name="code"
                rules={[{ required: true, len: 6, message: 'OTP phải đủ 6 chữ số' }]}
              >
                <Input.OTP length={6} />
              </Form.Item>
              <Space>
                <Button type="primary" htmlType="submit" loading={verifyingPhone} icon={<CheckCircleOutlined />}>Xác thực số điện thoại</Button>
                <Button onClick={() => setOtpSent(false)}>Gửi lại</Button>
              </Space>
            </Form>
          </Space>
        )}
      </Card>

      <Card style={{ borderRadius: 12, border: '1px solid #FCA5A5' }}
        title={<Space><WarningOutlined style={{ color: '#EF4444' }} /><span style={{ color: '#EF4444' }}>Vùng nguy hiểm</span></Space>}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Vô hiệu hóa tài khoản sẽ đăng xuất bạn ngay lập tức và đình chỉ quyền truy cập vào tất cả dịch vụ.
            Liên hệ admin để khôi phục.
          </Text>
          <Button danger icon={<DeleteOutlined />} onClick={() => setDeactivateModal(true)}>
            Vô hiệu hóa tài khoản
          </Button>
        </Space>
      </Card>

      <Modal open={deactivateModal} onCancel={() => setDeactivateModal(false)}
        title={<Space><WarningOutlined style={{ color: '#EF4444' }} />Xác nhận vô hiệu hóa tài khoản</Space>}
        footer={null} destroyOnClose width={480}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 8 }}>
          <Alert type="error" showIcon
            message="Hành động không thể hoàn tác ngay!"
            description="Tất cả phiên đăng nhập sẽ bị đóng. Tài khoản sẽ bị tạm khóa cho đến khi admin khôi phục." />
          <Popconfirm title="Bạn chắc chắn muốn vô hiệu hóa?" onConfirm={handleDeactivate}
            okText="Vô hiệu hóa" cancelText="Hủy" okButtonProps={{ danger: true, loading: deactivating }}
          >
            <Button danger type="primary" block size="large" loading={deactivating}>
              Tôi hiểu rủi ro — Vô hiệu hóa tài khoản
            </Button>
          </Popconfirm>
          <Button block onClick={() => setDeactivateModal(false)}>Hủy bỏ</Button>
        </Space>
      </Modal>
    </Space>
  )
}

// ─── Section: Định danh KYC ───────────────────────────────────────────────────

function KYCSection({ profile, onRefresh }: { profile: UserProfile | null; onRefresh: () => void }) {
  const kycLevel = profile?.kyc_level ?? 0

  // Level 1 state
  const [l1Status, setL1Status] = useState<import('../lib/services').KYCLevel1Status | null>(null)
  const [l1Loading, setL1Loading] = useState(false)
  const [l1Submitting, setL1Submitting] = useState(false)

  // Level 2 state
  const [cardUrl, setCardUrl] = useState('')
  const [selfieUrl, setSelfieUrl] = useState('')
  const [cardUploading, setCardUploading] = useState(false)
  const [selfieUploading, setSelfieUploading] = useState(false)
  const [l2Submitting, setL2Submitting] = useState(false)

  useEffect(() => {
    async function fetchL1() {
      setL1Loading(true)
      try {
        const s = await getKYCLevel1Status()
        setL1Status(s)
      } catch { /* ignore */ }
      finally { setL1Loading(false) }
    }
    fetchL1()
  }, [profile])

  async function handleSubmitLevel1() {
    setL1Submitting(true)
    try {
      await submitKYCLevel1()
      antMessage.success('KYC Level 1 đã được xác nhận!')
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Xác nhận KYC Level 1 thất bại')
    } finally { setL1Submitting(false) }
  }

  async function handleUploadCard() {
    const name = `student-card-${Date.now()}.jpg`
    setCardUploading(true)
    try {
      const res = await uploadKYCDocument(name)
      setCardUrl(res.url)
      antMessage.success('Đã nhận URL thẻ sinh viên (demo)')
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Upload thẻ sinh viên thất bại')
    } finally { setCardUploading(false) }
  }

  async function handleUploadSelfie() {
    const name = `selfie-${Date.now()}.jpg`
    setSelfieUploading(true)
    try {
      const res = await uploadKYCDocument(name)
      setSelfieUrl(res.url)
      antMessage.success('Đã nhận URL ảnh selfie (demo)')
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Upload ảnh selfie thất bại')
    } finally { setSelfieUploading(false) }
  }

  async function handleSubmitLevel2() {
    if (!cardUrl || !selfieUrl) {
      antMessage.warning('Vui lòng upload cả thẻ sinh viên và ảnh selfie')
      return
    }
    setL2Submitting(true)
    try {
      await submitKYCLevel2(cardUrl, selfieUrl)
      antMessage.success('Hồ sơ KYC Level 2 đã được gửi. Vui lòng chờ admin xét duyệt.')
      onRefresh()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Gửi KYC Level 2 thất bại')
    } finally { setL2Submitting(false) }
  }

  const reqItem = (label: string, ok: boolean) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      {ok
        ? <CheckCircleOutlined style={{ color: '#10B981', fontSize: 16 }} />
        : <CloseCircleOutlined style={{ color: '#EF4444', fontSize: 16 }} />}
      <Text style={{ color: ok ? '#065F46' : '#B91C1C' }}>{label}</Text>
    </div>
  )

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>

      {/* Current Level Badge */}
      <Card style={{ borderRadius: 12 }}
        title={<Space><IdcardOutlined style={{ color: '#3B82F6' }} /><span>Trạng thái KYC</span></Space>}
      >
        <Row gutter={16}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ textAlign: 'center', background: kycLevel >= 1 ? '#F0FDF4' : '#F8FAFC' }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Cấp độ hiện tại</div>
              <Text strong style={{ fontSize: 22, color: kycLevel >= 1 ? '#059669' : '#9CA3AF' }}>
                Level {kycLevel}
              </Text>
            </Card>
          </Col>
          <Col xs={12} sm={18}>
            <div style={{ paddingLeft: 8 }}>
              <Tag color={kycLevel >= 2 ? 'gold' : kycLevel >= 1 ? 'green' : 'default'} style={{ marginBottom: 6 }}>
                {kycLevel >= 2 ? 'Đã xác minh nâng cao (Level 2)' : kycLevel >= 1 ? 'Đã xác minh cơ bản (Level 1)' : 'Chưa xác minh'}
              </Tag>
              {profile?.kyc_verified_at && (
                <div><Text type="secondary" style={{ fontSize: 12 }}>Xác minh lúc: {new Date(profile.kyc_verified_at).toLocaleString('vi-VN')}</Text></div>
              )}
            </div>
          </Col>
        </Row>
      </Card>

      {/* Level 1 — Auto-approve card */}
      <Card style={{ borderRadius: 12 }}
        title={
          <Space>
            {kycLevel >= 1
              ? <CheckCircleOutlined style={{ color: '#10B981' }} />
              : <IdcardOutlined style={{ color: '#F59E0B' }} />}
            <span>KYC Level 1 — Xác minh cơ bản</span>
            {kycLevel >= 1 && <Tag color="green">Đã hoàn thành</Tag>}
          </Space>
        }
      >
        {l1Loading
          ? <div style={{ textAlign: 'center', padding: 20 }}><Spin /></div>
          : l1Status && (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Level 1 được tự động cấp khi bạn hoàn thành 3 điều kiện sau:
              </Text>
              <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '12px 16px' }}>
                {reqItem('Đã đặt Username (Mã sinh viên)', l1Status.has_username)}
                {reqItem('Email đã được xác thực', l1Status.email_verified)}
                {reqItem('Số điện thoại đã được xác thực', l1Status.phone_verified)}
              </div>
              {l1Status.message && (
                <Alert type={l1Status.ready || kycLevel >= 1 ? 'success' : 'warning'} message={l1Status.message} showIcon />
              )}
              {kycLevel < 1 && (
                <Button
                  type="primary"
                  icon={<CheckCircleOutlined />}
                  loading={l1Submitting}
                  disabled={!l1Status.ready}
                  onClick={handleSubmitLevel1}
                  style={{ marginTop: 8 }}
                >
                  {l1Status.ready ? 'Xác nhận KYC Level 1' : 'Hoàn thành các điều kiện để tiếp tục'}
                </Button>
              )}
            </Space>
          )
        }
      </Card>

      {/* Level 2 — Admin-reviewed card */}
      {kycLevel >= 1 && kycLevel < 2 && (
        <Card style={{ borderRadius: 12 }}
          title={
            <Space>
              <FileProtectOutlined style={{ color: '#8B5CF6' }} />
              <span>KYC Level 2 — Xác minh nâng cao</span>
            </Space>
          }
        >
          <Alert type="info" showIcon style={{ marginBottom: 16 }}
            message="Cần ảnh thẻ sinh viên và ảnh selfie"
            description="Sau khi nộp, admin sẽ xét duyệt trong vòng 1-3 ngày làm việc. Đây là demo — ảnh sẽ không được lưu thật sự." />

          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>1. Ảnh thẻ sinh viên</Text>
              <Space>
                <Button icon={<FileProtectOutlined />} loading={cardUploading} onClick={handleUploadCard}>
                  Upload (Demo)
                </Button>
                {cardUrl && <Text type="success" style={{ fontSize: 12, wordBreak: 'break-all' }}>✓ {cardUrl}</Text>}
              </Space>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>2. Ảnh selfie</Text>
              <Space>
                <Button icon={<IdcardOutlined />} loading={selfieUploading} onClick={handleUploadSelfie}>
                  Upload (Demo)
                </Button>
                {selfieUrl && <Text type="success" style={{ fontSize: 12, wordBreak: 'break-all' }}>✓ {selfieUrl}</Text>}
              </Space>
            </div>
            <Button
              type="primary"
              loading={l2Submitting}
              disabled={!cardUrl || !selfieUrl}
              onClick={handleSubmitLevel2}
              style={{ marginTop: 4 }}
            >
              Nộp hồ sơ KYC Level 2
            </Button>
          </Space>
        </Card>
      )}

      {kycLevel >= 2 && (
        <Alert type="success" showIcon message="KYC Level 2 đã được xác minh"
          description="Tài khoản của bạn đã đạt Level 2. Bạn có đầy đủ quyền truy cập tất cả tính năng." />
      )}
    </Space>
  )
}

// ─── Section: 2FA ─────────────────────────────────────────────────────────────

function TwoFASection() {
  const auth = useAuthContext()
  const [setupOpen, setSetupOpen] = useState(false)
  const [disableModal, setDisableModal] = useState(false)
  const [disableCode, setDisableCode] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [disableError, setDisableError] = useState<string | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [generatingCodes, setGeneratingCodes] = useState(false)
  const [backupModal, setBackupModal] = useState(false)
  const is2FAEnabled = auth.user?.two_factor_enabled ?? false

  async function handleDisable() {
    if (!disableCode) return
    setDisabling(true)
    setDisableError(null)
    try {
      await auth.disable2FA(disableCode)
      antMessage.success('Đã tắt xác thực 2 bước')
      setDisableModal(false)
      setDisableCode('')
    } catch (e) {
      setDisableError(e instanceof Error ? e.message : 'Mã không đúng')
    } finally { setDisabling(false) }
  }

  async function handleGenerateBackupCodes() {
    setGeneratingCodes(true)
    try {
      const result = await generateBackupCodes()
      setBackupCodes(result.backup_codes)
      setBackupModal(true)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể tạo mã backup')
    } finally { setGeneratingCodes(false) }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card style={{ borderRadius: 12 }}>
        <Row align="middle" wrap={false} gutter={16}>
          <Col>
            <div style={{
              width: 56, height: 56, borderRadius: 12,
              background: is2FAEnabled ? '#F0FDF4' : '#F8FAFC',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <SafetyCertificateOutlined style={{ fontSize: 28, color: is2FAEnabled ? '#10B981' : '#94A3B8' }} />
            </div>
          </Col>
          <Col flex={1}>
            <Title level={5} style={{ margin: 0 }}>Xác thực 2 bước (TOTP)</Title>
            <Text type="secondary" style={{ fontSize: 13 }}>
              {is2FAEnabled ? 'Tài khoản đang được bảo vệ bởi Google Authenticator / TOTP' : 'Bật 2FA để tăng cường bảo mật'}
            </Text>
          </Col>
          <Col>
            <Tag color={is2FAEnabled ? 'success' : 'default'} style={{ fontSize: 13, padding: '4px 12px' }}>
              {is2FAEnabled ? '✓ Đã bật' : 'Chưa bật'}
            </Tag>
          </Col>
        </Row>
      </Card>

      {!is2FAEnabled ? (
        <Card style={{ borderRadius: 12, background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Space direction="vertical" size={12}>
            <Alert type="info" showIcon message="Nên kích hoạt 2FA"
              description="Xác thực 2 bước bảo vệ tài khoản ngay cả khi ví bị lộ." />
            <Button type="primary" size="large" icon={<SafetyCertificateOutlined />} onClick={() => setSetupOpen(true)}>
              Bật xác thực 2 bước
            </Button>
          </Space>
        </Card>
      ) : (
        <Card style={{ borderRadius: 12 }}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Alert type="success" showIcon message="2FA đang hoạt động"
              description="Mỗi lần đăng nhập sẽ yêu cầu mã TOTP 6 chữ số từ ứng dụng xác thực." />
            <Row gutter={12}>
              <Col>
                <Button icon={<SafetyOutlined />} loading={generatingCodes} onClick={handleGenerateBackupCodes}>
                  Tạo mã backup mới
                </Button>
              </Col>
              <Col>
                <Button danger icon={<WarningOutlined />} onClick={() => setDisableModal(true)}>
                  Tắt xác thực 2 bước
                </Button>
              </Col>
            </Row>
          </Space>
        </Card>
      )}

      <TwoFASetupModal open={setupOpen} onClose={() => setSetupOpen(false)}
        onSetup={async () => {
          const data = await auth.setup2FA()
          return data as { secret: string; otp_auth_uri: string; backup_codes: string[] }
        }}
        onEnable={auth.enable2FA}
      />

      {/* Disable 2FA Modal */}
      <Modal open={disableModal} onCancel={() => { setDisableModal(false); setDisableCode(''); setDisableError(null) }}
        title={<Space><WarningOutlined style={{ color: '#EF4444' }} />Tắt xác thực 2 bước</Space>}
        footer={null} destroyOnClose width={480}
      >
        <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 8 }}>
          <Alert type="warning" showIcon message="Hành động này làm giảm bảo mật tài khoản!" />
          {disableError && <Alert type="error" message={disableError} />}
          <Form onFinish={handleDisable} layout="vertical">
            <Form.Item label="Nhập mã TOTP hoặc mã backup để xác nhận">
              <Input prefix={<KeyOutlined style={{ color: '#9CA3AF' }} />}
                value={disableCode} onChange={(e) => setDisableCode(e.target.value)}
                placeholder="6 chữ số hoặc mã backup" autoFocus />
            </Form.Item>
            <Button danger type="primary" block size="large" htmlType="submit" loading={disabling} disabled={!disableCode}>
              Xác nhận tắt 2FA
            </Button>
          </Form>
        </Space>
      </Modal>

      {/* Backup Codes Modal */}
      <Modal open={backupModal} onCancel={() => setBackupModal(false)}
        title={<Space><SafetyOutlined />Mã backup mới của bạn</Space>}
        footer={<Button type="primary" onClick={() => setBackupModal(false)}>Đã lưu lại — Đóng</Button>}
        width={480}
      >
        <Alert type="warning" showIcon style={{ marginBottom: 16 }}
          message="Lưu mã backup này ngay bây giờ!"
          description="Mỗi mã chỉ dùng được một lần. Khi tạo bộ mã mới, bộ cũ sẽ bị vô hiệu hóa." />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {backupCodes.map((code) => (
            <div key={code} style={{
              fontFamily: 'monospace', fontSize: 14, padding: '8px 12px',
              background: '#F1F5F9', borderRadius: 6, letterSpacing: 2,
              textAlign: 'center', fontWeight: 600,
            }}>
              {code}
            </div>
          ))}
        </div>
        <Button block style={{ marginTop: 12 }} icon={<CopyOutlined />}
          onClick={() => { void navigator.clipboard.writeText(backupCodes.join('\n')); antMessage.success('Đã copy tất cả mã!') }}>
          Copy tất cả
        </Button>
      </Modal>
    </Space>
  )
}

// ─── Section: Phiên đăng nhập ─────────────────────────────────────────────────

function SessionsSection() {
  const auth = useAuthContext()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try { setSessions((await auth.fetchSessions()) ?? []) }
    catch { setSessions([]) }
    finally { setLoading(false) }
  }, [auth])

  useEffect(() => { void load() }, [load])

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card style={{ borderRadius: 12 }}
        title={<Space><KeyOutlined style={{ color: '#3B82F6' }} /><span>Phiên đăng nhập đang hoạt động</span></Space>}
        extra={<Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">Làm mới</Button>}
      >
        {sessions.length === 0 && !loading ? (
          <Alert type="info" showIcon message="Không tìm thấy phiên đăng nhập nào"
            description="Thông tin phiên sẽ hiển thị sau khi đăng nhập." />
        ) : (
          <SessionsTable sessions={sessions} loading={loading}
            onRevoke={async (id) => {
              await auth.revokeSession(id)
              setSessions((s) => s.filter((sess) => sess.id !== id))
            }}
          />
        )}
      </Card>
      <Popconfirm title="Đăng xuất tất cả thiết bị?"
        description="Tất cả phiên sẽ bị kết thúc, bao gồm phiên hiện tại."
        onConfirm={auth.logoutAll} okText="Đăng xuất tất cả" cancelText="Hủy" okButtonProps={{ danger: true }}
      >
        <Button danger icon={<LogoutOutlined />}>Đăng xuất tất cả thiết bị</Button>
      </Popconfirm>
    </Space>
  )
}

// ─── Section: Thông báo & Quyền riêng tư ─────────────────────────────────────

function PreferencesSection() {
  const [prefs, setPrefs] = useState<UserPreferences | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    getPreferences().then(setPrefs).catch(() => {}).finally(() => setLoading(false))
  }, [])

  async function toggle(key: keyof Omit<UserPreferences, 'updated_at'>, val: boolean) {
    if (!prefs) return
    setSaving(true)
    try {
      setPrefs(await updatePreferences({ [key]: val }))
      antMessage.success('Đã cập nhật cài đặt')
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Cập nhật thất bại')
    } finally { setSaving(false) }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  if (!prefs) return <Alert type="warning" showIcon message="Không thể tải cài đặt" />

  const notifyItems: { key: keyof Omit<UserPreferences, 'updated_at'>; label: string; desc: string }[] = [
    { key: 'notify_login', label: 'Đăng nhập mới', desc: 'Cảnh báo khi có đăng nhập từ thiết bị lạ' },
    { key: 'notify_kyc', label: 'Cập nhật KYC', desc: 'Thông báo khi trạng thái KYC thay đổi' },
    { key: 'notify_transfer', label: 'Giao dịch token', desc: 'Thông báo khi có giao dịch VNDC token' },
    { key: 'notify_reward', label: 'Phần thưởng', desc: 'Thông báo khi nhận điểm hoặc phần thưởng' },
    { key: 'notify_marketing', label: 'Marketing', desc: 'Thông tin sự kiện, khuyến mãi từ VNDC' },
  ]
  const privacyItems: { key: keyof Omit<UserPreferences, 'updated_at'>; label: string; desc: string }[] = [
    { key: 'profile_public', label: 'Hồ sơ công khai', desc: 'Cho phép người dùng khác xem thông tin hồ sơ' },
    { key: 'show_login_stats', label: 'Thống kê đăng nhập', desc: 'Hiển thị thời gian và số lần đăng nhập gần đây' },
  ]

  const renderToggles = (items: typeof notifyItems) =>
    items.map(({ key, label, desc }) => (
      <Row key={key} justify="space-between" align="middle"
        style={{ padding: '12px 0', borderBottom: '1px solid #F1F5F9' }}>
        <Col><Text strong style={{ display: 'block' }}>{label}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>{desc}</Text></Col>
        <Col><Switch checked={prefs[key] as boolean} onChange={(val) => toggle(key, val)} disabled={saving} /></Col>
      </Row>
    ))

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card style={{ borderRadius: 12 }}
        title={<Space><BellOutlined style={{ color: '#3B82F6' }} />Thông báo{saving && <Spin size="small" />}</Space>}
      >
        {renderToggles(notifyItems)}
      </Card>
      <Card style={{ borderRadius: 12 }}
        title={<Space><LockOutlined style={{ color: '#3B82F6' }} />Quyền riêng tư</Space>}
      >
        {renderToggles(privacyItems)}
      </Card>
      {prefs.updated_at && (
        <Text type="secondary" style={{ fontSize: 12 }}>
          Cập nhật lần cuối: {new Date(prefs.updated_at).toLocaleString('vi-VN')}
        </Text>
      )}
    </Space>
  )
}

// ─── Section: Giới thiệu bạn bè ──────────────────────────────────────────────

function ReferralSection() {
  const [info, setInfo] = useState<ReferralInfo | null>(null)
  const [referrals, setReferrals] = useState<ReferralRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getReferralInfo().catch(() => null),
      listReferrals().catch(() => ({ referrals: [], total: 0 })),
    ]).then(([infoData, listData]) => {
      setInfo(infoData)
      setReferrals(listData?.referrals ?? [])
    }).finally(() => setLoading(false))
  }, [])

  const refColumns: ColumnsType<ReferralRecord> = [
    {
      title: 'Địa chỉ ví', dataIndex: 'wallet_address',
      render: (v: string) => (
        <Space>
          <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{shortenAddr(v)}</Text>
          <Tooltip title="Copy"><Button type="text" size="small" icon={<CopyOutlined />}
            onClick={() => { void navigator.clipboard.writeText(v); antMessage.success('Đã copy!') }} /></Tooltip>
        </Space>
      ),
    },
    { title: 'Ngày tham gia', dataIndex: 'joined_at', render: (v: string) => new Date(v).toLocaleDateString('vi-VN') },
    { title: 'Trạng thái', dataIndex: 'status', render: (v: string) => <Tag color={v === 'ACTIVE' ? 'success' : 'default'}>{v}</Tag> },
  ]

  if (loading) return <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
  if (!info) return <Alert type="info" showIcon message="Chương trình giới thiệu chưa được kích hoạt"
    description="Tính năng này sẽ mở sau khi hoàn thành xác thực KYC." />

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg,#EFF6FF,#DBEAFE)', border: 'none' }}>
            <Statistic title={<Text style={{ color: '#1D4ED8', fontSize: 13 }}>Mã giới thiệu</Text>}
              value={info.referral_code}
              valueStyle={{ fontFamily: 'monospace', fontSize: 20, color: '#1D4ED8', letterSpacing: 2 }}
              suffix={<Tooltip title="Copy mã"><Button type="text" size="small" icon={<CopyOutlined />} style={{ color: '#1D4ED8' }}
                onClick={() => { void navigator.clipboard.writeText(info.referral_code); antMessage.success('Đã copy!') }} /></Tooltip>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg,#F0FDF4,#DCFCE7)', border: 'none' }}>
            <Statistic title={<Text style={{ color: '#15803D', fontSize: 13 }}>Người được giới thiệu</Text>}
              value={info.referred_count} valueStyle={{ color: '#15803D' }} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={{ borderRadius: 12, background: 'linear-gradient(135deg,#FFFBEB,#FEF3C7)', border: 'none' }}>
            <Statistic title={<Text style={{ color: '#B45309', fontSize: 13 }}>Phần thưởng VNDC</Text>}
              value={info.referral_reward} precision={2} valueStyle={{ color: '#B45309' }} prefix={<TrophyOutlined />} />
          </Card>
        </Col>
      </Row>
      {info.referred_by && <Alert type="info" showIcon message={`Bạn được giới thiệu bởi: ${shortenAddr(info.referred_by)}`} />}
      <Card style={{ borderRadius: 12 }}
        title={<Space><TeamOutlined style={{ color: '#3B82F6' }} />Danh sách người được giới thiệu</Space>}
      >
        <Table dataSource={referrals} columns={refColumns} rowKey="wallet_address" size="small"
          pagination={{ pageSize: 10 }} locale={{ emptyText: 'Chưa có người nào được giới thiệu' }} />
      </Card>
    </Space>
  )
}

// ─── Section: Nhật ký bảo mật ────────────────────────────────────────────────

const AUDIT_EVENT_LABELS: Record<string, { label: string; color: string }> = {
  AUTH_LOGIN: { label: 'Đăng nhập', color: 'blue' },
  AUTH_LOGOUT: { label: 'Đăng xuất', color: 'default' },
  AUTH_TOKEN_REFRESH: { label: 'Gia hạn token', color: 'cyan' },
  AUTH_SESSION_REVOKED: { label: 'Thu hồi phiên', color: 'error' },
  TWO_FA_ENABLED: { label: 'Bật 2FA', color: 'success' },
  TWO_FA_DISABLED: { label: 'Tắt 2FA', color: 'warning' },
  TWO_FA_VERIFIED: { label: 'Xác thực 2FA', color: 'green' },
  TWO_FA_FAILED: { label: 'Sai mã 2FA', color: 'red' },
  PROFILE_UPDATED: { label: 'Cập nhật hồ sơ', color: 'purple' },
  EMAIL_CHANGED: { label: 'Đổi email', color: 'orange' },
  EMAIL_VERIFIED: { label: 'Xác thực email', color: 'green' },
  KYC_SUBMITTED: { label: 'Nộp KYC', color: 'geekblue' },
  KYC_APPROVED: { label: 'Duyệt KYC', color: 'success' },
  KYC_REJECTED: { label: 'Từ chối KYC', color: 'error' },
  PREFERENCES_UPDATED: { label: 'Đổi cài đặt', color: 'cyan' },
  PHONE_VERIFICATION_REQUESTED: { label: 'Xác thực SĐT', color: 'purple' },
  PHONE_VERIFIED: { label: 'Xác nhận SĐT', color: 'green' },
  BACKUP_CODES_GENERATED: { label: 'Tạo mã backup', color: 'geekblue' },
  ACCOUNT_DEACTIVATED: { label: 'Vô hiệu hóa TK', color: 'red' },
}

function AuditSection() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const data = await getAuditLogs(p, 15)
      setLogs(data?.items ?? [])
      setTotal(data?.total ?? 0)
    } catch { setLogs([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const logColumns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Sự kiện', dataIndex: 'event_type', width: 160,
      render: (v: string) => {
        const cfg = AUDIT_EVENT_LABELS[v] ?? { label: v, color: 'default' }
        return <Tag color={cfg.color}>{cfg.label}</Tag>
      },
    },
    {
      title: 'Địa chỉ IP', dataIndex: 'ip_address', width: 130,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12, color: '#6B7280' }}>{v || '—'}</Text>,
    },
    {
      title: 'Chi tiết', dataIndex: 'details',
      render: (v: Record<string, unknown> | undefined) => {
        if (!v || Object.keys(v).length === 0) return null
        const text = Object.entries(v).map(([k, val]) => `${k}: ${val}`).join(', ')
        return <Tooltip title={text}><Text type="secondary" style={{ fontSize: 12 }} ellipsis>{text}</Text></Tooltip>
      },
    },
    {
      title: 'Thời gian', dataIndex: 'occurred_at', width: 140,
      render: (v: string) => (
        <Tooltip title={new Date(v).toLocaleString('vi-VN')}>
          <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{timeAgo(v)}</Text>
        </Tooltip>
      ),
    },
  ]

  return (
    <Card style={{ borderRadius: 12 }}
      title={<Space><HistoryOutlined style={{ color: '#3B82F6' }} />Nhật ký bảo mật</Space>}
      extra={<Button icon={<ReloadOutlined />} onClick={() => { setPage(1); void load(1) }} loading={loading} size="small">Làm mới</Button>}
    >
      {logs.length === 0 && !loading ? (
        <Alert type="info" showIcon message="Chưa có nhật ký bảo mật"
          description="Các hành động bảo mật (đăng nhập, đổi 2FA, cập nhật hồ sơ...) sẽ được ghi lại ở đây." />
      ) : (
        <Table dataSource={logs} columns={logColumns} rowKey="id" loading={loading} size="small" scroll={{ x: 600 }}
          pagination={{ current: page, total, pageSize: 15, onChange: (p) => { setPage(p); void load(p) }, showTotal: (t) => `${t} sự kiện` }}
        />
      )}
    </Card>
  )
}

// ─── Section: Admin Dashboard ─────────────────────────────────────────────────

function AdminSection() {
  const [users, setUsers] = useState<UserProfile[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string | undefined>()
  const [filterKYC, setFilterKYC] = useState<string | undefined>()
  const [filterRole, setFilterRole] = useState<string | undefined>()
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [userDetailOpen, setUserDetailOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [suspendModal, setSuspendModal] = useState(false)
  const [suspendReason, setSuspendReason] = useState('')
  const [assignRoleModal, setAssignRoleModal] = useState(false)
  const [kycApproveModal, setKYCApproveModal] = useState(false)
  const [kycLevel, setKycLevel] = useState(1)
  const [roleToAdd, setRoleToAdd] = useState('USER')

  // KYC submissions state
  const [kycSubs, setKycSubs] = useState<KYCSubmission[]>([])
  const [kycSubsTotal, setKycSubsTotal] = useState(0)
  const [kycSubsLoading, setKycSubsLoading] = useState(false)
  const [kycSubsStatus, setKycSubsStatus] = useState('PENDING')
  const [reviewModal, setReviewModal] = useState<{ id: string; approve: boolean } | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewLoading, setReviewLoading] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const result = await adminListUsers({
        page: p, page_size: 20,
        search: search || undefined,
        status: filterStatus,
        kyc_status: filterKYC,
        role: filterRole,
      })
      setUsers(result.items)
      setTotal(result.total)
    } catch { setUsers([]) }
    finally { setLoading(false) }
  }, [search, filterStatus, filterKYC, filterRole])

  const loadKYCSubs = useCallback(async () => {
    setKycSubsLoading(true)
    try {
      const result = await adminListKYCSubmissions({ status: kycSubsStatus, page: 1, page_size: 50 })
      setKycSubs(result.items ?? [])
      setKycSubsTotal(result.total ?? 0)
    } catch { setKycSubs([]) }
    finally { setKycSubsLoading(false) }
  }, [kycSubsStatus])

  useEffect(() => { void load() }, [load])
  useEffect(() => { void loadKYCSubs() }, [loadKYCSubs])

  async function openUserDetail(id: string) {
    try {
      const u = await adminGetUser(id)
      setSelectedUser(u)
      setUserDetailOpen(true)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Không thể tải thông tin')
    }
  }

  async function handleSuspend() {
    if (!selectedUser || !suspendReason) return
    setActionLoading(true)
    try {
      await adminSuspendUser(selectedUser.id, suspendReason)
      antMessage.success('Đã đình chỉ tài khoản')
      setSuspendModal(false)
      setSuspendReason('')
      void load(page)
      void openUserDetail(selectedUser.id)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally { setActionLoading(false) }
  }

  async function handleUnsuspend() {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      await adminUnsuspendUser(selectedUser.id)
      antMessage.success('Đã khôi phục tài khoản')
      void load(page)
      void openUserDetail(selectedUser.id)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally { setActionLoading(false) }
  }

  async function handleAssignRole() {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      await adminAssignRole(selectedUser.id, roleToAdd)
      antMessage.success(`Đã gán role ${roleToAdd}`)
      setAssignRoleModal(false)
      void openUserDetail(selectedUser.id)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally { setActionLoading(false) }
  }

  async function handleRemoveRole(role: string) {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      await adminRemoveRole(selectedUser.id, role)
      antMessage.success(`Đã xóa role ${role}`)
      void openUserDetail(selectedUser.id)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally { setActionLoading(false) }
  }

  async function handleApproveKYC() {
    if (!selectedUser) return
    setActionLoading(true)
    try {
      await adminApproveKYC(selectedUser.id, kycLevel)
      antMessage.success(`Đã duyệt KYC Level ${kycLevel}`)
      setKYCApproveModal(false)
      void load(page)
      void openUserDetail(selectedUser.id)
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally { setActionLoading(false) }
  }

  async function handleReviewKYCSub(approve: boolean) {
    if (!reviewModal) return
    setReviewLoading(true)
    try {
      await adminReviewKYCSubmission(reviewModal.id, approve, reviewNote || undefined)
      antMessage.success(approve ? 'Đã duyệt hồ sơ KYC Level 2' : 'Đã từ chối hồ sơ KYC Level 2')
      setReviewModal(null)
      setReviewNote('')
      void loadKYCSubs()
    } catch (e) {
      antMessage.error(e instanceof Error ? e.message : 'Xét duyệt thất bại')
    } finally { setReviewLoading(false) }
  }

  const columns: ColumnsType<UserProfile> = [
    {
      title: 'Người dùng', key: 'user',
      render: (_, u) => (
        <Space>
          <Avatar size={32} src={u.avatar_uri} icon={<UserOutlined />} style={{ background: '#3B82F6', flexShrink: 0 }} />
          <div>
            <Text strong style={{ display: 'block', fontSize: 13 }}>{u.full_name || u.username || '—'}</Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#9CA3AF' }}>{shortenAddr(u.wallet_address)}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Email', dataIndex: 'email', width: 200,
      render: (v: string, u) => v ? (
        <Space direction="vertical" size={0}>
          <Text style={{ fontSize: 12 }}>{v}</Text>
          <Tag color={u.email_verified ? 'success' : 'warning'} style={{ fontSize: 10 }}>
            {u.email_verified ? 'Xác thực' : 'Chưa'}
          </Tag>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'KYC', key: 'kyc', width: 110,
      render: (_, u) => (
        <Space direction="vertical" size={2}>
          <Tag color={kycColor(u.kyc_status)}>{u.kyc_status}</Tag>
          <Text style={{ fontSize: 11, color: '#9CA3AF' }}>Lv.{u.kyc_level}</Text>
        </Space>
      ),
    },
    {
      title: 'Trạng thái', dataIndex: 'status', width: 110,
      render: (v: string) => <Tag color={statusColor(v)}>{v}</Tag>,
    },
    {
      title: 'Roles', dataIndex: 'roles', width: 140,
      render: (v: string[]) => (v ?? []).map((r) => <Tag key={r} color={roleColor(r)} style={{ marginBottom: 2 }}>{r}</Tag>),
    },
    {
      title: 'Đăng ký', dataIndex: 'created_at', width: 100,
      render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
    },
    {
      title: 'Hành động', key: 'actions', width: 90, fixed: 'right',
      render: (_, u) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openUserDetail(u.id)}>Chi tiết</Button>
      ),
    },
  ]

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      {/* Admin warning */}
      <Alert type="warning" showIcon
        message="Khu vực quản trị viên"
        description="Các thao tác tại đây ảnh hưởng trực tiếp đến tài khoản người dùng. Thực hiện cẩn thận." />

      {/* Stats */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ borderRadius: 10, textAlign: 'center', background: '#EFF6FF' }}>
            <Statistic title="Tổng người dùng" value={total} valueStyle={{ color: '#1D4ED8', fontSize: 22 }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ borderRadius: 12 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex={1}>
            <Input prefix={<SearchOutlined />} placeholder="Tìm kiếm ví, email, username..."
              value={search} onChange={(e) => setSearch(e.target.value)}
              onPressEnter={() => { setPage(1); void load(1) }}
              allowClear onClear={() => { setSearch(''); setPage(1) }}
            />
          </Col>
          <Col>
            <Select placeholder="Trạng thái" allowClear style={{ width: 160 }}
              value={filterStatus} onChange={(v) => { setFilterStatus(v); setPage(1) }}
              options={[
                { value: 'ACTIVE', label: 'ACTIVE' },
                { value: 'SUSPENDED', label: 'SUSPENDED' },
                { value: 'PENDING_VERIFICATION', label: 'PENDING' },
                { value: 'BANNED', label: 'BANNED' },
              ]}
            />
          </Col>
          <Col>
            <Select placeholder="KYC" allowClear style={{ width: 130 }}
              value={filterKYC} onChange={(v) => { setFilterKYC(v); setPage(1) }}
              options={[
                { value: 'NONE', label: 'NONE' }, { value: 'PENDING', label: 'PENDING' },
                { value: 'VERIFIED', label: 'VERIFIED' }, { value: 'REJECTED', label: 'REJECTED' },
              ]}
            />
          </Col>
          <Col>
            <Select placeholder="Role" allowClear style={{ width: 120 }}
              value={filterRole} onChange={(v) => { setFilterRole(v); setPage(1) }}
              options={[
                { value: 'USER', label: 'USER' }, { value: 'MODERATOR', label: 'MODERATOR' },
                { value: 'ADMIN', label: 'ADMIN' },
              ]}
            />
          </Col>
          <Col>
            <Button icon={<SearchOutlined />} type="primary" onClick={() => { setPage(1); void load(1) }}>Tìm</Button>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={() => { setPage(1); void load(1) }} loading={loading}>Làm mới</Button>
          </Col>
        </Row>
      </Card>

      {/* User Table */}
      <Card style={{ borderRadius: 12 }}>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          size="small"
          scroll={{ x: 900 }}
          pagination={{
            current: page, total, pageSize: 20,
            onChange: (p) => { setPage(p); void load(p) },
            showTotal: (t) => `${t} người dùng`,
          }}
        />
      </Card>

      {/* KYC Level 2 Submissions */}
      <Card style={{ borderRadius: 12 }}
        title={
          <Space>
            <FileProtectOutlined style={{ color: '#8B5CF6' }} />
            <span>Xét duyệt KYC Level 2</span>
            <Tag color="purple">{kycSubsTotal} hồ sơ</Tag>
          </Space>
        }
        extra={
          <Space>
            <Select value={kycSubsStatus} onChange={setKycSubsStatus} style={{ width: 130 }}
              options={[
                { value: 'PENDING', label: 'Chờ duyệt' },
                { value: 'APPROVED', label: 'Đã duyệt' },
                { value: 'REJECTED', label: 'Đã từ chối' },
              ]}
            />
            <Button icon={<ReloadOutlined />} onClick={() => void loadKYCSubs()} loading={kycSubsLoading} size="small" />
          </Space>
        }
      >
        <Table<KYCSubmission>
          dataSource={kycSubs}
          rowKey="id"
          size="small"
          loading={kycSubsLoading}
          pagination={false}
          locale={{ emptyText: 'Không có hồ sơ nào' }}
          columns={[
            {
              title: 'ID Hồ sơ', dataIndex: 'id', width: 120,
              render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}...</Text>,
            },
            {
              title: 'User ID', dataIndex: 'user_id', width: 120,
              render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 11 }}>{v.slice(0, 10)}...</Text>,
            },
            {
              title: 'Thẻ sinh viên', dataIndex: 'student_card_url',
              render: (v: string) => v ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>Xem ảnh</a> : '—',
            },
            {
              title: 'Selfie', dataIndex: 'selfie_url',
              render: (v: string) => v ? <a href={v} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>Xem ảnh</a> : '—',
            },
            {
              title: 'Trạng thái', dataIndex: 'status', width: 100,
              render: (v: string) => <Tag color={v === 'APPROVED' ? 'success' : v === 'REJECTED' ? 'error' : 'gold'}>{v}</Tag>,
            },
            {
              title: 'Ngày nộp', dataIndex: 'created_at', width: 110,
              render: (v: string) => v ? new Date(v).toLocaleDateString('vi-VN') : '—',
            },
            {
              title: 'Hành động', key: 'actions', width: 180, fixed: 'right',
              render: (_, sub) => sub.status === 'PENDING' ? (
                <Space size={4}>
                  <Button size="small" type="primary" icon={<CheckSquareOutlined />}
                    onClick={() => { setReviewModal({ id: sub.id, approve: true }) }}>
                    Duyệt
                  </Button>
                  <Button size="small" danger icon={<StopOutlined />}
                    onClick={() => { setReviewModal({ id: sub.id, approve: false }) }}>
                    Từ chối
                  </Button>
                </Space>
              ) : <Text type="secondary" style={{ fontSize: 12 }}>{sub.reviewed_by ? `By: ${sub.reviewed_by.slice(0, 8)}` : '—'}</Text>,
            },
          ]}
        />
      </Card>

      {/* Review KYC Submission Modal */}
      <Modal
        open={!!reviewModal}
        onCancel={() => { setReviewModal(null); setReviewNote('') }}
        title={
          <Space>
            {reviewModal?.approve
              ? <CheckSquareOutlined style={{ color: '#10B981' }} />
              : <StopOutlined style={{ color: '#EF4444' }} />}
            {reviewModal?.approve ? 'Duyệt hồ sơ KYC Level 2' : 'Từ chối hồ sơ KYC Level 2'}
          </Space>
        }
        footer={null} destroyOnClose width={460}
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          <Alert
            type={reviewModal?.approve ? 'success' : 'warning'} showIcon
            message={reviewModal?.approve
              ? 'Người dùng sẽ được nâng lên KYC Level 2 và có thể truy cập đầy đủ tính năng.'
              : 'Hồ sơ sẽ bị từ chối. Người dùng có thể nộp lại hồ sơ mới.'}
          />
          <Form.Item label="Ghi chú (tùy chọn)">
            <Input.TextArea rows={3} value={reviewNote} onChange={(e) => setReviewNote(e.target.value)}
              placeholder="Lý do duyệt/từ chối..." maxLength={500} showCount />
          </Form.Item>
          <Button
            type="primary" danger={!reviewModal?.approve} block
            loading={reviewLoading}
            onClick={() => reviewModal && handleReviewKYCSub(reviewModal.approve)}
          >
            {reviewModal?.approve ? 'Xác nhận duyệt' : 'Xác nhận từ chối'}
          </Button>
        </Space>
      </Modal>


      <Modal
        open={userDetailOpen}
        onCancel={() => { setUserDetailOpen(false); setSelectedUser(null) }}
        title={
          <Space>
            <Avatar size={32} src={selectedUser?.avatar_uri} icon={<UserOutlined />} style={{ background: '#3B82F6' }} />
            <div>
              <div>{selectedUser?.full_name || selectedUser?.username || shortenAddr(selectedUser?.wallet_address ?? '')}</div>
              <Text type="secondary" style={{ fontSize: 11, fontWeight: 400 }}>{selectedUser?.id}</Text>
            </div>
          </Space>
        }
        footer={null}
        width={680}
        destroyOnClose
      >
        {selectedUser && (
          <Space direction="vertical" size={16} style={{ width: '100%', paddingTop: 8 }}>
            {/* Info */}
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="Địa chỉ ví" span={2}>
                <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{selectedUser.wallet_address}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Email">
                {selectedUser.email ?? '—'}
                {selectedUser.email && <Tag color={selectedUser.email_verified ? 'success' : 'warning'} style={{ marginLeft: 6 }}>
                  {selectedUser.email_verified ? 'Xác thực' : 'Chưa'}
                </Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái TK">
                <Badge color={statusColor(selectedUser.status) === 'success' ? 'green' : 'red'}
                  text={<Tag color={statusColor(selectedUser.status)}>{selectedUser.status}</Tag>} />
              </Descriptions.Item>
              <Descriptions.Item label="KYC Status">
                <Tag color={kycColor(selectedUser.kyc_status)}>{selectedUser.kyc_status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="KYC Level">
                <Text strong>Level {selectedUser.kyc_level}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="2FA">
                <Tag color={selectedUser.two_factor_enabled ? 'success' : 'default'}>
                  {selectedUser.two_factor_enabled ? 'Bật' : 'Tắt'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Đăng nhập">
                {selectedUser.login_count ?? 0} lần
              </Descriptions.Item>
            </Descriptions>

            {/* Roles */}
            <Card size="small" title="Roles" style={{ borderRadius: 8 }} extra={
              <Button size="small" icon={<PlusCircleOutlined />} onClick={() => setAssignRoleModal(true)}>Thêm role</Button>
            }>
              <Space wrap>
                {(selectedUser.roles ?? []).map((r) => (
                  <Tag key={r} color={roleColor(r)} closable={r !== 'USER'}
                    onClose={() => handleRemoveRole(r)}
                  >
                    {r}
                  </Tag>
                ))}
                {(selectedUser.roles ?? []).length === 0 && <Text type="secondary">Không có role</Text>}
              </Space>
            </Card>

            {/* KYC Actions */}
            {selectedUser.kyc_status === 'PENDING' && (
              <Card size="small" title="Duyệt KYC" style={{ borderRadius: 8, background: '#F0FDF4' }}>
                <Space>
                  <Text>Cấp độ KYC:</Text>
                  <Segmented value={kycLevel} onChange={(v) => setKycLevel(Number(v))}
                    options={[{ value: 1, label: 'Level 1' }, { value: 2, label: 'Level 2' }, { value: 3, label: 'Level 3' }]} />
                  <Button type="primary" icon={<CheckSquareOutlined />} loading={actionLoading}
                    onClick={() => setKYCApproveModal(true)}>
                    Duyệt KYC
                  </Button>
                </Space>
              </Card>
            )}

            {/* Account Actions */}
            <Card size="small" title="Hành động tài khoản" style={{ borderRadius: 8 }}>
              <Space wrap>
                {selectedUser.status === 'ACTIVE' || selectedUser.status === 'PENDING_VERIFICATION' ? (
                  <Button danger icon={<StopOutlined />} onClick={() => setSuspendModal(true)}>Đình chỉ tài khoản</Button>
                ) : selectedUser.status === 'SUSPENDED' ? (
                  <Popconfirm title="Khôi phục tài khoản này?" onConfirm={handleUnsuspend}
                    okText="Khôi phục" cancelText="Hủy">
                    <Button icon={<CheckCircleOutlined />} style={{ color: '#10B981', borderColor: '#10B981' }} loading={actionLoading}>
                      Khôi phục tài khoản
                    </Button>
                  </Popconfirm>
                ) : null}
              </Space>
            </Card>
          </Space>
        )}
      </Modal>

      {/* Suspend Modal */}
      <Modal open={suspendModal} onCancel={() => { setSuspendModal(false); setSuspendReason('') }}
        title={<Space><StopOutlined style={{ color: '#EF4444' }} />Đình chỉ tài khoản</Space>}
        footer={null} destroyOnClose width={460}
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          <Alert type="warning" showIcon message="Người dùng sẽ bị đăng xuất ngay lập tức và không thể đăng nhập." />
          <Form.Item label="Lý do đình chỉ (10–500 ký tự)" required>
            <Input.TextArea rows={4} value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Nhập lý do chi tiết..." minLength={10} maxLength={500} showCount />
          </Form.Item>
          <Button danger type="primary" block loading={actionLoading}
            disabled={suspendReason.length < 10} onClick={handleSuspend}>
            Xác nhận đình chỉ
          </Button>
        </Space>
      </Modal>

      {/* Assign Role Modal */}
      <Modal open={assignRoleModal} onCancel={() => setAssignRoleModal(false)}
        title="Gán role cho người dùng" footer={null} destroyOnClose width={400}
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          <Select value={roleToAdd} onChange={setRoleToAdd} style={{ width: '100%' }}
            options={[
              { value: 'USER', label: 'USER' },
              { value: 'MODERATOR', label: 'MODERATOR' },
              { value: 'ADMIN', label: 'ADMIN' },
            ]}
          />
          <Button type="primary" block loading={actionLoading} icon={<PlusCircleOutlined />} onClick={handleAssignRole}>
            Gán role {roleToAdd}
          </Button>
        </Space>
      </Modal>

      {/* KYC Approve Confirm */}
      <Modal open={kycApproveModal} onCancel={() => setKYCApproveModal(false)}
        title={<Space><CheckSquareOutlined style={{ color: '#10B981' }} />Xác nhận duyệt KYC</Space>}
        footer={null} destroyOnClose width={420}
      >
        <Space direction="vertical" size={12} style={{ width: '100%', paddingTop: 8 }}>
          <Alert type="info" showIcon
            message={`Cấp KYC Level ${kycLevel} cho ${selectedUser?.full_name || selectedUser?.username || shortenAddr(selectedUser?.wallet_address ?? '')}`}
            description="Người dùng sẽ được thông báo và có thể truy cập các dịch vụ tương ứng." />
          <Button type="primary" block loading={actionLoading} icon={<CheckSquareOutlined />} onClick={handleApproveKYC}>
            Xác nhận duyệt KYC Level {kycLevel}
          </Button>
        </Space>
      </Modal>
    </Space>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function ProfileSidebar({
  profile, user, activeSection, onSelect,
}: {
  profile: UserProfile | null
  user: AuthUser
  activeSection: string
  onSelect: (key: string) => void
}) {
  // const avatarUri = profile?.avatar_uri ?? ''
  // const fullName = profile?.full_name ?? user.full_name ?? ''
  // const username = profile?.username ?? user.username ?? ''
  const actPoints = profile?.activity_points ?? 0
  const loginCount = profile?.login_count ?? 0
  const kycLevel = profile?.kyc_level ?? 0
  const studentClass = profile?.class ?? 'Chưa cập nhật'
  const roles = profile?.roles ?? user.roles ?? []
  const hasAdminRole = isAdmin(roles)
  const kycStatus = profile?.kyc_status ?? 'NONE'

  const navItems: MenuProps['items'] = [
    { key: 'account', icon: <UserOutlined />, label: 'Thông tin hồ sơ' },
    {
      key: 'kyc',
      icon: <IdcardOutlined />,
      label: (
        <span>
          Định danh KYC
          {kycStatus === 'PENDING' && <Badge dot style={{ marginLeft: 6 }} color="orange" />}
          {kycStatus === 'REJECTED' && <Badge dot style={{ marginLeft: 6 }} color="red" />}
        </span>
      ),
    },
    { key: '2fa', icon: <SafetyCertificateOutlined />, label: 'Xác thực 2 bước' },
    { key: 'sessions', icon: <KeyOutlined />, label: 'Phiên đăng nhập' },
    { key: 'preferences', icon: <BellOutlined />, label: 'Thông báo & Riêng tư' },
    { key: 'referral', icon: <GiftOutlined />, label: 'Giới thiệu bạn bè' },
    { key: 'audit', icon: <HistoryOutlined />, label: 'Nhật ký bảo mật' },
    ...(hasAdminRole ? [{ type: 'divider' as const }, {
      key: 'admin',
      icon: <CrownOutlined />,
      label: <span style={{ color: '#EF4444', fontWeight: 600 }}>Quản trị Admin</span>,
    }] : []),
  ]

  return (
    <div style={{ position: 'sticky', top: 24 }}>
      <Card style={{ borderRadius: 18, overflow: 'hidden', padding: 0, border: '1px solid #E0E7FF', boxShadow: '0 14px 32px rgba(15,23,42,0.06)' }} styles={{ body: { padding: 0 } }}>
        <div style={{ background: 'linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 55%,#312E81 100%)', padding: '18px 16px 14px', textAlign: 'center' }}>
          <Avatar
            size={72}
            src={getAvatarUri(profile, user)}
            icon={<UserOutlined />}
            style={{ background: '#4F46E5', fontSize: 28, border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 18px rgba(0,0,0,0.25)' }}
          />
          <div style={{ marginTop: 10, color: '#EEF2FF', fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
            {getAvatarLabel(profile, user)}
          </div>
          <div style={{ marginTop: 4, color: '#C7D2FE', fontSize: 12, fontFamily: 'monospace' }}>
            {shortenAddr(user.wallet_address)}
          </div>
        </div>
        <div
          style={{
            background: '#fff',
            padding: '14px 16px',
            color: '#E0E7FF',
          }}
        >
          <Text style={{ color: '#C7D2FE', fontSize: 12 }}>Lớp học hiện tại</Text>
          <div style={{ marginTop: 2, fontWeight: 700, fontSize: 16, color: '#EEF2FF' }}>{studentClass}</div>
        </div>
        {/* <div style={{ background: 'linear-gradient(160deg,#1E293B 0%,#0F172A 100%)', padding: '24px 20px 40px' }}>
          <div style={{ textAlign: 'center' }}>
            <Avatar size={72} src={avatarUri || undefined} icon={<UserOutlined />}
              style={{ background: '#3B82F6', fontSize: 28, border: '3px solid rgba(255,255,255,0.2)', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
        <div style={{ padding: '0 16px 16px', marginTop: -28, textAlign: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '16px 12px 12px', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
            <Title level={5} style={{ margin: 0, marginBottom: 2 }}>
              {fullName || (username ? `@${username}` : shortenAddr(user.wallet_address))}
            </Title>
            {username && <Text type="secondary" style={{ fontSize: 13 }}>@{username}</Text>}
            <div style={{ marginTop: 8 }}>
              {roles.map((r) => <Tag key={r} color={roleColor(r)} style={{ marginBottom: 4 }}>{r}</Tag>)}
            </div>
            <div style={{ marginTop: 8 }}>
              <Tooltip title="Copy địa chỉ ví">
                <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#94A3B8', cursor: 'pointer' }}
                  onClick={() => { void navigator.clipboard.writeText(user.wallet_address); antMessage.success('Đã copy!') }}>
                  {shortenAddr(user.wallet_address)} <CopyOutlined />
                </Text>
              </Tooltip>
            </div>
          </div>
        </div> */}
        <div style={{ padding: '0 16px 16px' }}>
          <Row gutter={0}>
            <Col span={8} style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#4F46E5', lineHeight: 1.2 }}>{actPoints.toLocaleString()}</div>
              <Text type="secondary" style={{ fontSize: 10 }}>Điểm</Text>
            </Col>
            <Col span={8} style={{ textAlign: 'center', padding: '12px 4px', borderLeft: '1px solid #F1F5F9', borderRight: '1px solid #F1F5F9' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981', lineHeight: 1.2 }}>{loginCount.toLocaleString()}</div>
              <Text type="secondary" style={{ fontSize: 10 }}>Đăng nhập</Text>
            </Col>
            <Col span={8} style={{ textAlign: 'center', padding: '12px 4px' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#F59E0B', lineHeight: 1.2 }}>Lv.{kycLevel}</div>
              <Text type="secondary" style={{ fontSize: 10 }}>KYC</Text>
            </Col>
          </Row>
        </div>
        <Divider style={{ margin: 0 }} />
        <Menu mode="inline" selectedKeys={[activeSection]} onClick={({ key }) => onSelect(key)}
          style={{ border: 'none', borderRadius: '0 0 16px 16px' }} items={navItems} />
      </Card>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

interface ProfilePageProps {
  user?: AuthUser
}

export function ProfilePage({ user }: ProfilePageProps) {
  const auth = useAuthContext()
  const currentUser = user ?? auth.user ?? null
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [activeSection, setActiveSection] = useState('account')

  const loadProfile = useCallback(async () => {
    try { setProfile(await getMyProfile()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (currentUser) void loadProfile()
  }, [currentUser, loadProfile])

  if (!currentUser) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  const roles = profile?.roles ?? currentUser.roles ?? []
  const hasAdminRole = isAdmin(roles)
  const walletAddress = currentUser.wallet_address

  const sectionLabels: Record<string, string> = {
    account: 'Thông tin hồ sơ',
    kyc: 'Định danh KYC',
    '2fa': 'Xác thực 2 bước',
    sessions: 'Phiên đăng nhập',
    preferences: 'Thông báo & Quyền riêng tư',
    referral: 'Giới thiệu bạn bè',
    audit: 'Nhật ký bảo mật',
    admin: 'Quản trị Admin',
  }

  function renderSection() {
    switch (activeSection) {
      case 'account': return <AccountSection profile={profile} onRefresh={loadProfile} />
      case 'kyc': return <KYCSection profile={profile} onRefresh={loadProfile} />
      case '2fa': return <TwoFASection />
      case 'sessions': return <SessionsSection />
      case 'preferences': return <PreferencesSection />
      case 'referral': return <ReferralSection />
      case 'audit': return <AuditSection />
      case 'admin': return hasAdminRole ? <AdminSection /> : <Alert type="error" showIcon message="Không có quyền truy cập" />
      default: return null
    }
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 18,
          overflow: 'hidden',
          border: '1px solid #E0E7FF',
          boxShadow: '0 14px 40px rgba(15,23,42,0.08)',
          background: 'linear-gradient(135deg,#0F0E2B 0%,#1E1A5C 55%,#312E81 100%)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <Row align="middle" gutter={[16, 16]} wrap>
          {/* <Col>
            <Avatar
              size={80}
              src={getAvatarUri(profile, currentUser)}
              icon={<UserOutlined />}
              style={{ background: '#4F46E5', fontSize: 32, border: '3px solid rgba(255,255,255,0.25)', boxShadow: '0 4px 16px rgba(0,0,0,0.4)' }}
            />
          </Col> */}
          <Col flex={1} style={{ minWidth: 0 }}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Space wrap>
                <Title level={4} style={{ margin: 0, color: '#F1F5F9' }}>
                  {getAvatarLabel(profile, currentUser) || 'Hồ sơ cá nhân'}
                </Title>
                {roles.map((r) => <Tag key={r} color={roleColor(r)}>{r}</Tag>)}
                {hasAdminRole && <Tag icon={<CrownOutlined />} color="gold" style={{ fontWeight: 600 }}>Administrator</Tag>}
              </Space>
              <Space>
                <Text style={{ color: '#94A3B8', fontFamily: 'monospace', fontSize: 13 }}>{walletAddress}</Text>
                <Tooltip title="Copy địa chỉ ví">
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    style={{ color: '#64748B' }}
                    onClick={() => { void navigator.clipboard.writeText(walletAddress); antMessage.success('Đã copy!') }}
                  />
                </Tooltip>
              </Space>
              <Space wrap>
                {profile?.status && <Tag color={profile.status === 'ACTIVE' ? 'success' : 'error'}>{profile.status}</Tag>}
                {profile?.kyc_status && <Tag color={kycColor(profile.kyc_status)} icon={<FileProtectOutlined />}>KYC: {profile.kyc_status}</Tag>}
                {profile?.two_factor_enabled && <Tag color="success" icon={<SafetyCertificateOutlined />}>2FA</Tag>}
                {profile?.class && <Tag color="processing">Lớp: {profile.class}</Tag>}
                {profile?.email && (
                  <Tag icon={profile.email_verified ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
                    color={profile.email_verified ? 'success' : 'warning'}>{profile.email}</Tag>
                )}
              </Space>
            </Space>
          </Col>
          <Col>
            <Space direction="vertical" size={8} align="end">
              <Button
                icon={<EditOutlined />}
                onClick={() => setActiveSection('account')}
                style={{ background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)', color: '#F1F5F9' }}
              >
                Chỉnh sửa
              </Button>
              <Popconfirm title="Xác nhận đăng xuất?" onConfirm={auth.logout} okText="Đăng xuất" cancelText="Hủy">
                <Button danger style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', color: '#F1F5F9' }}>
                  Đăng xuất
                </Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={7}>
          <ProfileSidebar profile={profile} user={currentUser} activeSection={activeSection} onSelect={setActiveSection} />
        </Col>
        <Col xs={24} md={17}>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Hồ sơ &rsaquo; <Text strong style={{ color: '#3B82F6' }}>{sectionLabels[activeSection] ?? 'Thông tin hồ sơ'}</Text>
            </Text>
          </div>
          {renderSection()}
        </Col>
      </Row>
    </div>
  )
}
