import React from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  warningText?: string;
  confirmText?: string;
  cancelText?: string;
  isProcessing?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  variant?: 'danger' | 'warning' | 'primary';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  warningText,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isProcessing = false,
  onConfirm,
  onClose,
  variant = 'danger'
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-mission-panel w-full max-w-md rounded-2xl border border-mission-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className={`w-12 h-12 rounded-xl mb-4 flex items-center justify-center border shadow-sm ${
            variant === 'danger' ? 'bg-mission-danger/10 border-mission-danger/20' : 
            variant === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
            'bg-radar-green/10 border-radar-green/20'
          }`}>
            <AlertTriangle className={
              variant === 'danger' ? 'text-mission-danger' :
              variant === 'warning' ? 'text-amber-500' :
              'text-radar-green'
            } size={24} />
          </div>
          
          <h2 className="text-xl font-display font-bold text-white mb-2 tracking-tight">{title}</h2>
          
          <div className="text-mission-secondary-text text-sm mb-4 leading-relaxed">
            {message}
          </div>

          {warningText && (
            <div className={`border rounded-xl p-3 flex gap-3 text-sm items-start ${
              variant === 'danger' ? 'bg-mission-danger/5 border-mission-danger/20 text-mission-danger/90' :
              variant === 'warning' ? 'bg-amber-500/5 border-amber-500/20 text-amber-500/90' :
              'bg-radar-green/5 border-radar-green/20 text-radar-green/90'
            }`}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{warningText}</p>
            </div>
          )}
        </div>

        <div className="bg-mission-panel-strong p-4 flex justify-end gap-3 border-t border-mission-border/50">
          <Button 
            variant="ghost"
            onClick={onClose}
            disabled={isProcessing}
          >
            {cancelText}
          </Button>
          <Button 
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={isProcessing}
            className={variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
