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
  Book,
  Rocket,
  Target,
  Layers,
  FlaskConical,
} from "lucide-react";
import { useAppContext } from "../store";
import {
  PageHeader,
  EmptyState,
  Panel,
  Button,
  IconButton,
  StatusBadge,
  LoadingSkeleton,
} from "../components/ui";

export const MyClasses: React.FC = () => {
  const { classes, isLoadingClasses, archiveClass } = useAppContext();
  const navigate = useNavigate();

  if (isLoadingClasses) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Classes" description="Manage your classes, student rosters, and active missions." />
        <LoadingSkeleton />
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
    <div className="space-y-6 animate-in fade-in duration-200">
      <PageHeader
        title="My Classes"
        description="Manage your classes, student rosters, and active missions."
        action={
          <Button onClick={() => navigate("/teacher/classes/new")}>
            <Plus size={18} className="mr-2" />
            Create Class
          </Button>
        }
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No active classes"
          description="You don't have any active classes yet. Create your first class to start gamifying your lessons."
          action={
            <Button onClick={() => navigate("/teacher/classes/new")}>
              <Plus size={18} className="mr-2" />
              Create Your First Class
            </Button>
          }
          className="mt-8"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classes.map((cls, index) => {
            const accents = [
              'bg-blue-500/10 text-blue-400 border-blue-500/20',
              'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
              'bg-purple-500/10 text-purple-400 border-purple-500/20',
              'bg-amber-500/10 text-amber-400 border-amber-500/20',
              'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
            ];
            const strips = [
              'bg-blue-500',
              'bg-emerald-500',
              'bg-purple-500',
              'bg-amber-500',
              'bg-cyan-500'
            ];
            const icons = [Book, Rocket, Target, Layers, FlaskConical];
            
            const accentIdx = index % accents.length;
            const accentClass = accents[accentIdx];
            const stripClass = strips[accentIdx];
            const CardIcon = icons[accentIdx];

            return (
              <Panel
                key={cls.id}
                className="p-6 flex flex-col group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-black/40 hover:-translate-y-1 hover:border-mission-border-strong"
              >
                {/* Accent Top Strip */}
                <div className={`absolute top-0 left-0 w-full h-1 ${stripClass} opacity-80`} />
                
                <div className="flex justify-between items-start mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${accentClass}`}>
                    <CardIcon size={20} />
                  </div>
                  
                  <div className="relative group/menu">
                    <IconButton size="sm" variant="ghost">
                      <MoreVertical size={16} />
                    </IconButton>
                    <div className="absolute right-0 top-full mt-1 w-36 bg-mission-panel-elevated border border-mission-border rounded-xl shadow-xl opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all z-20 overflow-hidden">
                      <button
                        onClick={() => navigate(`/teacher/classes/${cls.id}/settings`)}
                        className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-mission-primary-text hover:bg-mission-panel-strong transition-colors"
                      >
                        <Settings size={14} />
                        Settings
                      </button>
                      <button
                        onClick={() => handleArchive(cls.id)}
                        className="w-full flex items-center gap-2 text-left px-4 py-2.5 text-sm text-mission-danger hover:bg-mission-danger/10 transition-colors"
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-2">
                  <StatusBadge variant="default" className="mb-3">
                    {cls.level_name || "Uncategorized"}
                  </StatusBadge>
                  <h2 className="text-xl font-display font-bold text-white line-clamp-2 leading-tight">
                    {cls.name}
                  </h2>
                </div>
                
                <p className="text-sm text-mission-secondary-text mb-6 line-clamp-2">
                  Manage meetings, student points, and live participation.
                </p>

                <div className="space-y-3 mb-6 flex-1 bg-mission-sidebar/50 rounded-xl p-4 border border-mission-border/50">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-mission-secondary-text font-medium">Current Meeting</span>
                    <span className="font-mono text-white font-bold">#{cls.current_meeting_number}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-mission-secondary-text font-medium">Join Code</span>
                    <span className="font-mono text-radar-green font-bold tracking-wider">{cls.join_code}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <Button size="sm" onClick={() => navigate(`/teacher/classes/${cls.id}`)}>
                    Open Class
                  </Button>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => window.open(`/projector/${cls.id}`, "_blank")}
                  >
                    <MonitorPlay size={16} className="mr-2" />
                    Projector
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
};

