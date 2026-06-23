import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, LayoutDashboard, MonitorPlay, Plus, MoreVertical } from 'lucide-react';
import { useAppContext } from '../store';

export const MyClasses: React.FC = () => {
  const { classes, isLoadingClasses, archiveClass, restoreDefaultData } = useAppContext();
  const navigate = useNavigate();

  if (isLoadingClasses) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cosmic-cyan mb-4"></div>
        <p className="text-slate-400 font-medium tracking-wide">Loading Classes...</p>
      </div>
    );
  }

  const handleArchive = async (classId: string) => {
    if (confirm('Are you sure you want to archive this class? It will no longer appear in your active classes list.')) {
      await archiveClass(classId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">My Classes</h1>
          <p className="text-slate-400">Manage your cosmic classrooms and student rosters.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => restoreDefaultData()}
            className="px-4 py-2 bg-slate-800 text-slate-300 font-medium rounded-xl hover:bg-slate-700 transition-colors"
          >
            Reset Demo Data
          </button>
          <button
            onClick={() => navigate('/teacher/classes/new')}
            className="flex items-center gap-2 px-5 py-2.5 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors"
          >
            <Plus size={18} />
            Create Class
          </button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-cosmic-panel border border-slate-800 rounded-3xl p-12 text-center">
          <div className="bg-slate-800/50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Users className="text-slate-400" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No active classes</h2>
          <p className="text-slate-400 max-w-md mx-auto mb-8">
            You don't have any active classes yet. Create your first class to start gamifying your lessons.
          </p>
          <button
            onClick={() => navigate('/teacher/classes/new')}
            className="inline-flex items-center gap-2 px-6 py-3 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors"
          >
            <Plus size={20} />
            Create Your First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-cosmic-panel border border-slate-800 rounded-3xl p-6 hover:border-cosmic-cyan/30 transition-all group flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-cosmic-cyan/10 text-cosmic-cyan px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                  {cls.level_name}
                </div>
                <div className="relative group/menu">
                  <button className="text-slate-500 hover:text-white p-1">
                    <MoreVertical size={20} />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-32 bg-slate-800 border border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-10 overflow-hidden">
                    <button 
                      onClick={() => navigate(`/teacher/classes/${cls.id}/settings`)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                      Settings
                    </button>
                    <button 
                      onClick={() => handleArchive(cls.id)}
                      className="w-full text-left px-4 py-2 text-sm text-rose-400 hover:bg-slate-700 hover:text-rose-300"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              </div>
              
              <h2 className="text-xl font-bold text-white mb-6 line-clamp-2">{cls.name}</h2>
              
              <div className="space-y-3 mb-8 flex-1">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Meeting Number</span>
                  <span className="font-medium text-slate-200">{cls.current_meeting_number}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Max Lives</span>
                  <span className="font-medium text-slate-200">{cls.max_lives}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-auto">
                <button
                  onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  <LayoutDashboard size={16} />
                  Dashboard
                </button>
                <a
                  href={`/projector/${cls.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-cosmic-purple/20 hover:bg-cosmic-purple/30 text-cosmic-purple rounded-xl text-sm font-medium transition-colors border border-cosmic-purple/30"
                >
                  <MonitorPlay size={16} />
                  Projector
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
