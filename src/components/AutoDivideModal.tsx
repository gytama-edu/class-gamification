import React, { useState, useEffect } from 'react';
import { RefreshCw, Users } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { DbStudent, ProjectGroupWithMembers } from '../lib/types/database';
import { getRepository } from '../lib/data/repository';

interface AutoDivideModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  groups: ProjectGroupWithMembers[];
  students: DbStudent[];
  onSuccess: () => void;
}

export const AutoDivideModal: React.FC<AutoDivideModalProps> = ({
  isOpen,
  onClose,
  classId,
  groups,
  students,
  onSuccess
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  const handleDivide = async () => {
    if (groups.length === 0) {
      setError("Please create at least one project group first.");
      return;
    }
    if (students.length === 0) {
      setError("There are no active students to divide.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create a shuffled copy of students
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      
      const distribution = groups.map(g => ({ groupId: g.id, studentIds: [] as string[] }));
      
      // Distribute evenly
      shuffled.forEach((student, i) => {
        const groupIndex = i % groups.length;
        distribution[groupIndex].studentIds.push(student.id);
      });

      await getRepository().applyProjectGroupDistribution(classId, distribution);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to divide students");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Auto Divide Students"
      icon={RefreshCw}
      primaryAction={{
        label: "Divide Evenly",
        onClick: handleDivide,
        isLoading: isSubmitting,
        disabled: groups.length === 0 || students.length === 0
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
        
        <div className="p-4 rounded-lg bg-mission-bg border border-border">
          <p className="text-sm text-gray-300 mb-2">
            This will randomly distribute all active students evenly across all existing active project groups.
          </p>
          <ul className="text-sm text-gray-400 space-y-1 list-disc pl-5">
            <li>Any existing group assignments will be overwritten.</li>
            <li>Archived groups are ignored.</li>
            <li>Archived or inactive students are ignored.</li>
          </ul>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1 bg-deep-space p-4 rounded-lg text-center border border-border/50">
            <div className="text-2xl font-bold text-white mb-1">{students.length}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Students</div>
          </div>
          <div className="flex-1 bg-deep-space p-4 rounded-lg text-center border border-border/50">
            <div className="text-2xl font-bold text-neon-cyan mb-1">{groups.length}</div>
            <div className="text-xs text-gray-400 uppercase tracking-wider">Groups</div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};
