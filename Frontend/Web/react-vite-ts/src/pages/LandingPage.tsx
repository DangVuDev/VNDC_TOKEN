import { useEffect, useRef, useState } from 'react'
import type { ReactNode, RefObject } from 'react'
import {
  ApartmentOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
  CommentOutlined,
  FundProjectionScreenOutlined,
  GithubOutlined,
  LoginOutlined,
  PlayCircleFilled,
  ReadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  StarFilled,
  TeamOutlined,
  ThunderboltOutlined,
  UserOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useNavigate } from 'react-router-dom'
import heroImage from '../assets/visuals/vndc-landing-hero.png'
import orbImage from '../assets/visuals/vndc-landing-orb.png'
import storyImage from '../assets/visuals/vndc-landing-story.png'

type SeoConfig = {
  title: string
  description: string
  keywords: string
  author: string
  imagePath: string
}

type FeatureCard = {
  icon: ReactNode
  title: string
  badge: string
  text: string
  action: string
}

type JourneyStep = {
  scene: string
  label: string
  title: string
  text: string
  metric: string
  icon: ReactNode
}

const SITE_SEO: SeoConfig = {
  title: 'Nền tảng VNDC | Landing page kết nối campus',
  description:
    'Landing page VNDC với hero sáng, ảnh tự tạo, hiệu ứng chuyển mục khi cuộn và một nền xuyên suốt cho trải nghiệm campus Web3.',
  keywords:
    'VNDC, landing page, campus Web3, nền tảng giáo dục, DAO, token, marketplace, React Vite',
  author: 'Vũ Văn Đăng',
  imagePath: '/og-vndc-platform.png',
}

const navLinks = [
  { href: '#products', label: 'Sản phẩm' },
  { href: '#journey', label: 'Hành trình' },
  { href: '#stories', label: 'Câu chuyện' },
  { href: '#network', label: 'Mạng lưới' },
]

const featureCards: FeatureCard[] = [
  {
    icon: <CommentOutlined />,
    title: 'Chat campus',
    badge: 'Cho thành viên',
    text: 'Thông báo, hỏi đáp và cập nhật lớp học nằm trong một luồng giao tiếp rõ ràng.',
    action: 'Mở chat',
  },
  {
    icon: <FundProjectionScreenOutlined />,
    title: 'Trung tâm VNDC',
    badge: 'Cho quản trị viên',
    text: 'Quản lý hoạt động, sự kiện, chiến dịch và luồng thưởng từ một màn hình điều phối.',
    action: 'Xem hub',
  },
  {
    icon: <WalletOutlined />,
    title: 'Luồng token',
    badge: 'Cho sinh viên',
    text: 'Ví, điểm thưởng, vé NFT và nhiệm vụ học tập kết nối với nhau như một hành trình.',
    action: 'Thử ngay',
  },
]

const journeySteps: JourneyStep[] = [
  {
    scene: 'chat',
    label: '01',
    title: 'Mỗi thông báo có đường đi riêng',
    text: 'Sinh viên nhận cập nhật đúng ngữ cảnh, giảng viên gửi broadcast nhanh, quản trị viên vẫn nắm được tình trạng.',
    metric: 'Nhắn tin hai chiều cho campus',
    icon: <CommentOutlined />,
  },
  {
    scene: 'hub',
    label: '02',
    title: 'Từ lớp học đến sự kiện không bị đứt mạch',
    text: 'Hub gom dashboard, hoạt động, vé và gây quỹ thành một luồng vận hành có thể theo dõi liên tục.',
    metric: 'Một bề mặt vận hành thống nhất',
    icon: <ApartmentOutlined />,
  },
  {
    scene: 'token',
    label: '03',
    title: 'Động lực học tập có thể đo được',
    text: 'Thưởng, staking và thành tích trở thành tín hiệu minh bạch để cộng đồng thấy được đóng góp thật.',
    metric: 'Phần thưởng có bằng chứng',
    icon: <StarFilled />,
  },
  {
    scene: 'dao',
    label: '04',
    title: 'Cộng đồng cùng quyết định cách phát triển',
    text: 'DAO và voting biến campus thành một mạng lưới có tiếng nói chung, không chỉ là một bảng thông báo.',
    metric: 'Sẵn sàng quản trị cộng đồng',
    icon: <SafetyCertificateOutlined />,
  },
]

const proofQuotes = [
  {
    quote: 'VNDC làm trạng thái lớp học, sự kiện và phần thưởng trở nên rõ hơn rất nhiều.',
    name: 'Minh Anh',
    role: 'Công tác sinh viên',
  },
  {
    quote: 'Cảm giác như một landing của sản phẩm thật, có câu chuyện và có điểm neo thị giác.',
    name: 'Hoàng Nam',
    role: 'Mentor frontend',
  },
  {
    quote: 'Phần Web3 được đưa vào nhẹ nhàng, không làm người dùng mới bị ngợp.',
    name: 'Linh Tran',
    role: 'Đánh giá sản phẩm',
  },
]

const networkNodes = [
  'Sinh viên',
  'Giảng viên',
  'Câu lạc bộ',
  'Sự kiện',
  'DAO',
  'Ví',
  'Marketplace',
  'Gây quỹ',
]

