import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Layers,
  Plus,
  Settings2,
  Users,
  UserPlus,
  RefreshCw,
  Archive,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import {
  DbStudent,
  ProjectGroupWithMembers,
  ProjectGroupSummary,
  ProjectGroupColorKey
} from "../lib/types/database";
import {
  Panel,
  Button,
  StatusBadge,
  ErrorState,
  SectionHeader,
  IconButton,
  StatCard,
  ConfirmDialog
} from "../components/ui";

import { CreateEditGroupModal } from "../components/CreateEditGroupModal";
import { ManageMembersModal } from "../components/ManageMembersModal";
import { AutoDivideModal } from "../components/AutoDivideModal";

const COLOR_MAP: Record<ProjectGroupColorKey, { bg: string; border: string; text: string }> = {
  green: { bg: 'bg-radar-green/10', border: 'border-radar-green/30', text: 'text-radar-green' },
  cyan: { bg: 'bg-neon-cyan/10', border: 'border-neon-cyan/30', text: 'text-neon-cyan' },
  blue: { bg: 'bg-mission-blue/10', border: 'border-mission-blue/30', text: 'text-mission-blue' },
  purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400' },
  rose: { bg: 'bg-rose-500/10', border: 'border-rose-500/30', text: 'text-rose-400' },
};

