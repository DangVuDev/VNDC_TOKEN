import { useState, useMemo } from 'react';
import {
  BookOpen, Layers, Shield, Coins, GraduationCap, Vote, CreditCard,
  FileText, IdCard, Award, Users, Star, Briefcase, Building2,
  FlaskConical, Search, BarChart3, ArrowLeftRight, Plug, Trophy,
  Wallet, ChevronDown, ChevronRight, ExternalLink, Code, Cpu,
  Lock, Zap, Globe, GitBranch, Copy, Check, Terminal, Rocket,
  Network, Database, Key, Eye, ShoppingBag, Landmark, HeartHandshake,
  AlertTriangle, Info, HelpCircle, Workflow, Box, Fingerprint,
  Megaphone, ArrowRight, Hash, FileCode2, ScrollText, CircleDot,
  MessageSquareWarning, Lightbulb, CheckCircle2,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

type DocTab = 'overview' | 'modules' | 'contracts' | 'guides' | 'api' | 'faq';

interface ModuleDoc {
  id: string;
  number: string;
  name: string;
  icon: typeof Coins;
  standard: string;
  description: string;
  details: string;
  features: string[];
  contracts: { name: string; file: string; loc: number }[];
  functions: { name: string; desc: string; role?: string }[];
  events: string[];
  group: 'Core' | 'Dịch vụ' | 'Nâng cao' | 'Hệ thống';
  sepoliaAddress?: string;
  navPath: string;
}

// ═══════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════

const MODULES: ModuleDoc[] = [
  {
    id: '001', number: '001', name: 'VNDC Token', icon: Coins, standard: 'ERC-20 + ERC-20Permit',
    description: 'Đồng tiền kỹ thuật số chính — nền tảng thanh toán, phần thưởng và quản trị toàn hệ sinh thái campus.',
    details: 'VNDCToken là ERC-20 token có hỗ trợ mint/burn có kiểm soát, pausable toàn hệ thống, và gasless approval qua EIP-2612 Permit. Sử dụng OpenZeppelin AccessControl để phân quyền MINTER_ROLE và PAUSER_ROLE. Là token thanh toán chính cho tất cả module khác.',
    features: ['Mint / Burn có kiểm soát (MINTER_ROLE)', 'Pause / Unpause toàn hệ thống (PAUSER_ROLE)', 'Gasless Permit (EIP-2612) — approve không tốn gas', 'Role-based Access Control (Admin, Minter, Pauser)', 'ERC-20 đầy đủ: transfer, approve, transferFrom', 'Tương thích với mọi DEX và DApp chuẩn ERC-20'],
    contracts: [{ name: 'VNDCToken', file: 'VNDCToken.sol', loc: 120 }],
    functions: [
      { name: 'mint(address to, uint256 amount)', desc: 'Phát hành token mới', role: 'MINTER' },
      { name: 'burn(uint256 amount)', desc: 'Đốt token', role: 'Holder' },
      { name: 'pause() / unpause()', desc: 'Tạm dừng / khôi phục hệ thống', role: 'PAUSER' },
      { name: 'permit(owner, spender, value, deadline, v, r, s)', desc: 'Gasless approval theo EIP-2612', role: 'Any' },
    ],
    events: ['Transfer(from, to, amount)', 'Approval(owner, spender, value)', 'Paused(account)', 'Unpaused(account)'],
    group: 'Core',
    sepoliaAddress: '0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48',
    navPath: '/token',
  },
  {
    id: '001b', number: '001', name: 'Registry & Access Control', icon: Shield, standard: 'Central Registry',
    description: 'Quản lý địa chỉ tất cả contract và hệ thống phân quyền trung tâm cho toàn bộ campus.',
    details: 'VNDCRegistry lưu trữ mapping tên → address cho tất cả contract trong hệ sinh thái, giúp các module tìm nhau qua tên thay vì hardcode address. VNDCAccessControl quản lý phân quyền tập trung: ADMIN, TEACHER, STUDENT, MERCHANT, ISSUER, MINTER.',
    features: ['Registry trung tâm: set/get contract address theo tên', 'Access Control tập trung: grantRole, revokeRole', '6 vai trò: ADMIN, TEACHER, STUDENT, MERCHANT, ISSUER, MINTER', 'Mọi module tham chiếu Registry để tìm contract address', 'Hỗ trợ renounceRole để từ bỏ quyền'],
    contracts: [
      { name: 'VNDCRegistry', file: 'VNDCRegistry.sol', loc: 45 },
      { name: 'VNDCAccessControl', file: 'VNDCAccessControl.sol', loc: 65 },
    ],
    functions: [
      { name: 'setContractAddress(name, addr)', desc: 'Đăng ký contract mới', role: 'ADMIN' },
      { name: 'getContractAddress(name)', desc: 'Lấy address theo tên', role: 'Any' },
      { name: 'grantRole(role, account)', desc: 'Cấp quyền', role: 'ADMIN' },
      { name: 'revokeRole(role, account)', desc: 'Thu hồi quyền', role: 'ADMIN' },
      { name: 'hasRole(role, account)', desc: 'Kiểm tra quyền', role: 'Any' },
    ],
    events: ['ContractRegistered(name, addr)', 'RoleGranted(role, account, sender)', 'RoleRevoked(role, account, sender)'],
    group: 'Core',
    sepoliaAddress: '0x7d16b0e9dC98a976F008f5606eE26Bba50FDe2c1',
    navPath: '/token',
  },
  {
    id: '002', number: '002', name: 'Bằng cấp & Chứng chỉ', icon: Shield, standard: 'ERC-721 NFT',
    description: 'Cấp, xác minh và thu hồi bằng cấp / chứng chỉ dưới dạng NFT không thể giả mạo.',
    details: 'Hệ thống gồm 2 contract: CredentialVerification quản lý logic cấp/xác minh/thu hồi, CredentialNFT quản lý token ERC-721. Mỗi chứng chỉ là NFT duy nhất với metadata IPFS, có thể set expire date. Giảng viên (EDUCATOR_ROLE) cấp, bất kỳ ai xác minh trực tiếp on-chain.',
    features: ['Cấp chứng chỉ NFT (EDUCATOR_ROLE)', 'Xác minh on-chain tức thì', 'Thu hồi (Revoke) khi cần', 'Thời hạn hết hạn (Expiration)', 'IPFS Metadata URI', 'Batch issuance'],
    contracts: [
      { name: 'CredentialVerification', file: 'CredentialVerification.sol', loc: 85 },
      { name: 'CredentialNFT', file: 'CredentialNFT.sol', loc: 60 },
    ],
    functions: [
      { name: 'issueCredential(student, credentialType, uri)', desc: 'Cấp chứng chỉ NFT', role: 'EDUCATOR' },
      { name: 'revokeCredential(tokenId)', desc: 'Thu hồi chứng chỉ', role: 'EDUCATOR' },
      { name: 'verifyCredential(tokenId)', desc: 'Xác minh chứng chỉ còn hiệu lực', role: 'Any' },
      { name: 'getCredentialsByStudent(address)', desc: 'Lấy danh sách chứng chỉ của SV', role: 'Any' },
    ],
    events: ['CredentialIssued(tokenId, student, credType)', 'CredentialRevoked(tokenId)', 'CredentialVerified(tokenId, verifier)'],
    group: 'Core',
    sepoliaAddress: '0x2F73B53C805A90C1BB407726c704637C5dC19284',
    navPath: '/credentials',
  },
  {
    id: '003', number: '003', name: 'Thưởng học tập', icon: GraduationCap, standard: 'GPA-Based Rewards',
    description: 'Phần thưởng VNDC tự động dựa trên GPA — 4 bậc thưởng kèm Academic Badge NFT.',
    details: 'Giảng viên đăng ký GPA cho sinh viên, hệ thống tự động tính bậc thưởng (Bronze ≥2.5, Silver ≥3.0, Gold ≥3.5, Platinum ≥3.8) và phát VNDC + NFT badge tương ứng. AcademicBadgeNFT là ERC-721 badge riêng cho từng tier.',
    features: ['4 bậc thưởng: Bronze / Silver / Gold / Platinum', 'Phát VNDC tự động theo GPA', 'Academic Badge NFT theo tier', 'Giảng viên đăng ký GPA on-chain', 'Thống kê tổng phần thưởng đã phát'],
    contracts: [
      { name: 'AcademicReward', file: 'AcademicReward.sol', loc: 140 },
      { name: 'AcademicBadgeNFT', file: 'AcademicBadgeNFT.sol', loc: 55 },
    ],
    functions: [
      { name: 'registerGPA(student, gpa)', desc: 'Nhập GPA cho sinh viên', role: 'EDUCATOR' },
      { name: 'claimReward()', desc: 'Sinh viên nhận thưởng', role: 'STUDENT' },
      { name: 'getRewardTier(gpa)', desc: 'Xem bậc thưởng theo GPA', role: 'Any' },
      { name: 'getStudentRewardInfo(address)', desc: 'Xem lịch sử thưởng', role: 'Any' },
    ],
    events: ['GPARegistered(student, gpa)', 'RewardClaimed(student, tier, amount)', 'BadgeMinted(student, tier, tokenId)'],
    group: 'Core',
    sepoliaAddress: '0x59D093AF84dD99fe20817075C52527855b8dFB9b',
    navPath: '/academic-rewards',
  },
  {
    id: '004', number: '004', name: 'Ngoại khóa', icon: Trophy, standard: 'Activity Tracking',
    description: 'Ghi nhận, xác minh và thưởng cho các hoạt động ngoại khóa: CLB, tình nguyện, thể thao.',
    details: 'ExtracurricularReward cho phép giảng viên tạo hoạt động, sinh viên đăng ký & checkin. Hoàn thành hoạt động nhận VNDC + Activity Badge NFT. Có bảng xếp hạng theo điểm hoạt động.',
    features: ['Tạo hoạt động ngoại khóa', 'Đăng ký & check-in tham gia', 'Xác nhận hoàn thành', 'Activity Badge NFT', 'Bảng xếp hạng hoạt động', 'Thưởng VNDC tự động'],
    contracts: [
      { name: 'ExtracurricularReward', file: 'ExtracurricularReward.sol', loc: 160 },
      { name: 'ActivityBadge', file: 'ActivityBadge.sol', loc: 50 },
    ],
    functions: [
      { name: 'createActivity(name, desc, reward, maxParticipants)', desc: 'Tạo hoạt động mới', role: 'EDUCATOR' },
      { name: 'registerForActivity(activityId)', desc: 'Đăng ký tham gia', role: 'STUDENT' },
      { name: 'confirmParticipation(activityId, student)', desc: 'Xác nhận tham gia', role: 'EDUCATOR' },
      { name: 'getActivityDetails(activityId)', desc: 'Xem chi tiết hoạt động', role: 'Any' },
    ],
    events: ['ActivityCreated(id, name, reward)', 'ParticipationRegistered(id, student)', 'ParticipationConfirmed(id, student)', 'RewardDistributed(student, amount)'],
    group: 'Core',
    sepoliaAddress: '0x2ec4Cf8Abfb952Eb3d5844C72925Ebe9FBa70B9e',
    navPath: '/extracurricular',
  },
  {
    id: '005', number: '005', name: 'Thanh toán', icon: CreditCard, standard: 'Multi-Payment',
    description: 'Xử lý thanh toán học phí, dịch vụ campus bằng VNDC — merchant registry và hoàn tiền.',
    details: 'PaymentProcessor xử lý thanh toán VNDC với phí platform tùy chỉnh. MerchantRegistry quản lý danh sách merchant được chấp nhận. Hỗ trợ hoàn tiền từng phần, lịch sử giao dịch chi tiết.',
    features: ['Thanh toán VNDC cho merchant', 'Merchant Registry (đăng ký / xác minh)', 'Hoàn tiền (full & partial refund)', 'Platform fee tùy chỉnh', 'Lịch sử giao dịch on-chain', 'Export lịch sử thanh toán'],
    contracts: [
      { name: 'PaymentProcessor', file: 'PaymentProcessor.sol', loc: 180 },
      { name: 'MerchantRegistry', file: 'MerchantRegistry.sol', loc: 90 },
    ],
    functions: [
      { name: 'pay(merchant, amount, reference)', desc: 'Thanh toán cho merchant', role: 'Any' },
      { name: 'refund(paymentId)', desc: 'Hoàn tiền', role: 'MERCHANT' },
      { name: 'registerMerchant(name, address)', desc: 'Đăng ký merchant', role: 'ADMIN' },
      { name: 'getPaymentHistory(address)', desc: 'Lịch sử giao dịch', role: 'Any' },
    ],
    events: ['PaymentMade(from, to, amount, ref)', 'PaymentRefunded(paymentId, amount)', 'MerchantRegistered(name, addr)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0xe5AA2b90aC87F4271982E26e3D8Be46014f6b30e',
    navPath: '/payments',
  },
  {
    id: '006', number: '006', name: 'Hồ sơ học tập', icon: FileText, standard: 'On-chain Records',
    description: 'Quản lý hồ sơ sinh viên, bảng điểm, GPA on-chain — dữ liệu bất biến và xác minh được.',
    details: 'StudentRecordManager lưu trữ hồ sơ sinh viên hoàn chỉnh: thông tin cá nhân, khóa học, điểm số. GPA được tính tự động. Dữ liệu trên blockchain đảm bảo tính minh bạch, không thể chỉnh sửa trái phép.',
    features: ['Tạo & quản lý hồ sơ sinh viên', 'Nhập điểm theo môn học', 'Tính GPA tự động', 'Bảng điểm on-chain', 'Xác minh hồ sơ bất kỳ lúc nào', 'Export dữ liệu hồ sơ'],
    contracts: [{ name: 'StudentRecordManager', file: 'StudentRecordManager.sol', loc: 200 }],
    functions: [
      { name: 'createStudent(address, name, studentId)', desc: 'Tạo hồ sơ', role: 'ADMIN' },
      { name: 'addCourseGrade(student, course, grade, credits)', desc: 'Nhập điểm', role: 'TEACHER' },
      { name: 'getTranscript(student)', desc: 'Lấy bảng điểm', role: 'Any' },
      { name: 'calculateGPA(student)', desc: 'Tính GPA', role: 'Any' },
    ],
    events: ['StudentCreated(addr, name)', 'GradeAdded(student, course, grade)', 'GPAUpdated(student, gpa)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0x319EE1f8094c9fa5E39cB0643A90aDAC18f37bE2',
    navPath: '/records',
  },
  {
    id: '007', number: '007', name: 'Quản trị DAO', icon: Vote, standard: 'ERC-20Votes',
    description: 'Hệ thống quản trị phi tập trung — đề xuất, bỏ phiếu, thực thi quyết định campus.',
    details: 'StudentDAO sử dụng GovernanceToken (ERC-20Votes) để bỏ phiếu. Sinh viên tạo proposal, cộng đồng vote (For / Against / Abstain), proposal đạt quorum sẽ được thực thi on-chain. Voting power = token balance tại snapshot block.',
    features: ['Tạo proposal với mô tả và actions', 'Bỏ phiếu: For / Against / Abstain', 'Quorum (ngưỡng tối thiểu)', 'Thực thi on-chain tự động', 'Delegate voting power', 'GovernanceToken với snapshot'],
    contracts: [
      { name: 'StudentDAO', file: 'StudentDAO.sol', loc: 180 },
      { name: 'GovernanceToken', file: 'GovernanceToken.sol', loc: 75 },
    ],
    functions: [
      { name: 'propose(targets, values, calldatas, desc)', desc: 'Tạo đề xuất', role: 'TOKEN HOLDER' },
      { name: 'castVote(proposalId, support)', desc: 'Bỏ phiếu', role: 'TOKEN HOLDER' },
      { name: 'execute(proposalId)', desc: 'Thực thi proposal thành công', role: 'Any' },
      { name: 'delegate(delegatee)', desc: 'Ủy quyền voting power', role: 'TOKEN HOLDER' },
    ],
    events: ['ProposalCreated(id, proposer, desc)', 'VoteCast(voter, proposalId, support, weight)', 'ProposalExecuted(id)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0x5eCF36478E3989705972775E1A443F53c7c43532',
    navPath: '/governance',
  },
  {
    id: '008', number: '008', name: 'Thẻ sinh viên', icon: IdCard, standard: 'SBT (Soulbound)',
    description: 'Thẻ sinh viên số Soulbound Token — không chuyển nhượng, gắn vĩnh viễn với danh tính.',
    details: 'StudentIDToken là Soulbound Token (SBT) — NFT không thể transfer. Mỗi sinh viên được phát 1 thẻ duy nhất chứa thông tin: tên, mã SV, khoa, niên khóa. Admin có thể tạm ngưng hoặc thu hồi thẻ.',
    features: ['Phát hành SBT cho sinh viên', 'Không thể chuyển nhượng (Soulbound)', 'Tạm ngưng / Kích hoạt', 'Thu hồi (Revoke)', 'Metadata: tên, mã SV, khoa, khóa', 'Xác minh danh tính tức thì'],
    contracts: [{ name: 'StudentIDToken', file: 'StudentIDToken.sol', loc: 115 }],
    functions: [
      { name: 'issueID(student, name, studentId, department)', desc: 'Phát hành thẻ', role: 'ADMIN' },
      { name: 'suspendID(tokenId)', desc: 'Tạm ngưng thẻ', role: 'ADMIN' },
      { name: 'activateID(tokenId)', desc: 'Kích hoạt lại', role: 'ADMIN' },
      { name: 'revokeID(tokenId)', desc: 'Thu hồi vĩnh viễn', role: 'ADMIN' },
      { name: 'verifyStudent(address)', desc: 'Xác minh danh tính', role: 'Any' },
    ],
    events: ['IDIssued(student, tokenId)', 'IDSuspended(tokenId)', 'IDActivated(tokenId)', 'IDRevoked(tokenId)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0xeeef6d62c071B31C02FA8234a704a3Db9341596F',
    navPath: '/student-id',
  },
  {
    id: '009', number: '009', name: 'Chứng chỉ nghề', icon: Award, standard: 'ERC-1155',
    description: 'Hệ thống chứng chỉ nghề nghiệp ERC-1155 — một loại chứng chỉ cấp cho nhiều người.',
    details: 'CertificationSystem dùng ERC-1155 cho phép tạo nhiều loại chứng chỉ (type), mỗi loại có thể cấp cho nhiều sinh viên (batch mint). Tiết kiệm gas hơn ERC-721 khi cấp hàng loạt. Hỗ trợ xác minh, thu hồi, metadata URI cho từng type.',
    features: ['Tạo loại chứng chỉ (type)', 'Cấp hàng loạt (batch mint)', 'Xác minh on-chain', 'Thu hồi (burn)', 'ERC-1155 multi-token standard', 'Metadata URI per type'],
    contracts: [{ name: 'CertificationSystem', file: 'CertificationSystem.sol', loc: 145 }],
    functions: [
      { name: 'createCertificateType(name, uri)', desc: 'Tạo loại chứng chỉ', role: 'ADMIN' },
      { name: 'issueCertificate(student, typeId)', desc: 'Cấp chứng chỉ', role: 'ISSUER' },
      { name: 'batchIssueCertificates(students[], typeId)', desc: 'Cấp hàng loạt', role: 'ISSUER' },
      { name: 'verifyCertificate(holder, typeId)', desc: 'Xác minh', role: 'Any' },
    ],
    events: ['CertificateTypeCreated(typeId, name)', 'CertificateIssued(student, typeId)', 'CertificateRevoked(student, typeId)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0x5Ec6441A93ff6F505F779468F0bd12F79Ee03D40',
    navPath: '/certification',
  },
  {
    id: '010', number: '010', name: 'Học bổng', icon: Wallet, standard: 'Scholarship Pool',
    description: 'Quỹ học bổng on-chain minh bạch — tạo, ứng tuyển, xét duyệt, giải ngân tự động.',
    details: 'ScholarshipManager cho phép admin tạo quỹ học bổng với tiêu chí (GPA tối thiểu, khoa, etc), sinh viên nộp đơn, hội đồng xét duyệt và giải ngân VNDC trực tiếp cho sinh viên được chọn.',
    features: ['Tạo quỹ học bổng', 'Đăng ký ứng tuyển', 'Xét duyệt bởi hội đồng', 'Giải ngân VNDC tự động', 'Tiêu chí: GPA, khoa, niên khóa', 'Minh bạch hoàn toàn'],
    contracts: [{ name: 'ScholarshipManager', file: 'ScholarshipManager.sol', loc: 175 }],
    functions: [
      { name: 'createScholarship(name, amount, criteria)', desc: 'Tạo học bổng', role: 'ADMIN' },
      { name: 'applyForScholarship(scholarshipId)', desc: 'Nộp đơn', role: 'STUDENT' },
      { name: 'approveApplication(applicationId)', desc: 'Phê duyệt', role: 'ADMIN' },
      { name: 'disburseFunds(scholarshipId)', desc: 'Giải ngân', role: 'ADMIN' },
    ],
    events: ['ScholarshipCreated(id, name, amount)', 'ApplicationSubmitted(id, student)', 'ApplicationApproved(id)', 'FundsDisbursed(student, amount)'],
    group: 'Dịch vụ',
    sepoliaAddress: '0x50Db8937caC9b1D254055438b398a409F9250E03',
    navPath: '/scholarship',
  },
  {
    id: '011', number: '011', name: 'Cựu sinh viên', icon: Users, standard: 'Alumni Network',
    description: 'Mạng lưới cựu sinh viên on-chain — đăng ký, sự kiện, mentorship và quyên góp.',
    details: 'AlumniRegistry quản lý đăng ký alumni, tổ chức sự kiện reunion, chương trình mentorship ghép đôi mentor-mentee, và hệ thống quyên góp VNDC cho trường.',
    features: ['Đăng ký alumni profile', 'Tổ chức sự kiện (events)', 'Mentorship program', 'Quyên góp VNDC', 'Kết nối alumni ↔ sinh viên', 'Thống kê alumni network'],
    contracts: [{ name: 'AlumniRegistry', file: 'AlumniRegistry.sol', loc: 190 }],
    functions: [
      { name: 'registerAlumni(name, graduationYear, department)', desc: 'Đăng ký alumni', role: 'Any' },
      { name: 'createEvent(name, date, description)', desc: 'Tạo sự kiện', role: 'ADMIN' },
      { name: 'registerAsMentor(expertise)', desc: 'Đăng ký làm mentor', role: 'ALUMNI' },
      { name: 'donate(amount)', desc: 'Quyên góp VNDC', role: 'Any' },
    ],
    events: ['AlumniRegistered(addr, name, year)', 'EventCreated(id, name)', 'MentorRegistered(addr)', 'DonationReceived(donor, amount)'],
    group: 'Nâng cao',
    sepoliaAddress: '0xC41EE8f2953d1c8aBa093a591857474a08716636',
    navPath: '/alumni',
  },
  {
    id: '012', number: '012', name: 'Danh tiếng', icon: Star, standard: 'Reputation System',
    description: 'Hệ thống reputation points và badge NFT theo cấp bậc — tích điểm từ mọi hoạt động.',
    details: 'ReputationBadgeSystem tích lũy reputation points từ các hoạt động (học tập, ngoại khóa, governance, etc). Đạt ngưỡng nhất định tự động mint Badge NFT tương ứng. Bảng xếp hạng toàn campus.',
    features: ['Reputation Score tích lũy', 'Badge NFT theo cấp: Bronze → Diamond', 'Bảng xếp hạng toàn trường', 'Lịch sử hoạt động chi tiết', 'Auto-mint badge khi đạt ngưỡng', 'Nhiều nguồn điểm (học tập, ngoại khóa, DAO...)'],
    contracts: [{ name: 'ReputationBadgeSystem', file: 'ReputationBadgeSystem.sol', loc: 170 }],
    functions: [
      { name: 'addReputation(student, points, reason)', desc: 'Cộng điểm', role: 'AUTHORIZED' },
      { name: 'getReputation(student)', desc: 'Xem điểm', role: 'Any' },
      { name: 'getLeaderboard(offset, limit)', desc: 'Bảng xếp hạng', role: 'Any' },
      { name: 'claimBadge()', desc: 'Nhận badge NFT', role: 'STUDENT' },
    ],
    events: ['ReputationAdded(student, points, reason)', 'BadgeMinted(student, level, tokenId)', 'LeaderboardUpdated()'],
    group: 'Nâng cao',
    sepoliaAddress: '0x4C906f2bC9Cc6Fd0536DB3b6D9962C0819f79C4c',
    navPath: '/reputation',
  },
  {
    id: '013', number: '013', name: 'Việc làm', icon: Briefcase, standard: 'Job Board',
    description: 'Bảng tin việc làm on-chain — doanh nghiệp đăng tin, sinh viên ứng tuyển trực tiếp.',
    details: 'JobBoard cho phép doanh nghiệp (verified company) đăng tin tuyển dụng, sinh viên nộp đơn on-chain. Hỗ trợ referral reward cho người giới thiệu thành công.',
    features: ['Đăng tin tuyển dụng', 'Ứng tuyển on-chain', 'Trạng thái application', 'Referral reward system', 'Lọc theo ngành / vị trí / lương', 'Thống kê tuyển dụng'],
    contracts: [{ name: 'JobBoard', file: 'JobBoard.sol', loc: 160 }],
    functions: [
      { name: 'postJob(title, description, salary, requirements)', desc: 'Đăng tin', role: 'COMPANY' },
      { name: 'applyForJob(jobId, coverLetter)', desc: 'Ứng tuyển', role: 'STUDENT' },
      { name: 'updateApplicationStatus(applicationId, status)', desc: 'Cập nhật trạng thái', role: 'COMPANY' },
      { name: 'referCandidate(jobId, candidate)', desc: 'Giới thiệu ứng viên', role: 'Any' },
    ],
    events: ['JobPosted(id, company, title)', 'ApplicationSubmitted(jobId, applicant)', 'ApplicationStatusChanged(id, status)', 'ReferralPaid(referrer, amount)'],
    group: 'Nâng cao',
    sepoliaAddress: '0xfB0E0143Fc5b83b9809aCa6ae7eD040568d1e116',
    navPath: '/job-board',
  },
  {
    id: '014', number: '014', name: 'Thực tập', icon: Building2, standard: 'Internship Program',
    description: 'Quản lý chương trình thực tập — đăng ký, theo dõi, đánh giá và chứng nhận.',
    details: 'InternshipManager quản lý toàn bộ quy trình thực tập: doanh nghiệp tạo chương trình, sinh viên đăng ký, supervisor đánh giá tiến độ hàng tuần, và cấp chứng nhận khi hoàn thành.',
    features: ['Tạo chương trình thực tập', 'Đăng ký & matching', 'Đánh giá tiến độ (weekly)', 'Chứng nhận hoàn thành NFT', 'Supervisor dashboard', 'Feedback & rating'],
    contracts: [{ name: 'InternshipManager', file: 'InternshipManager.sol', loc: 180 }],
    functions: [
      { name: 'createProgram(company, title, duration, slots)', desc: 'Tạo chương trình', role: 'COMPANY' },
      { name: 'apply(programId)', desc: 'Đăng ký thực tập', role: 'STUDENT' },
      { name: 'submitEvaluation(internId, score, feedback)', desc: 'Đánh giá', role: 'SUPERVISOR' },
      { name: 'completionCertificate(internId)', desc: 'Cấp chứng nhận', role: 'ADMIN' },
    ],
    events: ['ProgramCreated(id, company, title)', 'ApplicationSubmitted(progId, student)', 'EvaluationSubmitted(internId, score)', 'InternshipCompleted(student, programId)'],
    group: 'Nâng cao',
    sepoliaAddress: '0xf41DC2c98852144ec0D7EcEF74D4256BaDdF4460',
    navPath: '/internship',
  },
  {
    id: '015', number: '015', name: 'Nghiên cứu', icon: FlaskConical, standard: 'Research Collaboration',
    description: 'Nền tảng hợp tác nghiên cứu — tạo dự án, mời cộng tác, quản lý tài trợ và xuất bản.',
    details: 'ResearchCollaborationPlatform cho phép nhà nghiên cứu tạo dự án, mời cộng tác viên, quản lý ngân sách tài trợ bằng VNDC, và xuất bản kết quả on-chain. Minh bạch hoàn toàn từ đề xuất đến nghiệm thu.',
    features: ['Tạo dự án nghiên cứu', 'Mời & quản lý cộng tác viên', 'Quản lý ngân sách tài trợ VNDC', 'Milestone tracking', 'Xuất bản kết quả on-chain', 'Peer review system'],
    contracts: [{ name: 'ResearchCollaborationPlatform', file: 'ResearchCollaborationPlatform.sol', loc: 220 }],
    functions: [
      { name: 'createProject(title, desc, budget)', desc: 'Tạo dự án', role: 'RESEARCHER' },
      { name: 'inviteCollaborator(projectId, collaborator)', desc: 'Mời cộng tác', role: 'PI' },
      { name: 'submitMilestone(projectId, milestoneId, report)', desc: 'Nộp milestone', role: 'PI' },
      { name: 'publishResult(projectId, resultURI)', desc: 'Xuất bản', role: 'PI' },
    ],
    events: ['ProjectCreated(id, pi, title)', 'CollaboratorAdded(projectId, collaborator)', 'MilestoneSubmitted(projectId, milestoneId)', 'ResultPublished(projectId, uri)'],
    group: 'Nâng cao',
    sepoliaAddress: '0x6e2B4a19c44623b63379c35F1643fc076765f936',
    navPath: '/research',
  },
  {
    id: '016', number: '016', name: 'Kiểm toán', icon: Search, standard: 'Audit System',
    description: 'Hệ thống kiểm toán smart contract — đăng ký, phát hiện lỗ hổng, bug bounty.',
    details: 'SmartContractAuditingSystem quản lý quy trình kiểm toán: đăng ký contract, auditor thực hiện audit, phân loại severity (Critical/High/Medium/Low/Info), bounty reward.',
    features: ['Đăng ký contract cần audit', 'Phân loại mức độ lỗ hổng', 'Bug bounty rewards', 'Auditor registry', 'Báo cáo audit on-chain', 'Theo dõi trạng thái fix'],
    contracts: [{ name: 'SmartContractAuditingSystem', file: 'SmartContractAuditingSystem.sol', loc: 165 }],
    functions: [
      { name: 'requestAudit(contract, scope)', desc: 'Yêu cầu kiểm toán', role: 'Any' },
      { name: 'submitFinding(auditId, severity, description)', desc: 'Báo cáo lỗ hổng', role: 'AUDITOR' },
      { name: 'resolveFind(findingId)', desc: 'Đánh dấu đã fix', role: 'DEVELOPER' },
      { name: 'claimBounty(findingId)', desc: 'Nhận bounty', role: 'AUDITOR' },
    ],
    events: ['AuditRequested(id, contract)', 'FindingSubmitted(auditId, severity)', 'FindingResolved(findingId)', 'BountyPaid(auditor, amount)'],
    group: 'Hệ thống',
    sepoliaAddress: '0x4AF9eAA67Dc5c5BC9B75f9F0e525aCcAE3A857f5',
    navPath: '/auditing',
  },
  {
    id: '017', number: '017', name: 'Tích hợp dữ liệu', icon: Plug, standard: 'Data Migration',
    description: 'Công cụ migration và tích hợp dữ liệu từ hệ thống truyền thống lên blockchain.',
    details: 'DataMigrationAndIntegration cung cấp quy trình import dữ liệu chuẩn hóa: mapping schema, validation, batch import, audit trail cho mọi thay đổi dữ liệu.',
    features: ['Import dữ liệu hàng loạt', 'Schema mapping', 'Data validation on-chain', 'Audit trail đầy đủ', 'Rollback support', 'Export dữ liệu'],
    contracts: [{ name: 'DataMigrationAndIntegration', file: 'DataMigrationAndIntegration.sol', loc: 140 }],
    functions: [
      { name: 'importRecord(recordType, data)', desc: 'Import bản ghi', role: 'ADMIN' },
      { name: 'batchImport(records[])', desc: 'Import hàng loạt', role: 'ADMIN' },
      { name: 'validateRecord(recordId)', desc: 'Xác thực', role: 'Any' },
      { name: 'getAuditTrail(recordId)', desc: 'Lịch sử thay đổi', role: 'Any' },
    ],
    events: ['RecordImported(id, type)', 'BatchImported(count)', 'RecordValidated(id)', 'DataExported(requestor)'],
    group: 'Hệ thống',
    sepoliaAddress: '0x3d1AD1ebdac6a86C692865C6B5C274EdB57e9445',
    navPath: '/integration',
  },
  {
    id: '018a', number: '018', name: 'Phân tích', icon: BarChart3, standard: 'Analytics Dashboard',
    description: 'Dashboard phân tích tổng hợp — thống kê giao dịch, người dùng và xu hướng campus.',
    details: 'AnalyticsAndReportingDashboard thu thập dữ liệu từ các module khác qua Registry, tổng hợp thống kê: tổng giao dịch, active users, trending activities, KPI tracking.',
    features: ['Biểu đồ thống kê thời gian thực', 'Báo cáo tuỳ chỉnh', 'Export dữ liệu CSV/JSON', 'KPI tracking', 'Module health monitoring', 'User activity heatmap'],
    contracts: [{ name: 'AnalyticsAndReportingDashboard', file: 'AnalyticsAndReportingDashboard.sol', loc: 115 }],
    functions: [
      { name: 'recordMetric(metricType, value)', desc: 'Ghi nhận metric', role: 'MODULE' },
      { name: 'getMetrics(metricType, from, to)', desc: 'Lấy metrics', role: 'Any' },
      { name: 'generateReport(reportType)', desc: 'Tạo báo cáo', role: 'ADMIN' },
    ],
    events: ['MetricRecorded(type, value, timestamp)', 'ReportGenerated(type, generator)'],
    group: 'Hệ thống',
    sepoliaAddress: '0xb32B60D65f20c24d2885FC472D57A4439c4b3061',
    navPath: '/analytics',
  },
  {
    id: '018b', number: '018', name: 'Staking Pool', icon: Landmark, standard: 'Staking Rewards',
    description: 'Staking VNDC token để nhận phần thưởng APY — pool tập trung khuyến khích holding.',
    details: 'StakingPool cho phép người dùng stake VNDC token nhận APY rewards. Admin thiết lập reward rate, deposit rewards vào pool. Compound interest, unstake mọi lúc.',
    features: ['Stake VNDC nhận rewards', 'APY rewards tự động', 'Unstake mọi lúc', 'Compound interest', 'Admin deposit rewards', 'Real-time rewards tracking'],
    contracts: [{ name: 'StakingPool', file: 'StakingPool.sol', loc: 160 }],
    functions: [
      { name: 'stake(amount)', desc: 'Stake token', role: 'Any' },
      { name: 'unstake(amount)', desc: 'Rút token', role: 'STAKER' },
      { name: 'claimRewards()', desc: 'Nhận thưởng', role: 'STAKER' },
      { name: 'depositRewards(amount)', desc: 'Nạp quỹ thưởng', role: 'ADMIN' },
      { name: 'setRewardRate(rate)', desc: 'Cập nhật APY', role: 'ADMIN' },
    ],
    events: ['Staked(user, amount)', 'Unstaked(user, amount)', 'RewardsClaimed(user, amount)', 'RewardsDeposited(admin, amount)'],
    group: 'Nâng cao',
    sepoliaAddress: '0xcbC39F0BF0585A11a86F3391d09D1F18f0b01F40',
    navPath: '/staking',
  },
  {
    id: '019', number: '019', name: 'Chợ Online', icon: ShoppingBag, standard: 'Marketplace',
    description: 'Marketplace mua bán tài liệu, dịch vụ sinh viên bằng VNDC — escrow an toàn.',
    details: 'Marketplace cho phép sinh viên đăng bán sản phẩm/dịch vụ (tài liệu học tập, thiết kế, code...) bằng VNDC. Escrow system bảo vệ người mua, seller nhận tiền sau khi buyer confirm.',
    features: ['Đăng bán sản phẩm / dịch vụ', 'Mua bằng VNDC', 'Escrow bảo vệ giao dịch', 'Rating & review', 'Danh mục sản phẩm', 'Dispute resolution'],
    contracts: [{ name: 'Marketplace', file: 'Marketplace.sol', loc: 230 }],
    functions: [
      { name: 'listItem(title, price, category, uri)', desc: 'Đăng bán', role: 'Any' },
      { name: 'buyItem(itemId)', desc: 'Mua sản phẩm', role: 'BUYER' },
      { name: 'confirmDelivery(orderId)', desc: 'Xác nhận nhận hàng', role: 'BUYER' },
      { name: 'rateOrder(orderId, score, review)', desc: 'Đánh giá', role: 'BUYER' },
    ],
    events: ['ItemListed(id, seller, title, price)', 'ItemPurchased(id, buyer)', 'DeliveryConfirmed(orderId)', 'OrderRated(orderId, score)'],
    group: 'Nâng cao',
    sepoliaAddress: '0x4E4721f966F454007127b7f4D049f22961D91596',
    navPath: '/marketplace',
  },
  {
    id: '020', number: '020', name: 'Gây quỹ', icon: HeartHandshake, standard: 'Crowdfunding',
    description: 'Nền tảng crowdfunding — tạo chiến dịch, donate VNDC, milestone tracking, matching fund.',
    details: 'Fundraising cho phép tạo chiến dịch gây quỹ (7 danh mục: Dự án SV, Nghiên cứu, CLB, Từ thiện, Sự kiện, Khởi nghiệp, Khác). Donate VNDC, auto-succeed khi đạt mục tiêu, hoàn tiền khi thất bại. Matching fund do admin nạp. Platform fee 2.5%.',
    features: ['Tạo chiến dịch (7 danh mục)', 'Donate VNDC + tin nhắn', 'Auto-succeed khi đạt goal', 'Hoàn tiền khi thất bại / huỷ', 'Milestone tracking', 'Matching fund (admin)', 'Platform fee 2.5%'],
    contracts: [{ name: 'Fundraising', file: 'Fundraising.sol', loc: 320 }],
    functions: [
      { name: 'createCampaign(title, desc, img, category, goal, days, min)', desc: 'Tạo chiến dịch', role: 'Any' },
      { name: 'donate(campaignId, amount, message)', desc: 'Ủng hộ', role: 'Any' },
      { name: 'withdrawFunds(campaignId)', desc: 'Rút tiền (sau thành công)', role: 'CREATOR' },
      { name: 'claimRefund(campaignId)', desc: 'Hoàn tiền', role: 'DONOR' },
      { name: 'addMilestone(campaignId, desc, target)', desc: 'Thêm milestone', role: 'CREATOR' },
      { name: 'applyMatchingFund(campaignId, amount)', desc: 'Áp dụng matching', role: 'ADMIN' },
    ],
    events: ['CampaignCreated(id, creator, title, goal)', 'DonationReceived(campaignId, donor, amount)', 'CampaignSucceeded(id)', 'CampaignFailed(id)', 'FundsWithdrawn(id, amount)', 'RefundClaimed(campaignId, donor, amount)', 'MatchingFundApplied(campaignId, amount)'],
    group: 'Nâng cao',
    sepoliaAddress: '0x8413712C5C4EeC5a000DB328B50D1Bf738532fEC',
    navPath: '/fundraising',
  },
];

const SEPOLIA_CONTRACTS: { name: string; key: string; address: string }[] = [
  { name: 'VNDC Token', key: 'vndc', address: '0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48' },
  { name: 'VNDCRegistry', key: 'registry', address: '0x7d16b0e9dC98a976F008f5606eE26Bba50FDe2c1' },
  { name: 'AccessControl', key: 'accessControl', address: '0x69d2F6cD1B6a3E4A273C003DcFf0CDA0CEb1cE65' },
  { name: 'CredentialVerification', key: 'credentialVerification', address: '0x2F73B53C805A90C1BB407726c704637C5dC19284' },
  { name: 'CredentialNFT', key: 'credentialNFT', address: '0x706Ca9875Ca5bE5214413d1741c38976BBC38c71' },
  { name: 'AcademicReward', key: 'academicReward', address: '0x59D093AF84dD99fe20817075C52527855b8dFB9b' },
  { name: 'AcademicBadgeNFT', key: 'academicBadgeNFT', address: '0x78d380eeBe479660b37e772Db0404bE62D200851' },
  { name: 'ExtracurricularReward', key: 'extracurricular', address: '0x2ec4Cf8Abfb952Eb3d5844C72925Ebe9FBa70B9e' },
  { name: 'PaymentProcessor', key: 'paymentProcessor', address: '0xe5AA2b90aC87F4271982E26e3D8Be46014f6b30e' },
  { name: 'MerchantRegistry', key: 'merchantRegistry', address: '0x3e33EFe8cBBb65561d1253FEC9295833cF5D714c' },
  { name: 'StudentRecordManager', key: 'studentRecordManager', address: '0x319EE1f8094c9fa5E39cB0643A90aDAC18f37bE2' },
  { name: 'StudentDAO', key: 'studentDAO', address: '0x5eCF36478E3989705972775E1A443F53c7c43532' },
  { name: 'GovernanceToken', key: 'governanceToken', address: '0x8d05155aA9bAeD9862e44fa5697612B9a21eD2A7' },
  { name: 'StudentIDToken', key: 'studentIDToken', address: '0xeeef6d62c071B31C02FA8234a704a3Db9341596F' },
  { name: 'CertificationSystem', key: 'certificationSystem', address: '0x5Ec6441A93ff6F505F779468F0bd12F79Ee03D40' },
  { name: 'ScholarshipManager', key: 'scholarshipManager', address: '0x50Db8937caC9b1D254055438b398a409F9250E03' },
  { name: 'AlumniRegistry', key: 'alumniRegistry', address: '0xC41EE8f2953d1c8aBa093a591857474a08716636' },
  { name: 'ReputationBadgeSystem', key: 'reputationBadge', address: '0x4C906f2bC9Cc6Fd0536DB3b6D9962C0819f79C4c' },
  { name: 'JobBoard', key: 'jobBoard', address: '0xfB0E0143Fc5b83b9809aCa6ae7eD040568d1e116' },
  { name: 'InternshipManager', key: 'internshipManager', address: '0xf41DC2c98852144ec0D7EcEF74D4256BaDdF4460' },
  { name: 'ResearchPlatform', key: 'researchPlatform', address: '0x6e2B4a19c44623b63379c35F1643fc076765f936' },
  { name: 'AuditingSystem', key: 'auditingSystem', address: '0x4AF9eAA67Dc5c5BC9B75f9F0e525aCcAE3A857f5' },
  { name: 'AnalyticsDashboard', key: 'analyticsDashboard', address: '0xb32B60D65f20c24d2885FC472D57A4439c4b3061' },
  { name: 'DataMigration', key: 'dataMigration', address: '0x3d1AD1ebdac6a86C692865C6B5C274EdB57e9445' },
  { name: 'Marketplace', key: 'marketplace', address: '0x4E4721f966F454007127b7f4D049f22961D91596' },
  { name: 'StakingPool', key: 'stakingPool', address: '0xcbC39F0BF0585A11a86F3391d09D1F18f0b01F40' },
  { name: 'Fundraising', key: 'fundraising', address: '0x8413712C5C4EeC5a000DB328B50D1Bf738532fEC' },
];

const TECH_STACK = [
  { category: 'Blockchain', icon: Box, items: [
    { name: 'Solidity 0.8.24', desc: 'Smart contract language' },
    { name: 'Hardhat 2.25', desc: 'Development framework' },
    { name: 'OpenZeppelin 5.x', desc: 'Security library' },
    { name: 'ethers.js v6', desc: 'Ethereum SDK' },
    { name: 'hardhat-deploy', desc: 'Deployment management' },
  ]},
  { category: 'Frontend', icon: Code, items: [
    { name: 'React 18', desc: 'UI framework' },
    { name: 'TypeScript 5.x', desc: 'Type-safe JS' },
    { name: 'Vite 6', desc: 'Build tool / HMR' },
    { name: 'Tailwind CSS v4', desc: 'Utility-first CSS (alpha)' },
    { name: 'react-router v7', desc: 'Client routing' },
  ]},
  { category: 'Libraries', icon: Layers, items: [
    { name: 'react-hot-toast', desc: 'Notification toasts' },
    { name: 'recharts', desc: 'Chart library' },
    { name: 'framer-motion', desc: 'Animation' },
    { name: 'lightweight-charts', desc: 'Trading charts' },
    { name: 'lucide-react', desc: 'Icon library' },
  ]},
  { category: 'Standards', icon: ScrollText, items: [
    { name: 'ERC-20', desc: 'Fungible token (VNDC)' },
    { name: 'ERC-721', desc: 'NFT (Credentials, Badges)' },
    { name: 'ERC-1155', desc: 'Multi-token (Certifications)' },
    { name: 'ERC-20Votes', desc: 'Governance voting' },
    { name: 'EIP-2612 Permit', desc: 'Gasless approvals' },
  ]},
];

const ARCHITECTURE_FEATURES = [
  { icon: Lock, title: 'Access Control', desc: 'Phân quyền role-based: Admin, Minter, Educator, Verifier, Student, Merchant. Mỗi contract có permissions riêng, quản lý tập trung qua VNDCAccessControl.' },
  { icon: Network, title: 'Central Registry', desc: 'VNDCRegistry — registry trung tâm lưu mapping tên → address. Tất cả module tìm nhau qua Registry, dễ dàng upgrade và thay thế contract.' },
  { icon: GitBranch, title: 'Modular Architecture', desc: '22 module độc lập (001 → 020), mỗi module 1-2 contract. Thêm module mới không ảnh hưởng module cũ. Separation of concerns.' },
  { icon: Cpu, title: 'Gas Optimized', desc: 'Compile với viaIR = true, optimizer 200 runs. Packed storage slots, batch operations, minimal external calls để tối ưu gas cost.' },
  { icon: Zap, title: 'EVM Compatible', desc: 'Deploy được trên mọi EVM chain: Ethereum, Polygon, BSC, Arbitrum, Optimism... Hiện tại trên Sepolia testnet, sẵn sàng mainnet.' },
  { icon: Globe, title: 'Verified & Open Source', desc: 'Tất cả 27 contracts đã verified trên Etherscan. Source code công khai, ai cũng có thể đọc và audit logic on-chain.' },
];

const FAQ_ITEMS = [
  {
    q: 'VNDC Campus là gì?',
    a: 'VNDC Campus là nền tảng quản lý giáo dục toàn diện trên blockchain, với 22 module smart contract bao phủ toàn bộ hoạt động campus: từ token thanh toán, bằng cấp NFT, quản trị DAO, học bổng, việc làm, đến sàn giao dịch và gây quỹ cộng đồng.',
  },
  {
    q: 'Làm sao để bắt đầu sử dụng?',
    a: 'Cài MetaMask → chuyển sang mạng Sepolia testnet → kết nối ví với ứng dụng → nhận VNDC test token từ admin hoặc faucet. Sau đó bạn có thể sử dụng tất cả tính năng: thanh toán, bỏ phiếu, ứng tuyển, giao dịch...',
  },
  {
    q: 'VNDC token có giá trị thật không?',
    a: 'Hiện tại trên Sepolia testnet, VNDC không có giá trị thật. Khi deploy lên mainnet (Polygon/Ethereum), token sẽ có giá trị theo quy định của tổ chức vận hành campus.',
  },
  {
    q: 'Dữ liệu trên blockchain có thể sửa được không?',
    a: 'Không. Dữ liệu đã ghi lên blockchain (bằng cấp, điểm, giao dịch, bỏ phiếu...) là bất biến (immutable). Chỉ owner/admin mới có thể thực hiện các thao tác đặc biệt như revoke, pause, nhưng dữ liệu gốc vẫn tồn tại.',
  },
  {
    q: 'Smart contract có an toàn không?',
    a: 'Các contract sử dụng OpenZeppelin 5.x — thư viện bảo mật được audit bởi cộng đồng. Có ReentrancyGuard, AccessControl, Pausable. Mã nguồn đã verified trên Etherscan. Module Auditing (016) cho phép kiểm toán nội bộ.',
  },
  {
    q: 'Gas fee hoạt động thế nào?',
    a: 'Mỗi giao dịch on-chain cần gas (ETH trên Sepolia). Trên testnet gas miễn phí (lấy từ faucet). Trên mainnet Polygon, gas rất thấp (~$0.001-0.01/tx). Một số thao tác hỗ trợ gasless qua EIP-2612 Permit.',
  },
  {
    q: 'Soulbound Token (SBT) nghĩa là gì?',
    a: 'SBT là NFT không thể chuyển nhượng — gắn vĩnh viễn với ví sở hữu. Thẻ sinh viên (Module 008) là SBT, đảm bảo không thể mua bán hay giả mạo danh tính.',
  },
  {
    q: 'Có thể tích hợp với hệ thống trường hiện tại không?',
    a: 'Có. Module Data Migration (017) cung cấp công cụ import/export dữ liệu. Registry pattern cho phép thêm adapter contract kết nối với API truyền thống qua Oracle.',
  },
];

const ROLES_DATA = [
  { role: 'DEFAULT_ADMIN', badge: 'badge-error', desc: 'Quản trị viên cao nhất của hệ thống', permissions: 'Cấp/thu hồi role, pause hệ thống, deploy contract, cấu hình tham số', icon: Key },
  { role: 'MINTER_ROLE', badge: 'badge-brand', desc: 'Người có quyền phát hành token', permissions: 'Mint VNDC token, mint NFT badge, deposit rewards', icon: Coins },
  { role: 'EDUCATOR_ROLE', badge: 'badge-success', desc: 'Giảng viên / Giáo vụ / Quản lý', permissions: 'Cấp chứng chỉ, nhập điểm, phát thưởng, xác nhận hoạt động, tạo sự kiện', icon: GraduationCap },
  { role: 'VERIFIER_ROLE', badge: 'badge-warning', desc: 'Người xác minh chứng chỉ / hồ sơ', permissions: 'Xác minh chứng chỉ, kiểm tra hồ sơ, validate dữ liệu migration', icon: Eye },
  { role: 'ISSUER_ROLE', badge: 'badge-info', desc: 'Người cấp chứng chỉ nghề ERC-1155', permissions: 'Cấp batch certificates, tạo loại chứng chỉ, thu hồi', icon: Award },
  { role: 'STUDENT', badge: 'badge-neutral', desc: 'Sinh viên — người dùng chính', permissions: 'Thanh toán, bỏ phiếu, ứng tuyển, giao dịch, donate, stake, mua/bán trên marketplace', icon: IdCard },
];

const WORKFLOW_STEPS = [
  {
    title: 'Cho sinh viên',
    color: 'brand',
    steps: [
      { num: 1, text: 'Cài đặt MetaMask và thêm mạng Sepolia Testnet', detail: 'RPC: https://1rpc.io/sepolia • Chain ID: 11155111 • Currency: ETH' },
      { num: 2, text: 'Kết nối ví (Connect Wallet) trên ứng dụng', detail: 'Click "Kết nối ví" phía trên bên phải → Chọn MetaMask → Approve' },
      { num: 3, text: 'Nhận VNDC token và ETH testnet', detail: 'Nhận ETH từ Sepolia faucet → Admin mint VNDC cho bạn → Bắt đầu dùng' },
      { num: 4, text: 'Sử dụng các tính năng campus', detail: 'Thanh toán, bỏ phiếu DAO, ứng tuyển việc làm, giao dịch marketplace, donate gây quỹ...' },
    ],
  },
  {
    title: 'Cho quản trị viên',
    color: 'amber',
    steps: [
      { num: 1, text: 'Deploy contracts lên mạng blockchain', detail: 'npx hardhat deploy --network sepolia --tags 001-core,002-credentials,...' },
      { num: 2, text: 'Verify contracts trên Etherscan', detail: 'npx hardhat verify --network sepolia <contract-address> <constructor-args>' },
      { num: 3, text: 'Cấu hình Registry và Access Control', detail: 'Đăng ký tất cả contract vào VNDCRegistry → Cấp role cho giảng viên và nhân viên' },
      { num: 4, text: 'Mint VNDC token và khởi tạo dữ liệu', detail: 'Mint token cho sinh viên → Tạo học bổng → Thiết lập reward → Đăng ký merchant' },
    ],
  },
];

// ═══════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════

export default function DocumentationPage() {
  const [tab, setTab] = useState<DocTab>('overview');
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterGroup, setFilterGroup] = useState<string>('all');
  const [copiedAddr, setCopiedAddr] = useState('');
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(''), 2000);
  };

  const filteredModules = useMemo(() => {
    return MODULES.filter(m => {
      if (searchText && !m.name.toLowerCase().includes(searchText.toLowerCase()) && !m.description.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (filterGroup !== 'all' && m.group !== filterGroup) return false;
      return true;
    });
  }, [searchText, filterGroup]);

  const tabs: { key: DocTab; label: string; icon: typeof BookOpen }[] = [
    { key: 'overview', label: 'Tổng quan', icon: BookOpen },
    { key: 'modules', label: `Modules (${MODULES.length})`, icon: Cpu },
    { key: 'contracts', label: `Contracts (${SEPOLIA_CONTRACTS.length})`, icon: FileCode2 },
    { key: 'guides', label: 'Hướng dẫn', icon: Rocket },
    { key: 'api', label: 'Architecture', icon: Network },
    { key: 'faq', label: 'FAQ', icon: HelpCircle },
  ];

  return (
    <div className="space-y-6">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
            <BookOpen size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-surface-800">Tài liệu VNDC Campus</h1>
            <p className="text-sm text-surface-500">Hướng dẫn toàn diện — kiến trúc, module, API và hướng dẫn sử dụng</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="https://sepolia.etherscan.io"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost text-sm flex items-center gap-1.5"
          >
            <ExternalLink size={14} /> Etherscan
          </a>
          <span className="badge badge-success">v2.0 — 27 Contracts</span>
        </div>
      </div>

      {/* ═══ TAB NAVIGATION ═══ */}
      <div className="flex gap-1 border-b border-surface-200 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              tab === t.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Overview                                         */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Hero */}
          <div className="card overflow-hidden">
            <div className="bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 p-8 text-white">
              <h2 className="text-3xl font-bold mb-3">VNDC Campus</h2>
              <p className="text-lg opacity-90 mb-2">Nền tảng Blockchain toàn diện cho Giáo dục Đại học</p>
              <p className="opacity-80 max-w-2xl leading-relaxed">
                Hệ sinh thái 27 smart contract trên Ethereum (Sepolia), bao phủ toàn bộ hoạt động campus:
                từ đăng ký sinh viên, quản lý hồ sơ, bằng cấp NFT, thanh toán VNDC, quản trị DAO,
                cho đến marketplace, staking, crowdfunding và hơn thế nữa.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3">
                  <p className="text-3xl font-bold text-brand-600">27</p>
                  <p className="text-sm text-surface-500">Smart Contracts</p>
                </div>
                <div className="text-center p-3">
                  <p className="text-3xl font-bold text-green-600">22</p>
                  <p className="text-sm text-surface-500">Modules</p>
                </div>
                <div className="text-center p-3">
                  <p className="text-3xl font-bold text-purple-600">300+</p>
                  <p className="text-sm text-surface-500">Functions</p>
                </div>
                <div className="text-center p-3">
                  <p className="text-3xl font-bold text-amber-600">5</p>
                  <p className="text-sm text-surface-500">ERC Standards</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Badges */}
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-brand">Solidity 0.8.24</span>
            <span className="badge badge-success">27 Contracts Verified</span>
            <span className="badge badge-info">OpenZeppelin 5.x</span>
            <span className="badge badge-warning">ERC-20 / 721 / 1155</span>
            <span className="badge badge-neutral">Sepolia Testnet</span>
            <span className="badge badge-brand">Hardhat 2.25</span>
            <span className="badge badge-success">React 18 + Vite 6</span>
            <span className="badge badge-info">Tailwind CSS v4</span>
          </div>

          {/* Module Group Overview */}
          <div>
            <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Layers size={18} className="text-brand-600" /> Tổng quan Module theo nhóm
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { group: 'Core', desc: 'Token, Registry, Bằng cấp, Phần thưởng, Ngoại khóa', color: 'from-blue-500 to-blue-700', count: MODULES.filter(m => m.group === 'Core').length },
                { group: 'Dịch vụ', desc: 'Thanh toán, Hồ sơ, DAO, Thẻ SV, Chứng chỉ, Học bổng', color: 'from-green-500 to-green-700', count: MODULES.filter(m => m.group === 'Dịch vụ').length },
                { group: 'Nâng cao', desc: 'Alumni, Danh tiếng, Việc làm, Thực tập, Nghiên cứu, Sàn, Marketplace, Staking, Gây quỹ', color: 'from-purple-500 to-purple-700', count: MODULES.filter(m => m.group === 'Nâng cao').length },
                { group: 'Hệ thống', desc: 'Kiểm toán, Tích hợp, Phân tích', color: 'from-amber-500 to-amber-700', count: MODULES.filter(m => m.group === 'Hệ thống').length },
              ].map(g => (
                <div key={g.group} className="card overflow-hidden cursor-pointer hover:shadow-lg transition-shadow" onClick={() => { setTab('modules'); setFilterGroup(g.group); }}>
                  <div className={`bg-gradient-to-r ${g.color} p-4 text-white`}>
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-lg">{g.group}</h4>
                      <span className="text-2xl font-bold opacity-80">{g.count}</span>
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="text-xs text-surface-500 leading-relaxed">{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tech Stack */}
          <div>
            <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Code size={18} className="text-brand-600" /> Công nghệ sử dụng
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TECH_STACK.map(({ category, icon: CatIcon, items }) => (
                <div key={category} className="card p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CatIcon size={18} className="text-brand-600" />
                    <h4 className="font-semibold text-surface-800">{category}</h4>
                  </div>
                  <ul className="space-y-2">
                    {items.map(item => (
                      <li key={item.name} className="text-sm">
                        <span className="font-medium text-surface-700">{item.name}</span>
                        <span className="text-surface-400 text-xs ml-1.5">— {item.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture Features */}
          <div>
            <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Workflow size={18} className="text-brand-600" /> Đặc điểm kiến trúc
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ARCHITECTURE_FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="card card-hover p-5">
                  <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center mb-3">
                    <Icon size={20} className="text-brand-600" />
                  </div>
                  <h4 className="font-semibold text-surface-800 mb-1.5">{title}</h4>
                  <p className="text-sm text-surface-500 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Modules                                          */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'modules' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
              <input
                type="text"
                placeholder="Tìm kiếm module..."
                className="input w-full pl-9"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
              />
            </div>
            <div className="flex gap-1">
              {['all', 'Core', 'Dịch vụ', 'Nâng cao', 'Hệ thống'].map(g => (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-all ${
                    filterGroup === g
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                >
                  {g === 'all' ? 'Tất cả' : g}
                </button>
              ))}
            </div>
          </div>

          <p className="text-sm text-surface-500">{filteredModules.length} module</p>

          {/* Module List */}
          <div className="space-y-2">
            {filteredModules.map((mod) => {
              const isExpanded = expandedModule === mod.id;
              const Icon = mod.icon;
              return (
                <div key={mod.id} className="card overflow-hidden">
                  <button
                    onClick={() => setExpandedModule(isExpanded ? null : mod.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-brand-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs text-surface-400 font-mono">#{mod.number}</span>
                        <h4 className="font-semibold text-surface-800">{mod.name}</h4>
                        <span className="badge badge-neutral text-[10px]">{mod.standard}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                          mod.group === 'Core' ? 'bg-blue-100 text-blue-700' :
                          mod.group === 'Dịch vụ' ? 'bg-green-100 text-green-700' :
                          mod.group === 'Nâng cao' ? 'bg-purple-100 text-purple-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{mod.group}</span>
                      </div>
                      <p className="text-sm text-surface-500 truncate">{mod.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="hidden md:flex items-center gap-3 text-xs text-surface-400">
                        <span>{mod.contracts.length} contract{mod.contracts.length > 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span>{mod.functions.length} fn</span>
                        <span>•</span>
                        <span>{mod.events.length} event{mod.events.length > 1 ? 's' : ''}</span>
                      </div>
                      {isExpanded ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-surface-200 bg-surface-50 animate-fade-in">
                      <div className="p-5 space-y-5">
                        {/* Description */}
                        <p className="text-sm text-surface-600 leading-relaxed">{mod.details}</p>

                        {/* Contract info + Sepolia */}
                        {mod.sepoliaAddress && (
                          <div className="flex items-center gap-2 p-3 bg-surface-100 rounded-lg">
                            <CircleDot size={14} className="text-green-500 shrink-0" />
                            <span className="text-xs text-surface-500">Sepolia:</span>
                            <code className="text-xs font-mono text-brand-600 truncate">{mod.sepoliaAddress}</code>
                            <button onClick={() => copyAddress(mod.sepoliaAddress!)} className="shrink-0 p-1 hover:bg-surface-200 rounded">
                              {copiedAddr === mod.sepoliaAddress ? <Check size={12} className="text-green-500" /> : <Copy size={12} className="text-surface-400" />}
                            </button>
                            <a href={`https://sepolia.etherscan.io/address/${mod.sepoliaAddress}`} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 hover:bg-surface-200 rounded">
                              <ExternalLink size={12} className="text-surface-400" />
                            </a>
                          </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                          {/* Features */}
                          <div>
                            <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1"><CheckCircle2 size={12} /> Tính năng</h5>
                            <ul className="space-y-1.5">
                              {mod.features.map(f => (
                                <li key={f} className="flex items-start gap-2 text-sm text-surface-700">
                                  <span className="w-1.5 h-1.5 mt-1.5 rounded-full bg-brand-500 shrink-0" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Contracts */}
                          <div>
                            <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1"><FileCode2 size={12} /> Smart Contracts</h5>
                            <ul className="space-y-1.5 mb-4">
                              {mod.contracts.map(c => (
                                <li key={c.name} className="flex items-center gap-2 text-sm">
                                  <Code size={12} className="text-brand-600 shrink-0" />
                                  <code className="font-mono text-brand-700 text-xs">{c.file}</code>
                                  <span className="text-xs text-surface-400">~{c.loc} LOC</span>
                                </li>
                              ))}
                            </ul>

                            <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Megaphone size={12} /> Events</h5>
                            <ul className="space-y-1">
                              {mod.events.map(ev => (
                                <li key={ev} className="text-xs font-mono text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block mr-1 mb-1">{ev}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Functions Table */}
                        <div>
                          <h5 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Terminal size={12} /> Hàm chính</h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-surface-200">
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-surface-500">Function</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-surface-500">Mô tả</th>
                                  <th className="text-left py-2 px-3 text-xs font-semibold text-surface-500">Role</th>
                                </tr>
                              </thead>
                              <tbody>
                                {mod.functions.map(fn => (
                                  <tr key={fn.name} className="border-b border-surface-100">
                                    <td className="py-2 px-3"><code className="text-xs font-mono text-brand-700">{fn.name}</code></td>
                                    <td className="py-2 px-3 text-surface-600 text-xs">{fn.desc}</td>
                                    <td className="py-2 px-3"><span className="badge badge-neutral text-[10px]">{fn.role || 'Any'}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Nav link */}
                        <a href={mod.navPath} className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium">
                          <ArrowRight size={14} /> Mở trang {mod.name}
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Contracts                                        */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'contracts' && (
        <div className="space-y-6">
          {/* Network Info */}
          <div className="card p-5 border-l-4 border-l-green-500">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              <h3 className="font-semibold text-surface-800">Sepolia Testnet</h3>
              <span className="badge badge-neutral text-xs">Chain ID: 11155111</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-surface-500">RPC URL</span>
                <p className="font-mono text-xs text-surface-700 mt-0.5">https://1rpc.io/sepolia</p>
              </div>
              <div>
                <span className="text-surface-500">Explorer</span>
                <p className="text-xs mt-0.5">
                  <a href="https://sepolia.etherscan.io" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline flex items-center gap-1">
                    sepolia.etherscan.io <ExternalLink size={10} />
                  </a>
                </p>
              </div>
              <div>
                <span className="text-surface-500">Currency</span>
                <p className="font-mono text-xs text-surface-700 mt-0.5">ETH (SepoliaETH)</p>
              </div>
            </div>
          </div>

          {/* Contracts Table */}
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
              <h3 className="font-semibold text-surface-800">
                Deployed Contracts ({SEPOLIA_CONTRACTS.length})
              </h3>
              <span className="badge badge-success text-xs flex items-center gap-1">
                <CheckCircle2 size={10} /> All Verified
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-surface-600 text-xs">#</th>
                    <th className="text-left py-3 px-4 font-semibold text-surface-600 text-xs">Contract</th>
                    <th className="text-left py-3 px-4 font-semibold text-surface-600 text-xs">Địa chỉ Sepolia</th>
                    <th className="text-center py-3 px-4 font-semibold text-surface-600 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {SEPOLIA_CONTRACTS.map((c, i) => (
                    <tr key={c.key} className="hover:bg-surface-50 transition-colors">
                      <td className="py-2.5 px-4 text-xs text-surface-400">{i + 1}</td>
                      <td className="py-2.5 px-4">
                        <span className="font-medium text-surface-800">{c.name}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <code className="text-xs font-mono text-brand-600">{c.address}</code>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => copyAddress(c.address)}
                            className="p-1.5 rounded hover:bg-surface-200 transition-colors"
                            title="Copy address"
                          >
                            {copiedAddr === c.address ? <Check size={13} className="text-green-500" /> : <Copy size={13} className="text-surface-400" />}
                          </button>
                          <a
                            href={`https://sepolia.etherscan.io/address/${c.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-surface-200 transition-colors"
                            title="View on Etherscan"
                          >
                            <ExternalLink size={13} className="text-surface-400" />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contract Integration Example */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-3 flex items-center gap-2">
              <Terminal size={16} className="text-brand-600" /> Tích hợp với ethers.js
            </h3>
            <div className="bg-surface-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-green-400 font-mono leading-relaxed">
{`import { Contract, BrowserProvider } from 'ethers';

// 1. Kết nối ví
const provider = new BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// 2. Tạo contract instance
const VNDC_ADDRESS = '0x682053A38Dfaae87a6c3e469C61aC798B2a3aD48';
const vndc = new Contract(VNDC_ADDRESS, VNDC_ABI, signer);

// 3. Gọi function
const balance = await vndc.balanceOf(signer.address);
console.log('Balance:', balance.toString());

// 4. Gửi transaction
const tx = await vndc.transfer(recipient, amount);
await tx.wait();
console.log('TX hash:', tx.hash);`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Guides                                           */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'guides' && (
        <div className="space-y-6">
          {/* Getting Started */}
          {WORKFLOW_STEPS.map(wf => (
            <div key={wf.title} className="card p-5">
              <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
                <Rocket size={18} className={wf.color === 'brand' ? 'text-brand-600' : 'text-amber-600'} />
                {wf.title}
              </h3>
              <div className="space-y-3">
                {wf.steps.map(step => (
                  <div key={step.num} className="flex gap-3">
                    <div className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold text-white ${
                      wf.color === 'brand' ? 'bg-brand-500' : 'bg-amber-500'
                    }`}>
                      {step.num}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="font-medium text-surface-800 text-sm">{step.text}</p>
                      <p className="text-xs text-surface-500 mt-0.5">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Roles */}
          <div>
            <h3 className="text-lg font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Key size={18} className="text-brand-600" /> Phân quyền & Vai trò (Access Control)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROLES_DATA.map(r => {
                const RIcon = r.icon;
                return (
                  <div key={r.role} className="card p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-xl bg-surface-100 flex items-center justify-center">
                        <RIcon size={18} className="text-surface-600" />
                      </div>
                      <div>
                        <span className={`badge ${r.badge} text-xs`}>{r.role}</span>
                        <p className="text-xs text-surface-500 mt-0.5">{r.desc}</p>
                      </div>
                    </div>
                    <p className="text-sm text-surface-600 pl-12">{r.permissions}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Common Workflows */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Workflow size={18} className="text-brand-600" /> Luồng nghiệp vụ phổ biến
            </h3>
            <div className="space-y-5">
              {[
                {
                  title: 'Cấp bằng cấp NFT',
                  steps: ['Admin cấp EDUCATOR_ROLE cho giảng viên', 'Giảng viên gọi issueCredential(student, type, uri)', 'CredentialNFT được mint cho sinh viên', 'Bất kỳ ai gọi verifyCredential(tokenId) để xác minh'],
                },
                {
                  title: 'Tạo đề xuất DAO & bỏ phiếu',
                  steps: ['Sinh viên delegate voting power cho mình hoặc đại diện', 'Tạo proposal với propose(targets, values, calldatas, desc)', 'Cộng đồng bỏ phiếu castVote(proposalId, For/Against)', 'Đạt quorum → execute(proposalId) → thực thi on-chain'],
                },
                {
                  title: 'Gây quỹ Crowdfunding',
                  steps: ['Sinh viên tạo chiến dịch: createCampaign(title, desc, goal, days)', 'Cộng đồng approve VNDC → donate(campaignId, amount, message)', 'Khi raisedAmount ≥ goalAmount → auto-succeed', 'Creator gọi withdrawFunds() nhận tiền (trừ 2.5% platform fee)'],
                },
                {
                  title: 'Mua bán Marketplace',
                  steps: ['Seller đăng sản phẩm: listItem(title, price, category)', 'Buyer approve VNDC → buyItem(itemId) → tiền vào escrow', 'Buyer nhận hàng → confirmDelivery(orderId)', 'Seller nhận VNDC → Buyer đánh giá rateOrder()'],
                },
              ].map(wf => (
                <div key={wf.title}>
                  <h4 className="text-sm font-semibold text-surface-700 mb-2">{wf.title}</h4>
                  <div className="flex flex-wrap gap-2 items-center">
                    {wf.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="bg-brand-50 text-brand-700 text-xs px-3 py-1.5 rounded-lg max-w-xs">
                          {step}
                        </div>
                        {i < wf.steps.length - 1 && <ArrowRight size={14} className="text-surface-300 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security */}
          <div className="card p-5 border-l-4 border-l-amber-500">
            <h3 className="font-semibold text-surface-800 mb-3 flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-600" /> Bảo mật & Lưu ý
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Tất cả contract sử dụng OpenZeppelin 5.x — thư viện được audit bởi cộng đồng lớn nhất',
                'ReentrancyGuard bảo vệ reentrancy attack trên mọi function thanh toán VNDC',
                'AccessControl phân quyền chặt chẽ — chỉ role phù hợp mới gọi được function',
                'Pausable cho phép admin tạm dừng khẩn cấp khi phát hiện lỗ hổng',
                'StudentIDToken là Soulbound (SBT) — không thể transfer, không thể giả mạo',
                'Mọi contract đều verified trên Etherscan — source code công khai kiểm tra được',
              ].map((note, i) => (
                <div key={i} className="flex gap-2 text-sm text-surface-600">
                  <Shield size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  {note}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: Architecture / API                               */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'api' && (
        <div className="space-y-6">
          {/* System Diagram */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Network size={18} className="text-brand-600" /> Sơ đồ kiến trúc hệ thống
            </h3>
            <div className="bg-surface-50 rounded-xl p-6 overflow-x-auto">
              <div className="min-w-[700px] space-y-6">
                {/* Frontend Layer */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold text-sm">
                    <Globe size={16} /> Frontend — React 18 + TypeScript + Vite 6 + Tailwind CSS v4
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-px h-6 bg-surface-300" />
                </div>
                {/* ethers.js Layer */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg font-semibold text-sm">
                    <Plug size={16} /> ethers.js v6 — Contract, Provider, Signer
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-px h-6 bg-surface-300" />
                </div>
                {/* Smart Contracts Layer */}
                <div className="bg-white border border-surface-200 rounded-xl p-4">
                  <p className="text-center text-xs font-semibold text-surface-500 mb-3 uppercase tracking-wider">Smart Contract Layer — Solidity 0.8.24</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'VNDCRegistry', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                      { label: 'AccessControl', color: 'bg-red-50 text-red-700 border-red-200' },
                      { label: 'VNDCToken', color: 'bg-green-50 text-green-700 border-green-200' },
                      { label: 'PaymentProcessor', color: 'bg-green-50 text-green-700 border-green-200' },
                      { label: 'CredentialNFT', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                      { label: 'StudentDAO', color: 'bg-purple-50 text-purple-700 border-purple-200' },
                      { label: 'StudentIDToken', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      { label: 'ScholarshipManager', color: 'bg-orange-50 text-orange-700 border-orange-200' },
                      { label: 'Marketplace', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                      { label: 'StakingPool', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                      { label: 'Fundraising', color: 'bg-teal-50 text-teal-700 border-teal-200' },
                      { label: '+16 contracts...', color: 'bg-surface-100 text-surface-600 border-surface-200' },
                    ].map(c => (
                      <div key={c.label} className={`text-xs font-medium text-center py-1.5 px-2 rounded-lg border ${c.color}`}>
                        {c.label}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-center">
                  <div className="w-px h-6 bg-surface-300" />
                </div>
                {/* EVM Layer */}
                <div className="text-center">
                  <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 px-4 py-2 rounded-lg font-semibold text-sm">
                    <Database size={16} /> Ethereum Virtual Machine (Sepolia Testnet — Chain 11155111)
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Module Interaction Pattern */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Workflow size={18} className="text-brand-600" /> Pattern giao tiếp giữa modules
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-surface-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">1. Registry Lookup</h4>
                <p className="text-xs text-surface-500 leading-relaxed">
                  Mỗi module gọi <code className="bg-surface-200 px-1 rounded text-xs">Registry.getContractAddress("VNDCToken")</code> để
                  tìm address contract cần tương tác. Không hardcode address.
                </p>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">2. Token Transfer</h4>
                <p className="text-xs text-surface-500 leading-relaxed">
                  Thanh toán VNDC qua pattern: User approve → Contract gọi <code className="bg-surface-200 px-1 rounded text-xs">VNDC.transferFrom(user, recipient, amount)</code>.
                </p>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">3. Access Check</h4>
                <p className="text-xs text-surface-500 leading-relaxed">
                  Mọi function restricted đều check <code className="bg-surface-200 px-1 rounded text-xs">AccessControl.hasRole(role, msg.sender)</code> hoặc
                  dùng modifier <code className="bg-surface-200 px-1 rounded text-xs">onlyOwner</code>.
                </p>
              </div>
            </div>
          </div>

          {/* Frontend Architecture */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-4 flex items-center gap-2">
              <Code size={18} className="text-brand-600" /> Frontend Architecture
            </h3>
            <div className="bg-surface-900 rounded-lg p-5 overflow-x-auto">
              <pre className="text-xs text-green-400 font-mono leading-relaxed">
{`FE/src/
├── App.tsx                  # Router: 25 routes
├── contexts/
│   └── Web3Context.tsx      # Wallet connection, provider, signer, chainId
├── contracts/
│   ├── addresses.ts         # 28 contract addresses (Sepolia, Hardhat, Polygon)
│   └── abis.ts              # 28 ABI definitions (human-readable format)
├── hooks/
│   ├── useContracts.ts      # 28 hooks: useVNDC(), useFundraising() etc.
│   └── useContractAction.ts # TX state management: execute(), isLoading, txHash
├── config/
│   └── navigation.ts        # 25 nav items, 5 groups
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx      # Navigation sidebar
│   │   └── Header.tsx       # Top bar with wallet connect
│   └── ui/
│       ├── Modal.tsx         # Reusable modal component
│       └── EmptyState.tsx    # Empty state placeholder
├── pages/                   # 25 page components
│   ├── DashboardPage.tsx    # Overview stats
│   ├── TokenPage.tsx        # VNDC token management
│   ├── FundraisingPage.tsx  # Crowdfunding (latest)
│   └── ...                  # Other module pages
└── lib/
    └── utils.ts             # formatVNDC, shortenAddress, formatDate...`}
              </pre>
            </div>
          </div>

          {/* Compiler Settings */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-3 flex items-center gap-2">
              <Cpu size={18} className="text-brand-600" /> Cấu hình Compiler & Deploy
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-surface-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">Solidity Compiler</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-surface-500">Version</span><code className="text-surface-700">0.8.24</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">viaIR</span><code className="text-green-600">true</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Optimizer Runs</span><code className="text-surface-700">200</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Metadata Hash</span><code className="text-surface-700">none</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">EVM Target</span><code className="text-surface-700">paris</code></div>
                </div>
              </div>
              <div className="bg-surface-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-surface-700 mb-2">Deploy Framework</h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-surface-500">Framework</span><code className="text-surface-700">Hardhat 2.25</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Deploy Plugin</span><code className="text-surface-700">hardhat-deploy</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Verify</span><code className="text-surface-700">hardhat-verify</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Typechain</span><code className="text-surface-700">ethers-v6</code></div>
                  <div className="flex justify-between"><span className="text-surface-500">Networks</span><code className="text-surface-700">localhost, sepolia, polygon</code></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* TAB: FAQ                                              */}
      {/* ═══════════════════════════════════════════════════════ */}
      {tab === 'faq' && (
        <div className="space-y-6">
          <div className="card p-5 border-l-4 border-l-brand-500">
            <div className="flex items-center gap-2 mb-1">
              <Info size={18} className="text-brand-600" />
              <h3 className="font-semibold text-surface-800">Câu hỏi thường gặp</h3>
            </div>
            <p className="text-sm text-surface-500">Giải đáp các thắc mắc phổ biến về VNDC Campus</p>
          </div>

          <div className="space-y-2">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = expandedFAQ === i;
              return (
                <div key={i} className="card overflow-hidden">
                  <button
                    onClick={() => setExpandedFAQ(isOpen ? null : i)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                      <HelpCircle size={16} className="text-brand-600" />
                    </div>
                    <span className="flex-1 font-medium text-surface-800 text-sm">{item.q}</span>
                    <ChevronDown size={16} className={`text-surface-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-surface-200 p-4 bg-surface-50 animate-fade-in">
                      <p className="text-sm text-surface-600 leading-relaxed pl-11">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Important Notes */}
          <div className="card p-5 bg-amber-50 border border-amber-200">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <MessageSquareWarning size={18} /> Lưu ý quan trọng
            </h3>
            <ul className="space-y-2 text-sm text-amber-700">
              <li className="flex gap-2"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Luôn kiểm tra mạng (Sepolia) trước khi thực hiện giao dịch</li>
              <li className="flex gap-2"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Không bao giờ chia sẻ private key hoặc seed phrase</li>
              <li className="flex gap-2"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Transaction trên blockchain là không thể đảo ngược — hãy kiểm tra kỹ trước khi confirm</li>
              <li className="flex gap-2"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Cần ETH Sepolia để trả gas fee — lấy miễn phí từ faucet</li>
              <li className="flex gap-2"><Lightbulb size={14} className="shrink-0 mt-0.5" /> Phải <b>Approve</b> VNDC trước khi thực hiện bất kỳ thanh toán / donate / stake nào</li>
            </ul>
          </div>

          {/* Glossary */}
          <div className="card p-5">
            <h3 className="font-semibold text-surface-800 mb-3 flex items-center gap-2">
              <Hash size={18} className="text-brand-600" /> Thuật ngữ blockchain
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { term: 'Smart Contract', def: 'Chương trình tự chạy trên blockchain, tự động thực thi khi đủ điều kiện' },
                { term: 'NFT (Non-Fungible Token)', def: 'Token không thể thay thế — mỗi NFT là duy nhất (dùng cho bằng cấp, badge)' },
                { term: 'SBT (Soulbound Token)', def: 'NFT không thể chuyển nhượng — gắn vĩnh viễn với ví sở hữu' },
                { term: 'Gas Fee', def: 'Phí trả cho miners/validators để xử lý giao dịch trên blockchain' },
                { term: 'ERC-20', def: 'Chuẩn token fungible trên Ethereum (VNDC, USDC, USDT...)' },
                { term: 'DAO', def: 'Decentralized Autonomous Organization — tổ chức quản trị phi tập trung bằng voting' },
                { term: 'Approve', def: 'Cho phép contract chi tiêu token thay mặt bạn (bắt buộc trước transfer)' },
                { term: 'Wallet (MetaMask)', def: 'Ví điện tử lưu trữ khóa riêng (private key) để ký giao dịch blockchain' },
                { term: 'Escrow', def: 'Tài khoản trung gian giữ tiền cho đến khi giao dịch hoàn tất (dùng trong Marketplace)' },
                { term: 'Quorum', def: 'Số phiếu tối thiểu cần đạt để proposal DAO có hiệu lực' },
              ].map(({ term, def }) => (
                <div key={term} className="flex gap-2 text-sm">
                  <span className="font-semibold text-brand-700 whitespace-nowrap">{term}:</span>
                  <span className="text-surface-600">{def}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ FOOTER ═══ */}
      <div className="card p-6 text-center bg-gradient-to-r from-surface-50 to-surface-100">
        <p className="text-sm font-medium text-surface-700">
          VNDC Campus v2.0 — 27 Smart Contracts • 22 Modules • 25 Pages
        </p>
        <p className="text-xs text-surface-400 mt-1">
          Built with Hardhat 2.25, Solidity 0.8.24, React 18, TypeScript, Vite 6, Tailwind CSS v4
        </p>
        <p className="text-xs text-surface-400 mt-1">
          © 2024 — 2026 VNDC Campus. Deployed on Sepolia Testnet (Chain 11155111).
        </p>
      </div>
    </div>
  );
}