const LANDING_STYLES = `
html { scroll-behavior: smooth; }

.v2-page {
  --ink: #07162f;
  --muted: #52627a;
  --line: rgba(20, 46, 86, .12);
  --blue: #0877e8;
  --blue-strong: #005cc8;
  --cyan: #17bde7;
  --orange: #ff7a1a;
  --rose: #e85ab8;
  --card: rgba(255, 255, 255, .72);
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow-x: clip;
  color: var(--ink);
  background:
    radial-gradient(900px 520px at 7% 4%, rgba(8,119,232,.14), transparent 68%),
    radial-gradient(820px 520px at 94% 16%, rgba(23,189,231,.14), transparent 70%),
    radial-gradient(920px 620px at 50% 58%, rgba(255,122,26,.08), transparent 72%),
    linear-gradient(180deg, #ffffff 0%, #f5fbff 38%, #eef8ff 68%, #ffffff 100%);
}

.v2-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -3;
  pointer-events: none;
  background:
    linear-gradient(110deg, rgba(8,119,232,.08), transparent 28%, rgba(23,189,231,.07) 62%, transparent 86%),
    radial-gradient(circle at 20% 20%, rgba(255,255,255,.88), transparent 22%),
    radial-gradient(circle at 82% 42%, rgba(255,255,255,.72), transparent 24%);
}

.v2-page::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  pointer-events: none;
  opacity: .22;
  background-image:
    linear-gradient(rgba(8,119,232,.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(8,119,232,.08) 1px, transparent 1px);
  background-size: 58px 58px;
  mask-image: linear-gradient(180deg, transparent, #000 12%, #000 84%, transparent);
}

.v2-page * { box-sizing: border-box; }
.v2-page a { color: inherit; text-decoration: none; }

.v2-shell {
  width: min(1180px, calc(100% - 36px));
  margin: 0 auto;
}

.v2-skip {
  position: fixed;
  left: 16px;
  top: 16px;
  z-index: 100;
  transform: translateY(-150%);
  border-radius: 999px;
  background: #fff;
  color: var(--blue);
  padding: 10px 14px;
  font-weight: 850;
  box-shadow: 0 16px 38px rgba(8, 53, 120, .14);
}

.v2-skip:focus { transform: translateY(0); }

.v2-nav {
  position: sticky;
  top: 0;
  z-index: 80;
  border-bottom: 1px solid rgba(255,255,255,.64);
  background: rgba(255,255,255,.72);
  backdrop-filter: blur(22px) saturate(1.35);
  -webkit-backdrop-filter: blur(22px) saturate(1.35);
}

.v2-nav-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 22px;
  min-height: 74px;
}

.v2-brand,
.v2-nav-links,
.v2-nav-actions,
.v2-hero-actions,
.v2-mini-proof,
.v2-tab-row,
.v2-footer-socials {
  display: flex;
  align-items: center;
}

.v2-brand { gap: 10px; font-weight: 950; letter-spacing: -.03em; }

.v2-brand-mark {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: 14px;
  background:
    radial-gradient(circle at 30% 16%, rgba(255,255,255,.42), transparent 32%),
    linear-gradient(135deg, var(--blue), var(--cyan));
  color: #fff;
  box-shadow: 0 16px 34px rgba(8,119,232,.22);
}

.v2-nav-links {
  justify-content: center;
  gap: 26px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 720;
}

.v2-nav-links a {
  position: relative;
  padding: 8px 0;
}

.v2-nav-links a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 2px;
  border-radius: 99px;
  background: var(--blue);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 180ms ease;
}

.v2-nav-links a:hover::after { transform: scaleX(1); }

.v2-nav-actions {
  justify-content: end;
  gap: 10px;
}

.v2-text-link {
  color: var(--muted);
  font-size: 14px;
  font-weight: 800;
}

.v2-primary,
.v2-secondary {
  height: 42px !important;
  border-radius: 999px !important;
  font-weight: 850 !important;
}

.v2-primary {
  border: 0 !important;
  color: #fff !important;
  background: linear-gradient(135deg, var(--blue), var(--blue-strong)) !important;
  box-shadow: 0 18px 36px rgba(8,119,232,.24) !important;
}

.v2-secondary {
  border-color: rgba(8,53,120,.14) !important;
  color: var(--ink) !important;
  background: rgba(255,255,255,.8) !important;
}

.v2-primary:active,
.v2-secondary:active { transform: translateY(1px); }

.v2-section {
  position: relative;
  padding: 96px 0;
}

.v2-hero {
  min-height: calc(100dvh - 74px);
  display: grid;
  align-items: center;
  padding: 54px 0 72px;
}

.v2-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, .92fr) minmax(360px, 1.08fr);
  align-items: center;
  gap: 48px;
}

.v2-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  border: 1px solid rgba(8,119,232,.14);
  border-radius: 999px;
  background: rgba(255,255,255,.74);
  color: var(--blue);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: .08em;
  text-transform: uppercase;
}

.v2-hero-title,
.v2-section-title,
.v2-card-title,
.v2-final-title {
  margin: 0;
  color: var(--ink);
  font-weight: 950;
  letter-spacing: -.055em;
}

.v2-hero-title {
  max-width: 720px;
  margin-top: 18px;
  font-size: clamp(48px, 7vw, 88px);
  line-height: .92;
  text-wrap: balance;
}

.v2-hero-copy,
.v2-section-copy,
.v2-card-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.72;
}

.v2-hero-copy {
  max-width: 520px;
  margin-top: 22px;
  font-size: 16px;
}

.v2-hero-actions {
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 28px;
}

.v2-mini-proof {
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 22px;
  color: var(--muted);
  font-size: 13px;
}

.v2-proof-pill {
  border: 1px solid rgba(8,53,120,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.72);
  padding: 8px 12px;
  box-shadow: 0 10px 26px rgba(8,53,120,.06);
}

.v2-hero-visual {
  position: relative;
  min-height: 560px;
  perspective: 1200px;
}

.v2-oval,
.v2-oval-alt {
  position: absolute;
  inset: 46px 8px auto auto;
  width: min(660px, 100%);
  height: 430px;
  border-radius: 50%;
  pointer-events: none;
}

.v2-oval {
  border: 3px solid var(--blue);
  transform: rotate(-8deg);
}

.v2-oval-alt {
  border: 3px solid var(--rose);
  transform: rotate(5deg) translateY(20px);
}

.v2-photo-orbit {
  position: absolute;
  overflow: hidden;
  border: 10px solid rgba(255,255,255,.88);
  box-shadow: 0 26px 60px rgba(8,53,120,.16);
  transform-style: preserve-3d;
}

.v2-photo-orbit.main {
  right: 36px;
  top: 96px;
  width: min(520px, 82vw);
  aspect-ratio: 1.44;
  border-radius: 42px;
  transform: rotateY(-9deg) rotateZ(2deg);
}

.v2-photo-orbit.small-a {
  left: 4px;
  top: 88px;
  width: 180px;
  aspect-ratio: 1;
  border-radius: 50%;
  transform: rotateZ(-8deg) translateZ(50px);
}

.v2-photo-orbit.small-b {
  right: 2px;
  bottom: 64px;
  width: 168px;
  aspect-ratio: 1;
  border-radius: 42px;
  transform: rotateZ(8deg) translateZ(40px);
}

.v2-photo-orbit img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.v2-photo-orbit.small-b img { object-fit: contain; background: #f5fbff; }

.v2-spark,
.v2-chip-shape {
  position: absolute;
  pointer-events: none;
}

.v2-spark {
  right: 34px;
  top: 44px;
  width: 44px;
  height: 44px;
  animation: v2-spin 8s linear infinite;
}

.v2-spark::before,
.v2-spark::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  border-radius: 99px;
  background: var(--orange);
  transform: translate(-50%, -50%);
}

.v2-spark::before { width: 44px; height: 7px; }
.v2-spark::after { width: 7px; height: 44px; }

.v2-chip-shape {
  width: 18px;
  height: 28px;
  border-radius: 999px;
  background: var(--rose);
  box-shadow: 0 10px 24px rgba(232,90,184,.24);
}

.v2-chip-shape.one { left: 24%; bottom: 82px; transform: rotate(24deg); }
.v2-chip-shape.two { right: 18%; top: 34px; background: var(--cyan); transform: rotate(-18deg); }

.v2-feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.v2-feature-card,
.v2-glass-panel,
.v2-quote-card,
.v2-network-card {
  border: 1px solid rgba(255,255,255,.76);
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgba(255,255,255,.82), rgba(246,251,255,.58)),
    rgba(255,255,255,.62);
  box-shadow:
    0 24px 54px rgba(8,53,120,.09),
    inset 0 1px 0 rgba(255,255,255,.9);
  backdrop-filter: blur(18px) saturate(1.25);
  -webkit-backdrop-filter: blur(18px) saturate(1.25);
}

.v2-feature-card {
  padding: 28px;
  min-height: 292px;
  transition: transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease;
}

.v2-feature-card:hover {
  border-color: rgba(8,119,232,.24);
  transform: translateY(-8px) rotate(-.4deg);
  box-shadow: 0 34px 74px rgba(8,53,120,.13);
}

.v2-icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(8,119,232,.12), rgba(23,189,231,.12));
  color: var(--blue);
  font-size: 23px;
}

.v2-feature-card h3 {
  margin: 18px 0 8px;
  color: var(--ink);
  font-size: 28px;
  font-weight: 950;
  letter-spacing: -.045em;
}

.v2-badge {
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(8,53,120,.12);
  border-radius: 999px;
  color: var(--muted);
  background: rgba(255,255,255,.7);
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 800;
}

.v2-feature-card p {
  min-height: 72px;
  margin: 16px 0 22px;
  color: var(--muted);
  line-height: 1.68;
}

.v2-insight {
  display: grid;
  grid-template-columns: .9fr 1.1fr;
  gap: 44px;
  align-items: center;
}

.v2-tab-row {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: -6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 760;
}

.v2-tab {
  position: relative;
  padding-bottom: 15px;
  text-align: center;
}

.v2-tab.is-active { color: var(--blue); }
.v2-tab.is-active::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 0;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
}

.v2-section-title {
  max-width: 720px;
  font-size: clamp(36px, 5vw, 62px);
  line-height: 1;
  text-wrap: balance;
}

.v2-section-copy {
  max-width: 540px;
  margin-top: 18px;
  font-size: 16px;
}

.v2-image-card {
  position: relative;
  overflow: hidden;
  min-height: 430px;
  border: 10px solid rgba(255,255,255,.86);
  border-radius: 24px;
  box-shadow: 0 30px 72px rgba(8,53,120,.14);
  transform: rotate(1.5deg);
}

.v2-image-card::after {
  content: "";
  position: absolute;
  inset: 22px;
  border: 2px solid var(--rose);
  border-radius: 50%;
  transform: rotate(-7deg);
  pointer-events: none;
}

.v2-image-card img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 430px;
  object-fit: cover;
}

.v2-traveler {
  position: fixed;
  right: max(18px, calc((100vw - 1180px) / 2 - 34px));
  top: 27vh;
  z-index: 5;
  width: 172px;
  pointer-events: none;
  transform: translate3d(0, 0, 0) rotateY(-12deg) rotateZ(2deg);
  transition: top 680ms cubic-bezier(.2,.8,.2,1), right 680ms cubic-bezier(.2,.8,.2,1), width 680ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease, filter 680ms ease, transform 680ms cubic-bezier(.2,.8,.2,1);
  will-change: transform, top, right, width;
}

.v2-traveler img {
  width: 100%;
  display: block;
  border-radius: 34px;
  filter: drop-shadow(0 26px 34px rgba(8,53,120,.18));
  animation: v2-float 5.8s ease-in-out infinite;
}

.v2-page[data-scene="hero"] .v2-traveler {
  top: 62vh;
  right: max(18px, calc((100vw - 1180px) / 2 + 40px));
  width: 136px;
  opacity: .74;
}

.v2-page[data-scene="products"] .v2-traveler {
  top: 31vh;
  width: 154px;
  transform: rotateY(-18deg) rotateZ(-5deg) scale(.96);
}

.v2-page[data-scene="insight"] .v2-traveler {
  top: 47vh;
  right: max(18px, calc((100vw - 1180px) / 2 + 28px));
  width: 188px;
  transform: rotateY(10deg) rotateZ(4deg) scale(1.02);
}

.v2-page[data-scene="journey"] .v2-traveler {
  top: 23vh;
  right: max(16px, calc((100vw - 1180px) / 2 + 70px));
  width: 218px;
  transform: rotateY(-22deg) rotateX(7deg) rotateZ(-3deg) scale(1.04);
}

.v2-page[data-scene="stories"] .v2-traveler {
  top: 57vh;
  width: 148px;
  opacity: .84;
  transform: rotateY(18deg) rotateZ(8deg) scale(.92);
}

.v2-page[data-scene="network"] .v2-traveler {
  top: 32vh;
  width: 190px;
  filter: saturate(1.12);
  transform: rotateY(-8deg) rotateZ(-9deg) scale(1);
}

.v2-journey {
  display: grid;
  grid-template-columns: minmax(280px, .82fr) minmax(0, 1.18fr);
  gap: 50px;
  align-items: start;
}

.v2-journey-sticky {
  position: sticky;
  top: 112px;
  min-height: 520px;
  padding: 34px;
}

.v2-journey-orb {
  position: relative;
  display: grid;
  min-height: 300px;
  place-items: center;
  perspective: 1000px;
}

.v2-journey-orb img {
  width: min(310px, 82%);
  border-radius: 42px;
  transform: rotateY(-12deg) rotateX(6deg);
  filter: drop-shadow(0 28px 48px rgba(8,53,120,.16));
}

.v2-orbit-line {
  position: absolute;
  width: 82%;
  aspect-ratio: 1.55;
  border: 2px solid rgba(8,119,232,.18);
  border-radius: 50%;
  transform: rotate(-14deg);
}

.v2-journey-caption {
  color: var(--muted);
  font-weight: 750;
  line-height: 1.7;
}

.v2-step-list {
  display: grid;
  gap: 26px;
}

.v2-step {
  min-height: 360px;
  padding: 30px;
  scroll-margin-top: 120px;
}

.v2-step-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 26px;
}

.v2-step-num {
  color: var(--blue);
  font-size: 14px;
  font-weight: 950;
  letter-spacing: .08em;
}

.v2-step-icon {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(8,119,232,.13), rgba(23,189,231,.13));
  color: var(--blue);
  font-size: 22px;
}

.v2-step h3 {
  margin: 0;
  max-width: 640px;
  color: var(--ink);
  font-size: clamp(30px, 4vw, 48px);
  line-height: 1;
  letter-spacing: -.05em;
}

.v2-step p {
  max-width: 600px;
  margin: 18px 0 26px;
  color: var(--muted);
  line-height: 1.72;
  font-size: 16px;
}

.v2-metric {
  display: inline-flex;
  border-radius: 999px;
  background: rgba(8,119,232,.09);
  color: var(--blue-strong);
  padding: 9px 13px;
  font-size: 13px;
  font-weight: 850;
}

.v2-story {
  text-align: center;
}

.v2-story h2 {
  margin-inline: auto;
}

.v2-stars {
  display: flex;
  justify-content: center;
  gap: 9px;
  margin-top: 24px;
  color: var(--orange);
  font-size: 19px;
}

.v2-rating {
  margin-top: 10px;
  color: var(--ink);
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -.04em;
}

.v2-video {
  position: relative;
  overflow: hidden;
  width: min(900px, 100%);
  aspect-ratio: 16 / 8.2;
  margin: 44px auto 0;
  border: 10px solid rgba(255,255,255,.86);
  border-radius: 24px;
  box-shadow: 0 32px 76px rgba(8,53,120,.15);
}

.v2-video img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}

.v2-video::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 38%, rgba(4,20,44,.62));
}

.v2-play {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  color: rgba(255,255,255,.94);
  font-size: 62px;
}

.v2-video-caption {
  position: absolute;
  z-index: 1;
  left: 28px;
  right: 28px;
  bottom: 24px;
  color: #fff;
  font-size: clamp(22px, 3.2vw, 34px);
  font-weight: 900;
  letter-spacing: -.045em;
  line-height: 1.08;
}

.v2-quote-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 34px;
  text-align: left;
}

.v2-quote-card {
  padding: 24px;
}

.v2-quote-card p {
  margin: 0;
  color: var(--ink);
  line-height: 1.62;
  font-weight: 720;
}

.v2-quote-card strong {
  display: block;
  margin-top: 18px;
  color: var(--blue-strong);
}

.v2-quote-card span { color: var(--muted); font-size: 13px; }

.v2-network-head {
  display: grid;
  grid-template-columns: .84fr 1.16fr;
  gap: 36px;
  align-items: end;
}

.v2-network-map {
  position: relative;
  min-height: 440px;
  margin-top: 42px;
}

.v2-network-line {
  position: absolute;
  inset: 0;
  border: 2px solid rgba(8,119,232,.18);
  border-radius: 50%;
  transform: rotate(-9deg) scale(.88);
}

.v2-network-line.two {
  transform: rotate(12deg) scale(.72);
  border-color: rgba(232,90,184,.18);
}

.v2-center-node,
.v2-node {
  position: absolute;
  display: grid;
  place-items: center;
  border: 1px solid rgba(255,255,255,.78);
  background: rgba(255,255,255,.78);
  box-shadow: 0 18px 42px rgba(8,53,120,.1);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.v2-center-node {
  left: 50%;
  top: 48%;
  width: 116px;
  height: 116px;
  border-radius: 34px;
  color: var(--blue);
  transform: translate(-50%, -50%) rotate(-3deg);
  font-size: 34px;
}

.v2-center-node span {
  display: block;
  margin-top: 4px;
  color: var(--ink);
  font-size: 13px;
  font-weight: 900;
}

.v2-node {
  width: 112px;
  height: 48px;
  border-radius: 999px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 850;
}

.v2-node:nth-child(4) { left: 12%; top: 18%; }
.v2-node:nth-child(5) { left: 42%; top: 4%; }
.v2-node:nth-child(6) { right: 12%; top: 20%; }
.v2-node:nth-child(7) { right: 8%; top: 58%; }
.v2-node:nth-child(8) { left: 45%; bottom: 5%; }
.v2-node:nth-child(9) { left: 10%; top: 60%; }
.v2-node:nth-child(10) { left: 25%; bottom: 16%; }
.v2-node:nth-child(11) { right: 25%; bottom: 14%; }

.v2-network-cards {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 36px;
}

.v2-network-card {
  padding: 24px;
}

.v2-network-card h3 {
  margin: 0 0 14px;
  color: var(--ink);
  font-size: 24px;
  font-weight: 950;
  letter-spacing: -.045em;
}

.v2-network-card ul {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--muted);
}

.v2-network-card li {
  display: flex;
  gap: 9px;
  align-items: flex-start;
}

.v2-network-card li span { color: var(--blue); margin-top: 2px; }

.v2-final {
  padding-bottom: 108px;
}

.v2-final-panel {
  position: relative;
  overflow: hidden;
  padding: 54px;
  border-radius: 26px;
  text-align: center;
}

.v2-final-panel::before {
  content: "";
  position: absolute;
  inset: -90px auto auto -40px;
  width: 260px;
  height: 260px;
  border-radius: 52px;
  background: linear-gradient(135deg, rgba(255,122,26,.28), rgba(8,119,232,.14));
  transform: rotate(-18deg);
}

.v2-final-panel::after {
  content: "";
  position: absolute;
  right: -40px;
  bottom: -80px;
  width: 280px;
  height: 280px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(23,189,231,.24), transparent 66%);
}

.v2-final-panel > * {
  position: relative;
  z-index: 1;
}

.v2-final-title {
  max-width: 760px;
  margin-inline: auto;
  font-size: clamp(36px, 5vw, 64px);
  line-height: .98;
}

.v2-final-copy {
  max-width: 560px;
  margin: 18px auto 0;
  color: var(--muted);
  line-height: 1.72;
}

.v2-footer {
  border-top: 1px solid rgba(8,53,120,.1);
  background: rgba(255,255,255,.5);
  padding: 42px 0;
}

.v2-footer-grid {
  display: grid;
  grid-template-columns: minmax(160px, .72fr) 1fr;
  gap: 44px;
}

.v2-footer-socials {
  gap: 10px;
  margin-top: 16px;
  color: var(--blue);
}

.v2-footer-cols {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 20px;
}

.v2-footer-col {
  display: grid;
  gap: 8px;
  color: var(--muted);
  font-size: 13px;
}

.v2-footer-col h4 {
  margin: 0 0 4px;
  color: var(--ink);
  font-size: 13px;
}

.v2-reveal {
  opacity: 0;
  transform: translateY(28px) scale(.985);
  transition: opacity 720ms ease, transform 720ms cubic-bezier(.2,.8,.2,1);
}

.v2-reveal.is-visible {
  opacity: 1;
  transform: translateY(0) scale(1);
}

@keyframes v2-float {
  0%, 100% { transform: translate3d(0, 0, 0) rotateZ(0deg); }
  50% { transform: translate3d(0, -14px, 0) rotateZ(1.8deg); }
}

@keyframes v2-spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1100px) {
  .v2-traveler { display: none; }
  .v2-hero-grid,
  .v2-insight,
  .v2-journey,
  .v2-network-head {
    grid-template-columns: 1fr;
  }
  .v2-journey-sticky { position: relative; top: auto; min-height: auto; }
}

@media (max-width: 820px) {
  .v2-nav-row { grid-template-columns: 1fr auto; min-height: 66px; }
  .v2-nav-links { display: none; }
  .v2-text-link { display: none; }
  .v2-section { padding: 68px 0; }
  .v2-hero { min-height: auto; padding-top: 38px; }
  .v2-hero-grid { gap: 26px; }
  .v2-hero-visual { min-height: 380px; }
  .v2-photo-orbit.main { right: 0; top: 62px; width: 100%; border-radius: 26px; }
  .v2-photo-orbit.small-a { width: 118px; top: 12px; }
  .v2-photo-orbit.small-b { width: 118px; bottom: 10px; }
  .v2-oval, .v2-oval-alt { height: 280px; }
  .v2-feature-grid,
  .v2-tab-row,
  .v2-quote-grid,
  .v2-network-cards,
  .v2-footer-grid,
  .v2-footer-cols {
    grid-template-columns: 1fr;
  }
  .v2-image-card,
  .v2-image-card img { min-height: 300px; }
  .v2-step { min-height: auto; padding: 24px; }
  .v2-network-map { min-height: 520px; }
  .v2-node:nth-child(n) {
    position: relative;
    inset: auto;
    transform: none;
  }
  .v2-network-map {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    align-items: center;
  }
  .v2-network-line,
  .v2-center-node { display: none; }
  .v2-node { width: 100%; }
  .v2-final-panel { padding: 34px 22px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .v2-reveal,
  .v2-traveler,
  .v2-traveler img,
  .v2-spark {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
  .v2-reveal { opacity: 1; }
}
`

