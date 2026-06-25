import React, { useEffect } from 'react';
import { X, type LucideIcon } from 'lucide-react';
import { Button } from './Button';

export interface ModalAction {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}

export interface ModalShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  iconClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  primaryAction?: ModalAction;
  secondaryAction?: ModalAction;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  preventClose?: boolean;
}

export const ModalShell: React.FC<ModalShellProps> = ({
  isOpen,
  onClose,
  title,
  icon: Icon,
  iconClassName,
  children,
  footer,
  primaryAction,
  secondaryAction,
  maxWidth = 'md',
  preventClose = false
}) => {
  const isProcessing = primaryAction?.isLoading || secondaryAction?.isLoading;
  const disableClose = preventClose || isProcessing;

  useEffect(() => {
    if (isOpen && !disableClose) {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, disableClose]);

  if (!isOpen) return null;

  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[maxWidth];

  const defaultIconClassName = "text-radar-green bg-radar-green/10 border-radar-green/20";
  const iconContainerClass = iconClassName || defaultIconClassName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`bg-mission-panel w-full ${maxWidthClass} rounded-2xl border border-mission-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex items-start justify-between p-5 md:p-6 pb-4 shrink-0">
          <div className="flex flex-col gap-4">
            {Icon && (
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shadow-sm ${iconContainerClass}`}>
                <Icon size={24} />
              </div>
            )}
            <h2 id="modal-title" className="text-xl font-display font-bold text-white">
              {title}
            </h2>
          </div>
          {!disableClose && (
            <button
              onClick={onClose}
              className="p-1 -mr-1 -mt-1 hover:bg-mission-bg-secondary rounded-lg text-mission-muted-text hover:text-white transition-colors"
              aria-label="Close dialog"
            >
              <X size={20} />
            </button>
          )}
        </div>

        <div className="px-5 md:px-6 pb-6 overflow-y-auto min-h-0">
          {children}
        </div>

        {(footer || primaryAction || secondaryAction) && (
          <div className="px-5 md:px-6 py-4 border-t border-mission-border/50 bg-mission-bg/50 shrink-0 flex items-center justify-end gap-3">
            {footer ? (
              footer
            ) : (
              <>
                {secondaryAction && (
                  <Button
                    variant={secondaryAction.variant || 'ghost'}
                    onClick={secondaryAction.onClick}
                    disabled={secondaryAction.disabled || disableClose}
                    isLoading={secondaryAction.isLoading}
                  >
                    {secondaryAction.label}
                  </Button>
                )}
                {primaryAction && (
                  <Button
                    variant={primaryAction.variant || 'primary'}
                    onClick={primaryAction.onClick}
                    disabled={primaryAction.disabled || primaryAction.isLoading}
                    isLoading={primaryAction.isLoading}
                  >
                    {primaryAction.label}
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
