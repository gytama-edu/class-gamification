import React, { useState, useEffect } from 'react';
import { Power, AlertTriangle, XCircle } from 'lucide-react';
import { ModalShell } from './ui';

interface EndMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onRefreshClass?: () => Promise<void>;
}

export const EndMeetingDialog: React.FC<EndMeetingDialogProps> = ({ isOpen, onClose, onConfirm, onRefreshClass }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLocalError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    setLocalError(null);
    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      console.error("End Meeting Error:", err);
      const errMsg = err?.message || String(err);
      
      if (errMsg.includes('No active meeting')) {
        // Treat as a stale interface condition, not a destructive failure.
        setLocalError('This meeting has already ended. Refreshing the class now.');
        // Briefly show the message before closing
        setTimeout(async () => {
          onClose();
          if (onRefreshClass) {
            await onRefreshClass();
          }
        }, 1500);
      } else if (errMsg.includes('Not authorized')) {
        setLocalError('You do not have permission to end this meeting.');
      } else if (errMsg.toLowerCase().includes('fetch') || errMsg.toLowerCase().includes('network')) {
        setLocalError('The meeting could not be ended because the connection was interrupted.');
      } else {
        setLocalError('The meeting could not be ended. Please refresh and try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="End this meeting?"
      primaryAction={{
        label: "End Meeting",
        onClick: handleConfirm,
        isLoading: isProcessing,
        variant: "danger"
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isProcessing,
      }}
      icon={Power}
      iconClassName="text-mission-danger bg-mission-danger/10 border-mission-danger/20"
    >
      <p className="text-mission-secondary-text text-sm mb-4 leading-relaxed">
        The current session will be marked as completed. Permanent points and remaining lives will be preserved.
      </p>

      {localError && (
        <div className="bg-mission-danger/10 border border-mission-danger/30 rounded-xl p-3 flex gap-3 text-sm text-mission-danger mb-4 items-start">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <p>{localError}</p>
        </div>
      )}

      <div className="bg-mission-danger/5 border border-mission-danger/20 rounded-xl p-3 flex gap-3 text-sm text-mission-danger/90 items-start">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>Meeting will be recorded in the class history.</p>
      </div>
    </ModalShell>
  );
};

