import { useState } from 'react';
import {
  BookOpen, Layers, Shield, Coins, GraduationCap, Vote, CreditCard,
  FileText, IdCard, Award, Users, Star, Briefcase, Building2,
  FlaskConical, Search, BarChart3, ArrowLeftRight, Plug, Trophy,
  Wallet, ChevronDown, ChevronRight, ExternalLink, Code, Cpu,
  Lock, Zap, Globe, GitBranch,
} from 'lucide-react';

interface Module {
  name: string;
  icon: typeof Coins;
  standard: string;
  description: string;
  features: string[];
  contracts: string[];
}

const MODULES: Module[] = [
  {
    name: 'VNDC Token',
    icon: Coins,
    standard: 'ERC-20 + ERC-20Permit',
    description: 'Đồng tiền kỹ thuật số chính của hệ sinh thái campus. Hỗ trợ mint, burn, pause và gasless approval qua EIP-2612.',
    features: ['Mint / Burn có kiểm soát', 'Pause toàn hệ thống', 'Gasless Permit (EIP-2612)', 'Role-based Access Control'],
    contracts: ['VNDCToken.sol'],
  },
  {
    name: 'Bằng cấp & Chứng chỉ',
    icon: Shield,
    standard: 'ERC-721 NFT',
    description: 'Cấp, xác minh và thu hồi bằng cấp/chứng chỉ dưới dạng NFT. Mỗi chứng chỉ là một token không thể thay thế.',
    features: ['Cấp chứng chỉ NFT', 'Xác minh on-chain', 'Thu hồi / Expire', 'IPFS Metadata'],
    contracts: ['CredentialVerification.sol', 'CredentialNFT.sol'],
  },
  {
    name: 'Thưởng học tập',
    icon: GraduationCap,
    standard: 'GPA-Based Rewards',
    description: 'Hệ thống phần thưởng tự động dựa trên GPA. Sinh viên đạt ngưỡng GPA sẽ nhận VNDC và NFT badge.',
    features: ['4 bậc thưởng GPA', 'Phát thưởng tự động', 'Academic Badge NFT', 'Thống kê phần thưởng'],
    contracts: ['AcademicReward.sol', 'AcademicBadgeNFT.sol'],
  },
  {
    name: 'Ngoại khóa',
    icon: Trophy,
    standard: 'Activity Tracking',
    description: 'Ghi nhận và thưởng cho các hoạt động ngoại khóa: CLB, tình nguyện, thể thao, văn nghệ.',
    features: ['Đăng ký hoạt động', 'Xác nhận tham gia', 'Activity Badge NFT', 'Bảng xếp hạng'],
    contracts: ['ExtracurricularReward.sol', 'ActivityBadge.sol'],
  },
  {
    name: 'Thanh toán',
    icon: CreditCard,
    standard: 'Multi-Payment',
    description: 'Xử lý thanh toán học phí, dịch vụ campus bằng VNDC. Hỗ trợ merchant registry và hoàn tiền.',
    features: ['Thanh toán VNDC', 'Merchant Registry', 'Hoàn tiền', 'Lịch sử giao dịch'],
    contracts: ['PaymentProcessor.sol', 'MerchantRegistry.sol'],
  },
  {
    name: 'Hồ sơ học tập',
    icon: FileText,
    standard: 'On-chain Records',
    description: 'Quản lý hồ sơ sinh viên, bảng điểm, GPA on-chain. Dữ liệu bất biến và có thể xác minh.',
    features: ['Tạo hồ sơ', 'Nhập điểm', 'Tính GPA tự động', 'Bảng điểm on-chain'],
    contracts: ['StudentRecordManager.sol'],
  },
  {
    name: 'Quản trị DAO',
    icon: Vote,
    standard: 'ERC-20Votes Governance',
    description: 'Hệ thống quản trị phi tập trung. Sinh viên đề xuất và bỏ phiếu cho các quyết định campus.',
    features: ['Tạo đề xuất', 'Bỏ phiếu', 'Thực thi on-chain', 'Governance Token'],
    contracts: ['StudentDAO.sol', 'GovernanceToken.sol'],
  },
  {
    name: 'Thẻ sinh viên',
    icon: IdCard,
    standard: 'SBT (Soulbound)',
    description: 'Thẻ sinh viên số dưới dạng Soulbound Token. Không thể chuyển nhượng, gắn với danh tính on-chain.',
    features: ['Phát hành thẻ SBT', 'Tạm ngưng / Kích hoạt', 'Thu hồi', 'Xác minh danh tính'],
    contracts: ['StudentIDToken.sol'],
  },
  {
    name: 'Chứng chỉ nghề',
    icon: Award,
    standard: 'ERC-1155',
    description: 'Hệ thống chứng chỉ nghề nghiệp ERC-1155. Một chứng chỉ có thể cấp cho nhiều người.',
    features: ['Tạo loại chứng chỉ', 'Cấp hàng loạt', 'Xác minh', 'Multi-token'],
    contracts: ['CertificationSystem.sol'],
  },
  {
    name: 'Học bổng',
    icon: Wallet,
    standard: 'Scholarship Pool',
    description: 'Quản lý quỹ học bổng on-chain. Tạo, phân bổ và giải ngân học bổng minh bạch.',
    features: ['Tạo học bổng', 'Đăng ký ứng tuyển', 'Xét duyệt', 'Giải ngân tự động'],
    contracts: ['ScholarshipManager.sol'],
  },
  {
    name: 'Cựu sinh viên',
    icon: Users,
    standard: 'Alumni Network',
    description: 'Mạng lưới cựu sinh viên on-chain. Đăng ký, kết nối, tổ chức sự kiện và mentorship.',
    features: ['Đăng ký alumni', 'Sự kiện', 'Mentorship', 'Quyên góp'],
    contracts: ['AlumniRegistry.sol'],
  },
  {
    name: 'Danh tiếng',
    icon: Star,
    standard: 'Reputation System',
    description: 'Hệ thống danh tiếng và xếp hạng. Tích điểm từ hoạt động, nhận badge theo cấp bậc.',
    features: ['Reputation Score', 'Badge NFT theo cấp', 'Bảng xếp hạng', 'Lịch sử hoạt động'],
    contracts: ['ReputationBadgeSystem.sol'],
  },
  {
    name: 'Việc làm',
    icon: Briefcase,
    standard: 'Job Board',
    description: 'Bảng tin việc làm và tuyển dụng. Doanh nghiệp đăng tin, sinh viên ứng tuyển on-chain.',
    features: ['Đăng tin tuyển dụng', 'Ứng tuyển', 'Trạng thái đơn', 'Thưởng giới thiệu'],
    contracts: ['JobBoard.sol'],
  },
  {
    name: 'Thực tập',
    icon: Building2,
    standard: 'Internship Program',
    description: 'Quản lý chương trình thực tập. Đăng ký, theo dõi tiến độ, đánh giá và chứng nhận.',
    features: ['Tạo chương trình', 'Đăng ký thực tập', 'Đánh giá', 'Chứng nhận hoàn thành'],
    contracts: ['InternshipManager.sol'],
  },
  {
    name: 'Nghiên cứu',
    icon: FlaskConical,
    standard: 'Research Collaboration',
    description: 'Nền tảng hợp tác nghiên cứu. Tạo dự án, mời cộng tác, quản lý tài trợ.',
    features: ['Tạo dự án nghiên cứu', 'Mời cộng tác', 'Quản lý tài trợ', 'Xuất bản kết quả'],
    contracts: ['ResearchCollaborationPlatform.sol'],
  },
  {
    name: 'Sàn giao dịch',
    icon: ArrowLeftRight,
    standard: 'Internal DEX',
    description: 'Sàn giao dịch nội bộ cho campus. Marketplace mua bán tài liệu, dịch vụ bằng VNDC.',
    features: ['Trading pairs', 'Limit/Market orders', 'Marketplace', 'Biểu đồ giá'],
    contracts: ['InternalExchange.sol'],
  },
  {
    name: 'Kiểm toán',
    icon: Search,
    standard: 'Auditing System',
    description: 'Hệ thống kiểm toán smart contract. Đăng ký kiểm toán, phát hiện lỗ hổng, báo cáo.',
    features: ['Đăng ký kiểm toán', 'Phân loại mức độ', 'Báo cáo', 'Theo dõi trạng thái'],
    contracts: ['SmartContractAuditingSystem.sol'],
  },
  {
    name: 'Tích hợp',
    icon: Plug,
    standard: 'Data Migration',
    description: 'Công cụ tích hợp và migration dữ liệu giữa các hệ thống truyền thống và blockchain.',
    features: ['Import/Export dữ liệu', 'Mapping schema', 'Validation', 'Audit trail'],
    contracts: ['DataMigrationAndIntegration.sol'],
  },
  {
    name: 'Phân tích',
    icon: BarChart3,
    standard: 'Analytics Dashboard',
    description: 'Dashboard phân tích và báo cáo. Thống kê giao dịch, người dùng, xu hướng.',
    features: ['Biểu đồ thời gian thực', 'Báo cáo tùy chỉnh', 'Export dữ liệu', 'KPI tracking'],
    contracts: ['AnalyticsAndReportingDashboard.sol'],
  },
];

