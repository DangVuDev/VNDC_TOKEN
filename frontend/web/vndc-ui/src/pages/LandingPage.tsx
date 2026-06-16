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
import orbImage from '../assets/visuals/logo.png'
import storyImage from '../assets/visuals/vndc-landing-story.png'
import waveBackground from '../assets/visuals/vndc-landing-wave-bg.png'

type SeoConfig = {
  title: string
  description: string
  keywords: string
  author: string
  imagePath: string
}

type EcosystemPoint = {
  icon: ReactNode
  title: string
  eyebrow: string
  text: string
  action: string
  tone: 'blue' | 'cyan' | 'violet' | 'gold'
}

type JourneyStep = {
  scene: string
  label: string
  title: string
  text: string
  metric: string
  icon: ReactNode
}

type ProofQuote = {
  quote: string
  name: string
  role: string
}

const SITE_SEO: SeoConfig = {
  title: 'VNDC Campus | Hệ sinh thái token cho sinh viên',
  description:
    'VNDC Campus là nền tảng kết nối sinh viên, nhiệm vụ học tập, sự kiện, ví thưởng, marketplace và DAO trong một hệ sinh thái số minh bạch.',
  keywords:
    'VNDC Campus, token sinh viên, student reward platform, ví thưởng đại học, DAO sinh viên, marketplace campus, blockchain education',
  author: 'Vũ Văn Đăng',
  imagePath: '/og-vndc-platform.png',
}

const navLinks = [
  { href: '#products', label: 'Sản phẩm' },
  { href: '#journey', label: 'Trải nghiệm' },
  { href: '#stories', label: 'Giá trị' },
  { href: '#network', label: 'Hệ sinh thái' },
]

const ecosystemPoints: EcosystemPoint[] = [
  {
    icon: <UserOutlined />,
    title: 'Hồ sơ sinh viên số',
    eyebrow: 'Identity · activity · achievement',
    text: 'Mỗi sinh viên có một không gian cá nhân để lưu hoạt động, điểm danh, vé tham gia, huy hiệu và thành tích trong suốt quá trình học tập.',
    action: 'Khởi tạo hồ sơ',
    tone: 'blue',
  },
  {
    icon: <ReadOutlined />,
    title: 'Mission campus',
    eyebrow: 'Workshop · sự kiện · thử thách',
    text: 'Nhà trường và câu lạc bộ tạo nhiệm vụ có mục tiêu rõ ràng; sinh viên tham gia, hoàn thành và nhận ghi nhận ngay trên hệ thống.',
    action: 'Khám phá nhiệm vụ',
    tone: 'cyan',
  },
  {
    icon: <WalletOutlined />,
    title: 'Ví VNDC',
    eyebrow: 'Token · ticket · badge',
    text: 'Điểm thưởng và token được phát hành theo từng hoạt động, giúp đóng góp của sinh viên trở thành giá trị số có thể theo dõi và sử dụng.',
    action: 'Mở ví VNDC',
    tone: 'gold',
  },
  {
    icon: <SafetyCertificateOutlined />,
    title: 'DAO campus',
    eyebrow: 'Đề xuất · biểu quyết · gây quỹ',
    text: 'Các ý tưởng của cộng đồng có thể được đề xuất, bình chọn và triển khai minh bạch, tạo môi trường sinh viên chủ động hơn.',
    action: 'Tham gia quản trị',
    tone: 'violet',
  },
]

const journeySteps: JourneyStep[] = [
  {
    scene: 'connect',
    label: '01 · Onboard',
    title: 'Sinh viên bước vào campus bằng một hồ sơ thống nhất.',
    text: 'Tài khoản, ví và thông tin tham gia được gom về một nơi. Từ lần đăng nhập đầu tiên, sinh viên đã có thể theo dõi lớp học, câu lạc bộ, sự kiện và phần thưởng của mình.',
    metric: 'Một danh tính số cho toàn bộ campus',
    icon: <TeamOutlined />,
  },
  {
    scene: 'learn',
    label: '02 · Mission',
    title: 'Hoạt động được thiết kế như một hành trình có mục tiêu.',
    text: 'Workshop, điểm danh, nhiệm vụ học tập, chiến dịch truyền thông hay sự kiện ngoại khóa đều có trạng thái, deadline, bằng chứng hoàn thành và người phụ trách rõ ràng.',
    metric: 'Từ tham gia rời rạc thành nhiệm vụ có lộ trình',
    icon: <ReadOutlined />,
  },
  {
    scene: 'reward',
    label: '03 · Reward',
    title: 'Đóng góp được ghi nhận bằng token, vé và huy hiệu.',
    text: 'Khi hoàn thành nhiệm vụ, sinh viên nhận phần thưởng VNDC hoặc vật phẩm số tương ứng. Phần thưởng không chỉ để xem, mà còn có thể dùng trong marketplace và các hoạt động tiếp theo.',
    metric: 'Ghi nhận nhanh, minh bạch và có thể kiểm chứng',
    icon: <WalletOutlined />,
  },
  {
    scene: 'govern',
    label: '04 · Community',
    title: 'Cộng đồng cùng quyết định cách giá trị được sử dụng.',
    text: 'DAO giúp sinh viên đề xuất ý tưởng, biểu quyết hoạt động, gây quỹ cho dự án và theo dõi quá trình triển khai bằng dữ liệu rõ ràng.',
    metric: 'Quản trị mở cho sinh viên, CLB và nhà trường',
    icon: <SafetyCertificateOutlined />,
  },
]

const proofQuotes: ProofQuote[] = [
  {
    quote: 'Sinh viên thấy rõ mình đã tham gia gì, nhận được gì và có thể dùng phần thưởng đó ở đâu trong hệ sinh thái.',
    name: 'Sinh viên',
    role: 'Trải nghiệm cá nhân',
  },
  {
    quote: 'Câu lạc bộ có thể tổ chức hoạt động, ghi nhận người tham gia và phát thưởng mà không phải chia dữ liệu qua nhiều công cụ.',
    name: 'Câu lạc bộ',
    role: 'Vận hành sự kiện',
  },
  {
    quote: 'Nhà trường có thêm một lớp dữ liệu minh bạch để theo dõi mức độ tham gia, động lực học tập và đóng góp cộng đồng.',
    name: 'Nhà trường',
    role: 'Quản trị campus',
  },
]

const networkNodes = [
  'Sinh viên',
  'Giảng viên',
  'CLB',
  'Sự kiện',
  'Ví VNDC',
  'Badge/NFT',
  'DAO',
  'Marketplace',
]

