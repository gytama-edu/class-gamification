import React, { useEffect, useCallback, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Settings,
  ArrowLeft,
  MonitorPlay,
  LogOut,
  User as UserIcon,
  Menu,
  X,
  History,
  Info,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ListTodo,
} from "lucide-react";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";
import { useAppContext } from "../store";
import { useAuth } from "../lib/auth/AuthContext";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";
import { ConnectionStatus } from "./ConnectionStatus";
import { IconButton } from "./ui";
import { ClassTypeBadge } from "./ClassTypeBadge";

export const Layout: React.FC = () => {
  const { classId } = useParams();
  const {
    classes,
    setSelectedClassId,
    isLoadingClasses,
    refreshDashboard,
    refreshClasses,
    dashboardData,
    toastMessage,
    setToastMessage,
  } = useAppContext();
  const { teacherProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleRealtimeUpdate = useCallback(() => {
    refreshDashboard();
    refreshClasses();
  }, [refreshDashboard, refreshClasses]);

  const activeMeetingId = dashboardData?.activeMeeting?.id || null;

  const { status } = useClassroomRealtime(
    classId || null,
    activeMeetingId,
    handleRealtimeUpdate,
  );

  useEffect(() => {
    if (classId) {
      setSelectedClassId(classId);
    } else {
      setSelectedClassId(null);
    }
  }, [classId, setSelectedClassId]);

  const activeClass = classes.find((c) => c.id === classId);

  useEffect(() => {
    // If we have loaded classes, have a classId, but the class isn't in the list, redirect to /teacher/classes
    if (!isLoadingClasses && classId && !activeClass) {
      navigate("/teacher/classes");
    }
  }, [isLoadingClasses, classId, activeClass, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const navItems = classId
    ? [
        {
          to: `/teacher/classes/${classId}`,
          icon: <LayoutDashboard size={18} />,
          label: "Overview",
        },
        {
          to: `/teacher/classes/${classId}/live`,
          icon: <MonitorPlay size={18} />,
          label: "Live Meeting",
        },
        {
          to: `/teacher/classes/${classId}/students`,
          icon: <Users size={18} />,
          label: "Students",
        },
        {
          to: `/teacher/classes/${classId}/history`,
          icon: <History size={18} />,
          label: "Meeting History",
        },
        {
          to: `/teacher/classes/${classId}/tasks`,
          icon: <ListTodo size={18} />,
          label: "Tasks",
        },
        {
          to: `/teacher/classes/${classId}/settings`,
          icon: <Settings size={18} />,
          label: "Settings",
        },
      ]
    : [];

  const SidebarContent = () => (
    <>
      <div className="p-6 flex flex-col gap-5 border-b border-mission-border/50 bg-mission-sidebar">
        <div className="h-10 sm:h-12 shrink-0 flex items-center justify-start">
          <img
            src={missionControlLogo}
            alt="Mission Control"
            className="h-full w-auto object-contain rounded-md drop-shadow-md"
          />
        </div>

        {classId && (
          <button
            onClick={() => {
              navigate("/teacher/classes");
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors p-2 rounded-lg hover:bg-mission-panel-elevated"
          >
            <ArrowLeft size={16} />
            <span>Back to Classes</span>
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {classId ? (
          <>
            <div className="px-3 pb-4 mb-2 border-b border-mission-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold text-mission-muted-text uppercase tracking-wider">
                  Active Mission
                </p>
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${status === 'connected' ? 'bg-radar-green animate-pulse' : 'bg-mission-offline'}`}></span>
                </div>
              </div>
              <p className="text-sm font-bold text-white truncate mb-1">
                {activeClass?.name}
              </p>
              <div className="flex flex-wrap gap-1">
                <span className="text-[10px] bg-mission-bg px-1.5 py-0.5 rounded text-mission-secondary-text border border-mission-border/50">
                  {activeClass?.level_name || 'No level'}
                </span>
                <ClassTypeBadge type={activeClass?.class_type} compact />
              </div>
            </div>
            {navItems.map((item, idx) => (
              <NavLink
                key={idx}
                to={item.to}
                end={item.to === `/teacher/classes/${classId}`}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg text-sm ${
                    isActive
                      ? "bg-mission-panel-elevated text-radar-green"
                      : "text-mission-secondary-text hover:bg-mission-panel-strong hover:text-white"
                  }`
                }
              >
                {item.icon}
                <span className="font-semibold">{item.label}</span>
              </NavLink>
            ))}

            <div className="mt-6 pt-4 border-t border-mission-border/50">
              <Link
                to={`/projector/${classId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-strong-green hover:bg-mission-panel-strong hover:text-radar-green text-sm"
              >
                <MonitorPlay size={18} />
                <span className="font-semibold">Open Projector</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="px-3 py-2 space-y-2">
            <NavLink
              to="/teacher/classes"
              end
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 transition-colors rounded-lg text-sm ${
                  isActive
                    ? "bg-mission-panel-elevated text-radar-green"
                    : "text-mission-secondary-text hover:bg-mission-panel-strong hover:text-white"
                }`
              }
            >
              <LayoutDashboard size={18} />
              <span className="font-semibold">My Classes</span>
            </NavLink>
            <div className="pt-2 px-1">
              <p className="text-xs text-mission-muted-text leading-relaxed">
                Select a class to view its dashboard, or create a new mission.
              </p>
            </div>
          </div>
        )}
      </nav>

      <div className="p-5 border-t border-mission-border/50 bg-mission-sidebar mt-auto">
        <div className="flex items-center justify-between bg-mission-panel-strong/30 p-2.5 rounded-xl border border-mission-border/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-mission-panel p-2 rounded-lg border border-mission-border/50 shadow-sm">
              <UserIcon size={16} className="text-mission-secondary-text" />
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-white truncate">
                {teacherProfile?.full_name || "Teacher"}
              </p>
              <p className="text-[10px] text-mission-muted-text uppercase tracking-widest truncate font-semibold">
                Instructor
              </p>
            </div>
          </div>
          <IconButton
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="text-mission-muted-text hover:text-mission-danger/80 hover:bg-mission-danger/10"
            title="Log out"
          >
            <LogOut size={16} />
          </IconButton>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden font-sans text-mission-primary-text bg-transparent">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-mission-sidebar/90 backdrop-blur-md border-r border-mission-border flex-col hidden md:flex z-20 shrink-0 shadow-2xl">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <aside className="relative w-72 max-w-[84vw] bg-mission-sidebar border-r border-mission-border flex flex-col h-full animate-in slide-in-from-left duration-200 shadow-2xl">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-3 right-3 text-mission-secondary-text hover:text-white p-2"
            >
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 relative overflow-hidden bg-transparent">
        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between h-14 px-4 border-b border-mission-border bg-mission-sidebar/90 backdrop-blur-md relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-white hover:text-radar-green transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="font-bold text-base font-display text-white truncate max-w-[200px]">
              {activeClass ? activeClass.name : "Mission Control"}
            </div>
          </div>
          {classId && (
             <div className="flex items-center gap-1.5">
               <span className={`h-2 w-2 rounded-full ${status === 'connected' ? 'bg-radar-green animate-pulse' : 'bg-mission-offline'}`}></span>
             </div>
          )}
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto relative z-10">
          <div className="max-w-7xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 min-h-full">
            <Outlet />
          </div>
        </div>

        {/* Global Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-mission-panel-elevated text-white px-4 py-3 rounded-xl shadow-xl border border-mission-border-strong flex items-start gap-3 max-w-sm animate-in fade-in slide-in-from-bottom-5">
             <div className="mt-0.5 text-mission-info">
               <Info size={18} />
             </div>
             <div className="flex-1 text-sm font-medium leading-snug">{toastMessage}</div>
             <button
               onClick={() => setToastMessage(null)}
               className="text-mission-muted-text hover:text-white transition-colors"
             >
               <X size={16} />
             </button>
          </div>
        )}
      </main>
    </div>
  );
};