export const ProjectGroups: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { dashboardData } = useAppContext();
  
  const [groups, setGroups] = useState<ProjectGroupWithMembers[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<ProjectGroupWithMembers[]>([]);
  const [summary, setSummary] = useState<ProjectGroupSummary | null>(null);
  const [unassigned, setUnassigned] = useState<DbStudent[]>([]);
  
  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ProjectGroupWithMembers | null>(null);
  
  const [isManageMembersOpen, setIsManageMembersOpen] = useState(false);
  const [managingGroup, setManagingGroup] = useState<ProjectGroupWithMembers | null>(null);
  
  const [isAutoDivideOpen, setIsAutoDivideOpen] = useState(false);
  
  const [archiveGroupId, setArchiveGroupId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  const loadData = async () => {
    if (!classId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRepository().getProjectGroups(classId);
      setGroups(data.groups);
      setArchivedGroups(data.archivedGroups || []);
      setSummary(data.summary);
      setUnassigned(data.unassignedStudents);
    } catch (err: any) {
      setError(err.message || "Failed to load project groups");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [classId]);

  const handleCreateGroup = async (input: any) => {
    if (!classId) return;
    await getRepository().createProjectGroup(classId, input);
    await loadData();
  };

  const handleCreateGroupBatch = async (groups: any[]) => {
    if (!classId) return;
    await getRepository().createProjectGroupsBatch(classId, groups);
    await loadData();
  };

  const handleEditGroup = async (input: any) => {
    if (!editingGroup) return;
    await getRepository().updateProjectGroup(editingGroup.id, input);
    await loadData();
  };

  const handleArchiveGroup = async () => {
    if (!archiveGroupId) return;
    try {
      await getRepository().archiveProjectGroup(archiveGroupId);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to archive group");
    } finally {
      setArchiveGroupId(null);
    }
  };

  // Get active students for manage members / auto divide
  const activeStudents = dashboardData?.students?.filter(s => s.is_active && !s.deleted_at) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-radar-green"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-12 flex justify-center">
        <ErrorState 
          title="Failed to load project groups" 
          message={error} 
          onRetry={loadData}
        />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-200 space-y-6 pb-12">
      <SectionHeader 
        title="Project Groups" 
        icon={<Layers className="text-neon-cyan" size={24} />}
        description="Organize your class into temporary groups for projects, presentations, or collaborative work."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsAutoDivideOpen(true)}>
              <RefreshCw size={16} className="mr-2" />
              Auto Divide
            </Button>
            <Button size="sm" onClick={() => setIsCreateModalOpen(true)}>
              <Plus size={16} className="mr-2" />
              New Group
            </Button>
          </div>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            label="Active Groups" 
            value={summary.active_groups_count.toString()} 
          />
          <StatCard 
            label="Assigned Students" 
            value={summary.assigned_students_count.toString()} 
          />
          <StatCard 
            label="Unassigned" 
            value={summary.unassigned_students_count.toString()} 
            valueClassName={summary.unassigned_students_count > 0 ? "text-amber-400" : undefined}
          />
          <StatCard 
            label="Avg. Size" 
            value={summary.average_group_size.toFixed(1)} 
          />
        </div>
      )}

      {groups.length === 0 ? (
        <Panel className="p-12 text-center flex flex-col items-center justify-center border-dashed">
          <div className="h-16 w-16 rounded-full bg-deep-space/50 border border-border flex items-center justify-center mb-4">
            <Layers className="text-gray-400" size={24} />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Active Groups</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            Create project groups to organize students for team assignments, collaborative learning, or group presentations.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={16} className="mr-2" />
            Create First Group
          </Button>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {groups.map(group => {
            const colors = COLOR_MAP[group.color_key] || COLOR_MAP.green;
            return (
              <Panel key={group.id} className="flex flex-col h-full hover:border-gray-600 transition-colors">
                <div className="p-5 border-b border-border/50 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-3 h-3 rounded-full ${colors.bg.replace('/10', '')} shadow-[0_0_8px_rgba(0,0,0,0.5)]`} />
                      <h3 className="font-semibold text-lg text-white">{group.name}</h3>
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-400 line-clamp-2">{group.description}</p>
                    )}
                  </div>
                  <IconButton 
                    icon={<Settings2 size={16} />} 
                    title="Edit Group"
                    onClick={() => {
                      setEditingGroup(group);
                      setIsEditModalOpen(true);
                    }}
                  />
                </div>
                
                <div className="p-5 flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Users size={14} className="text-gray-500" />
                      Members
                    </h4>
                    <span className="text-xs bg-deep-space px-2 py-0.5 rounded-full text-gray-400 border border-border/50">
                      {group.members.length}
                    </span>
                  </div>
                  
                  {group.members.length === 0 ? (
                    <div className="py-4 text-center text-sm text-gray-500 border border-dashed border-border rounded-lg bg-deep-space/30">
                      No members assigned
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {group.members.map(member => (
                        <div 
                          key={member.student_id}
                          className={`text-sm px-2.5 py-1 rounded-md bg-deep-space border ${colors.border} ${colors.text} flex items-center`}
                        >
                          {member.display_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="p-3 border-t border-border/50 bg-deep-space/30 flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-8 text-xs text-gray-400 hover:text-white" onClick={() => setArchiveGroupId(group.id)}>
                    <Archive size={14} className="mr-1.5" />
                    Archive
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 text-xs border-border/50" onClick={() => {
                    setManagingGroup(group);
                    setIsManageMembersOpen(true);
                  }}>
                    <UserPlus size={14} className="mr-1.5" />
                    Manage Members
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      
      {unassigned.length > 0 && groups.length > 0 && (
        <Panel className="p-6 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} className="text-amber-400" />
            <h3 className="font-medium text-white">Unassigned Students</h3>
            <span className="bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full text-sm font-medium">
              {unassigned.length}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map(student => (
              <div 
                key={student.id}
                className="text-sm px-3 py-1.5 rounded-lg bg-deep-space border border-amber-500/30 text-amber-200"
              >
                {student.display_name}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {archivedGroups.length > 0 && (
        <div className="mt-12">
          <button 
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-4"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive size={16} />
            {showArchived ? 'Hide' : 'Show'} Archived Groups ({archivedGroups.length})
          </button>
          
          {showArchived && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-75">
              {archivedGroups.map(group => {
                const colors = COLOR_MAP[group.color_key] || COLOR_MAP.green;
                return (
                  <Panel key={group.id} className="p-4 bg-deep-space/50 border-dashed">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-3 h-3 rounded-full ${colors.bg.replace('/10', '')}`} />
                      <h3 className="font-semibold text-white">{group.name}</h3>
                      <span className="ml-auto text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">Archived</span>
                    </div>
                    {group.description && (
                      <p className="text-xs text-gray-500 line-clamp-2">{group.description}</p>
                    )}
                  </Panel>
                );
              })}
            </div>
          )}
        </div>
      )}

      <CreateEditGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateGroup}
        onSubmitBatch={handleCreateGroupBatch}
        mode="create"
      />
      
      <CreateEditGroupModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleEditGroup}
        initialData={editingGroup}
        mode="edit"
      />

      <ManageMembersModal
        isOpen={isManageMembersOpen}
        onClose={() => {
          setIsManageMembersOpen(false);
          setManagingGroup(null);
        }}
        group={managingGroup}
        allStudents={activeStudents}
        classId={classId || ''}
        onSuccess={loadData}
      />

      <AutoDivideModal
        isOpen={isAutoDivideOpen}
        onClose={() => setIsAutoDivideOpen(false)}
        classId={classId || ''}
        groups={groups}
        students={activeStudents}
        onSuccess={loadData}
      />

      <ConfirmDialog
        isOpen={!!archiveGroupId}
        onClose={() => setArchiveGroupId(null)}
        onConfirm={handleArchiveGroup}
        title="Archive Project Group"
        message="Are you sure you want to archive this project group? This will remove all students from the group. This action cannot be undone here."
        confirmText="Archive Group"
        cancelText="Cancel"
        isDestructive={true}
      />
    </div>
  );
};