const TECH_STACK = [
  { category: 'Blockchain', items: ['Solidity 0.8.24', 'Hardhat 2.25', 'OpenZeppelin 5.x', 'ethers.js v6'] },
  { category: 'Frontend', items: ['React 18', 'TypeScript', 'Vite', 'Tailwind CSS v4'] },
  { category: 'Libraries', items: ['react-router-dom', 'react-hot-toast', 'recharts', 'framer-motion', 'lightweight-charts'] },
  { category: 'Standards', items: ['ERC-20', 'ERC-721', 'ERC-1155', 'ERC-20Permit', 'ERC-20Votes'] },
];

const ARCHITECTURE_FEATURES = [
  { icon: Lock, title: 'Access Control', desc: 'Phân quyền role-based: Admin, Minter, Educator, Verifier. Mỗi contract có hệ thống permissions riêng.' },
  { icon: Zap, title: 'Upgradeable', desc: 'Hỗ trợ proxy upgradeable pattern (UUPS/Transparent) cho các contract quan trọng.' },
  { icon: Globe, title: 'Interoperable', desc: 'Các module giao tiếp qua VNDCRegistry — hệ thống registry trung tâm quản lý địa chỉ contract.' },
  { icon: GitBranch, title: 'Modular', desc: '19 module độc lập, mỗi module một smart contract riêng. Dễ bảo trì và mở rộng.' },
  { icon: Cpu, title: 'Gas Optimized', desc: 'Tối ưu gas với viaIR compiler, packed storage và batch operations.' },
  { icon: Code, title: 'Open Source', desc: 'Mã nguồn mở, đầy đủ test coverage. Kiểm toán bởi hệ thống auditing tích hợp.' },
];

