import { NavLink } from 'react-router-dom';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import { getNavGroups } from '@/config/navigation';
import { cn } from '@/lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onItemClick?: () => void;
}

export default function Sidebar({ collapsed, onToggle, onItemClick }: SidebarProps) {
  const groups = getNavGroups();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-surface-800/60 shrink-0">
        <div className="w-9 h-9 rounded-xl gradient-brand flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20" style={{ animation: 'pulse-glow 3s ease-in-out infinite' }}>
          <span className="text-white font-bold text-sm">VN</span>
        </div>
        {!collapsed && (
          <div className="animate-slide-in-right">
            <h1 className="font-bold text-white text-base leading-none">VNDC</h1>
            <p className="text-[10px] text-surface-500 mt-0.5">Digital Campus</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="ml-auto p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-all hidden lg:block"
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-6 px-2">
        {groups.map(({ group, items }) => (
          <div key={group}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold text-surface-500 uppercase tracking-wider">
                {group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.path === '/'}
                    onClick={onItemClick}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-brand-600/15 text-brand-300'
                          : 'text-surface-400 hover:text-white hover:bg-white/5',
                      )
                    }
                    title={collapsed ? item.label : undefined}
                  >
                    <item.icon size={18} className="shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Version */}
      <div className="px-4 py-3 border-t border-surface-800/60 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-[10px] text-surface-500">v1.0.0 • Solidity 0.8.24</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
    </div>
  );
}