const LANDING_STYLES = `
html { scroll-behavior: smooth; }

.v3-page {
  --ink: #06152f;
  --ink-soft: #17345f;
  --muted: #586a86;
  --line: rgba(17, 47, 91, .12);
  --blue: #0774ea;
  --blue-strong: #014fb3;
  --cyan: #12c6e9;
  --teal: #0fb7b1;
  --violet: #6754f4;
  --magenta: #d75ee8;
  --gold: #ffae2c;
  --orange: #ff7a1a;
  --glass: rgba(255, 255, 255, .72);
  --glass-strong: rgba(255, 255, 255, .86);
  --mx: .5;
  --my: .5;
  --scroll: 0;
  position: relative;
  isolation: isolate;
  min-height: 100dvh;
  overflow-x: clip;
  color: var(--ink);
  background:
    radial-gradient(760px 460px at calc(var(--mx) * 100%) 4%, rgba(18, 198, 233, .14), transparent 72%),
    radial-gradient(880px 560px at 8% 12%, rgba(7, 116, 234, .14), transparent 70%),
    linear-gradient(180deg, #ffffff 0%, #f6fbff 26%, #eef9ff 52%, #f8fbff 74%, #ffffff 100%);
}

.v3-page *, .v3-page *::before, .v3-page *::after { box-sizing: border-box; }
.v3-page a { color: inherit; text-decoration: none; }
.v3-page img { max-width: 100%; }

.v3-ambient {
  position: absolute;
  inset: 0;
  z-index: -4;
  overflow: hidden;
  pointer-events: none;
}

.v3-wave-image {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: .34;
  filter: saturate(1.08) contrast(1.02);
  mix-blend-mode: multiply;
  transform: translateY(-1%) scale(1.035);
}

.v3-ambient::before {
  content: "";
  position: absolute;
  inset: 0;
  opacity: .2;
  background-image:
    linear-gradient(rgba(7,116,234,.12) 1px, transparent 1px),
    linear-gradient(90deg, rgba(7,116,234,.09) 1px, transparent 1px);
  background-size: 64px 64px;
  mask-image: linear-gradient(180deg, transparent 0%, #000 12%, #000 82%, transparent 100%);
}

.v3-ambient::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(circle at 18% 20%, rgba(255,255,255,.82), transparent 24%),
    radial-gradient(circle at 82% 28%, rgba(255,255,255,.6), transparent 26%),
    radial-gradient(circle at 58% 72%, rgba(255,255,255,.62), transparent 28%);
}

.v3-wave {
  position: absolute;
  left: 50%;
  top: -4%;
  width: min(1120px, 92vw);
  height: 112%;
  border-radius: 46% 54% 50% 50%;
  filter: blur(38px);
  opacity: .42;
  transform-origin: center;
  mix-blend-mode: multiply;
}

.v3-wave.one {
  background:
    radial-gradient(42% 28% at 22% 18%, rgba(7,116,234,.34), transparent 62%),
    radial-gradient(36% 24% at 72% 34%, rgba(18,198,233,.25), transparent 66%),
    radial-gradient(44% 26% at 34% 62%, rgba(103,84,244,.22), transparent 70%),
    radial-gradient(48% 30% at 78% 84%, rgba(255,174,44,.18), transparent 70%);
  transform: translateX(-50%) translateY(calc(var(--scroll) * -90px)) rotate(-11deg);
  animation: v3-wave-drift 18s ease-in-out infinite alternate;
}

.v3-wave.two {
  width: min(860px, 74vw);
  left: 24%;
  opacity: .25;
  background: linear-gradient(180deg, rgba(18,198,233,.32), transparent 22%, rgba(215,94,232,.22) 46%, transparent 70%, rgba(7,116,234,.25));
  transform: translateY(calc(var(--scroll) * 120px)) rotate(15deg);
  animation: v3-wave-drift-alt 22s ease-in-out infinite alternate;
}

.v3-wave.three {
  width: min(680px, 68vw);
  left: 82%;
  opacity: .22;
  background: linear-gradient(180deg, rgba(255,174,44,.22), transparent 35%, rgba(18,198,233,.26), transparent 74%, rgba(103,84,244,.2));
  transform: translateX(-50%) translateY(calc(var(--scroll) * -120px)) rotate(-19deg);
  animation: v3-wave-drift 26s ease-in-out infinite alternate-reverse;
}

.v3-light-trail {
  position: absolute;
  width: min(720px, 84vw);
  height: 160px;
  border-radius: 999px;
  filter: blur(42px);
  opacity: .32;
  mix-blend-mode: screen;
  background: linear-gradient(90deg, transparent, rgba(18,198,233,.34), rgba(103,84,244,.18), transparent);
  transform: rotate(var(--trail-rotate, -12deg)) translate3d(0, calc(var(--scroll) * var(--trail-depth, 120px)), 0);
  animation: v3-trail-glow 8s ease-in-out infinite alternate;
}
.v3-light-trail.trail-1 { left: -8%; top: 16%; --trail-rotate: -10deg; --trail-depth: -140px; }
.v3-light-trail.trail-2 { right: -12%; top: 48%; --trail-rotate: 12deg; --trail-depth: 160px; animation-delay: -2.8s; }
.v3-light-trail.trail-3 { left: 20%; bottom: 8%; --trail-rotate: -4deg; --trail-depth: -90px; opacity: .24; animation-delay: -5s; }

.v3-particle {
  position: absolute;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: rgba(255,255,255,.9);
  box-shadow: 0 0 0 8px rgba(18,198,233,.08), 0 0 24px rgba(7,116,234,.22);
  opacity: .7;
  animation: v3-particle-float 11s ease-in-out infinite;
}
.v3-particle.p1 { left: 9%; top: 18%; }
.v3-particle.p2 { left: 78%; top: 12%; animation-delay: -2s; }
.v3-particle.p3 { left: 52%; top: 44%; animation-delay: -4s; }
.v3-particle.p4 { left: 18%; top: 66%; animation-delay: -6s; }
.v3-particle.p5 { left: 88%; top: 72%; animation-delay: -8s; }

.v3-section::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 32px;
  width: min(780px, 76vw);
  height: 1px;
  pointer-events: none;
  transform: translateX(-50%) scaleX(.72);
  transform-origin: center;
  opacity: .22;
  background: linear-gradient(90deg, transparent, rgba(7,116,234,.38), rgba(18,198,233,.44), transparent);
}

.v3-shell {
  width: min(1180px, calc(100% - 36px));
  margin-inline: auto;
}

.v3-skip {
  position: fixed;
  left: 16px;
  top: 16px;
  z-index: 100;
  transform: translateY(-150%);
  border-radius: 999px;
  background: #fff;
  color: var(--blue);
  padding: 10px 14px;
  font-weight: 900;
  box-shadow: 0 16px 38px rgba(8, 53, 120, .16);
}
.v3-skip:focus { transform: translateY(0); }

.v3-nav {
  position: sticky;
  top: 0;
  z-index: 80;
  border-bottom: 1px solid rgba(255,255,255,.72);
  background: rgba(255,255,255,.68);
  backdrop-filter: blur(24px) saturate(1.35);
  -webkit-backdrop-filter: blur(24px) saturate(1.35);
}

.v3-progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  transform-origin: left;
  opacity: .22;
  transform: scaleX(1);
  background: linear-gradient(90deg, var(--blue), var(--cyan), var(--gold));
}

.v3-nav-row {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 22px;
  min-height: 74px;
}

.v3-brand,
.v3-nav-links,
.v3-nav-actions,
.v3-hero-actions,
.v3-proof-row,
.v3-footer-socials,
.v3-pill-row {
  display: flex;
  align-items: center;
}

.v3-brand { gap: 10px; font-weight: 950; letter-spacing: -.035em; }

.v3-brand-mark {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  overflow: hidden;
  border-radius: 15px;
  background: linear-gradient(135deg, rgba(7,116,234,.12), rgba(18,198,233,.16));
  box-shadow: 0 16px 34px rgba(8,119,232,.16), inset 0 1px 0 rgba(255,255,255,.9);
}
.v3-brand-mark img { width: 32px; height: 32px; object-fit: contain; }

.v3-nav-links {
  justify-content: center;
  gap: 28px;
  color: var(--muted);
  font-size: 14px;
  font-weight: 760;
}

.v3-nav-links a {
  position: relative;
  padding: 8px 0;
}
.v3-nav-links a::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 1px;
  height: 2px;
  border-radius: 99px;
  transform: scaleX(0);
  transform-origin: left;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  transition: transform 180ms ease;
}
.v3-nav-links a:hover::after { transform: scaleX(1); }

.v3-nav-actions { justify-content: flex-end; gap: 10px; }
.v3-text-link { color: var(--muted); font-size: 14px; font-weight: 850; }

.v3-primary,
.v3-secondary,
.v3-ghost {
  height: 42px !important;
  border-radius: 999px !important;
  font-weight: 900 !important;
}
.v3-primary {
  border: 0 !important;
  color: #fff !important;
  background: linear-gradient(135deg, var(--blue), var(--blue-strong)) !important;
  box-shadow: 0 18px 42px rgba(8,119,232,.25) !important;
}
.v3-secondary {
  border-color: rgba(7, 44, 94, .14) !important;
  color: var(--ink) !important;
  background: rgba(255,255,255,.78) !important;
}
.v3-ghost {
  border-color: rgba(7, 44, 94, .12) !important;
  color: var(--blue-strong) !important;
  background: rgba(255,255,255,.42) !important;
}
.v3-primary:hover, .v3-secondary:hover, .v3-ghost:hover { transform: translateY(-1px); }

.v3-section { position: relative; padding: 104px 0; }
.v3-hero { min-height: calc(100dvh - 74px); display: grid; align-items: center; padding: 58px 0 88px; }

.v3-hero-grid {
  display: grid;
  grid-template-columns: minmax(0, .94fr) minmax(420px, 1.06fr);
  gap: 54px;
  align-items: center;
}

.v3-kicker {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  border: 1px solid rgba(7, 116, 234, .16);
  border-radius: 999px;
  background: rgba(255,255,255,.76);
  color: var(--blue-strong);
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  box-shadow: 0 12px 32px rgba(8,53,120,.06);
}

.v3-hero-title,
.v3-section-title,
.v3-card-title,
.v3-final-title {
  margin: 0;
  color: var(--ink);
  font-weight: 950;
  letter-spacing: -.058em;
}

.v3-hero-title {
  max-width: 760px;
  margin-top: 18px;
  font-size: clamp(48px, 7.6vw, 92px);
  line-height: .9;
  text-wrap: balance;
}

.v3-gradient-text {
  background: linear-gradient(100deg, var(--blue) 0%, var(--cyan) 48%, var(--violet) 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.v3-hero-copy,
.v3-section-copy,
.v3-card-copy {
  margin: 0;
  color: var(--muted);
  line-height: 1.75;
}
.v3-hero-copy { max-width: 560px; margin-top: 22px; font-size: 16px; }
.v3-hero-actions { gap: 12px; flex-wrap: wrap; margin-top: 30px; }

.v3-proof-row { gap: 10px; flex-wrap: wrap; margin-top: 22px; color: var(--muted); font-size: 13px; }
.v3-proof-pill {
  border: 1px solid rgba(7,44,94,.1);
  border-radius: 999px;
  background: rgba(255,255,255,.72);
  padding: 8px 12px;
  box-shadow: 0 10px 26px rgba(8,53,120,.06);
}

.v3-hero-visual {
  position: relative;
  min-height: 590px;
  perspective: 1200px;
}

.v3-orbit-board {
  position: absolute;
  inset: 24px 0 0;
  transform-style: preserve-3d;
}

.v3-generated-card,
.v3-media-card,
.v3-mini-card,
.v3-stat-card,
.v3-glass-panel {
  border: 1px solid rgba(255,255,255,.76);
  background:
    linear-gradient(145deg, rgba(255,255,255,.86), rgba(245,251,255,.58)),
    rgba(255,255,255,.68);
  box-shadow:
    0 28px 72px rgba(8,53,120,.1),
    inset 0 1px 0 rgba(255,255,255,.95);
  backdrop-filter: blur(20px) saturate(1.22);
  -webkit-backdrop-filter: blur(20px) saturate(1.22);
}

.v3-generated-card {
  position: absolute;
  right: 18px;
  top: 56px;
  width: min(520px, 88vw);
  border-radius: 38px;
  padding: 22px;
  transform: rotateY(-10deg) rotateZ(1.5deg);
  transition: transform 360ms ease;
}

.v3-generated-card:hover { transform: rotateY(-6deg) rotateZ(0deg) translateY(-8px); }

.v3-generated-card::after {
  content: "";
  position: absolute;
  inset: -40% auto -40% -60%;
  width: 42%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,.76), transparent);
  transform: rotate(12deg);
  animation: v3-hero-glow-sweep 7s ease-in-out infinite;
  pointer-events: none;
}

.v3-media-card {
  position: absolute;
  left: 0;
  bottom: 42px;
  width: 220px;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 50%;
  border-width: 8px;
  transform: rotate(-8deg) translateZ(48px);
}
.v3-media-card img { width: 100%; height: 100%; object-fit: cover; display: block; }

.v3-mini-card {
  position: absolute;
  right: 0;
  bottom: 22px;
  width: 230px;
  border-radius: 28px;
  padding: 18px;
  transform: rotate(5deg) translateZ(44px);
}
.v3-mini-card strong { display: block; color: var(--ink); font-size: 30px; line-height: 1; letter-spacing: -.04em; }
.v3-mini-card span { color: var(--muted); font-size: 13px; font-weight: 760; }

.v3-floating-token {
  position: absolute;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 20px;
  color: #fff;
  background: linear-gradient(135deg, var(--gold), var(--orange));
  box-shadow: 0 18px 36px rgba(255,122,26,.24);
  animation: v3-float 5.8s ease-in-out infinite;
}
.v3-floating-token.one { right: 44px; top: 10px; }
.v3-floating-token.two { left: 88px; top: 92px; background: linear-gradient(135deg, var(--violet), var(--magenta)); animation-delay: -2.4s; }

.v3-orbit-line {
  position: absolute;
  inset: 72px 0 auto auto;
  width: min(650px, 96%);
  height: 430px;
  border: 2px solid rgba(7,116,234,.18);
  border-radius: 50%;
  transform: rotate(-9deg);
  pointer-events: none;
}
.v3-orbit-line::after {
  content: "";
  position: absolute;
  right: 12%;
  top: 5%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 8px rgba(18,198,233,.16), 0 0 26px rgba(18,198,233,.8);
  animation: v3-pulse 2.4s ease-in-out infinite;
}

.v3-section-head {
  display: grid;
  grid-template-columns: minmax(0, .9fr) minmax(280px, .7fr);
  gap: 32px;
  align-items: end;
}

.v3-section-title {
  max-width: 740px;
  font-size: clamp(36px, 5vw, 64px);
  line-height: .98;
  text-wrap: balance;
}
.v3-section-copy { max-width: 560px; margin-top: 18px; font-size: 16px; }

.v3-pill-row { gap: 10px; flex-wrap: wrap; justify-content: flex-end; }
.v3-pill {
  border: 1px solid rgba(7,44,94,.11);
  border-radius: 999px;
  padding: 8px 12px;
  color: var(--muted);
  background: rgba(255,255,255,.66);
  font-size: 13px;
  font-weight: 820;
}

.v3-free-board {
  position: relative;
  min-height: 620px;
  margin-top: 54px;
  isolation: isolate;
}

.v3-free-board::before,
.v3-free-board::after {
  content: "";
  position: absolute;
  pointer-events: none;
}

.v3-free-board::before {
  left: 5%;
  right: 6%;
  top: 46%;
  height: 170px;
  border: 2px solid rgba(7,116,234,.16);
  border-bottom-color: rgba(18,198,233,.2);
  border-radius: 50%;
  transform: rotate(-5deg);
}

.v3-free-board::after {
  left: 14%;
  right: 14%;
  top: 53%;
  height: 2px;
  background: linear-gradient(90deg, transparent, rgba(7,116,234,.26), rgba(18,198,233,.3), transparent);
  transform: rotate(-2deg);
}

.v3-flow-point {
  position: absolute;
  z-index: 1;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  width: min(460px, 100%);
  gap: 18px;
  border-top: 1px solid rgba(7,44,94,.14);
  padding: 18px 0 0;
  transition: transform 320ms cubic-bezier(.2,.8,.2,1), opacity 320ms ease;
  will-change: transform;
}

.v3-flow-point::before {
  content: "";
  position: absolute;
  left: 26px;
  top: -7px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 8px rgba(18,198,233,.14), 0 0 28px rgba(7,116,234,.26);
}

.v3-flow-point:hover { transform: var(--point-hover); }
.v3-flow-point:nth-child(1) { --point-rest: translate3d(0,0,0) rotate(-2deg); --point-hover: translate3d(0,-10px,0) rotate(-1deg); --start-rotate: -8deg; left: 0; top: 34px; transform: var(--point-rest); }
.v3-flow-point:nth-child(2) { --point-rest: translate3d(0,0,0) rotate(2deg); --point-hover: translate3d(0,-12px,0) rotate(.5deg); --start-rotate: 7deg; right: 2%; top: 96px; transform: var(--point-rest); }
.v3-flow-point:nth-child(3) { --point-rest: translate3d(0,0,0) rotate(.8deg); --point-hover: translate3d(0,-10px,0) rotate(0deg); --start-rotate: -5deg; left: 17%; top: 330px; transform: var(--point-rest); }
.v3-flow-point:nth-child(4) { --point-rest: translate3d(0,0,0) rotate(-2.4deg); --point-hover: translate3d(0,-12px,0) rotate(-.8deg); --start-rotate: 6deg; right: 0; top: 410px; transform: var(--point-rest); }
.v3-flow-point.v3-reveal.is-visible { transform: var(--point-rest); }
.v3-flow-point.v3-reveal.is-visible:hover { transform: var(--point-hover); }

.v3-flow-icon {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 18px;
  color: var(--blue);
  background: linear-gradient(135deg, rgba(7,116,234,.12), rgba(18,198,233,.12));
  font-size: 24px;
}
.v3-flow-point[data-tone="cyan"] .v3-flow-icon { color: var(--teal); background: linear-gradient(135deg, rgba(18,198,233,.16), rgba(15,183,177,.12)); }
.v3-flow-point[data-tone="violet"] .v3-flow-icon { color: var(--violet); background: linear-gradient(135deg, rgba(103,84,244,.14), rgba(215,94,232,.12)); }
.v3-flow-point[data-tone="gold"] .v3-flow-icon { color: var(--orange); background: linear-gradient(135deg, rgba(255,174,44,.18), rgba(255,122,26,.1)); }

.v3-flow-point h3 { margin: 2px 0 8px; color: var(--ink); font-size: 30px; font-weight: 950; letter-spacing: -.05em; }
.v3-eyebrow { display: inline-flex; border-radius: 999px; padding: 6px 11px; border: 1px solid rgba(7,44,94,.1); background: rgba(255,255,255,.7); color: var(--muted); font-size: 12px; font-weight: 850; }
.v3-flow-point p { margin: 14px 0 12px; color: var(--muted); line-height: 1.68; }

.v3-flow-link {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 8px;
  border: 0;
  background: transparent;
  color: var(--blue-strong);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  padding: 0;
}

.v3-flow-link:hover { color: var(--blue); }

.v3-insight-grid {
  display: grid;
  grid-template-columns: .92fr 1.08fr;
  gap: 46px;
  align-items: center;
}

.v3-panel-stack { position: relative; min-height: 560px; perspective: 1000px; }
.v3-dashboard-art {
  --motion-rest: rotateY(10deg) rotateZ(-2deg);
  position: absolute;
  inset: 32px 40px auto 0;
  border-radius: 34px;
  padding: 18px;
  transform: var(--motion-rest);
}
.v3-dashboard-inner {
  overflow: hidden;
  min-height: 380px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 26% 22%, rgba(18,198,233,.24), transparent 28%),
    radial-gradient(circle at 78% 30%, rgba(255,174,44,.22), transparent 28%),
    linear-gradient(135deg, rgba(255,255,255,.92), rgba(232,247,255,.7));
}
.v3-floating-stat {
  --motion-rest: rotate(4deg);
  position: absolute;
  right: 0;
  bottom: 32px;
  width: 250px;
  border-radius: 28px;
  padding: 20px;
  transform: var(--motion-rest);
}
.v3-floating-stat strong { display: block; color: var(--ink); font-size: 42px; line-height: 1; letter-spacing: -.055em; }
.v3-floating-stat span { color: var(--muted); line-height: 1.55; }

.v3-journey {
  display: grid;
  grid-template-columns: minmax(300px, .82fr) minmax(0, 1.18fr);
  gap: 50px;
  align-items: start;
}
.v3-journey-sticky {
  position: sticky;
  top: 112px;
  min-height: 540px;
  border-radius: 34px;
  padding: 34px;
}
.v3-journey-visual { position: relative; display: grid; min-height: 320px; place-items: center; }
.v3-journey-visual img {
  width: min(260px, 76%);
  border-radius: 42px;
  filter: drop-shadow(0 30px 46px rgba(8,53,120,.18));
  transform: rotateY(-12deg) rotateX(6deg);
  animation: v3-float 6.2s ease-in-out infinite;
}
.v3-journey-ring {
  position: absolute;
  width: 84%;
  aspect-ratio: 1.55;
  border: 2px solid rgba(7,116,234,.18);
  border-radius: 50%;
  transform: rotate(-14deg);
}
.v3-journey-caption { color: var(--muted); font-weight: 760; line-height: 1.72; }

.v3-step-list {
  position: relative;
  display: grid;
  gap: 42px;
}
.v3-step-list::before {
  content: "";
  position: absolute;
  left: 22px;
  top: 16px;
  bottom: 16px;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(7,116,234,.04), rgba(7,116,234,.34), rgba(18,198,233,.34), rgba(255,174,44,.2), rgba(7,116,234,.04));
}
.v3-step {
  --motion-rest: translateX(0) rotate(0deg);
  position: relative;
  min-height: 315px;
  border-radius: 0;
  padding: 22px 0 46px 82px;
  scroll-margin-top: 120px;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.v3-step:nth-child(2n) { margin-left: 62px; --motion-rest: translateX(0) rotate(.8deg); }
.v3-step::before {
  content: "";
  position: absolute;
  left: 8px;
  top: 28px;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  background: #fff;
  border: 7px solid rgba(18,198,233,.22);
  box-shadow: 0 0 0 12px rgba(7,116,234,.05), 0 18px 36px rgba(8,53,120,.12);
}
.v3-step::after {
  content: attr(data-scene);
  position: absolute;
  right: 0;
  top: 10px;
  color: rgba(7,116,234,.055);
  font-size: clamp(70px, 10vw, 132px);
  font-weight: 950;
  letter-spacing: -.08em;
  text-transform: uppercase;
  z-index: -1;
}
.v3-step-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
.v3-step-num { color: var(--blue); font-size: 14px; font-weight: 950; letter-spacing: .08em; text-transform: uppercase; }
.v3-step-icon { display: grid; width: 50px; height: 50px; place-items: center; border-radius: 17px; background: linear-gradient(135deg, rgba(255,255,255,.86), rgba(220,246,255,.7)); color: var(--blue); font-size: 23px; box-shadow: 0 18px 44px rgba(8,53,120,.08), inset 0 1px 0 rgba(255,255,255,.95); }
.v3-step h3 { margin: 0; max-width: 720px; color: var(--ink); font-size: clamp(32px, 4.2vw, 58px); line-height: .96; letter-spacing: -.058em; text-wrap: balance; }
.v3-step p { max-width: 660px; margin: 20px 0 26px; color: var(--muted); line-height: 1.74; font-size: 16px; }
.v3-metric { display: inline-flex; border-radius: 999px; background: rgba(255,255,255,.68); border: 1px solid rgba(7,44,94,.1); color: var(--blue-strong); padding: 9px 13px; font-size: 13px; font-weight: 880; box-shadow: 0 12px 28px rgba(8,53,120,.06); }

.v3-story { text-align: center; }
.v3-story h2 { margin-inline: auto; }
.v3-stars { display: flex; justify-content: center; gap: 9px; margin-top: 24px; color: var(--gold); font-size: 20px; }
.v3-rating { margin-top: 10px; color: var(--ink); font-size: 24px; font-weight: 950; letter-spacing: -.04em; }
.v3-video {
  --motion-rest: rotate(-1deg);
  position: relative;
  overflow: hidden;
  width: min(940px, 100%);
  aspect-ratio: 16 / 8.4;
  margin: 46px auto 0;
  border: 10px solid rgba(255,255,255,.88);
  border-radius: 32px;
  box-shadow: 0 34px 82px rgba(8,53,120,.16);
  transform: var(--motion-rest);
}
.v3-video img { width: 100%; height: 100%; display: block; object-fit: cover; }
.v3-video::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 38%, rgba(4,20,44,.66)); }
.v3-play { position: absolute; inset: 0; z-index: 1; display: grid; place-items: center; color: rgba(255,255,255,.94); font-size: 64px; }
.v3-video-caption { position: absolute; z-index: 1; left: 28px; right: 28px; bottom: 24px; color: #fff; font-size: clamp(22px, 3.2vw, 36px); font-weight: 950; letter-spacing: -.05em; line-height: 1.08; }
.v3-quote-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; margin-top: 36px; text-align: left; }
.v3-quote-card {
  position: relative;
  border-left: 2px solid rgba(7,116,234,.2);
  padding: 6px 0 6px 22px;
}
.v3-quote-card p { margin: 0; color: var(--ink); line-height: 1.62; font-weight: 740; }
.v3-quote-card strong { display: block; margin-top: 18px; color: var(--blue-strong); }
.v3-quote-card span { color: var(--muted); font-size: 13px; }

.v3-network-head { display: grid; grid-template-columns: .84fr 1.16fr; gap: 36px; align-items: end; }
.v3-network-map { position: relative; min-height: 470px; margin-top: 46px; }
.v3-network-line { --orbit-rest: rotate(-9deg) scale(.88); position: absolute; inset: 0; border: 2px solid rgba(7,116,234,.18); border-radius: 50%; transform: var(--orbit-rest); }
.v3-network-line.two { --orbit-rest: rotate(12deg) scale(.72); transform: var(--orbit-rest); border-color: rgba(215,94,232,.17); }
.v3-center-node,
.v3-node { position: absolute; display: grid; place-items: center; border: 1px solid rgba(255,255,255,.78); background: rgba(255,255,255,.78); box-shadow: 0 18px 42px rgba(8,53,120,.1); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
.v3-center-node { left: 50%; top: 48%; width: 122px; height: 122px; border-radius: 36px; color: var(--blue); transform: translate(-50%, -50%) rotate(-3deg); font-size: 34px; }
.v3-center-node span { display: block; margin-top: 4px; color: var(--ink); font-size: 13px; font-weight: 950; }
.v3-node { width: 122px; height: 50px; border-radius: 999px; color: var(--muted); font-size: 13px; font-weight: 880; }
.v3-node:nth-child(4) { left: 10%; top: 16%; }
.v3-node:nth-child(5) { left: 42%; top: 3%; }
.v3-node:nth-child(6) { right: 11%; top: 19%; }
.v3-node:nth-child(7) { right: 8%; top: 59%; }
.v3-node:nth-child(8) { left: 45%; bottom: 5%; }
.v3-node:nth-child(9) { left: 9%; top: 61%; }
.v3-node:nth-child(10) { left: 24%; bottom: 15%; }
.v3-node:nth-child(11) { right: 24%; bottom: 14%; }
.v3-network-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 28px; margin-top: 42px; }
.v3-network-card {
  border-top: 1px solid rgba(7,44,94,.14);
  padding-top: 18px;
}
.v3-network-card h3 { margin: 0 0 14px; color: var(--ink); font-size: 24px; font-weight: 950; letter-spacing: -.045em; }
.v3-network-card ul { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; color: var(--muted); }
.v3-network-card li { display: flex; gap: 9px; align-items: flex-start; line-height: 1.55; }
.v3-network-card li span { color: var(--blue); margin-top: 2px; }

.v3-final { padding-bottom: 112px; }
.v3-final-panel { position: relative; overflow: hidden; border-radius: 36px; padding: 58px; text-align: center; }
.v3-final-panel::before { content: ""; position: absolute; inset: -110px auto auto -50px; width: 290px; height: 290px; border-radius: 60px; background: linear-gradient(135deg, rgba(255,122,26,.26), rgba(7,116,234,.14)); transform: rotate(-18deg); }
.v3-final-panel::after { content: ""; position: absolute; right: -60px; bottom: -100px; width: 320px; height: 320px; border-radius: 50%; background: radial-gradient(circle, rgba(18,198,233,.24), transparent 66%); }
.v3-final-panel > * { position: relative; z-index: 1; }
.v3-final-title { max-width: 780px; margin-inline: auto; font-size: clamp(36px, 5vw, 66px); line-height: .98; }
.v3-final-copy { max-width: 590px; margin: 18px auto 0; color: var(--muted); line-height: 1.72; }

.v3-footer { border-top: 1px solid rgba(7,44,94,.1); background: rgba(255,255,255,.5); padding: 42px 0; }
.v3-footer-grid { display: grid; grid-template-columns: minmax(170px, .72fr) 1fr; gap: 44px; }
.v3-footer-socials { gap: 10px; margin-top: 16px; color: var(--blue); }
.v3-footer-cols { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 20px; }
.v3-footer-col { display: grid; gap: 8px; color: var(--muted); font-size: 13px; }
.v3-footer-col h4 { margin: 0 0 4px; color: var(--ink); font-size: 13px; }

.v3-traveler {
  position: fixed;
  right: max(18px, calc((100vw - 1180px) / 2 - 20px));
  top: 34vh;
  z-index: 5;
  width: 118px;
  pointer-events: none;
  transform: translate3d(0,0,0) rotateY(-12deg) rotateZ(2deg);
  transition: top 680ms cubic-bezier(.2,.8,.2,1), right 680ms cubic-bezier(.2,.8,.2,1), width 680ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease, filter 680ms ease, transform 680ms cubic-bezier(.2,.8,.2,1);
  will-change: transform, top, right, width;
}
.v3-traveler img { width: 100%; display: block; border-radius: 28px; filter: drop-shadow(0 24px 34px rgba(8,53,120,.18)); animation: v3-float 5.8s ease-in-out infinite; }
.v3-page[data-scene="hero"] .v3-traveler { top: 65vh; width: 96px; opacity: .72; }
.v3-page[data-scene="products"] .v3-traveler { top: 30vh; width: 126px; transform: rotateY(-18deg) rotateZ(-5deg) scale(.96); }
.v3-page[data-scene="insight"] .v3-traveler { top: 46vh; right: max(18px, calc((100vw - 1180px) / 2 + 30px)); width: 142px; transform: rotateY(10deg) rotateZ(4deg) scale(1.02); }
.v3-page[data-scene="connect"] .v3-traveler,
.v3-page[data-scene="learn"] .v3-traveler,
.v3-page[data-scene="reward"] .v3-traveler,
.v3-page[data-scene="govern"] .v3-traveler { top: 24vh; }
.v3-page[data-scene="journey"] .v3-traveler { top: 24vh; width: 152px; transform: rotateY(-22deg) rotateX(7deg) rotateZ(-3deg) scale(1.04); }
.v3-page[data-scene="stories"] .v3-traveler { top: 58vh; width: 108px; opacity: .8; transform: rotateY(18deg) rotateZ(8deg) scale(.92); }
.v3-page[data-scene="network"] .v3-traveler { top: 32vh; width: 132px; filter: saturate(1.12); transform: rotateY(-8deg) rotateZ(-9deg) scale(1); }

.v3-reveal {
  opacity: 0;
  transform: translateY(34px) scale(.985);
  transition: opacity 760ms ease, transform 760ms cubic-bezier(.2,.8,.2,1);
}
.v3-reveal.is-visible { opacity: 1; transform: translateY(0) scale(1); }

@supports (animation-timeline: view()) {
  .v3-scroll-card {
    animation: v3-card-view both ease-out;
    animation-timeline: view();
    animation-range: entry 8% cover 46%;
  }

  .v3-flow-point {
    animation: v3-flow-view both cubic-bezier(.2,.8,.2,1);
    animation-timeline: view();
    animation-range: entry 4% cover 42%;
  }

  .v3-dashboard-art,
  .v3-floating-stat,
  .v3-video,
  .v3-network-card {
    animation: v3-soft-rise both cubic-bezier(.2,.8,.2,1);
    animation-timeline: view();
    animation-range: entry 8% cover 38%;
  }

  .v3-network-line {
    animation: v3-orbit-breathe both ease-out;
    animation-timeline: view();
    animation-range: entry 10% cover 70%;
  }
}

@supports (animation-timeline: scroll()) {
  .v3-progress {
    opacity: 1;
    transform: scaleX(0);
    animation: v3-progress-grow linear both;
    animation-timeline: scroll(root);
  }

  .v3-wave-image {
    animation: v3-wave-image-scroll linear both;
    animation-timeline: scroll(root);
  }
}

@keyframes v3-card-view {
  from { opacity: .18; transform: translateY(70px) rotate(var(--start-rotate, 0deg)) scale(.94); filter: blur(4px); }
  to { opacity: 1; transform: translateY(0) rotate(var(--end-rotate, 0deg)) scale(1); filter: blur(0); }
}

@keyframes v3-flow-view {
  from { opacity: .12; transform: translateY(92px) rotate(var(--start-rotate, 0deg)) scale(.96); filter: blur(5px); }
  to { opacity: 1; transform: var(--point-rest); filter: blur(0); }
}

@keyframes v3-soft-rise {
  from { opacity: .24; transform: translateY(64px) scale(.96); filter: blur(4px); }
  to { opacity: 1; transform: var(--motion-rest, translateY(0)); filter: blur(0); }
}

@keyframes v3-orbit-breathe {
  from { opacity: .18; transform: rotate(-18deg) scale(.74); }
  to { opacity: 1; transform: var(--orbit-rest); }
}

@keyframes v3-progress-grow {
  to { transform: scaleX(1); }
}

@keyframes v3-wave-image-scroll {
  from { transform: translateY(-1%) scale(1.035); }
  to { transform: translateY(1.4%) scale(1.07); }
}

@keyframes v3-trail-glow {
  from { opacity: .18; filter: blur(48px); }
  to { opacity: .42; filter: blur(34px); }
}

@keyframes v3-particle-float {
  0%, 100% { transform: translate3d(0, 0, 0) scale(.78); opacity: .34; }
  35% { transform: translate3d(24px, -38px, 0) scale(1); opacity: .78; }
  70% { transform: translate3d(-18px, 22px, 0) scale(.9); opacity: .52; }
}

@keyframes v3-hero-glow-sweep {
  from { transform: translateX(-120%) rotate(12deg); opacity: 0; }
  30% { opacity: .48; }
  to { transform: translateX(160%) rotate(12deg); opacity: 0; }
}

@keyframes v3-float {
  0%, 100% { transform: translate3d(0, 0, 0) rotateZ(0deg); }
  50% { transform: translate3d(0, -14px, 0) rotateZ(1.8deg); }
}
@keyframes v3-pulse {
  0%, 100% { transform: scale(1); opacity: .74; }
  50% { transform: scale(1.18); opacity: 1; }
}
@keyframes v3-wave-drift {
  from { border-radius: 46% 54% 50% 50%; filter: blur(38px); }
  to { border-radius: 54% 46% 58% 42%; filter: blur(48px); }
}
@keyframes v3-wave-drift-alt {
  from { opacity: .2; filter: blur(44px); }
  to { opacity: .34; filter: blur(56px); }
}

@media (max-width: 1100px) {
  .v3-traveler { display: none; }
  .v3-hero-grid,
  .v3-insight-grid,
  .v3-journey,
  .v3-network-head,
  .v3-section-head { grid-template-columns: 1fr; }
  .v3-journey-sticky { position: relative; top: auto; min-height: auto; }
  .v3-pill-row { justify-content: flex-start; }
  .v3-step:nth-child(2n) { margin-left: 0; }
}

@media (max-width: 880px) {
  .v3-nav-row { grid-template-columns: 1fr auto; min-height: 66px; }
  .v3-nav-links, .v3-text-link { display: none; }
  .v3-section { padding: 72px 0; }
  .v3-hero { min-height: auto; padding-top: 38px; }
  .v3-hero-grid { gap: 28px; }
  .v3-hero-visual { min-height: 510px; }
  .v3-generated-card { right: 0; left: 0; top: 48px; width: 100%; border-radius: 28px; }
  .v3-media-card { width: 150px; bottom: 38px; }
  .v3-mini-card { width: 190px; bottom: 0; }
  .v3-floating-token.two { left: 12px; }
  .v3-free-board { display: grid; gap: 18px; min-height: auto; }
  .v3-free-board::before,
  .v3-free-board::after { display: none; }
  .v3-flow-point { position: relative; inset: auto !important; width: 100%; transform: none !important; }
  .v3-flow-point.v3-reveal.is-visible { transform: none; }
  .v3-panel-stack { min-height: 480px; }
  .v3-dashboard-art { inset: 20px 0 auto; }
  .v3-floating-stat { right: 10px; width: 220px; }
  .v3-quote-grid,
  .v3-network-cards,
  .v3-footer-grid,
  .v3-footer-cols { grid-template-columns: 1fr; }
  .v3-network-map { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; min-height: auto; }
  .v3-network-line, .v3-center-node { display: none; }
  .v3-node:nth-child(n) { position: relative; inset: auto; width: 100%; transform: none; }
  .v3-final-panel { padding: 38px 22px; }
}

@media (max-width: 560px) {
  .v3-shell { width: min(100% - 24px, 1180px); }
  .v3-hero-title { font-size: clamp(42px, 15vw, 62px); }
  .v3-hero-actions .ant-btn { width: 100%; }
  .v3-hero-visual { min-height: 430px; }
  .v3-media-card { display: none; }
  .v3-mini-card { left: 12px; right: 12px; width: auto; }
  .v3-floating-token { width: 48px; height: 48px; border-radius: 16px; }
  .v3-network-map { grid-template-columns: 1fr; }
  .v3-video { border-width: 6px; border-radius: 22px; }
}

@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .v3-reveal,
  .v3-traveler,
  .v3-traveler img,
  .v3-floating-token,
  .v3-journey-visual img,
  .v3-wave,
  .v3-wave-image,
  .v3-progress {
    animation: none !important;
    transition: none !important;
    transform: none !important;
  }
  .v3-reveal { opacity: 1; }
  .v3-progress { opacity: .45; transform: scaleX(1) !important; }
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
    upsertMeta('name', 'theme-color', '#0774ea')
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
          name: 'VNDC Campus',
          url: canonicalUrl,
          description: config.description,
          inLanguage: 'vi-VN',
        },
        {
          '@type': 'SoftwareApplication',
          '@id': `${canonicalUrl}#software`,
          name: 'VNDC Campus',
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
    const revealItems = Array.from(root.querySelectorAll<HTMLElement>('.v3-reveal'))

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

