import React, { useState } from "react";
import { AlertCircle, X, Loader2 } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-mission-panel border border-mission-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 text-radar-green">
              <AlertCircle size={24} />
              <h2 className="text-xl font-semibold text-white">
                Start a new meeting?
              </h2>
            </div>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-mission-muted-text hover:text-white transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>

          <p className="text-mission-secondary-text leading-relaxed mb-8">
            {hasActiveMeeting
              ? "The current meeting will be completed, final lives will be saved, and all active students will begin the next meeting with refreshed lives. Permanent points will remain saved."
              : "All active students will begin with the class maximum lives. Permanent points will remain saved."}
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 rounded-lg font-medium text-mission-secondary-text hover:bg-mission-panel-elevated hover:text-white transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-bold bg-radar-green text-mission-bg hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel disabled:opacity-50 min-w-[140px]"
            >
              {isProcessing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : hasActiveMeeting ? (
                "Start New Meeting"
              ) : (
                "Start Meeting"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