export default function DocumentationPage() {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <BookOpen size={20} className="text-brand-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-surface-800">Tài liệu</h1>
          <p className="text-sm text-surface-500">Hướng dẫn sử dụng và tài liệu kỹ thuật VNDC Campus</p>
        </div>
      </div>

      {/* Hero Section */}
      <div className="card p-8 border-l-4 border-l-brand-500">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-surface-800 mb-3">
            VNDC Campus — Nền tảng Blockchain cho Giáo dục
          </h2>
          <p className="text-surface-600 leading-relaxed mb-4">
            VNDC Campus là hệ thống quản lý giáo dục toàn diện trên blockchain, tích hợp 19 smart contract module
            bao phủ từ token thanh toán, bằng cấp NFT, quản trị DAO đến sàn giao dịch nội bộ.
            Mọi dữ liệu đều minh bạch, bất biến và có thể xác minh trên chuỗi.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="badge badge-brand">Solidity 0.8.24</span>
            <span className="badge badge-success">19 Modules</span>
            <span className="badge badge-info">OpenZeppelin 5.x</span>
            <span className="badge badge-warning">ERC-20 / 721 / 1155</span>
          </div>
        </div>
      </div>

      {/* Architecture Features */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Layers size={18} className="text-brand-600" /> Kiến trúc hệ thống
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ARCHITECTURE_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card card-hover p-5">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-3">
                <Icon size={20} className="text-brand-600" />
              </div>
              <h4 className="font-semibold text-surface-800 mb-1">{title}</h4>
              <p className="text-sm text-surface-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Code size={18} className="text-brand-600" /> Công nghệ sử dụng
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TECH_STACK.map(({ category, items }) => (
            <div key={category} className="card p-5">
              <h4 className="font-semibold text-surface-800 mb-3">{category}</h4>
              <ul className="space-y-2">
                {items.map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-surface-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Module Documentation */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Cpu size={18} className="text-brand-600" /> Smart Contract Modules ({MODULES.length})
        </h3>
        <div className="space-y-2">
          {MODULES.map((mod) => {
            const isExpanded = expandedModule === mod.name;
            const Icon = mod.icon;
            return (
              <div key={mod.name} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedModule(isExpanded ? null : mod.name)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-brand-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-surface-800">{mod.name}</h4>
                      <span className="badge badge-neutral text-[10px]">{mod.standard}</span>
                    </div>
                    <p className="text-sm text-surface-500 truncate">{mod.description}</p>
                  </div>
                  {isExpanded ? <ChevronDown size={16} className="text-surface-400 shrink-0" /> : <ChevronRight size={16} className="text-surface-400 shrink-0" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-surface-200 p-4 bg-surface-50 animate-fade-in">
                    <p className="text-sm text-surface-600 mb-4 leading-relaxed">{mod.description}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Tính năng</h5>
                        <ul className="space-y-1.5">
                          {mod.features.map(f => (
                            <li key={f} className="flex items-center gap-2 text-sm text-surface-700">
                              <span className="w-1 h-1 rounded-full bg-brand-500" />
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Smart Contracts</h5>
                        <ul className="space-y-1.5">
                          {mod.contracts.map(c => (
                            <li key={c} className="flex items-center gap-2 text-sm">
                              <Code size={12} className="text-brand-600" />
                              <code className="font-mono text-brand-700 text-xs">{c}</code>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Access Control & Roles */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-brand-600" /> Phân quyền & Vai trò
        </h3>
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200">
                  <th className="text-left py-3 px-4 font-semibold text-surface-700">Vai trò</th>
                  <th className="text-left py-3 px-4 font-semibold text-surface-700">Mô tả</th>
                  <th className="text-left py-3 px-4 font-semibold text-surface-700">Quyền hạn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200">
                <tr>
                  <td className="py-3 px-4"><span className="badge badge-danger">DEFAULT_ADMIN</span></td>
                  <td className="py-3 px-4 text-surface-600">Quản trị viên cao nhất</td>
                  <td className="py-3 px-4 text-surface-600">Cấp/thu hồi role, pause hệ thống, upgrade contract</td>
                </tr>
                <tr>
                  <td className="py-3 px-4"><span className="badge badge-brand">MINTER_ROLE</span></td>
                  <td className="py-3 px-4 text-surface-600">Người có quyền mint</td>
                  <td className="py-3 px-4 text-surface-600">Mint VNDC token, cấp NFT badge</td>
                </tr>
                <tr>
                  <td className="py-3 px-4"><span className="badge badge-success">EDUCATOR_ROLE</span></td>
                  <td className="py-3 px-4 text-surface-600">Giảng viên / Giáo vụ</td>
                  <td className="py-3 px-4 text-surface-600">Cấp chứng chỉ, nhập điểm, phát thưởng</td>
                </tr>
                <tr>
                  <td className="py-3 px-4"><span className="badge badge-warning">VERIFIER_ROLE</span></td>
                  <td className="py-3 px-4 text-surface-600">Người xác minh</td>
                  <td className="py-3 px-4 text-surface-600">Xác minh chứng chỉ, kiểm tra hồ sơ</td>
                </tr>
                <tr>
                  <td className="py-3 px-4"><span className="badge badge-info">STUDENT</span></td>
                  <td className="py-3 px-4 text-surface-600">Sinh viên</td>
                  <td className="py-3 px-4 text-surface-600">Thanh toán, bỏ phiếu, ứng tuyển, giao dịch</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Zap size={18} className="text-brand-600" /> Hướng dẫn bắt đầu
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h4 className="font-semibold text-surface-800 mb-3">Cho sinh viên</h4>
            <ol className="space-y-2 text-sm text-surface-600">
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>Cài đặt MetaMask và thêm mạng Hardhat Local (RPC: http://127.0.0.1:8545, Chain ID: 31337)</li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>Kết nối ví với ứng dụng VNDC Campus</li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">3</span>Nhận VNDC token từ admin hoặc faucet</li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">4</span>Bắt đầu sử dụng: thanh toán, bỏ phiếu, ứng tuyển việc làm</li>
            </ol>
          </div>
          <div className="card p-5">
            <h4 className="font-semibold text-surface-800 mb-3">Cho quản trị viên</h4>
            <ol className="space-y-2 text-sm text-surface-600">
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center text-xs font-bold shrink-0">1</span>Deploy contracts: <code className="font-mono text-xs bg-surface-100 px-1 rounded">npx hardhat deploy --network localhost</code></li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center text-xs font-bold shrink-0">2</span>Mint test VNDC cho các tài khoản</li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center text-xs font-bold shrink-0">3</span>Cấp role cho giảng viên và nhân viên</li>
              <li className="flex gap-2"><span className="w-5 h-5 rounded-full bg-warning-50 text-warning-700 flex items-center justify-center text-xs font-bold shrink-0">4</span>Cấu hình merchant registry và học bổng</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Contract Addresses */}
      <section>
        <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
          <Globe size={18} className="text-brand-600" /> Địa chỉ Smart Contract (Localhost)
        </h3>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm font-mono">
            <thead>
              <tr className="border-b border-surface-200">
                <th className="text-left py-2 px-4 font-semibold text-surface-700 font-sans">Contract</th>
                <th className="text-left py-2 px-4 font-semibold text-surface-700 font-sans">Địa chỉ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 text-xs">
              {[
                ['VNDC Token', '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1'],
                ['VNDCRegistry', '0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE'],
                ['AccessControl', '0x68B1D87F95878fE05B998F19b66F4baba5De1aed'],
                ['CredentialNFT', '0x3Aa5ebB10DC797CAC828524e59A333d0A371443c'],
                ['CredentialVerification', '0xc6e7DF5E7b4f2A278906862b61205850344D4e7d'],
                ['AcademicBadgeNFT', '0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1'],
                ['AcademicReward', '0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44'],
                ['ActivityBadge', '0x9E545E3C0baAB3E08CdfD552C960A1050f373042'],
                ['ExtracurricularReward', '0xa82fF9aFd8f496c3d6ac40E2a0F282E47488CFc9'],
                ['PaymentProcessor', '0x5FbDB2315678afecb367f032d93F642f64180aa3'],
                ['MerchantRegistry', '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'],
                ['StudentRecordManager', '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0'],
                ['GovernanceToken', '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'],
                ['StudentDAO', '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9'],
                ['StudentIDToken', '0x5FC8d32690cc91D4c39d9d3abcBD16989F875707'],
                ['CertificationSystem', '0x0165878A594ca255338adfa4d48449f69242Eb8F'],
                ['ScholarshipManager', '0xa513E6E4b8f2a923D98304ec87F64353C4D5C853'],
                ['AlumniRegistry', '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6'],
                ['ReputationBadgeSystem', '0x8A791620dd6260079BF849Dc5567aDC3F2FdC318'],
                ['JobBoard', '0x610178dA211FEF7D417bC0e6FeD39F05609AD788'],
                ['InternshipManager', '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e'],
                ['ResearchPlatform', '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0'],
                ['AuditingSystem', '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82'],
                ['DataMigration', '0x9A676e781A523b5d0C0e43731313A708CB607508'],
                ['AnalyticsDashboard', '0x0B306BF915C4d645ff596e518fAf3F9669b97016'],
              ].map(([name, addr]) => (
                <tr key={name} className="hover:bg-surface-50">
                  <td className="py-2 px-4 font-sans text-surface-800">{name}</td>
                  <td className="py-2 px-4 text-brand-600">{addr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <div className="card p-6 text-center">
        <p className="text-sm text-surface-500">
          VNDC Campus v1.0 — Built with Hardhat, React & Solidity
        </p>
        <p className="text-xs text-surface-400 mt-1">
          © 2024 VNDC Campus. All rights reserved.
        </p>
      </div>
    </div>
  );
}