function usePointerGlow(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    let frame = 0
    let nextX = 0.5
    let nextY = 0.5

    const commitPointer = () => {
      root.style.setProperty('--mx', nextX.toFixed(4))
      root.style.setProperty('--my', nextY.toFixed(4))
      frame = 0
    }

    const updatePointer = (event: PointerEvent) => {
      nextX = event.clientX / window.innerWidth
      nextY = event.clientY / window.innerHeight
      if (!frame) frame = window.requestAnimationFrame(commitPointer)
    }

    window.addEventListener('pointermove', updatePointer, { passive: true })

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', updatePointer)
    }
  }, [rootRef])
}


function useScrollMotion(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    let frame = 0

    const updateScroll = () => {
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, window.scrollY / maxScroll))
      root.style.setProperty('--scroll', progress.toFixed(4))
      frame = 0
    }

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll)
    }

    updateScroll()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [rootRef])
}

function AmbientBackground() {
  return (
    <div className="v3-ambient" aria-hidden="true">
      <img className="v3-wave-image" src={waveBackground} alt="" />
      <div className="v3-wave one" />
      <div className="v3-wave two" />
      <div className="v3-wave three" />
      <div className="v3-light-trail trail-1" />
      <div className="v3-light-trail trail-2" />
      <div className="v3-light-trail trail-3" />
      <span className="v3-particle p1" />
      <span className="v3-particle p2" />
      <span className="v3-particle p3" />
      <span className="v3-particle p4" />
      <span className="v3-particle p5" />
    </div>
  )
}

