import { cn } from '@/lib/utils';
import { type LucideIcon, PackageOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  lucideIcon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon, lucideIcon: LIcon, title, description, action, className,
}: EmptyStateProps) {
  const IconComponent = LIcon || PackageOpen;
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 px-4 text-center', className)}>
      <div className="w-16 h-16 rounded-2xl bg-surface-800/60 border border-surface-700/50 flex items-center justify-center text-surface-500 mb-5">
        {icon || <IconComponent className="w-7 h-7" />}
      </div>
      <h3 className="text-lg font-semibold text-white mb-1.5">{title}</h3>
      {description && <p className="text-sm text-surface-400 max-w-md mb-5">{description}</p>}
      {action}
    </div>
  );
}
