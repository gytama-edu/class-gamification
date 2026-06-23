import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface NewMeetingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const NewMeetingDialog: React.FC<NewMeetingDialogProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-cosmic-panel border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl shadow-cosmic-cyan/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3 text-cosmic-cyan">
              <AlertCircle size={24} />
              <h2 className="text-xl font-semibold text-white">Start New Meeting</h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <p className="text-slate-300 leading-relaxed mb-8">
            This will begin a new meeting and restore every student's lives to the class maximum. 
            <span className="block mt-2 font-medium text-cosmic-purple">Total points will remain saved.</span>
          </p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="px-4 py-2 rounded-lg font-medium bg-gradient-to-r from-cosmic-cyan to-blue-500 text-slate-900 hover:opacity-90 transition-opacity shadow-lg shadow-cosmic-cyan/20"
            >
              Start Meeting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