function AbstractCampusVisual({ id = 'hero' }: { id?: string }) {
  const bookGradient = `v3-book-${id}`
  const cyanGradient = `v3-cyan-${id}`
  const blueGradient = `v3-blue-${id}`
  const goldGradient = `v3-gold-${id}`
  const glowFilter = `v3-glow-${id}`

  return (
    <svg viewBox="0 0 640 520" role="img" aria-label="Biểu tượng trừu tượng về sinh viên kết nối, học tập và phần thưởng số">
      <defs>
        <linearGradient id={bookGradient} x1="80" y1="440" x2="560" y2="220" gradientUnits="userSpaceOnUse">
          <stop stopColor="#014bd8" />
          <stop offset=".55" stopColor="#0774ea" />
          <stop offset="1" stopColor="#12c6e9" />
        </linearGradient>
        <linearGradient id={blueGradient} x1="160" y1="160" x2="330" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#003ad6" />
          <stop offset="1" stopColor="#6754f4" />
        </linearGradient>
        <linearGradient id={cyanGradient} x1="360" y1="90" x2="520" y2="410" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14d8f4" />
          <stop offset="1" stopColor="#0570d7" />
        </linearGradient>
        <linearGradient id={goldGradient} x1="286" y1="236" x2="340" y2="292" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7c8" />
          <stop offset=".45" stopColor="#ffb837" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
        <filter id={glowFilter} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur" />
          <feColorMatrix in="blur" type="matrix" values="1 0 0 0 1  0 .58 0 0 .62  0 0 .08 0 .15  0 0 0 .88 0" />
          <feBlend in="SourceGraphic" />
        </filter>
      </defs>

      <path d="M92 410C178 316 248 294 320 438C392 294 462 316 548 410" fill="none" stroke="#cdeeff" strokeWidth="30" strokeLinecap="round" opacity=".72" />
      <path d="M102 395C184 362 246 372 306 462C232 424 168 414 80 440Z" fill={`url(#${bookGradient})`} opacity=".96" />
      <path d="M538 395C456 362 394 372 334 462C408 424 472 414 560 440Z" fill={`url(#${bookGradient})`} opacity=".96" />
      <path d="M128 352C194 346 250 368 302 452" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />
      <path d="M512 352C446 346 390 368 338 452" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />

      <path d="M86 312C126 244 210 190 292 222" fill="none" stroke="#65d9f7" strokeWidth="5" strokeLinecap="round" opacity=".6" />
      <path d="M346 160C430 112 532 132 582 208" fill="none" stroke="#34ccef" strokeWidth="5" strokeLinecap="round" opacity=".72" />
      <path d="M548 206l18 0M557 197l0 18" stroke="#0fc6e8" strokeWidth="5" strokeLinecap="round" opacity=".82" />

      <circle cx="204" cy="168" r="32" fill={`url(#${blueGradient})`} />
      <path d="M150 240C166 192 210 190 252 226L320 282C278 294 238 286 208 264C178 312 164 354 132 384L72 370C98 312 122 260 150 240Z" fill={`url(#${blueGradient})`} />

      <circle cx="422" cy="112" r="35" fill={`url(#${cyanGradient})`} />
      <path d="M360 204C388 146 432 144 482 160C506 170 508 202 486 222L406 294C380 290 350 276 324 256Z" fill={`url(#${cyanGradient})`} />
      <path d="M410 306L492 270L552 380H464C438 340 428 322 410 306Z" fill={`url(#${cyanGradient})`} />

      <path d="M285 256C300 278 325 282 347 262" stroke={`url(#${goldGradient})`} strokeWidth="20" strokeLinecap="round" filter={`url(#${glowFilter})`} />
      <path d="M318 237L346 252V284L318 300L290 284V252Z" fill="#fff" opacity=".98" />
      <path d="M318 230L354 250V286L318 306L282 286V250Z" fill="none" stroke={`url(#${goldGradient})`} strokeWidth="8" filter={`url(#${glowFilter})`} />
      <circle cx="318" cy="268" r="12" fill={`url(#${goldGradient})`} filter={`url(#${glowFilter})`} />
    </svg>
  )
}

