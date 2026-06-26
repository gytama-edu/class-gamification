import React, { useState, useEffect } from 'react';
import { Layers, Plus, Users } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { ProjectGroupColorKey } from '../lib/types/database';

interface CreateEditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: any) => Promise<void>;
  onSubmitBatch?: (groups: any[]) => Promise<void>;
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
  onSubmitBatch,
  initialData,
  mode
}) => {
  const [tab, setTab] = useState<'single' | 'multiple'>('single');
  
  // Single mode state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [colorKey, setColorKey] = useState<ProjectGroupColorKey>('green');
  
  // Multiple mode state
  const [groupCount, setGroupCount] = useState<number>(4);
  const [namingPattern, setNamingPattern] = useState('Group {n}');
  const [startNumber, setStartNumber] = useState(1);
  const [commonDescription, setCommonDescription] = useState('');
  const [previewGroups, setPreviewGroups] = useState<any[]>([]);

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
        setTab('single');
        setGroupCount(4);
        setNamingPattern('Group {n}');
        setStartNumber(1);
        setCommonDescription('');
      }
      setError(null);
    }
  }, [isOpen, initialData]);

  // Generate preview
  useEffect(() => {
    if (tab === 'multiple') {
      const newPreview = [];
      const count = Math.min(Math.max(groupCount || 2, 2), 20);
      for (let i = 0; i < count; i++) {
        const n = startNumber + i;
        const generatedName = namingPattern ? namingPattern.replace('{n}', n.toString()) : `Group ${n}`;
        const color = COLORS[i % COLORS.length].key;
        
        // Preserve edits if the user changed them manually
        const existing = previewGroups[i];
        
        newPreview.push({
          id: existing?.id || `preview-${i}`,
          name: existing?.name || generatedName,
          description: commonDescription,
          color_key: existing?.color_key || color,
          isManualEdited: existing?.isManualEdited || false
        });
      }
      
      // Update names that haven't been manually edited
      const finalPreview = newPreview.map((g, i) => {
        const n = startNumber + i;
        const generatedName = namingPattern ? namingPattern.replace('{n}', n.toString()) : `Group ${n}`;
        return g.isManualEdited ? g : { ...g, name: generatedName };
      });
      
      setPreviewGroups(finalPreview);
    }
  }, [groupCount, namingPattern, startNumber, commonDescription, tab]);

  const handlePreviewNameChange = (index: number, newName: string) => {
    const updated = [...previewGroups];
    updated[index] = { ...updated[index], name: newName, isManualEdited: true };
    setPreviewGroups(updated);
  };

  const handlePreviewColorChange = (index: number, newColor: ProjectGroupColorKey) => {
    const updated = [...previewGroups];
    updated[index] = { ...updated[index], color_key: newColor };
    setPreviewGroups(updated);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (tab === 'single') {
        if (name.trim().length < 2) {
          throw new Error("Name must be at least 2 characters");
        }
        await onSubmit({ name, description, color_key: colorKey });
      } else {
        if (!onSubmitBatch) throw new Error("Batch submission not supported");
        
        const count = Math.min(Math.max(groupCount || 2, 2), 20);
        if (count < 2 || count > 20) {
          throw new Error("The number of groups must be between 2 and 20.");
        }
        
        // Validate names
        const names = new Set();
        for (const g of previewGroups.slice(0, count)) {
          const trimmed = g.name.trim();
          if (trimmed.length < 2) throw new Error(`Group name "${trimmed}" must be at least 2 characters.`);
          if (names.has(trimmed.toLowerCase())) throw new Error(`Two generated groups have the same name: ${trimmed}`);
          names.add(trimmed.toLowerCase());
        }
        
        const payload = previewGroups.slice(0, count).map(g => ({
          name: g.name.trim(),
          description: commonDescription.trim(),
          color_key: g.color_key
        }));
        
        await onSubmitBatch(payload);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save group");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSingleGroupForm = () => (
    <div className="space-y-4">
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
  );

  const renderMultipleGroupsForm = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Number of Groups
          </label>
          <input
            type="number"
            min={2}
            max={20}
            value={groupCount}
            onChange={(e) => setGroupCount(parseInt(e.target.value) || 2)}
            className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Starting Number
          </label>
          <input
            type="number"
            min={1}
            value={startNumber}
            onChange={(e) => setStartNumber(parseInt(e.target.value) || 1)}
            className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Naming Pattern
        </label>
        <input
          type="text"
          value={namingPattern}
          onChange={(e) => {
            setNamingPattern(e.target.value);
            // Reset manual edits when pattern changes
            setPreviewGroups(previewGroups.map(g => ({ ...g, isManualEdited: false })));
          }}
          className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
          placeholder="e.g. Group {n}"
        />
        <p className="text-xs text-gray-500 mt-1">Use {"{n}"} for the sequential number.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Common Description (Optional)
        </label>
        <textarea
          value={commonDescription}
          onChange={(e) => setCommonDescription(e.target.value)}
          className="w-full bg-deep-space border border-border rounded-lg px-3 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
          placeholder="Applies to all generated groups..."
          rows={2}
          maxLength={500}
        />
      </div>

      <div className="pt-4 border-t border-border">
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Preview & Edit
        </label>
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {previewGroups.map((group, index) => (
            <div key={group.id} className="flex gap-3 items-center bg-mission-bg p-2 rounded-lg border border-border/50">
              <div className="flex-1">
                <input
                  type="text"
                  value={group.name}
                  onChange={(e) => handlePreviewNameChange(index, e.target.value)}
                  className="w-full bg-deep-space border border-border rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-radar-green"
                  maxLength={60}
                />
              </div>
              <div className="flex gap-1">
                {COLORS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => handlePreviewColorChange(index, c.key)}
                    className={`w-5 h-5 rounded-full focus:outline-none transition-all ${c.class} ${group.color_key === c.key ? 'ring-1 ring-white ring-offset-1 ring-offset-mission-bg scale-110' : 'opacity-50 hover:opacity-100'}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const getPrimaryLabel = () => {
    if (mode === 'edit') return "Save Changes";
    if (tab === 'single') return "Create Group";
    return `Create ${previewGroups.length} Groups`;
  };

  const getIsDisabled = () => {
    if (tab === 'single') return name.trim().length < 2;
    return previewGroups.length < 2 || previewGroups.some(g => g.name.trim().length < 2);
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? "Create Project Group" : "Edit Project Group"}
      icon={Layers}
      primaryAction={{
        label: getPrimaryLabel(),
        onClick: handleSubmit,
        isLoading: isSubmitting,
        disabled: getIsDisabled()
      }}
      secondaryAction={{
        label: "Cancel",
        onClick: onClose,
        disabled: isSubmitting
      }}
    >
      <div className="space-y-4">
        {mode === 'create' && onSubmitBatch && (
          <div className="flex border-b border-border">
            <button
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'single' ? 'border-radar-green text-radar-green' : 'border-transparent text-gray-400 hover:text-white'}`}
              onClick={() => setTab('single')}
            >
              Single Group
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'multiple' ? 'border-radar-green text-radar-green' : 'border-transparent text-gray-400 hover:text-white'}`}
              onClick={() => setTab('multiple')}
            >
              Multiple Groups
            </button>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {tab === 'single' ? renderSingleGroupForm() : renderMultipleGroupsForm()}
      </div>
    </ModalShell>
  );
};
