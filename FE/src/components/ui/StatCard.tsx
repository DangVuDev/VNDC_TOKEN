import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  change?: string;
  trend?: 'up' | 'down';
  icon?: ReactNode;
  lucideIcon?: LucideIcon;
  color?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
  className?: string;
}

const colorMap = {
  brand: 'bg-brand-500/10 text-brand-400 ring-brand-500/20',
  success: 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 ring-amber-500/20',
  danger: 'bg-red-500/10 text-red-400 ring-red-500/20',
  info: 'bg-sky-500/10 text-sky-400 ring-sky-500/20',
};

export default function StatCard({
  label, value, subtitle, change, trend, icon, lucideIcon: LIcon,
  color = 'brand', loading, className,
}: StatCardProps) {
  if (loading) {
    return (
      <div className={cn('card animate-pulse', className)}>
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton h-4 w-24" />
          <div className="skeleton h-10 w-10 rounded-xl" />
        </div>
        <div className="skeleton h-8 w-20 mb-2" />
        <div className="skeleton h-3 w-32" />
      </div>
    );
  }

  return (
    <div className={cn('card card-hover group', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-surface-400">{label}</span>
        <div className={cn(
          'flex items-center justify-center w-10 h-10 rounded-xl ring-1 transition-transform group-hover:scale-110',
          colorMap[color]
        )}>
          {LIcon ? <LIcon className="w-5 h-5" /> : icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="flex items-center gap-2">
        {change && (
          <span className={cn(
            'text-xs font-semibold',
            trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-red-400' : 'text-surface-400'
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : ''} {change}
          </span>
        )}
        {subtitle && <span className="text-xs text-surface-500">{subtitle}</span>}
      </div>
    </div>
  );
}
