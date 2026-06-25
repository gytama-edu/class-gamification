import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, CheckCircle, FileText, Send } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { StudentTask } from "../lib/types/database";
import { Panel, Button, LoadingSkeleton } from "../components/ui";
import { format } from "date-fns";

export const StudentTaskDetail: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<StudentTask | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [submissionText, setSubmissionText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const studentId = localStorage.getItem("gytama_student_id");

  const loadData = useCallback(async () => {
    if (!studentId || !taskId) return;
    setIsLoading(true);
    try {
      const repo = getRepository();
      const tasks = await repo.getStudentTasks(studentId);
      const found = tasks.find(t => t.id === taskId);
      if (found) {
        setTask(found);
        if (found.assignment.submission_text) {
          setSubmissionText(found.assignment.submission_text);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [studentId, taskId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    if (!task) return;
    setIsSubmitting(true);
    try {
      const repo = getRepository();
      await repo.submitTaskAssignment(task.assignment.id, submissionText);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Failed to submit assignment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mission-bg p-4 flex justify-center">
        <div className="w-full max-w-md space-y-4"><LoadingSkeleton /></div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-mission-bg p-4 flex flex-col items-center justify-center">
        <p className="text-white mb-4">Task not found</p>
        <Button onClick={() => navigate("/student/dashboard")}>Back to Dashboard</Button>
      </div>
    );
  }

  const { assignment } = task;

  return (
    <div className="min-h-screen bg-mission-bg p-4 flex justify-center">
      <div className="w-full max-w-md space-y-4 animate-in fade-in duration-500 pb-20">
        <button
          onClick={() => navigate("/student/dashboard")}
          className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors py-2"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>

        <Panel className="p-5 border-mission-border/50">
          <div className="flex items-center gap-2 mb-3">
            {assignment.status === 'assigned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-bg-secondary text-mission-muted-text border border-mission-border">To Do</span>}
            {assignment.status === 'submitted' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Submitted</span>}
            {assignment.status === 'approved' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-radar-green/10 text-radar-green border border-radar-green/20">Approved</span>}
            {assignment.status === 'returned' && <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-mission-danger/10 text-mission-danger border border-mission-danger/20">Returned</span>}
          </div>
          
          <h1 className="text-xl font-display font-bold text-white mb-2">{task.title}</h1>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-mission-secondary-text mb-4">
            {task.due_at && (
              <span className={`flex items-center gap-1 ${task.is_overdue ? 'text-mission-danger' : ''}`}>
                <Clock size={14} />
                Due {format(new Date(task.due_at), 'MMM d, h:mm a')}
              </span>
            )}
            {task.reward_points > 0 && (
              <span className="flex items-center gap-1 text-radar-green">
                <CheckCircle size={14} />
                {task.reward_points} pts possible
              </span>
            )}
          </div>
          
          <div className="p-4 bg-mission-bg rounded-lg border border-mission-border/30 text-sm text-mission-secondary-text whitespace-pre-wrap">
            {task.instructions || "No instructions provided."}
          </div>
        </Panel>

        {assignment.teacher_feedback && (
          <Panel className={`p-4 border ${assignment.status === 'returned' ? 'border-mission-danger/30 bg-mission-danger/5' : 'border-radar-green/30 bg-radar-green/5'}`}>
            <h3 className={`text-sm font-bold mb-2 flex items-center gap-2 ${assignment.status === 'returned' ? 'text-mission-danger' : 'text-radar-green'}`}>
              <FileText size={16} />
              Teacher Feedback
            </h3>
            <p className="text-sm text-white">{assignment.teacher_feedback}</p>
          </Panel>
        )}

        <Panel className="p-5 border-mission-border/50">
          <h3 className="text-sm font-bold text-white mb-3">Your Work</h3>
          
          {assignment.status === 'approved' ? (
            <div className="space-y-4">
              {assignment.submission_text ? (
                <div className="p-4 bg-mission-bg rounded-lg border border-mission-border/50 text-sm text-mission-secondary-text whitespace-pre-wrap">
                  {assignment.submission_text}
                </div>
              ) : (
                <div className="text-sm text-mission-muted-text">No text submitted.</div>
              )}
              <div className="flex items-center justify-between p-3 bg-radar-green/10 border border-radar-green/20 rounded-lg">
                <span className="text-sm font-bold text-radar-green">Score</span>
                <span className="text-sm font-bold text-radar-green">+{assignment.points_awarded} pts</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <textarea 
                placeholder="Type your submission here..."
                value={submissionText}
                onChange={(e) => setSubmissionText(e.target.value)}
                disabled={assignment.status === 'submitted' || isSubmitting}
                rows={6}
                className="w-full bg-mission-bg-secondary border border-mission-border text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-radar-green"
              />
              
              {assignment.status === 'submitted' ? (
                <div className="text-center p-3 bg-amber-500/10 text-amber-500 rounded-lg text-sm border border-amber-500/20">
                  Waiting for teacher review
                </div>
              ) : (
                <Button 
                  className="w-full" 
                  onClick={handleSubmit}
                  disabled={isSubmitting || !submissionText.trim()}
                >
                  {isSubmitting ? "Submitting..." : (
                    <>
                      <Send size={18} className="mr-2" />
                      Submit Assignment
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
};