function DashboardVisual() {
  return (
    <svg viewBox="0 0 720 460" role="img" aria-label="Bảng điều khiển VNDC trừu tượng">
      <defs>
        <linearGradient id="dashA" x1="80" y1="60" x2="650" y2="380" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0774ea" />
          <stop offset=".55" stopColor="#12c6e9" />
          <stop offset="1" stopColor="#6754f4" />
        </linearGradient>
        <linearGradient id="dashGold" x1="340" y1="140" x2="430" y2="230" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff7c8" />
          <stop offset=".5" stopColor="#ffb837" />
          <stop offset="1" stopColor="#ff7a1a" />
        </linearGradient>
      </defs>
      <rect x="56" y="60" width="608" height="340" rx="34" fill="rgba(255,255,255,.82)" />
      <path d="M96 330C164 210 246 250 314 178C390 96 490 120 604 86" fill="none" stroke="url(#dashA)" strokeWidth="32" strokeLinecap="round" opacity=".82" />
      <path d="M96 340C172 280 228 312 302 250C380 184 478 206 604 170" fill="none" stroke="#d9f4ff" strokeWidth="18" strokeLinecap="round" />
      <path d="M382 150L430 178V234L382 262L334 234V178Z" fill="url(#dashGold)" opacity=".94" />
      <path d="M124 122h120M124 162h80" stroke="#86ddf3" strokeWidth="14" strokeLinecap="round" />
      <circle cx="568" cy="300" r="42" fill="#e6faff" />
      <path d="M548 300h40M568 280v40" stroke="#12c6e9" strokeWidth="10" strokeLinecap="round" />
      <path d="M122 382h476" stroke="#d7eef9" strokeWidth="12" strokeLinecap="round" />
    </svg>
  )
}

