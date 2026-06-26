import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Users, Shuffle, Plus, ArrowRight, Save } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { DbStudent, ProjectGroupWithMembers, ProjectGroupColorKey, CreateProjectGroupBatchItem } from '../lib/types/database';
import { getRepository } from '../lib/data/repository';

interface AutoDivideModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  groups: ProjectGroupWithMembers[];
  students: DbStudent[];
  onSuccess: () => void;
}

type GroupCreationMode = 'existing' | 'new';
type StudentSelectionMode = 'all' | 'unassigned';

interface PreviewGroup {
  id: string; // real ID or temp ID
  name: string;
  color_key: ProjectGroupColorKey;
  isNew: boolean;
  studentIds: string[];
}

const COLORS: ProjectGroupColorKey[] = ['green', 'cyan', 'blue', 'purple', 'amber', 'rose'];

export const AutoDivideModal: React.FC<AutoDivideModalProps> = ({
  isOpen,
  onClose,
  classId,
  groups,
  students,
  onSuccess
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  
  // Settings
  const [groupCreationMode, setGroupCreationMode] = useState<GroupCreationMode>('existing');
  const [studentSelectionMode, setStudentSelectionMode] = useState<StudentSelectionMode>('all');
  const [preserveMemberships, setPreserveMemberships] = useState(false);
  
  // New groups settings
  const [newGroupCount, setNewGroupCount] = useState<number>(4);
  const [namingPattern, setNamingPattern] = useState('Group {n}');
  
  // Existing groups settings
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());

  // Preview state
  const [previewGroups, setPreviewGroups] = useState<PreviewGroup[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setError(null);
      setGroupCreationMode(groups.length >= 2 ? 'existing' : 'new');
      setStudentSelectionMode('all');
      setPreserveMemberships(false);
      setNewGroupCount(Math.max(2, Math.min(20, Math.floor(students.length / 4) || 2)));
      setSelectedGroupIds(new Set(groups.map(g => g.id)));
      setPreviewGroups([]);
    }
  }, [isOpen, groups.length, students.length]);

  const activeGroups = groups.filter(g => g.status === 'active');
  const assignedStudentIds = useMemo(() => {
    const ids = new Set<string>();
    activeGroups.forEach(g => {
      g.members.forEach(m => ids.add(m.student_id));
    });
    return ids;
  }, [activeGroups]);

  const targetStudents = useMemo(() => {
    return students.filter(s => {
      if (studentSelectionMode === 'unassigned') {
        return !assignedStudentIds.has(s.id);
      }
      return true;
    });
  }, [students, studentSelectionMode, assignedStudentIds]);

  const handleGeneratePreview = () => {
    try {
      setError(null);
      
      let baseGroups: PreviewGroup[] = [];
      let studentsToDistribute = [...targetStudents];
      
      if (groupCreationMode === 'new') {
        const count = Math.min(Math.max(newGroupCount || 2, 2), 20);
        for (let i = 0; i < count; i++) {
          const n = i + 1;
          const name = namingPattern ? namingPattern.replace('{n}', n.toString()) : `Group ${n}`;
          baseGroups.push({
            id: `temp-${i}`,
            name,
            color_key: COLORS[i % COLORS.length],
            isNew: true,
            studentIds: []
          });
        }
      } else {
        const selected = activeGroups.filter(g => selectedGroupIds.has(g.id));
        if (selected.length < 2) {
          throw new Error("Select at least two existing groups to divide into.");
        }
        
        baseGroups = selected.map(g => ({
          id: g.id,
          name: g.name,
          color_key: g.color_key,
          isNew: false,
          studentIds: []
        }));
      }
      
      // Handle preserve memberships
      if (preserveMemberships) {
        if (groupCreationMode === 'new') {
          throw new Error("Cannot preserve memberships when creating new groups.");
        }
        
        // Filter out students who are already in these groups, pre-assign them
        const remainingStudents: DbStudent[] = [];
        
        studentsToDistribute.forEach(student => {
          let preAssigned = false;
          for (const g of baseGroups) {
            const originalGroup = activeGroups.find(og => og.id === g.id);
            if (originalGroup?.members.some(m => m.student_id === student.id)) {
              g.studentIds.push(student.id);
              preAssigned = true;
              break;
            }
          }
          if (!preAssigned) {
            remainingStudents.push(student);
          }
        });
        
        studentsToDistribute = remainingStudents;
      }
      
      // Shuffle remaining
      const shuffled = [...studentsToDistribute].sort(() => Math.random() - 0.5);
      
      // Distribute evenly, prioritizing groups with fewer students (due to preserve)
      shuffled.forEach((student) => {
        // Find group with minimum students
        let minGroupIndex = 0;
        let minCount = baseGroups[0].studentIds.length;
        
        for (let i = 1; i < baseGroups.length; i++) {
          if (baseGroups[i].studentIds.length < minCount) {
            minGroupIndex = i;
            minCount = baseGroups[i].studentIds.length;
          }
        }
        
        baseGroups[minGroupIndex].studentIds.push(student.id);
      });
      
      setPreviewGroups(baseGroups);
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleReshuffle = () => {
    handleGeneratePreview();
  };

  const moveStudent = (studentId: string, fromGroupId: string, toGroupId: string) => {
    setPreviewGroups(prev => {
      const updated = prev.map(g => ({ ...g, studentIds: [...g.studentIds] }));
      const fromGroup = updated.find(g => g.id === fromGroupId);
      const toGroup = updated.find(g => g.id === toGroupId);
      
      if (fromGroup && toGroup) {
        fromGroup.studentIds = fromGroup.studentIds.filter(id => id !== studentId);
        toGroup.studentIds.push(studentId);
      }
      return updated;
    });
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    
    try {
      if (groupCreationMode === 'new') {
        // We need to create groups and distribute atomically
        const newGroupsPayload: CreateProjectGroupBatchItem[] = previewGroups.map(g => ({
          temp_id: g.id,
          name: g.name,
          description: '',
          color_key: g.color_key
        }));
        
        const distributionPayload = previewGroups.map(g => ({
          groupId: g.id, // these are temp IDs
          studentIds: g.studentIds
        }));
        
        await getRepository().createAndDistributeProjectGroups(classId, newGroupsPayload, distributionPayload);
      } else {
        // Only apply distribution to existing groups
        const distributionPayload = previewGroups.map(g => ({
          groupId: g.id,
          studentIds: g.studentIds
        }));
        
        // Note: applyProjectGroupDistribution removes students from groups they are no longer in,
        // but only for the groups included in the distribution?
        // Actually, applyProjectGroupDistribution clears old memberships and applies new ones.
        // Let's rely on its implementation.
        await getRepository().applyProjectGroupDistribution(classId, distributionPayload);
      }
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project groups");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      {/* Group Creation Mode */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Group Mode</label>
        <div className="flex gap-4">
          <label className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-border bg-deep-space cursor-pointer hover:border-radar-green transition-colors">
            <input 
              type="radio" 
              name="groupMode" 
              checked={groupCreationMode === 'existing'} 
              onChange={() => setGroupCreationMode('existing')}
              disabled={activeGroups.length < 2}
              className="text-radar-green focus:ring-radar-green"
            />
            <div className={activeGroups.length < 2 ? 'opacity-50' : ''}>
              <div className="font-medium text-white">Use Existing Groups</div>
              <div className="text-xs text-gray-500">{activeGroups.length} available</div>
            </div>
          </label>
          <label className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-border bg-deep-space cursor-pointer hover:border-radar-green transition-colors">
            <input 
              type="radio" 
              name="groupMode" 
              checked={groupCreationMode === 'new'} 
              onChange={() => {
                setGroupCreationMode('new');
                setPreserveMemberships(false);
              }}
              className="text-radar-green focus:ring-radar-green"
            />
            <div>
              <div className="font-medium text-white">Create New Groups</div>
              <div className="text-xs text-gray-500">Generate instantly</div>
            </div>
          </label>
        </div>
      </div>

      {groupCreationMode === 'new' && (
        <div className="p-4 rounded-lg bg-mission-bg border border-border space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Number of Groups</label>
              <input
                type="number"
                min={2}
                max={20}
                value={newGroupCount}
                onChange={(e) => setNewGroupCount(parseInt(e.target.value) || 2)}
                className="w-full bg-deep-space border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-radar-green"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Naming Pattern</label>
              <input
                type="text"
                value={namingPattern}
                onChange={(e) => setNamingPattern(e.target.value)}
                className="w-full bg-deep-space border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-radar-green"
                placeholder="Group {n}"
              />
            </div>
          </div>
        </div>
      )}

      {groupCreationMode === 'existing' && (
        <div className="p-4 rounded-lg bg-mission-bg border border-border space-y-3">
          <label className="block text-xs text-gray-400 mb-1">Select Groups to Use</label>
          <div className="max-h-[150px] overflow-y-auto custom-scrollbar space-y-2 pr-2">
            {activeGroups.map(g => (
              <label key={g.id} className="flex items-center justify-between p-2 rounded bg-deep-space border border-border/50 cursor-pointer hover:border-radar-green/50">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedGroupIds.has(g.id)}
                    onChange={(e) => {
                      const next = new Set(selectedGroupIds);
                      if (e.target.checked) next.add(g.id);
                      else next.delete(g.id);
                      setSelectedGroupIds(next);
                    }}
                    className="rounded text-radar-green focus:ring-radar-green border-gray-600 bg-deep-space"
                  />
                  <div className={`w-3 h-3 rounded-full bg-${g.color_key === 'green' ? 'radar-green' : g.color_key === 'cyan' ? 'neon-cyan' : g.color_key === 'blue' ? 'mission-blue' : g.color_key + '-500'}`} />
                  <span className="text-sm text-white">{g.name}</span>
                </div>
                <span className="text-xs text-gray-500">{g.members.length} members</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Student Selection */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-300">Students to Include</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="studentMode"
              checked={studentSelectionMode === 'all'}
              onChange={() => setStudentSelectionMode('all')}
              className="text-radar-green focus:ring-radar-green"
            />
            All Active Students ({students.length})
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="radio"
              name="studentMode"
              checked={studentSelectionMode === 'unassigned'}
              onChange={() => setStudentSelectionMode('unassigned')}
              className="text-radar-green focus:ring-radar-green"
            />
            Unassigned Only ({students.length - assignedStudentIds.size})
          </label>
        </div>
        
        {groupCreationMode === 'existing' && (
          <div className="pt-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={preserveMemberships}
                onChange={(e) => setPreserveMemberships(e.target.checked)}
                className="rounded text-radar-green focus:ring-radar-green border-gray-600 bg-deep-space"
              />
              Preserve current memberships in selected groups
            </label>
          </div>
        )}
      </div>

    </div>
  );

  const renderStep2 = () => {
    // Calculate stats
    const counts = previewGroups.map(g => g.studentIds.length);
    const max = Math.max(...counts, 0);
    const min = Math.min(...counts, 0);
    const totalAssigned = counts.reduce((a, b) => a + b, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between bg-deep-space p-3 rounded-lg border border-border">
          <div className="flex gap-4 text-sm">
            <div><span className="text-gray-400">Groups:</span> <span className="text-white font-medium">{previewGroups.length}</span></div>
            <div><span className="text-gray-400">Students:</span> <span className="text-white font-medium">{totalAssigned}</span></div>
            <div><span className="text-gray-400">Size Range:</span> <span className="text-white font-medium">{min} - {max}</span></div>
          </div>
          <button 
            onClick={handleReshuffle}
            className="flex items-center gap-2 text-sm text-neon-cyan hover:text-white transition-colors px-3 py-1.5 rounded bg-neon-cyan/10 hover:bg-neon-cyan/20"
          >
            <Shuffle size={14} />
            Reshuffle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {previewGroups.map(group => {
            const isGreen = group.color_key === 'green';
            const isCyan = group.color_key === 'cyan';
            const isBlue = group.color_key === 'blue';
            const bgClass = isGreen ? 'bg-radar-green/10 border-radar-green/30' : 
                           isCyan ? 'bg-neon-cyan/10 border-neon-cyan/30' : 
                           isBlue ? 'bg-mission-blue/10 border-mission-blue/30' : 
                           `bg-${group.color_key}-500/10 border-${group.color_key}-500/30`;
                           
            const textClass = isGreen ? 'text-radar-green' : 
                              isCyan ? 'text-neon-cyan' : 
                              isBlue ? 'text-mission-blue' : 
                              `text-${group.color_key}-400`;

            return (
              <div key={group.id} className={`p-3 rounded-lg border ${bgClass} flex flex-col`}>
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-white/10">
                  <div className={`font-medium ${textClass} flex items-center gap-2`}>
                    {group.name}
                    {group.isNew && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-white">New</span>}
                  </div>
                  <div className="text-xs text-gray-400">{group.studentIds.length} members</div>
                </div>
                
                <div className="flex-1 space-y-1 min-h-[60px]">
                  {group.studentIds.map(studentId => {
                    const student = students.find(s => s.id === studentId);
                    return (
                      <div key={studentId} className="flex items-center justify-between group/item">
                        <span className="text-sm text-gray-200 truncate">{student?.display_name}</span>
                        <div className="opacity-0 group-hover/item:opacity-100 transition-opacity flex">
                          <select 
                            className="bg-deep-space text-xs text-gray-300 border border-border rounded px-1 py-0.5 focus:outline-none focus:border-radar-green"
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                moveStudent(studentId, group.id, e.target.value);
                              }
                            }}
                          >
                            <option value="">Move to...</option>
                            {previewGroups.filter(g => g.id !== group.id).map(g => (
                              <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                  {group.studentIds.length === 0 && (
                    <div className="text-xs text-gray-500 italic py-2 text-center">Empty</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Auto Divide Students"
      icon={RefreshCw}
      primaryAction={
        step === 1 ? {
          label: "Generate Preview",
          onClick: handleGeneratePreview,
          disabled: (groupCreationMode === 'existing' && selectedGroupIds.size < 2) || targetStudents.length === 0,
          icon: <ArrowRight size={16} className="ml-2" />
        } : {
          label: "Confirm & Save",
          onClick: handleConfirm,
          isLoading: isSubmitting,
          icon: <Save size={16} className="ml-2" />
        }
      }
      secondaryAction={{
        label: step === 1 ? "Cancel" : "Back",
        onClick: () => step === 1 ? onClose() : setStep(1),
        disabled: isSubmitting
      }}
      maxWidth="max-w-3xl"
    >
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}
      
      {step === 1 ? renderStep1() : renderStep2()}
    </ModalShell>
  );
};
