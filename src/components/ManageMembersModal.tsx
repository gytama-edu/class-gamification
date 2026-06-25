import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, Plus, Minus } from 'lucide-react';
import { ModalShell } from './ui/ModalShell';
import { DbStudent, ProjectGroupWithMembers } from '../lib/types/database';
import { getRepository } from '../lib/data/repository';

interface ManageMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: ProjectGroupWithMembers | null;
  allStudents: DbStudent[];
  classId: string;
  onSuccess: () => void;
}

export const ManageMembersModal: React.FC<ManageMembersModalProps> = ({
  isOpen,
  onClose,
  group,
  allStudents,
  classId,
  onSuccess
}) => {
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setError(null);
    }
  }, [isOpen]);

  // Derived state based on actual database relations
  // This modal acts immediately by calling assign/remove
  const currentMembers = useMemo(() => {
    if (!group) return [];
    return group.members.map(m => m.student_id);
  }, [group]);

  const handleToggleMember = async (studentId: string, isMember: boolean) => {
    if (!group) return;
    setIsSubmitting(true);
    setError(null);
    try {
      if (isMember) {
        await getRepository().removeStudentFromProjectGroup(group.id, studentId);
      } else {
        await getRepository().assignStudentToProjectGroup(group.id, studentId);
      }
      onSuccess(); // Will trigger parent to reload data
    } catch (err: any) {
      setError(err.message || "Failed to update membership");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!search) return allStudents;
    const lowerSearch = search.toLowerCase();
    return allStudents.filter(s => s.display_name.toLowerCase().includes(lowerSearch));
  }, [allStudents, search]);

  if (!group) return null;

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`Manage Members: ${group.name}`}
      icon={Users}
      primaryAction={{
        label: "Done",
        onClick: onClose
      }}
      preventClose={isSubmitting}
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-500" />
          </div>
          <input
            type="text"
            className="w-full bg-deep-space border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-radar-green"
            placeholder="Search students..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="bg-deep-space rounded-lg border border-border/50 max-h-80 overflow-y-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-6 text-center text-gray-500 text-sm">
              No students match your search.
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {filteredStudents.map((student) => {
                const isMember = currentMembers.includes(student.id);
                return (
                  <div key={student.id} className="p-3 flex items-center justify-between hover:bg-white/5 transition-colors">
                    <span className="text-sm text-gray-200">{student.display_name}</span>
                    <button
                      onClick={() => handleToggleMember(student.id, isMember)}
                      disabled={isSubmitting}
                      className={`p-1.5 rounded-md transition-colors ${
                        isMember 
                          ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" 
                          : "bg-radar-green/10 text-radar-green hover:bg-radar-green/20"
                      } disabled:opacity-50`}
                      title={isMember ? "Remove from group" : "Add to group"}
                    >
                      {isMember ? <Minus size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <p className="text-xs text-gray-500">
          Adding a student to this group will automatically remove them from any other active group.
        </p>
      </div>
    </ModalShell>
  );
};
