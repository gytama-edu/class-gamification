import React, { useState } from "react";
import { ModalShell } from "./ui/ModalShell";
import { Button } from "./ui";
import { DbStudent, CreateTaskInput, ProjectGroupWithMembers } from "../lib/types/database";
import { getRepository } from "../lib/data/repository";

interface CreateTaskModalProps {
  classId: string;
  students: DbStudent[];
  projectGroups: ProjectGroupWithMembers[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ classId, students, projectGroups, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rewardPoints, setRewardPoints] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<'all_students' | 'selected_students' | 'project_groups'>('all_students');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  
  // Submission Settings
  const [allowSubmissionText, setAllowSubmissionText] = useState(true);
  const [allowSubmissionFiles, setAllowSubmissionFiles] = useState(false);
  const [requireSubmissionFile, setRequireSubmissionFile] = useState(false);
  const [allowedCategories, setAllowedCategories] = useState<('images' | 'documents')[]>(['images', 'documents']);
  const [maxSubmissionFiles, setMaxSubmissionFiles] = useState(5);
  const [maxSubmissionFileSize, setMaxSubmissionFileSize] = useState(10); // MB

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTask = async (publishImmediately: boolean) => {
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const repo = getRepository();
      
      const settings = {
        allow_submission_text: allowSubmissionText,
        allow_submission_files: allowSubmissionFiles,
        require_submission_file: requireSubmissionFile,
        allowed_submission_file_categories: allowedCategories as any[],
        max_submission_files: maxSubmissionFiles,
        max_submission_file_size_bytes: maxSubmissionFileSize * 1024 * 1024,
        max_submission_total_size_bytes: Math.min(maxSubmissionFiles * maxSubmissionFileSize * 1024 * 1024, 30 * 1024 * 1024)
      };

      if (assignmentScope === 'project_groups') {
        await repo.createProjectGroupTask(classId, {
          title: title.trim(),
          instructions: instructions.trim(),
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          reward_points: rewardPoints,
          project_group_ids: selectedGroupIds,
          publish_immediately: publishImmediately,
          ...settings
        });
      } else {
        const input: CreateTaskInput = {
          title: title.trim(),
          instructions: instructions.trim(),
          due_at: dueAt ? new Date(dueAt).toISOString() : null,
          reward_points: rewardPoints,
          assignment_scope: assignmentScope,
          student_ids: selectedStudentIds,
          publish_immediately: publishImmediately
          // we do not include settings for non-group tasks yet
        };
        await repo.createTask(classId, input);
      }
      
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to create task");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitTask(true);
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  return (
    <ModalShell
      isOpen={true}
      onClose={onClose}
      title="Create New Task"
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {error && (
          <div className="p-3 bg-mission-danger/10 border border-mission-danger/20 text-mission-danger rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div>
          <label className="block text-sm font-medium text-mission-secondary-text mb-1">Task Title</label>
          <input 
            type="text"
            className="w-full bg-mission-bg-secondary border border-mission-border text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-radar-green"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Read Chapter 4"
            required
            maxLength={100}
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-mission-secondary-text mb-1">Instructions</label>
          <textarea 
            className="w-full bg-mission-bg-secondary border border-mission-border text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-radar-green"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Provide clear instructions for the students..."
            rows={4}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-mission-secondary-text mb-1">Reward Points</label>
            <input 
              type="number"
              min={0}
              max={1000}
              className="w-full bg-mission-bg-secondary border border-mission-border text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-radar-green"
              value={rewardPoints}
              onChange={(e) => setRewardPoints(parseInt(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-mission-secondary-text mb-1">Due Date (Optional)</label>
            <input 
              type="datetime-local"
              className="w-full bg-mission-bg-secondary border border-mission-border text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-radar-green"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-3">
          <label className="block text-sm font-medium text-mission-secondary-text">Assign To</label>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input 
                type="radio" 
                name="assignmentScope" 
                checked={assignmentScope === 'all_students'}
                onChange={() => setAssignmentScope('all_students')}
                className="text-radar-green bg-mission-bg-secondary border-mission-border"
              />
              All Students
            </label>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input 
                type="radio" 
                name="assignmentScope" 
                checked={assignmentScope === 'selected_students'}
                onChange={() => setAssignmentScope('selected_students')}
                className="text-radar-green bg-mission-bg-secondary border-mission-border"
              />
              Selected Students
            </label>
            <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
              <input 
                type="radio" 
                name="assignmentScope" 
                checked={assignmentScope === 'project_groups'}
                onChange={() => setAssignmentScope('project_groups')}
                className="text-radar-green bg-mission-bg-secondary border-mission-border"
              />
              Project Groups
            </label>
          </div>
          
          {assignmentScope === 'selected_students' && (
            <div className="mt-3 max-h-40 overflow-y-auto p-3 bg-mission-bg-secondary border border-mission-border rounded-lg space-y-2">
              {students.map(s => (
                <label key={s.id} className="flex items-center gap-2 text-sm text-white cursor-pointer hover:bg-mission-panel p-1 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                    className="rounded text-radar-green bg-mission-panel border-mission-border"
                  />
                  {s.display_name}
                </label>
              ))}
              {students.length === 0 && <div className="text-mission-muted-text text-sm">No active students.</div>}
            </div>
          )}

          {assignmentScope === 'project_groups' && (
            <div className="mt-3 max-h-40 overflow-y-auto p-3 bg-mission-bg-secondary border border-mission-border rounded-lg space-y-2">
              {projectGroups.map(g => (
                <label key={g.id} className="flex items-center gap-2 text-sm text-white cursor-pointer hover:bg-mission-panel p-1 rounded transition-colors">
                  <input 
                    type="checkbox" 
                    checked={selectedGroupIds.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="rounded text-radar-green bg-mission-panel border-mission-border"
                  />
                  <div className={`w-3 h-3 rounded-full bg-${g.color_key}-500`} />
                  {g.name} <span className="text-mission-muted-text">({g.members.length} members)</span>
                </label>
              ))}
              {projectGroups.length === 0 && <div className="text-mission-muted-text text-sm">No active project groups.</div>}
            </div>
          )}
        </div>

        {assignmentScope === 'project_groups' && (
          <div className="space-y-4 pt-4 border-t border-mission-border">
            <h4 className="text-sm font-medium text-white">Submission Requirements</h4>
            <p className="text-xs text-mission-muted-text">Students may submit one shared response for their project group.</p>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={allowSubmissionText}
                  onChange={(e) => setAllowSubmissionText(e.target.checked)}
                  className="rounded text-radar-green bg-mission-panel border-mission-border"
                />
                Allow written response
              </label>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={allowSubmissionFiles}
                  onChange={(e) => setAllowSubmissionFiles(e.target.checked)}
                  className="rounded text-radar-green bg-mission-panel border-mission-border"
                />
                Allow attachments
              </label>
            </div>

            {allowSubmissionFiles && (
              <div className="pl-6 space-y-3">
                <label className="flex items-center gap-2 text-sm text-white cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={requireSubmissionFile}
                    onChange={(e) => setRequireSubmissionFile(e.target.checked)}
                    className="rounded text-radar-green bg-mission-panel border-mission-border"
                  />
                  Require at least one attachment
                </label>
                
                <div>
                  <label className="block text-sm text-mission-muted-text mb-1">Allowed Categories</label>
                  <select 
                    value={allowedCategories.length === 2 ? 'both' : allowedCategories[0]}
                    onChange={(e) => {
                      if (e.target.value === 'both') setAllowedCategories(['images', 'documents']);
                      else setAllowedCategories([e.target.value as any]);
                    }}
                    className="w-full p-2 bg-mission-bg-secondary border border-mission-border rounded text-white text-sm"
                  >
                    <option value="both">Pictures and Documents</option>
                    <option value="images">Pictures</option>
                    <option value="documents">Documents</option>
                  </select>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-mission-muted-text mb-1">Max Files</label>
                    <input 
                      type="number" min="1" max="10" 
                      value={maxSubmissionFiles}
                      onChange={(e) => setMaxSubmissionFiles(parseInt(e.target.value) || 5)}
                      className="w-full p-2 bg-mission-bg-secondary border border-mission-border rounded text-white text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-mission-muted-text mb-1">Max Size (MB)</label>
                    <input 
                      type="number" min="1" max="20" 
                      value={maxSubmissionFileSize}
                      onChange={(e) => setMaxSubmissionFileSize(parseInt(e.target.value) || 10)}
                      className="w-full p-2 bg-mission-bg-secondary border border-mission-border rounded text-white text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="pt-4 flex justify-end gap-3 border-t border-mission-border/50">
          <Button variant="ghost" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            variant="secondary" 
            type="button" 
            onClick={() => submitTask(false)}
            disabled={isSubmitting || !title.trim()}
          >
            Save as Draft
          </Button>
          <Button 
            type="button" 
            onClick={() => submitTask(true)}
            disabled={isSubmitting || !title.trim() || (assignmentScope === 'selected_students' && selectedStudentIds.length === 0) || (assignmentScope === 'project_groups' && selectedGroupIds.length === 0)}
          >
            {isSubmitting ? "Creating..." : "Publish Task"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};