function getAbsoluteUrl(path: string) {
  if (typeof window === 'undefined') return path
  return new URL(path, window.location.origin).toString()
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(attribute, key)
    document.head.appendChild(tag)
  }
  tag.content = content
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return
  let tag = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!tag) {
    tag = document.createElement('link')
    tag.rel = rel
    document.head.appendChild(tag)
  }
  tag.href = href
}

function upsertJsonLd(id: string, data: unknown) {
  if (typeof document === 'undefined') return
  let script = document.getElementById(id) as HTMLScriptElement | null
  if (!script) {
    script = document.createElement('script')
    script.id = id
    script.type = 'application/ld+json'
    document.head.appendChild(script)
  }
  script.textContent = JSON.stringify(data)
}

function useLandingSeo(config: SeoConfig) {
  useEffect(() => {
    const canonicalUrl = getAbsoluteUrl('/')
    const imageUrl = getAbsoluteUrl(config.imagePath)
    document.title = config.title
    upsertMeta('name', 'description', config.description)
    upsertMeta('name', 'keywords', config.keywords)
    upsertMeta('name', 'author', config.author)
    upsertMeta('name', 'robots', 'index, follow, max-image-preview:large')
    upsertMeta('name', 'theme-color', '#0877e8')
    upsertMeta('property', 'og:title', config.title)
    upsertMeta('property', 'og:description', config.description)
    upsertMeta('property', 'og:type', 'website')
    upsertMeta('property', 'og:url', canonicalUrl)
    upsertMeta('property', 'og:image', imageUrl)
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', config.title)
    upsertMeta('name', 'twitter:description', config.description)
    upsertMeta('name', 'twitter:image', imageUrl)
    upsertLink('canonical', canonicalUrl)
    upsertJsonLd('vndc-landing-schema', {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${canonicalUrl}#website`,
          name: 'Nền tảng VNDC',
          url: canonicalUrl,
          description: config.description,
          inLanguage: 'vi-VN',
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${canonicalUrl}#software`,
          name: 'Nền tảng VNDC',
          url: canonicalUrl,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web',
          description: config.description,
          author: { '@type': 'Person', name: config.author },
        },
      ],
    })
  }, [config])
}

