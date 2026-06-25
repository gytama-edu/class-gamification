import React, { useState } from 'react';
import { X, Award } from 'lucide-react';
import { getRepository } from '../lib/data/repository';
import { IconMap } from './AchievementCard';

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
      setError(err.message || 'Failed to award recognition.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-mission-panel border border-mission-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-mission-border">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Award className="text-radar-green" />
            Award Recognition
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-mission-bg-secondary rounded-lg text-mission-muted-text hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-mission-danger/10 border border-mission-danger/20 rounded-lg text-mission-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <p className="text-mission-secondary-text text-sm mb-4">
              Awarding special recognition to <strong className="text-white">{studentName}</strong>.
            </p>

            <label className="block text-sm font-medium text-mission-secondary-text mb-1">
              Achievement Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Creative Thinker"
              className="w-full px-4 py-2 bg-mission-bg-secondary border border-mission-border rounded-lg text-white placeholder-mission-muted-text focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-mission-secondary-text mb-2">
              Select Icon
            </label>
            <div className="grid grid-cols-6 gap-2">
              {AvailableIcons.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedIcon(id)}
                  className={`p-2 rounded-lg border flex items-center justify-center transition-all ${
                    selectedIcon === id
                      ? 'bg-radar-green/20 border-radar-green text-radar-green'
                      : 'bg-mission-bg-secondary border-mission-border text-mission-muted-text hover:text-white hover:border-mission-muted-text'
                  }`}
                  title={label}
                >
                  <Icon size={20} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-mission-secondary-text mb-1">
              Reason (Optional)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are they receiving this?"
              className="w-full px-4 py-2 bg-mission-bg-secondary border border-mission-border rounded-lg text-white placeholder-mission-muted-text focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all resize-none"
              rows={3}
              maxLength={200}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-mission-secondary-text hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-6 py-2 bg-radar-green hover:bg-radar-green/80 text-black rounded-lg font-bold transition-all shadow-lg shadow-radar-green/20 disabled:opacity-50"
            >
              {isSubmitting ? 'Awarding...' : 'Award Badge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
