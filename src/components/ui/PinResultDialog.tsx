import React, { useState } from 'react';
import { Key, Copy, CheckCircle, X } from 'lucide-react';
import { Button } from './Button';

interface PinResultDialogProps {
  isOpen: boolean;
  pin: string | null;
  onClose: () => void;
}

export const PinResultDialog: React.FC<PinResultDialogProps> = ({
  isOpen,
  pin,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !pin) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(pin);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-mission-panel w-full max-w-sm rounded-2xl border border-mission-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b border-mission-border/50 bg-mission-panel-strong">
          <h2 className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Key size={18} className="text-radar-green" />
            New PIN Generated
          </h2>
          <button
            onClick={onClose}
            className="text-mission-muted-text hover:text-white transition-colors"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 text-center">
          <p className="text-sm text-mission-secondary-text mb-6">
            Provide this PIN to the student. It will not be shown again.
          </p>

          <div className="bg-mission-bg-secondary border border-mission-border/50 rounded-xl p-6 mb-6">
            <div className="text-4xl font-mono font-bold text-radar-green tracking-widest" aria-live="polite">
              {pin}
            </div>
          </div>

          <Button 
            onClick={handleCopy}
            variant="secondary"
            className="w-full justify-center"
          >
            {copied ? (
              <>
                <CheckCircle size={18} className="mr-2 text-radar-green" />
                Copied to Clipboard
              </>
            ) : (
              <>
                <Copy size={18} className="mr-2" />
                Copy PIN
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
