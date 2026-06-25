import React, { useState, useEffect } from 'react';
import { Layers } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { ProjectGroupColorKey, CreateProjectGroupInput, UpdateProjectGroupInput } from '../lib/types/database';

interface CreateEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: any) => Promise<void>;
  initialData?: { name: string; description: string; color_key: ProjectGroupColorKey } | null;
  mode: 'create' | 'edit';
}

const COLORS: { key: ProjectGroupColorKey; label: string; class: string }[] = [
  { key: 'green', label: 'Green', class: 'bg-radar-green border-radar-green' },
  { key: 'cyan', label: 'Cyan', class: 'bg-neon-cyan border-neon-cyan' },
  { key: 'blue', label: 'Blue', class: 'bg-mission-blue border-mission-blue' },
  { key: 'purple', label: 'Purple', class: 'bg-purple-500 border-purple-500' },
  { key: 'amber', label: 'Amber', class: 'bg-amber-500 border-amber-500' },
  { key: 'rose', label: 'Rose', class: 'bg-rose-500 border-rose-500' }
];

export const CreateEditGroupModal: React.FC<CreateEditGroupModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorKey, setColorKey] = useState<ProjectGroupColorKey>('green');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setDescription(initialData.description);
        setColorKey(initialData.color_key);
      } else {
        setName('');
        setDescription('');
        setColorKey('green');
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async () => {
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      await onSubmit({ name, description, color_key: colorKey });
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save group");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? "Create Project Group" : "Edit Project Group"}
      icon={Layers}
      primaryAction={{
        label: mode === 'create' ? "Create Group" : "Save Changes",
        onClick: handleSubmit,
        isLoading: isSubmitting,
        disabled: name.trim().length < 2
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isSubmitting
      }}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Group Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
            placeholder="e.g. Apollo Team"
            maxLength={60}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
            placeholder="Optional purpose or focus of this group..."
            rows={3}
            maxLength={500}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Group Color
          </label>
          <div className="flex gap-3">
            {COLORS.map(c => (
              <button
                key={c.key}
                onClick={() => setColorKey(c.key)}
                className={`w-8 h-8 rounded-full focus:outline-none transition-all ${c.class} ${colorKey === c.key ? 'ring-2 ring-white ring-offset-2 ring-offset-mission-bg scale-110' : 'opacity-70 hover:opacity-100'}`}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
