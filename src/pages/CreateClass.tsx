import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { useAppContext } from '../store';

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
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <button 
        onClick={() => navigate('/teacher/classes')}
        className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors"
      >
        <ArrowLeft size={16} />
        <span>Back to My Classes</span>
      </button>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Create New Class</h1>
        <p className="text-mission-secondary-text">Configure a new mission control center for your students.</p>
      </div>

      <div className="bg-mission-panel border border-mission-border rounded-3xl p-8 relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-radar-green/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
        
        {error && (
          <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/20 rounded-xl text-mission-danger text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-mission-primary-text mb-2">
              Class Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Science Period 1"
              className="w-full bg-mission-input border border-mission-border rounded-xl px-4 py-3 text-white placeholder-mission-muted-text focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="levelName" className="block text-sm font-medium text-mission-primary-text mb-2">
              Class Level / Subject
            </label>
            <input
              type="text"
              id="levelName"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              placeholder="e.g. Grade 5, IELTS Prep"
              className="w-full bg-mission-input border border-mission-border rounded-xl px-4 py-3 text-white placeholder-mission-muted-text focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="maxLives" className="block text-sm font-medium text-mission-primary-text mb-2">
              Maximum Lives (per meeting)
            </label>
            <input
              type="number"
              id="maxLives"
              min="1"
              max="20"
              value={maxLives}
              onChange={(e) => setMaxLives(parseInt(e.target.value) || 10)}
              className="w-full bg-mission-input border border-mission-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
              required
            />
            <p className="mt-2 text-xs text-mission-muted-text">
              Students will reset to this number of lives at the start of each new meeting.
            </p>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel disabled:opacity-50"
            >
              <Plus size={18} />
              {isSubmitting ? 'Initializing...' : 'Create Class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
