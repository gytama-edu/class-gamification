import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../store';
import { getRepository } from '../lib/data/repository';
import { PageHeader, Panel, Button, LoadingSkeleton } from '../components/ui';

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
    return (
      <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in fade-in duration-500">
         <LoadingSkeleton className="h-24 w-full" />
         <LoadingSkeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <PageHeader
        title="Class Settings"
        description="Manage classroom details and danger zone actions."
        actions={
           <Button
             variant="outline"
             onClick={() => navigate(`/teacher/classes/${classId}`)}
           >
             Cancel
           </Button>
        }
      />

      <Panel>
        {error && (
          <div className="mb-6 p-4 bg-mission-danger/10 border border-mission-danger/20 rounded-xl text-mission-danger text-sm flex items-start gap-3">
            <AlertTriangle size={18} className="shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-mission-secondary-text">Class Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none shadow-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-mission-secondary-text">Class Level / Subject</label>
            <input
              type="text"
              value={levelName}
              onChange={(e) => setLevelName(e.target.value)}
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none shadow-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-mission-secondary-text">Maximum Lives</label>
            <input
              type="number"
              min="1"
              max="20"
              value={maxLives}
              onChange={(e) => setMaxLives(parseInt(e.target.value) || 10)}
              className="w-full bg-mission-bg border border-mission-border/50 rounded-xl px-4 py-3 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none shadow-sm font-mono text-lg"
              required
            />
            <p className="text-xs text-mission-muted-text mt-1">
              Standard configuration is 10 lives per session.
            </p>
          </div>

          <div className="pt-6 flex justify-end">
            <Button
              type="submit"
              disabled={isSaving}
              variant="primary"
              className="px-8"
              icon={Save}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Panel>

      <Panel className="border-mission-danger/30 bg-mission-danger/5">
        <h2 className="text-lg font-bold text-mission-danger mb-2 flex items-center gap-2">
          <AlertTriangle size={20} />
          Danger Zone
        </h2>
        <p className="text-mission-secondary-text text-sm mb-6">
          Archiving a class removes it from your active list. You can restore it later from the database.
        </p>
        <Button
          variant="outline"
          onClick={handleArchive}
          className="text-mission-danger border-mission-danger/30 hover:bg-mission-danger/10 hover:text-mission-danger hover:border-mission-danger/50"
        >
          Archive Class
        </Button>
      </Panel>
    </div>
  );
};