function useRevealOnScroll(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>('.v2-reveal'))

    if (reduceMotion) {
      revealItems.forEach((element) => element.classList.add('is-visible'))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          entry.target.classList.add('is-visible')
          observer.unobserve(entry.target)
        })
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    )

    revealItems.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [rootRef])
}

function useActiveScene(rootRef: RefObject<HTMLElement | null>) {
  const [scene, setScene] = useState('hero')

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-scene]'))
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        const nextScene = visible?.target.getAttribute('data-scene')
        if (nextScene) setScene(nextScene)
      },
      { threshold: [0.24, 0.38, 0.52], rootMargin: '-18% 0px -34% 0px' }
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [rootRef])

  return scene
}

export function LandingPage() {
  const navigate = useNavigate()
  const pageRef = useRef<HTMLElement>(null)
  const activeScene = useActiveScene(pageRef)

  useLandingSeo(SITE_SEO)
  useRevealOnScroll(pageRef)

  const goLogin = () => navigate('/login')

  return (
    <main ref={pageRef} className="v2-page" data-scene={activeScene} id="main-content">
      <style>{LANDING_STYLES}</style>
      <a className="v2-skip" href="#products">Bỏ qua phần đầu</a>

      <div className="v2-traveler" aria-hidden="true">
        <img src={orbImage} alt="" />
      </div>

      <header className="v2-nav" aria-label="Điều hướng landing page">
        <div className="v2-shell v2-nav-row">
          <a className="v2-brand" href="#top" aria-label="Trang chủ VNDC">
            <span className="v2-brand-mark">V</span>
            <span>VNDC</span>
          </a>

          <nav className="v2-nav-links" aria-label="Nội dung chính">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="v2-nav-actions">
            <a className="v2-text-link" href="#stories"><SearchOutlined /> Tìm hiểu</a>
            <Button className="v2-secondary" icon={<LoginOutlined />} onClick={goLogin}>Đăng nhập</Button>
            <Button className="v2-primary" onClick={goLogin}>Đăng ký miễn phí</Button>
          </div>
        </div>
      </header>

      <section id="top" className="v2-hero v2-section" data-scene="hero">
        <div className="v2-shell v2-hero-grid">
          <div className="v2-reveal">
            <div className="v2-kicker"><ThunderboltOutlined /> chuỗi campus kết nối</div>
            <h1 className="v2-hero-title">Xây dựng kết nối campus có ý nghĩa cùng VNDC.</h1>
            <p className="v2-hero-copy">
              Một landing mới có nền liền mạch, ảnh thật được tạo riêng và chuyển động khi cuộn để kể câu chuyện từ chat, hub, thưởng đến DAO.
            </p>
            <div className="v2-hero-actions">
              <Button className="v2-primary" size="large" onClick={goLogin}>
                Đăng ký miễn phí <ArrowRightOutlined />
              </Button>
              <Button className="v2-secondary" size="large" href="#journey">
                Xem hành trình
              </Button>
            </div>
            <div className="v2-mini-proof" aria-label="Điểm nổi bật">
              <span className="v2-proof-pill">Vận hành campus</span>
              <span className="v2-proof-pill">Thưởng token</span>
              <span className="v2-proof-pill">Sẵn sàng DAO</span>
            </div>
          </div>

          <div className="v2-hero-visual v2-reveal" aria-label="Sinh viên và giảng viên kết nối trên nền tảng VNDC">
            <div className="v2-oval" aria-hidden="true" />
            <div className="v2-oval-alt" aria-hidden="true" />
            <div className="v2-spark" aria-hidden="true" />
            <div className="v2-chip-shape one" aria-hidden="true" />
            <div className="v2-chip-shape two" aria-hidden="true" />
            <figure className="v2-photo-orbit main">
              <img src={heroImage} alt="Nhóm sinh viên và giảng viên đang làm việc cùng nhau trong sân trường hiện đại" />
            </figure>
            <figure className="v2-photo-orbit small-a" aria-hidden="true">
              <img src={storyImage} alt="" />
            </figure>
            <figure className="v2-photo-orbit small-b" aria-hidden="true">
              <img src={orbImage} alt="" />
            </figure>
          </div>
        </div>
      </section>

      <section id="products" className="v2-section" data-scene="products" aria-labelledby="products-title">
        <div className="v2-shell">
          <h2 id="products-title" className="v2-section-title v2-reveal">Ba sản phẩm kết nối trong cùng một nhịp campus.</h2>
          <p className="v2-section-copy v2-reveal">
            Lấy tinh thần card trong mẫu tham chiếu, nhưng mỗi card của VNDC tập trung vào một phần của hệ sinh thái.
          </p>

          <div className="v2-feature-grid" style={{ marginTop: 34 }}>
            {featureCards.map((item) => (
              <article key={item.title} className="v2-feature-card v2-reveal">
                <div className="v2-icon" aria-hidden="true">{item.icon}</div>
                <h3>{item.title}</h3>
                <span className="v2-badge">{item.badge}</span>
                <p>{item.text}</p>
                <Button className="v2-primary">{item.action}</Button>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v2-section" data-scene="insight" aria-labelledby="insight-title">
        <div className="v2-shell v2-insight">
          <div className="v2-tab-row v2-reveal" aria-hidden="true">
            <div className="v2-tab is-active">Tiết kiệm thời gian</div>
            <div className="v2-tab">Đơn giản hóa quy trình</div>
            <div className="v2-tab">Mở rộng niềm tin</div>
          </div>

          <div className="v2-reveal">
            <h2 id="insight-title" className="v2-section-title">86% công việc campus trở nên nhanh hơn khi luồng xử lý được nhìn thấy.</h2>
            <p className="v2-section-copy">
              Landing không chỉ liệt kê tính năng. Nó cho người xem thấy VNDC đi từ thông báo, hành động, bằng chứng đến phần thưởng như một mạch liên tục.
            </p>
            <Button className="v2-primary" style={{ marginTop: 24 }}>Khám phá VNDC Hub</Button>
          </div>

          <figure className="v2-image-card v2-reveal">
            <img src={heroImage} alt="Khung cảnh campus hiện đại với sinh viên đang cộng tác trên thiết bị số" />
          </figure>
        </div>
      </section>

      <section id="journey" className="v2-section" data-scene="journey" aria-labelledby="journey-title">
        <div className="v2-shell v2-journey">
          <aside className="v2-glass-panel v2-journey-sticky v2-reveal">
            <div className="v2-kicker"><ReadOutlined /> chuyển cảnh khi cuộn</div>
            <h2 id="journey-title" className="v2-section-title" style={{ marginTop: 18 }}>Một vật thể 3D di chuyển cùng câu chuyện.</h2>
            <div className="v2-journey-orb" aria-hidden="true">
              <div className="v2-orbit-line" />
              <img src={orbImage} alt="" />
            </div>
            <p className="v2-journey-caption">
              Khi cuộn qua từng mục, vật thể 3D bên phải đổi vị trí và góc nhìn. Nền trang vẫn giữ liền mạch, nên cảm giác không bị cắt thành từng khối.
            </p>
          </aside>

          <div className="v2-step-list">
            {journeySteps.map((step) => (
              <article key={step.scene} className="v2-glass-panel v2-step v2-reveal" data-scene={step.scene}>
                <div className="v2-step-head">
                  <span className="v2-step-num">{step.label}</span>
                  <span className="v2-step-icon" aria-hidden="true">{step.icon}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="v2-metric">{step.metric}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="stories" className="v2-section v2-story" data-scene="stories" aria-labelledby="stories-title">
        <div className="v2-shell">
          <h2 id="stories-title" className="v2-section-title v2-reveal">Một cách tuyệt vời để kết nối đời sống campus.</h2>
          <div className="v2-stars v2-reveal" aria-hidden="true">
            <StarFilled /><StarFilled /><StarFilled /><StarFilled /><StarFilled />
          </div>
          <div className="v2-rating v2-reveal">1,1 triệu tương tác có ý nghĩa có thể bắt đầu từ đây</div>
          <p className="v2-section-copy v2-reveal" style={{ marginInline: 'auto' }}>
            Phần bằng chứng xã hội được giữ sạch, có ảnh video tự tạo và trích dẫn ngắn để trang trông đáng tin hơn.
          </p>

          <figure className="v2-video v2-reveal">
            <img src={storyImage} alt="Nhóm sinh viên VNDC đang lập kế hoạch cho một sự kiện trong phòng workshop" />
            <div className="v2-play" aria-hidden="true"><PlayCircleFilled /></div>
            <figcaption className="v2-video-caption">Xem cách VNDC biến hoạt động campus thành động lực có thể nhìn thấy.</figcaption>
          </figure>

          <div className="v2-quote-grid">
            {proofQuotes.map((item) => (
              <article key={item.name} className="v2-quote-card v2-reveal">
                <p>"{item.quote}"</p>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="network" className="v2-section" data-scene="network" aria-labelledby="network-title">
        <div className="v2-shell">
          <div className="v2-network-head">
            <h2 id="network-title" className="v2-section-title v2-reveal">Sinh viên phát triển tốt hơn khi các hệ thống hỗ trợ được kết nối.</h2>
            <p className="v2-section-copy v2-reveal">
              Phần cuối mô phỏng network map trong mẫu, nhưng dùng visual glass và token orb để đúng hơn với VNDC.
            </p>
          </div>

          <div className="v2-network-map v2-reveal" aria-label="Mạng lưới kết nối VNDC">
            <div className="v2-network-line" aria-hidden="true" />
            <div className="v2-network-line two" aria-hidden="true" />
            <div className="v2-center-node" aria-hidden="true"><TeamOutlined /><span>VNDC</span></div>
            {networkNodes.map((node) => (
              <div className="v2-node" key={node}>{node}</div>
            ))}
          </div>

          <div className="v2-network-cards">
            <article className="v2-network-card v2-reveal">
              <h3>Chat</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Thông báo hai chiều cho lớp học và câu lạc bộ</li>
                <li><span><CheckCircleFilled /></span> Phản hồi nhanh theo ngữ cảnh</li>
                <li><span><CheckCircleFilled /></span> Lịch sử giao tiếp rõ ràng</li>
              </ul>
            </article>
            <article className="v2-network-card v2-reveal">
              <h3>Hub</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Điều phối chiến dịch và sự kiện</li>
                <li><span><CheckCircleFilled /></span> Theo dõi thành viên và hoạt động</li>
                <li><span><CheckCircleFilled /></span> Quản trị sẵn sàng mở rộng</li>
              </ul>
            </article>
            <article className="v2-network-card v2-reveal">
              <h3>Phần thưởng</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Luồng token gắn với nhiệm vụ</li>
                <li><span><CheckCircleFilled /></span> Vé và marketplace cùng hệ sinh thái</li>
                <li><span><CheckCircleFilled /></span> DAO tạo tiếng nói cộng đồng</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="v2-section v2-final" data-scene="network" aria-labelledby="final-title">
        <div className="v2-shell">
          <div className="v2-glass-panel v2-final-panel v2-reveal">
            <h2 id="final-title" className="v2-final-title">Thế giới học tập của bạn, được kết nối đẹp hơn cùng VNDC.</h2>
            <p className="v2-final-copy">
              Bắt đầu bằng landing page đẹp hơn, sau đó đưa người dùng vào dashboard, ví, hoạt động, DAO và marketplace mà không làm trải nghiệm bị đứt khúc.
            </p>
            <div className="v2-hero-actions" style={{ justifyContent: 'center' }}>
              <Button className="v2-primary" size="large" onClick={goLogin}>Bắt đầu ngay</Button>
              <Button className="v2-secondary" size="large" href="#products">Xem sản phẩm</Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="v2-footer">
        <div className="v2-shell v2-footer-grid">
          <div>
            <a className="v2-brand" href="#top" aria-label="Trang chủ VNDC">
              <span className="v2-brand-mark">V</span>
              <span>VNDC</span>
            </a>
            <div className="v2-footer-socials" aria-hidden="true">
              <GithubOutlined />
              <CommentOutlined />
              <UserOutlined />
            </div>
          </div>

          <div className="v2-footer-cols">
            <div className="v2-footer-col">
              <h4>Sản phẩm</h4>
              <a href="#products">Chat</a>
              <a href="#products">Hub</a>
              <a href="#products">Phần thưởng</a>
            </div>
            <div className="v2-footer-col">
              <h4>Dành cho ai</h4>
              <span>Sinh viên</span>
              <span>Giảng viên</span>
              <span>Quản trị viên</span>
            </div>
            <div className="v2-footer-col">
              <h4>Tài nguyên</h4>
              <a href="#journey">Hành trình</a>
              <a href="#stories">Câu chuyện</a>
              <a href="#network">Mạng lưới</a>
            </div>
            <div className="v2-footer-col">
              <h4>Công ty</h4>
              <span>Chuỗi campus</span>
              <span>Tin cậy và an toàn</span>
              <span>Điều khoản và riêng tư</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
