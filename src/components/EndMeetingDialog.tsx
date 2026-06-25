import React, { useState } from 'react';
import { Power, AlertTriangle, Loader2 } from 'lucide-react';
import { ModalShell } from './ui';

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

      <div className="bg-mission-danger/5 border border-mission-danger/20 rounded-xl p-3 flex gap-3 text-sm text-mission-danger/90 items-start">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <p>Meeting will be recorded in the class history.</p>
      </div>
    </ModalShell>
  );
};

