import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { type LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  lucideIcon?: LucideIcon;
  badge?: string;
  action?: ReactNode;
  className?: string;
}

export default function PageHeader({
  title, description, icon, lucideIcon: LIcon, badge, action, className,
}: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8', className)}>
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl gradient-brand flex items-center justify-center shadow-lg shadow-brand-500/20">
          {LIcon ? <LIcon className="w-6 h-6 text-white" /> : icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white">{title}</h1>
            {badge && <span className="badge badge-brand text-[11px]">{badge}</span>}
          </div>
          {description && <p className="text-sm text-surface-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}
