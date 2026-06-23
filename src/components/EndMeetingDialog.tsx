import React, { useState } from 'react';
import { Power, AlertTriangle, Loader2 } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-cosmic-panel w-full max-w-md rounded-2xl border border-rose-500/30 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20">
            <Power className="text-rose-400" size={24} />
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">End this meeting?</h2>
          
          <p className="text-slate-300 text-sm mb-4 leading-relaxed">
            This will close the current meeting. Student points and remaining lives will be saved. Lives will reset only when the next meeting begins.
          </p>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex gap-3 text-sm text-rose-300 items-start">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p>Active meeting status will be marked as completed.</p>
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 border-t border-slate-800 flex gap-3 justify-end">
          <button 
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : 'End Meeting'}
          </button>
        </div>
      </div>
    </div>
  );
};
