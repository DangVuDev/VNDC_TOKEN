import {
  LayoutDashboard, Coins, ShieldCheck, GraduationCap, Trophy, CreditCard,
  FileText, Vote, IdCard, Award, Wallet, Users, Star, Briefcase,
  Building2, FlaskConical, Search, Plug, BarChart3, Settings, ArrowLeftRight,
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, group: 'Tổng quan' },
  { label: 'VNDC Token', path: '/token', icon: Coins, group: 'Core' },
  { label: 'Bằng cấp', path: '/credentials', icon: ShieldCheck, group: 'Core' },
  { label: 'Thưởng học tập', path: '/academic-rewards', icon: GraduationCap, group: 'Core' },
  { label: 'Ngoại khóa', path: '/extracurricular', icon: Trophy, group: 'Core' },
  { label: 'Thanh toán', path: '/payments', icon: CreditCard, group: 'Dịch vụ' },
  { label: 'Hồ sơ học tập', path: '/records', icon: FileText, group: 'Dịch vụ' },
  { label: 'Quản trị DAO', path: '/governance', icon: Vote, group: 'Dịch vụ' },
  { label: 'Thẻ sinh viên', path: '/student-id', icon: IdCard, group: 'Dịch vụ' },
  { label: 'Chứng chỉ', path: '/certification', icon: Award, group: 'Dịch vụ' },
  { label: 'Học bổng', path: '/scholarship', icon: Wallet, group: 'Dịch vụ' },
  { label: 'Cựu sinh viên', path: '/alumni', icon: Users, group: 'Nâng cao' },
  { label: 'Danh tiếng', path: '/reputation', icon: Star, group: 'Nâng cao' },
  { label: 'Việc làm', path: '/job-board', icon: Briefcase, group: 'Nâng cao' },
  { label: 'Thực tập', path: '/internship', icon: Building2, group: 'Nâng cao' },
  { label: 'Nghiên cứu', path: '/research', icon: FlaskConical, group: 'Nâng cao' },
  { label: 'Sàn giao dịch', path: '/exchange', icon: ArrowLeftRight, group: 'Nâng cao' },
  { label: 'Kiểm toán', path: '/auditing', icon: Search, group: 'Hệ thống' },
  { label: 'Tích hợp', path: '/integration', icon: Plug, group: 'Hệ thống' },
  { label: 'Phân tích', path: '/analytics', icon: BarChart3, group: 'Hệ thống' },
  { label: 'Cài đặt', path: '/settings', icon: Settings, group: 'Hệ thống' },
];

export function getNavGroups(): { group: string; items: NavItem[] }[] {
  const groups: Record<string, NavItem[]> = {};
  NAV_ITEMS.forEach((item) => {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  });
  return Object.entries(groups).map(([group, items]) => ({ group, items }));
}
