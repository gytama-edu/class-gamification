import React, { useState } from "react";
import { ModalShell } from "./ui/ModalShell";
import { Button } from "./ui";
import { DbStudent, CreateTaskInput } from "../lib/types/database";
import { getRepository } from "../lib/data/repository";

interface CreateTaskModalProps {
  classId: string;
  students: DbStudent[];
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ classId, students, onClose, onSuccess }) => {
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [rewardPoints, setRewardPoints] = useState(0);
  const [dueAt, setDueAt] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<'all_students' | 'selected_students'>('all_students');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitTask = async (publishImmediately: boolean) => {
    if (!title.trim()) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const repo = getRepository();
      const input: CreateTaskInput = {
        title: title.trim(),
        instructions: instructions.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        reward_points: rewardPoints,
        assignment_scope: assignmentScope,
        student_ids: selectedStudentIds,
        publish_immediately: publishImmediately
      };
      
      await repo.createTask(classId, input);
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
          <div className="flex gap-4">
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
        </div>
        
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
            disabled={isSubmitting || !title.trim() || (assignmentScope === 'selected_students' && selectedStudentIds.length === 0)}
          >
            {isSubmitting ? "Creating..." : "Publish Task"}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
};
