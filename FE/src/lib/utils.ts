import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function shortenAddress(address: string, chars = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatNumber(n: number | string, decimals = 2): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '0';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(decimals)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(decimals)}K`;
  return num.toFixed(decimals);
}

export function formatVNDC(amount: bigint | string | number, decimals = 18): string {
  const val = typeof amount === 'bigint'
    ? Number(amount) / 10 ** decimals
    : typeof amount === 'string'
      ? parseFloat(amount)
      : amount;
  return formatNumber(val);
}

export function formatDate(timestamp: number | bigint): string {
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  if (ts === 0) return '—';
  const d = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatDateShort(timestamp: number | bigint): string {
  const ts = typeof timestamp === 'bigint' ? Number(timestamp) : timestamp;
  if (ts === 0) return '—';
  const d = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
  return d.toLocaleDateString('vi-VN', { month: 'short', day: 'numeric' });
}

export function timeAgo(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return 'vừa xong';
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return formatDate(timestamp);
}

export function formatGPA(gpa: number | bigint): string {
  const val = typeof gpa === 'bigint' ? Number(gpa) : gpa;
  return (val / 100).toFixed(2);
}

export function getStatusColor(status: string): string {
  const s = status.toLowerCase();
  if (['active', 'approved', 'completed', 'verified', 'open', 'accepted'].includes(s))
    return 'badge-success';
  if (['pending', 'in_progress', 'reviewing', 'submitted'].includes(s))
    return 'badge-warning';
  if (['rejected', 'revoked', 'cancelled', 'suspended', 'closed', 'failed'].includes(s))
    return 'badge-danger';
  if (['draft', 'inactive'].includes(s))
    return 'badge-neutral';
  return 'badge-info';
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    active: 'Hoạt động', approved: 'Đã duyệt', completed: 'Hoàn thành',
    verified: 'Đã xác minh', open: 'Mở', accepted: 'Chấp nhận',
    pending: 'Chờ xử lý', in_progress: 'Đang thực hiện', reviewing: 'Đang xem xét',
    submitted: 'Đã nộp', rejected: 'Từ chối', revoked: 'Thu hồi',
    cancelled: 'Hủy bỏ', suspended: 'Tạm dừng', closed: 'Đóng',
    failed: 'Thất bại', draft: 'Nháp', inactive: 'Không hoạt động',
  };
  return map[status.toLowerCase()] || status;
}

export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

export function generateGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h1 = Math.abs(hash % 360);
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 70%, 60%), hsl(${h2}, 70%, 50%))`;
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
