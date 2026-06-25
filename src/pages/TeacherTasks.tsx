import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRepository } from "../lib/data/repository";
import { TaskWithSummary, ClassTask, CreateTaskInput, StudentWithCurrentState, DbStudent } from "../lib/types/database";
import { PageHeader, Panel, Button, EmptyState, LoadingSkeleton } from "../components/ui";
import { ListTodo, Plus, Calendar as CalendarIcon, CheckCircle, Clock } from "lucide-react";
import { CreateTaskModal } from "../components/CreateTaskModal";
import { format } from "date-fns";

export const TeacherTasks: React.FC = () => {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskWithSummary[]>([]);
  const [students, setStudents] = useState<DbStudent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!classId) return;
    setIsLoading(true);
    try {
      const repo = getRepository();
      const loadedTasks = await repo.getClassTasks(classId);
      setTasks(loadedTasks);
      
      const loadedStudents = await repo.getStudents(classId);
      setStudents(loadedStudents.filter(s => s.is_active));
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return <div className="p-6 space-y-4 max-w-5xl mx-auto"><LoadingSkeleton /><LoadingSkeleton /></div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500 pb-20">
      <PageHeader 
        title="Tasks & Assignments" 
        description="Create and manage class assignments"
        icon={ListTodo}
        action={
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus size={18} className="mr-2" />
            Create Task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState 
          icon={ListTodo}
          title="No tasks yet"
          description="Create your first task to assign work to students."
          action={
            <Button onClick={() => setIsCreateModalOpen(true)}>
              Create Task
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <Panel 
              key={task.id} 
              className="p-5 cursor-pointer hover:border-mission-border transition-colors group"
              onClick={() => navigate(`/teacher/classes/${classId}/tasks/${task.id}`)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-display font-bold text-lg text-white group-hover:text-radar-green transition-colors">
                      {task.title}
                    </h3>
                    {task.status === 'draft' && <span className="text-xs px-2 py-0.5 rounded-full bg-mission-bg-secondary text-mission-muted-text border border-mission-border">Draft</span>}
                    {task.status === 'active' && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Active</span>}
                    {task.status === 'completed' && <span className="text-xs px-2 py-0.5 rounded-full bg-radar-green/10 text-radar-green border border-radar-green/20">Completed</span>}
                    {task.status === 'archived' && <span className="text-xs px-2 py-0.5 rounded-full bg-mission-danger/10 text-mission-danger border border-mission-danger/20">Archived</span>}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-mission-secondary-text">
                    <span className="flex items-center gap-1.5">
                      <Clock size={14} />
                      {task.due_at ? `Due ${format(new Date(task.due_at), 'MMM d, h:mm a')}` : 'No due date'}
                    </span>
                    {task.reward_points > 0 && (
                      <span className="flex items-center gap-1.5 text-radar-green">
                        <CheckCircle size={14} />
                        {task.reward_points} pts
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="text-2xl font-mono text-white">{task.submitted_count}</div>
                    <div className="text-mission-muted-text text-xs uppercase tracking-wider">Submitted</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono text-radar-green">{task.approved_count}</div>
                    <div className="text-mission-muted-text text-xs uppercase tracking-wider">Approved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-mono text-mission-secondary-text">{task.assigned_count}</div>
                    <div className="text-mission-muted-text text-xs uppercase tracking-wider">Assigned</div>
                  </div>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {isCreateModalOpen && (
        <CreateTaskModal 
          classId={classId!}
          students={students}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
