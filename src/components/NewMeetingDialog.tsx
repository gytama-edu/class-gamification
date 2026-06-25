import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
import { ModalShell } from "./ui";

interface NewMeetingDialogProps {
  isOpen: boolean;
  hasActiveMeeting?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const NewMeetingDialog: React.FC<NewMeetingDialogProps> = ({
  isOpen,
  hasActiveMeeting,
  onClose,
  onConfirm,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to start new meeting.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={hasActiveMeeting ? "Start New Meeting?" : "Start Meeting?"}
      primaryAction={{
        label: hasActiveMeeting ? "Start New Meeting" : "Start Meeting",
        onClick: handleConfirm,
        isLoading: isProcessing,
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isProcessing,
      }}
      icon={AlertCircle}
    >
      <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl mb-6">
        <p className="text-mission-secondary-text leading-relaxed text-sm">
          {hasActiveMeeting
            ? "The current meeting will be completed, final lives will be saved, and all active students will begin the next meeting with refreshed lives. Permanent points will remain saved."
            : "All active students will begin with the class maximum lives. Permanent points will remain saved."}
        </p>
      </div>
    </ModalShell>
  );
};
