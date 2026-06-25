import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRepository } from "../lib/data/repository";
import { ClassTask, TaskAssignmentWithStudent } from "../lib/types/database";
import { PageHeader, Panel, Button, EmptyState, LoadingSkeleton } from "../components/ui";
import { ArrowLeft, Clock, CheckCircle, Check, X, FileText } from "lucide-react";
import { format } from "date-fns";

export const TeacherTaskDetail: React.FC = () => {
  const { classId, taskId } = useParams<{ classId: string, taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<ClassTask | null>(null);
  const [assignments, setAssignments] = useState<TaskAssignmentWithStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!taskId) return;
    setIsLoading(true);
    try {
      const repo = getRepository();
      const loadedTask = await repo.getTask(taskId);
      if (loadedTask) {
        setTask(loadedTask);
        const loadedAssignments = await repo.getTaskAssignments(taskId);
        setAssignments(loadedAssignments);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async (assignmentId: string, action: 'approve' | 'return') => {
    try {
      const repo = getRepository();
      await repo.reviewTaskAssignment(assignmentId, action, "");
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to review assignment");
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'completed' | 'archived') => {
    if (!taskId) return;
    try {
      const repo = getRepository();
      await repo.setTaskStatus(taskId, newStatus);
      loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to change task status");
    }
  };

  if (isLoading) {
    return <div className="p-6 max-w-5xl mx-auto"><LoadingSkeleton /></div>;
  }

  if (!task) {
    return <div className="p-6 text-center text-white">Task not found</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <button
        onClick={() => navigate(`/teacher/classes/${classId}/tasks`)}
        className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors p-2 rounded-lg hover:bg-mission-panel-elevated w-fit"
      >
        <ArrowLeft size={16} />
        <span>Back to Tasks</span>
      </button>

      <Panel className="p-6 border-mission-border/50 bg-mission-bg-secondary">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-4 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-display font-bold text-white">{task.title}</h1>
              {task.status === 'draft' && <span className="text-xs px-2 py-0.5 rounded-full bg-mission-bg-secondary text-mission-muted-text border border-mission-border">Draft</span>}
              {task.status === 'active' && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Active</span>}
              {task.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded-full bg-radar-green/10 text-radar-green border border-radar-green/20">Completed</span>}
            </div>
            
            <p className="text-mission-secondary-text whitespace-pre-wrap">{task.instructions}</p>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-mission-secondary-text">
              <span className="flex items-center gap-1.5">
                <Clock size={16} />
                {task.due_at ? `Due ${format(new Date(task.due_at), 'MMM d, h:mm a')}` : 'No due date'}
              </span>
              <span className="flex items-center gap-1.5 text-radar-green">
                <CheckCircle size={16} />
                {task.reward_points} Reward Points
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {task.status === 'draft' && (
              <Button onClick={() => handleStatusChange('active')}>Publish Task</Button>
            )}
            {task.status === 'active' && (
              <Button variant="secondary" onClick={() => handleStatusChange('completed')}>Mark Completed</Button>
            )}
            {task.status === 'completed' && (
              <Button variant="ghost" onClick={() => handleStatusChange('active')}>Reopen Task</Button>
            )}
          </div>
        </div>
      </Panel>

      <div className="space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <FileText size={20} className="text-mission-muted-text" />
          Student Submissions ({assignments.length})
        </h2>

        {assignments.length === 0 ? (
          <EmptyState icon={FileText} title="No assignments" description="No students have been assigned this task." />
        ) : (
          <div className="grid gap-3">
            {assignments.map(a => (
              <Panel key={a.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{a.student_name}</span>
                    {a.status === 'assigned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-bg-secondary text-mission-muted-text">Assigned</span>}
                    {a.status === 'submitted' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500">Needs Review</span>}
                    {a.status === 'approved' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-radar-green/10 text-radar-green">Approved</span>}
                    {a.status === 'returned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-danger/10 text-mission-danger">Returned</span>}
                  </div>
                  {a.submitted_at && (
                    <div className="text-xs text-mission-muted-text">Submitted {format(new Date(a.submitted_at), 'MMM d, h:mm a')}</div>
                  )}
                  {a.submission_text && (
                    <div className="mt-2 p-3 bg-mission-bg-secondary rounded-lg text-sm text-mission-secondary-text">
                      {a.submission_text}
                    </div>
                  )}
                </div>

                {a.status === 'submitted' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" onClick={() => handleReview(a.id, 'return')} className="text-mission-danger hover:text-mission-danger hover:bg-mission-danger/10">
                      <X size={16} className="mr-1" /> Return
                    </Button>
                    <Button onClick={() => handleReview(a.id, 'approve')} className="bg-radar-green hover:bg-radar-green/80 text-black">
                      <Check size={16} className="mr-1" /> Approve
                    </Button>
                  </div>
                )}
                {a.status === 'approved' && (
                  <div className="text-sm text-radar-green flex items-center gap-1 shrink-0">
                    <CheckCircle size={16} /> +{a.points_awarded} pts
                  </div>
                )}
              </Panel>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
