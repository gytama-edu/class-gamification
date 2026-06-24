import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  LayoutDashboard,
  MonitorPlay,
  Plus,
  MoreVertical,
  Settings,
  Archive,
} from "lucide-react";
import { useAppContext } from "../store";

export const MyClasses: React.FC = () => {
  const { classes, isLoadingClasses, archiveClass } =
    useAppContext();
  const navigate = useNavigate();

  if (isLoadingClasses) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-radar-green mb-4"></div>
        <p className="text-mission-muted-text font-medium tracking-wide">
          Loading Classes...
        </p>
      </div>
    );
  }

  const handleArchive = async (classId: string) => {
    if (
      confirm(
        "Are you sure you want to archive this class? It will no longer appear in your active classes list.",
      )
    ) {
      await archiveClass(classId);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-white mb-2">
            My Classes
          </h1>
          <p className="text-mission-secondary-text">
            Manage your classes, student rosters, and active missions.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/teacher/classes/new")}
            className="flex items-center gap-2 px-5 py-2.5 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-bg"
          >
            <Plus size={18} />
            Create Class
          </button>
        </div>
      </div>

      {classes.length === 0 ? (
        <div className="bg-mission-panel border border-mission-border rounded-2xl p-12 text-center flex flex-col items-center max-w-2xl mx-auto mt-12">
          <div className="bg-mission-panel-elevated w-16 h-16 rounded-full flex items-center justify-center mb-6">
            <Users className="text-mission-muted-text" size={28} />
          </div>
          <h2 className="font-display text-xl font-bold text-white mb-2">
            No active classes
          </h2>
          <p className="text-mission-secondary-text mb-8 max-w-sm">
            You don't have any active classes yet. Create your first class to start gamifying your lessons.
          </p>
          <button
            onClick={() => navigate("/teacher/classes/new")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel"
          >
            <Plus size={20} />
            Create Your First Class
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-mission-panel border border-mission-border rounded-2xl p-5 hover:border-radar-green/50 transition-all group flex flex-col h-full relative"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-mission-panel-elevated border border-mission-border text-mission-secondary-text px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider">
                  {cls.level_name}
                </div>
                <div className="relative group/menu">
                  <button className="text-mission-muted-text hover:text-radar-green p-1 rounded-md hover:bg-mission-panel-elevated transition-colors">
                    <MoreVertical size={18} />
                  </button>
                  <div className="absolute right-0 top-full mt-1 w-36 bg-mission-panel-elevated border border-mission-border rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
                    <button
                      onClick={() => navigate(`/teacher/classes/${cls.id}/settings`)}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-mission-primary-text hover:bg-mission-bg hover:text-white transition-colors"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    <button
                      onClick={() => handleArchive(cls.id)}
                      className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-mission-danger hover:bg-mission-bg hover:text-mission-danger/80 transition-colors"
                    >
                      <Archive size={16} />
                      Archive
                    </button>
                  </div>
                </div>
              </div>

              <h2 className="font-display text-lg font-bold text-white mb-6 line-clamp-2 leading-tight">
                {cls.name}
              </h2>

              <div className="space-y-2.5 mb-6 flex-1">
                <div className="flex justify-between items-center text-sm border-b border-mission-border pb-2">
                  <span className="text-mission-secondary-text">Total Meetings</span>
                  <span className="font-medium text-mission-primary-text">
                    {cls.current_meeting_number}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pb-2">
                  <span className="text-mission-secondary-text">Max Lives</span>
                  <span className="font-medium text-mission-primary-text">
                    {cls.max_lives}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-auto">
                <button
                  onClick={() => navigate(`/teacher/classes/${cls.id}`)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-radar-green text-mission-bg hover:bg-strong-green rounded-lg text-sm font-bold transition-colors"
                >
                  <LayoutDashboard size={16} />
                  Open Class
                </button>
                <a
                  href={`/projector/${cls.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-mission-panel-elevated hover:bg-mission-bg text-radar-green rounded-lg text-sm font-medium transition-colors border border-mission-border hover:border-radar-green/50"
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