export function LandingPage() {
  const navigate = useNavigate()
  const pageRef = useRef<HTMLElement>(null)
  const activeScene = useActiveScene(pageRef)

  useLandingSeo(SITE_SEO)
  useRevealOnScroll(pageRef)
  usePointerGlow(pageRef)
  useScrollMotion(pageRef)

  const goLogin = () => navigate('/login')

  return (
    <main ref={pageRef} className="v3-page" data-scene={activeScene} id="main-content">
      <style>{LANDING_STYLES}</style>
      <AmbientBackground />
      <a className="v3-skip" href="#products">Bỏ qua phần đầu</a>

      <div className="v3-traveler" aria-hidden="true">
        <img src={orbImage} alt="" />
      </div>

      <header className="v3-nav" aria-label="Điều hướng trang chủ VNDC">
        <div className="v3-progress" aria-hidden="true" />
        <div className="v3-shell v3-nav-row">
          <a className="v3-brand" href="#top" aria-label="Trang chủ VNDC">
            <span className="v3-brand-mark"><img src={orbImage} alt="" /></span>
            <span>VNDC Campus</span>
          </a>

          <nav className="v3-nav-links" aria-label="Nội dung chính">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>{link.label}</a>
            ))}
          </nav>

          <div className="v3-nav-actions">
            <a className="v3-text-link" href="#stories"><SearchOutlined /> Khám phá</a>
            <Button className="v3-secondary" icon={<LoginOutlined />} onClick={goLogin}>Đăng nhập</Button>
            <Button className="v3-primary" onClick={goLogin}>Tham gia beta</Button>
          </div>
        </div>
      </header>

      <section id="top" className="v3-hero v3-section" data-scene="hero">
        <div className="v3-shell v3-hero-grid">
          <div className="v3-reveal">
            <div className="v3-kicker"><ThunderboltOutlined /> VNDC CAMPUS PLATFORM</div>
            <h1 className="v3-hero-title">
              Hệ sinh thái token cho <span className="v3-gradient-text">campus hiện đại.</span>
            </h1>
            <p className="v3-hero-copy">
              VNDC biến hoạt động sinh viên thành một trải nghiệm số liền mạch: tham gia nhiệm vụ, nhận token, sở hữu huy hiệu, dùng marketplace và cùng biểu quyết cho cộng đồng.
            </p>
            <div className="v3-hero-actions">
              <Button className="v3-primary" size="large" onClick={goLogin}>
                Trải nghiệm VNDC <ArrowRightOutlined />
              </Button>
              <Button className="v3-secondary" size="large" href="#journey">
                Xem cách vận hành
              </Button>
            </div>
            <div className="v3-proof-row" aria-label="Điểm nổi bật">
              <span className="v3-proof-pill">Hồ sơ sinh viên</span>
              <span className="v3-proof-pill">Mission campus</span>
              <span className="v3-proof-pill">VNDC reward</span>
            </div>
          </div>

          <div className="v3-hero-visual v3-reveal" aria-label="Mô hình hệ sinh thái token VNDC cho campus">
            <div className="v3-orbit-board">
              <div className="v3-orbit-line" aria-hidden="true" />
              <div className="v3-floating-token one" aria-hidden="true"><StarFilled /></div>
              <div className="v3-floating-token two" aria-hidden="true"><FundProjectionScreenOutlined /></div>
              <figure className="v3-generated-card">
                <AbstractCampusVisual id="hero" />
              </figure>
              <figure className="v3-media-card" aria-hidden="true">
                <img src={heroImage} alt="" />
              </figure>
              <div className="v3-mini-card">
                <strong>VNDC</strong>
                <span>nơi hoạt động sinh viên được ghi nhận bằng giá trị số</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="products" className="v3-section" data-scene="products" aria-labelledby="products-title">
        <div className="v3-shell">
          <div className="v3-section-head">
            <div>
              <h2 id="products-title" className="v3-section-title v3-reveal">Một sản phẩm cho toàn bộ vòng đời hoạt động sinh viên.</h2>
              <p className="v3-section-copy v3-reveal">
                VNDC không chỉ là ví token. Đây là lớp sản phẩm kết nối danh tính sinh viên, nhiệm vụ học tập, sự kiện, phần thưởng, marketplace và quản trị cộng đồng.
              </p>
            </div>
            <div className="v3-pill-row v3-reveal" aria-label="Hệ sinh thái">
              <span className="v3-pill">Profile</span>
              <span className="v3-pill">Mission</span>
              <span className="v3-pill">Wallet</span>
              <span className="v3-pill">DAO</span>
            </div>
          </div>

          <div className="v3-free-board">
            {ecosystemPoints.map((item) => (
              <article key={item.title} className="v3-flow-point v3-reveal" data-tone={item.tone}>
                <div className="v3-flow-icon" aria-hidden="true">{item.icon}</div>
                <div>
                  <h3>{item.title}</h3>
                  <span className="v3-eyebrow">{item.eyebrow}</span>
                  <p>{item.text}</p>
                  <button className="v3-flow-link" type="button" onClick={goLogin}>
                    {item.action} <ArrowRightOutlined />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="v3-section" data-scene="insight" aria-labelledby="insight-title">
        <div className="v3-shell v3-insight-grid">
          <div className="v3-reveal">
            <div className="v3-kicker"><FundProjectionScreenOutlined /> product operating layer</div>
            <h2 id="insight-title" className="v3-section-title" style={{ marginTop: 18 }}>
              Từ dữ liệu tham gia đến phần thưởng, mọi giá trị đều có ngữ cảnh.
            </h2>
            <p className="v3-section-copy">
              Mỗi token VNDC được gắn với hoạt động cụ thể: ai tham gia, hoàn thành điều gì, nhận thưởng khi nào và có thể sử dụng trong phần nào của hệ sinh thái.
            </p>
            <Button className="v3-primary" style={{ marginTop: 24 }}>Mở bảng điều khiển</Button>
          </div>

          <div className="v3-panel-stack v3-reveal">
            <div className="v3-dashboard-art v3-glass-panel">
              <div className="v3-dashboard-inner"><DashboardVisual /></div>
            </div>
            <div className="v3-floating-stat v3-glass-panel">
              <strong>1 hệ sinh thái</strong>
              <span>cho phép học tập, sự kiện, phần thưởng và quản trị cộng đồng vận hành trên cùng một nền tảng.</span>
            </div>
          </div>
        </div>
      </section>

      <section id="journey" className="v3-section" data-scene="journey" aria-labelledby="journey-title">
        <div className="v3-shell v3-journey">
          <aside className="v3-glass-panel v3-journey-sticky v3-reveal">
            <div className="v3-kicker"><ReadOutlined /> student experience</div>
            <h2 id="journey-title" className="v3-section-title" style={{ marginTop: 18 }}>Từ lần đăng nhập đầu tiên đến khi trở thành thành viên đóng góp.</h2>
            <div className="v3-journey-visual" aria-hidden="true">
              <div className="v3-journey-ring" />
              <img src={orbImage} alt="" />
            </div>
            <p className="v3-journey-caption">
              Sinh viên không cần hiểu phức tạp về blockchain. VNDC đặt công nghệ phía sau một trải nghiệm quen thuộc: làm nhiệm vụ, nhận thưởng, dùng quyền lợi và tham gia cộng đồng.
            </p>
          </aside>

          <div className="v3-step-list">
            {journeySteps.map((step) => (
              <article key={step.scene} className="v3-step v3-reveal v3-scroll-card" data-scene={step.scene}>
                <div className="v3-step-head">
                  <span className="v3-step-num">{step.label}</span>
                  <span className="v3-step-icon" aria-hidden="true">{step.icon}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
                <span className="v3-metric">{step.metric}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="stories" className="v3-section v3-story" data-scene="stories" aria-labelledby="stories-title">
        <div className="v3-shell">
          <h2 id="stories-title" className="v3-section-title v3-reveal">VNDC tạo động lực cho cộng đồng học tập năng động hơn.</h2>
          <div className="v3-stars v3-reveal" aria-hidden="true">
            <StarFilled /><StarFilled /><StarFilled /><StarFilled /><StarFilled />
          </div>
          <div className="v3-rating v3-reveal">Thiết kế cho sinh viên, câu lạc bộ, sự kiện và những chương trình cần ghi nhận đóng góp rõ ràng.</div>
          <p className="v3-section-copy v3-reveal" style={{ marginInline: 'auto' }}>
            Khi thành tích được nhìn thấy và có thể sử dụng, sinh viên có thêm lý do để tham gia. Khi dữ liệu được kết nối, nhà trường và CLB vận hành cộng đồng dễ hơn.
          </p>

          <figure className="v3-video v3-reveal">
            <img src={storyImage} alt="Nhóm sinh viên VNDC đang lập kế hoạch cho một sự kiện trong phòng workshop" />
            <div className="v3-play" aria-hidden="true"><PlayCircleFilled /></div>
            <figcaption className="v3-video-caption">Một campus nơi mỗi workshop, nhiệm vụ và sự kiện đều tạo ra giá trị số cho người tham gia.</figcaption>
          </figure>

          <div className="v3-quote-grid">
            {proofQuotes.map((item) => (
              <article key={item.name} className="v3-quote-card v3-reveal v3-scroll-card">
                <p>“{item.quote}”</p>
                <strong>{item.name}</strong>
                <span>{item.role}</span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="network" className="v3-section" data-scene="network" aria-labelledby="network-title">
        <div className="v3-shell">
          <div className="v3-network-head">
            <h2 id="network-title" className="v3-section-title v3-reveal">Tất cả thành phần của campus cùng vận hành trong một mạng lưới mở.</h2>
            <p className="v3-section-copy v3-reveal">
              Từ hồ sơ cá nhân đến ví thưởng, từ sự kiện đến marketplace, VNDC tạo một dòng chảy dữ liệu và giá trị thống nhất cho cộng đồng sinh viên.
            </p>
          </div>

          <div className="v3-network-map v3-reveal" aria-label="Hệ sinh thái kết nối VNDC">
            <div className="v3-network-line" aria-hidden="true" />
            <div className="v3-network-line two" aria-hidden="true" />
            <div className="v3-center-node" aria-hidden="true"><TeamOutlined /><span>VNDC</span></div>
            {networkNodes.map((node) => (
              <div className="v3-node" key={node}>{node}</div>
            ))}
          </div>

          <div className="v3-network-cards">
            <article className="v3-network-card v3-reveal">
              <h3><CommentOutlined /> Kết nối</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Hồ sơ sinh viên kết nối lớp học, câu lạc bộ và sự kiện.</li>
                <li><span><CheckCircleFilled /></span> Thông báo và nhiệm vụ đi theo đúng bối cảnh người dùng.</li>
                <li><span><CheckCircleFilled /></span> Dữ liệu tham gia được lưu lại để dễ theo dõi tiến độ.</li>
              </ul>
            </article>
            <article className="v3-network-card v3-reveal">
              <h3><ApartmentOutlined /> Học tập</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Tạo mission cho workshop, điểm danh, chiến dịch và dự án.</li>
                <li><span><CheckCircleFilled /></span> Theo dõi trạng thái hoàn thành và minh chứng đóng góp.</li>
                <li><span><CheckCircleFilled /></span> Tạo hành trình phát triển có milestone rõ ràng.</li>
              </ul>
            </article>
            <article className="v3-network-card v3-reveal">
              <h3><WalletOutlined /> Phần thưởng</h3>
              <ul>
                <li><span><CheckCircleFilled /></span> Token VNDC gắn với hoạt động và quyền lợi cụ thể.</li>
                <li><span><CheckCircleFilled /></span> Vé, huy hiệu, badge/NFT và marketplace hoạt động liền mạch.</li>
                <li><span><CheckCircleFilled /></span> DAO giúp cộng đồng đề xuất và biểu quyết minh bạch hơn.</li>
              </ul>
            </article>
          </div>
        </div>
      </section>

      <section className="v3-section v3-final" data-scene="network" aria-labelledby="final-title">
        <div className="v3-shell">
          <div className="v3-glass-panel v3-final-panel v3-reveal">
            <h2 id="final-title" className="v3-final-title">Sẵn sàng đưa VNDC vào trải nghiệm campus của bạn?</h2>
            <p className="v3-final-copy">
              Khởi động với hồ sơ sinh viên và mission học tập, sau đó mở rộng sang ví thưởng, marketplace, badge/NFT và DAO theo đúng nhu cầu của cộng đồng.
            </p>
            <div className="v3-hero-actions" style={{ justifyContent: 'center' }}>
              <Button className="v3-primary" size="large" onClick={goLogin}>Vào sản phẩm</Button>
              <Button className="v3-secondary" size="large" href="#products">Khám phá hệ sinh thái</Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="v3-footer">
        <div className="v3-shell v3-footer-grid">
          <div>
            <a className="v3-brand" href="#top" aria-label="Trang chủ VNDC">
              <span className="v3-brand-mark"><img src={orbImage} alt="" /></span>
              <span>VNDC Campus</span>
            </a>
            <div className="v3-footer-socials" aria-hidden="true">
              <GithubOutlined />
              <CommentOutlined />
              <UserOutlined />
            </div>
          </div>

          <div className="v3-footer-cols">
            <div className="v3-footer-col">
              <h4>Sản phẩm</h4>
              <a href="#products">Hồ sơ sinh viên</a>
              <a href="#products">Mission học tập</a>
              <a href="#products">Ví VNDC</a>
            </div>
            <div className="v3-footer-col">
              <h4>Dành cho ai</h4>
              <span>Sinh viên</span>
              <span>Giảng viên</span>
              <span>Quản trị viên</span>
            </div>
            <div className="v3-footer-col">
              <h4>Tài nguyên</h4>
              <a href="#journey">Trải nghiệm</a>
              <a href="#stories">Giá trị</a>
              <a href="#network">Hệ sinh thái</a>
            </div>
            <div className="v3-footer-col">
              <h4>Nền tảng</h4>
              <span>Hệ sinh thái campus</span>
              <span>Blockchain minh bạch</span>
              <span>Quyền riêng tư người dùng</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  )
}
