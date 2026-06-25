import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../store';
import { PageHeader, Panel, Button } from '../components/ui';

export const CreateClass: React.FC = () => {
  const navigate = useNavigate();
  const { createClass } = useAppContext();
  
  const [name, setName] = useState('');
  const [levelName, setLevelName] = useState('');
  const [maxLives, setMaxLives] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Class name is required.');
      return;
    }
    if (!levelName.trim()) {
      setError('Class level is required.');
      return;
    }
    if (maxLives < 1 || maxLives > 20) {
      setError('Maximum lives must be between 1 and 20.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const classId = await createClass(name.trim(), levelName.trim(), maxLives);
      navigate(`/teacher/classes/${classId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create class.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <button 
        onClick={() => navigate('/teacher/classes')}
        className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors group w-fit"
      >
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span>Back to My Classes</span>
      </button>

      <PageHeader
        title="Create New Class"
        description="Configure a new environment for your students."
      />

      <Panel className="relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        {error && (
          <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/20 rounded-xl flex items-start gap-3 text-mission-danger text-sm shadow-sm">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-mission-secondary-text">
              Class Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science Period 1"
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white placeholder-mission-muted-text focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="levelName" className="block text-sm font-medium text-mission-secondary-text">
              Class Level / Subject
            </label>
            <input
              type="text"
              id="levelName"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              placeholder="e.g. Grade 5, IELTS Prep"
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white placeholder-mission-muted-text focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all shadow-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="maxLives" className="block text-sm font-medium text-mission-secondary-text">
              Maximum Lives (per meeting)
            </label>
            <input
              type="number"
              id="maxLives"
              min="1"
              max="20"
              value={maxLives}
              onChange={(e) => setMaxLives(parseInt(e.target.value) || 10)}
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono text-lg shadow-sm"
              required
            />
            <p className="mt-2 text-xs text-mission-muted-text">
              Students will reset to this number of lives at the start of each new meeting.
            </p>
          </div>

          <div className="pt-6">
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="primary"
              className="w-full py-3.5 font-bold"
              icon={Plus}
            >
              {isSubmitting ? 'Initializing...' : 'Create Class'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  );
};

