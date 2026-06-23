import React, { useEffect, useCallback } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ChartColumn,
  Settings,
  Rocket,
  ArrowLeft,
  MonitorPlay,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { useAppContext } from "../store";
import { useAuth } from "../lib/auth/AuthContext";
import { useClassroomRealtime } from "../lib/realtime/useClassroomRealtime";
import { ConnectionStatus } from "./ConnectionStatus";

export const Layout: React.FC = () => {
  const { classId } = useParams();
  const {
    classes,
    setSelectedClassId,
    isLoadingClasses,
    refreshDashboard,
    refreshClasses,
  } = useAppContext();
  const { teacherProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleRealtimeUpdate = useCallback(() => {
    refreshDashboard();
    refreshClasses();
  }, [refreshDashboard, refreshClasses]);

  const { status } = useClassroomRealtime(
    classId || null,
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
          icon: <LayoutDashboard size={20} />,
          label: "Overview",
        },
        {
          to: `/teacher/classes/${classId}/live`,
          icon: <MonitorPlay size={20} />,
          label: "Live Meeting",
        },
        {
          to: `/teacher/classes/${classId}/students`,
          icon: <Users size={20} />,
          label: "Students",
        },
        {
          to: "#",
          icon: <Calendar size={20} />,
          label: "Meeting History",
          disabled: true,
        },
        {
          to: `/teacher/classes/${classId}/settings`,
          icon: <Settings size={20} />,
          label: "Settings",
        },
      ]
    : [];

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-cosmic-panel border-r border-slate-800 flex flex-col hidden md:flex z-20">
        <div className="p-6 flex flex-col gap-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cosmic-cyan to-cosmic-purple p-2 rounded-lg">
              <Rocket className="text-white" size={24} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight tracking-tight">
                GYTama EDU
              </h1>
              <p className="text-xs text-cosmic-cyan font-medium">
                Cosmic Classroom
              </p>
            </div>
          </div>

          {classId && (
            <button
              onClick={() => navigate("/teacher/classes")}
              className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors bg-slate-800/50 hover:bg-slate-700 p-2 rounded-lg"
            >
              <ArrowLeft size={16} />
              <span>Back to Classes</span>
            </button>
          )}
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {classId ? (
            <>
              <div className="px-4 pb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                  Class Menu
                </p>
                <ConnectionStatus status={status} />
                <p className="text-sm font-bold text-white truncate mt-2">
                  {activeClass?.name}
                </p>
              </div>
              {navItems.map((item, idx) => (
                <NavLink
                  key={idx}
                  to={item.to}
                  end={item.to === `/teacher/classes/${classId}`}
                  onClick={(e) => {
                    if (item.disabled) e.preventDefault();
                  }}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      item.disabled
                        ? "opacity-50 cursor-not-allowed hover:bg-transparent text-slate-400"
                        : isActive && item.to !== "#"
                          ? "bg-gradient-to-r from-cosmic-cyan/20 to-cosmic-purple/10 text-cosmic-cyan border border-cosmic-cyan/30"
                          : "text-slate-300 hover:bg-cosmic-panel-hover"
                    }`
                  }
                  title={item.disabled ? "Coming in a later phase" : ""}
                >
                  {item.icon}
                  <span className="font-medium">{item.label}</span>
                  {item.disabled && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded-full">
                      Soon
                    </span>
                  )}
                </NavLink>
              ))}

              <div className="mt-8 pt-4 border-t border-slate-800">
                <a
                  href={`/projector/${classId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30"
                >
                  <MonitorPlay size={20} />
                  <span className="font-medium">Open Projector</span>
                </a>
              </div>
            </>
          ) : (
            <div className="px-4">
              <p className="text-sm text-slate-400">
                Select a class to view its dashboard.
              </p>
            </div>
          )}
        </nav>

        <div className="p-4 border-t border-slate-800 relative overflow-hidden bg-slate-900/50">
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-cosmic-purple/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-12 -left-10 w-40 h-40 bg-cosmic-cyan/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-slate-800 p-2 rounded-full border border-slate-700">
                <UserIcon size={18} className="text-slate-300" />
              </div>
              <div className="truncate">
                <p className="text-sm font-semibold text-white truncate">
                  {teacherProfile?.full_name || "Teacher"}
                </p>
                <p className="text-xs text-slate-500 truncate">Instructor</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-slate-400 hover:text-rose-400 p-2 transition-colors"
              title="Log out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-cosmic-navy relative">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8Y2lyY2xlIGN4PSIyIiBjeT0iMiIgcj0iMC41IiBmaWxsPSIjZmZmZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIgLz4KPC9zdmc+')] opacity-50 pointer-events-none"></div>
        <div className="relative z-10 max-w-7xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
