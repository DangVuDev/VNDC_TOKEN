import { type ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';

interface Tab {
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  activeTab?: string;
  onChange?: (tabId: string) => void;
  children: (activeTab: string) => ReactNode;
  className?: string;
}

export default function Tabs({ tabs, defaultTab, activeTab: controlledTab, onChange, children, className }: TabsProps) {
  const [internalActive, setInternalActive] = useState(defaultTab || tabs[0]?.id);
  const active = controlledTab ?? internalActive;

  const handleTabClick = (tabId: string) => {
    setInternalActive(tabId);
    onChange?.(tabId);
  };

  return (
    <div className={className}>
      <div className="tab-nav mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn('tab-btn', active === tab.id && 'active')}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={cn(
                'ml-1 text-[11px] px-1.5 py-0.5 rounded-md',
                active === tab.id ? 'bg-brand-50 text-brand-700' : 'bg-surface-100 text-surface-500'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="animate-fade-in" key={active}>{children(active)}</div>
    </div>
  );
}
