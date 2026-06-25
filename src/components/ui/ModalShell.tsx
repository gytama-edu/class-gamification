import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  preventClose?: boolean;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  maxWidth = 'md',
  preventClose = false
}) => {
  useEffect(() => {
    if (isOpen && !preventClose) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, preventClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`bg-mission-panel w-full ${maxWidthClass} rounded-2xl border border-mission-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-mission-border/50 bg-mission-panel-strong shrink-0">
          <h2 id="modal-title" className="text-lg font-display font-bold text-white flex items-center gap-2">
            {icon && <span className="text-radar-green">{icon}</span>}
            {title}
          </h2>
          {!preventClose && (
            <button
              onClick={onClose}
              className="p-1 hover:bg-mission-bg-secondary rounded-lg text-mission-muted-text hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="p-5 md:p-6 overflow-y-auto min-h-0">
          {children}
        </div>

        {footer && (
          <div className="p-4 border-t border-mission-border/50 bg-mission-panel-strong shrink-0 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
