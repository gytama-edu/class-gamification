import React, { useState } from 'react';
import { Power, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './ui';

interface EndMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const EndMeetingDialog: React.FC<EndMeetingDialogProps> = ({ isOpen, onClose, onConfirm }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to end meeting.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-mission-panel w-full max-w-md rounded-2xl border border-mission-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-mission-danger/10 flex items-center justify-center mb-4 border border-mission-danger/20">
            <Power className="text-mission-danger" size={24} />
          </div>
          
          <h2 className="text-xl font-display font-bold text-white mb-2">End this meeting?</h2>
          
          <p className="text-mission-secondary-text text-sm mb-4 leading-relaxed">
            The current session will be marked as completed. Permanent points and remaining lives will be preserved.
          </p>

          <div className="bg-mission-danger/5 border border-mission-danger/20 rounded-xl p-3 flex gap-3 text-sm text-mission-danger/90 items-start">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>Meeting will be recorded in the class history.</p>
          </div>
        </div>

        <div className="p-4 bg-mission-bg-secondary border-t border-mission-border flex gap-3 justify-end">
          <Button 
            variant="ghost"
            onClick={onClose}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            variant="danger"
            onClick={handleConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
            End Meeting
          </Button>
        </div>
      </div>
    </div>
  );
};

