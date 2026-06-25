import React, { useState, useEffect, useRef } from 'react';
import { X, Award, AlertTriangle, Loader2 } from 'lucide-react';
import { getRepository } from '../lib/data/repository';
import { IconMap } from './AchievementCard';
import { Button } from './ui';

interface AwardRecognitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  studentName: string;
  onAwarded: () => void;
}

const AvailableIcons = [
  { id: 'star', icon: IconMap['star'], label: 'Star' },
  { id: 'book', icon: IconMap['book'], label: 'Book' },
  { id: 'microphone', icon: IconMap['microphone'], label: 'Microphone' },
  { id: 'brain', icon: IconMap['brain'], label: 'Brain' },
  { id: 'zap', icon: IconMap['zap'], label: 'Energy' },
  { id: 'target', icon: IconMap['target'], label: 'Target' },
  { id: 'shield', icon: IconMap['shield'], label: 'Shield' },
  { id: 'trophy', icon: IconMap['trophy'], label: 'Trophy' },
  { id: 'helping-hand', icon: IconMap['helping-hand'], label: 'Helping Hand' },
  { id: 'leadership', icon: IconMap['leadership'], label: 'Leadership' },
];

export const AwardRecognitionModal: React.FC<AwardRecognitionModalProps> = ({
  isOpen,
  onClose,
  studentId,
  studentName,
  onAwarded,
}) => {
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('star');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || title.length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      const repo = getRepository();
      await repo.awardTeacherRecognition(studentId, {
        title: title.trim(),
        reason: reason.trim() || null,
        iconKey: selectedIcon,
      });
      onAwarded();
      onClose();
      setTitle('');
      setReason('');
    } catch (err: any) {
      // Don't show raw Supabase errors
      setError('Failed to award recognition. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="bg-mission-panel border border-mission-border/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="award-modal-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-mission-border/50 bg-mission-panel-strong">
          <h2 id="award-modal-title" className="text-lg font-display font-bold text-white flex items-center gap-2">
            <Award className="text-amber-400" size={18} />
            Award Recognition
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mission-bg-secondary rounded-lg text-mission-muted-text hover:text-white transition-colors"
            aria-label="Close dialog"
            disabled={isSubmitting}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <p className="text-mission-secondary-text text-sm mb-5 leading-relaxed">
            Award special recognition to <span className="font-bold text-white">{studentName}</span>. 
            This will appear permanently on their profile as a Special tier achievement.
          </p>

          {error && (
            <div className="mb-5 p-3 bg-mission-danger/10 border border-mission-danger/20 rounded-lg text-mission-danger text-sm flex gap-2 items-start">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-end mb-1">
                <label htmlFor="award-title" className="block text-sm font-medium text-white">
                  Achievement Title <span className="text-mission-danger">*</span>
                </label>
                <span className="text-[10px] text-mission-muted-text">{title.length}/50</span>
              </div>
              <input
                ref={titleInputRef}
                id="award-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Creative Thinker"
                className="w-full px-4 py-2.5 bg-mission-bg-secondary border border-mission-border/50 rounded-xl text-white placeholder-mission-muted-text focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all"
                maxLength={50}
              />
              {title.length > 0 && title.length < 3 && (
                <p className="text-[10px] text-amber-500 mt-1">Must be at least 3 characters</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Select Icon
              </label>
              <div className="grid grid-cols-5 gap-2">
                {AvailableIcons.map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setSelectedIcon(id)}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition-all ${
                      selectedIcon === id
                        ? 'bg-amber-400/20 border-amber-400 text-amber-400'
                        : 'bg-mission-bg-secondary border-mission-border/50 text-mission-muted-text hover:text-white hover:border-mission-muted-text hover:bg-mission-panel-elevated'
                    }`}
                    title={label}
                  >
                    <Icon size={20} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1">
                <label htmlFor="award-reason" className="block text-sm font-medium text-white">
                  Reason <span className="text-mission-muted-text font-normal">(Optional)</span>
                </label>
                <span className="text-[10px] text-mission-muted-text">{reason.length}/200</span>
              </div>
              <textarea
                id="award-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are they receiving this?"
                className="w-full px-4 py-2.5 bg-mission-bg-secondary border border-mission-border/50 rounded-xl text-white placeholder-mission-muted-text focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all resize-none"
                rows={3}
                maxLength={200}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-mission-border/50">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !title.trim() || title.length < 3}
              className="bg-amber-400 hover:bg-amber-500 text-black border-amber-400"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              {isSubmitting ? 'Awarding...' : 'Award Recognition'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

