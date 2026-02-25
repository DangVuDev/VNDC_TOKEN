import { X } from 'lucide-react';
import Sidebar from './Sidebar';

interface MobileNavProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileNav({ open, onClose }: MobileNavProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-surface-50 border-r border-surface-200 z-50 lg:hidden animate-slide-up">
        <div className="absolute top-4 right-4">
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X size={20} />
          </button>
        </div>
        <Sidebar collapsed={false} onToggle={() => {}} onItemClick={onClose} />
      </div>
    </>
  );
}
