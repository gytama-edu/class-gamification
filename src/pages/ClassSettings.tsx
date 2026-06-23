import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../store';
import { getRepository } from '../lib/data/repository';

export const ClassSettings: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { archiveClass, refreshClasses } = useAppContext();
  
  const [name, setName] = useState('');
  const [levelName, setLevelName] = useState('');
  const [maxLives, setMaxLives] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadClass = async () => {
      if (!classId) return;
      try {
        const repo = getRepository();
        const classes = await repo.getClasses();
        const cls = classes.find(c => c.id === classId);
        if (cls) {
          setName(cls.name);
          setLevelName(cls.level_name);
          setMaxLives(cls.max_lives);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load class settings.');
      } finally {
        setIsLoading(false);
      }
    };
    loadClass();
  }, [classId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId) return;
    setIsSaving(true);
    setError(null);
    try {
      const repo = getRepository();
      await repo.updateClass(classId, { name, level_name: levelName, max_lives: maxLives });
      await refreshClasses();
      navigate(`/teacher/classes/${classId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update class settings.');
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!classId) return;
    if (confirm('Are you sure you want to archive this class? This will hide it from your dashboard.')) {
      await archiveClass(classId);
      navigate('/teacher/classes');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-400">Loading settings...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500 py-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Class Settings</h1>
        <p className="text-slate-400">Manage classroom details and danger zone actions.</p>
      </div>

      <div className="bg-cosmic-panel border border-slate-800 rounded-3xl p-8">
        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Class Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cosmic-cyan transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Class Level / Subject</label>
            <input
              type="text"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cosmic-cyan transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Maximum Lives</label>
            <input
              type="number"
              min="1"
              max="20"
              value={maxLives}
              onChange={(e) => setMaxLives(parseInt(e.target.value) || 10)}
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cosmic-cyan transition-all"
              required
            />
          </div>

          <div className="pt-4 flex gap-4 border-t border-slate-800">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors"
            >
              <Save size={18} />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/teacher/classes/${classId}`)}
              className="px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-8">
        <h2 className="text-xl font-bold text-rose-400 mb-2 flex items-center gap-2">
          <AlertTriangle size={20} />
          Danger Zone
        </h2>
        <p className="text-slate-400 mb-6">
          Archiving a class removes it from your active list. You can restore it later from the database.
        </p>
        <button
          onClick={handleArchive}
          className="px-6 py-3 bg-rose-500/10 text-rose-400 border border-rose-500/30 font-bold rounded-xl hover:bg-rose-500/20 transition-colors"
        >
          Archive Class
        </button>
      </div>
    </div>
  );
};
