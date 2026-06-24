import React, { useEffect, useCallback, useState } from "react";
import { NavLink, Outlet, useParams, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          to: `/teacher/classes/${classId}/history`,
          icon: <History size={20} />,
          label: "Meeting History",
        },
        {
          to: `/teacher/classes/${classId}/settings`,
          icon: <Settings size={20} />,
          label: "Settings",
        },
      ]
    : [];

  const SidebarContent = () => (
    <>
      <div className="p-6 flex flex-col gap-4 border-b border-mission-border">
        <div className="flex items-center gap-3">
          <div className="h-10 shrink-0 flex items-center justify-start">
            <img src={missionControlLogo} alt="Mission Control" className="h-full w-auto max-w-[80px] object-contain rounded" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-tight text-white uppercase">
              Mission Control
            </h1>
            <p className="text-xs text-radar-green font-medium uppercase tracking-wider">
              By GYTama EDU
            </p>
          </div>
        </div>

        {classId && (
          <button
            onClick={() => {
              navigate("/teacher/classes");
              setIsMobileMenuOpen(false);
            }}
            className="flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors bg-mission-panel-elevated hover:bg-mission-bg p-2 rounded-lg border border-transparent hover:border-mission-border"
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
              <p className="text-xs font-semibold text-mission-muted-text uppercase tracking-wider mb-2">
                ACTIVE MISSION
              </p>
              <ConnectionStatus status={status} />
              <p className="text-sm font-bold text-mission-primary-text truncate mt-2">
                {activeClass?.name}
              </p>
              <p className="text-xs text-mission-secondary-text truncate">
                {activeClass?.level_name}
              </p>
            </div>
            {navItems.map((item, idx) => (
              <NavLink
                key={idx}
                to={item.to}
                end={item.to === `/teacher/classes/${classId}`}
                onClick={(e) => {
                  setIsMobileMenuOpen(false);
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 transition-colors ${
                    isActive
                      ? "bg-soft-green-surface text-radar-green border-l-2 border-radar-green rounded-r-xl"
                      : "text-mission-secondary-text hover:bg-mission-panel-elevated hover:text-mission-primary-text rounded-xl"
                  }`
                }
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}

            <div className="mt-8 pt-4 border-t border-mission-border">
              <a
                href={`/projector/${classId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors text-strong-green hover:bg-soft-green-surface border border-transparent hover:border-radar-green/30"
              >
                <MonitorPlay size={20} />
                <span className="font-medium">Open Projector</span>
              </a>
            </div>
          </>
        ) : (
          <div className="px-4">
            <p className="text-sm text-mission-secondary-text">
              Select a class to view its dashboard.
            </p>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-mission-border relative overflow-hidden bg-mission-panel">
        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-radar-green/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-mission-bg p-2 rounded-full border border-mission-border">
              <UserIcon size={18} className="text-mission-secondary-text" />
            </div>
            <div className="truncate">
              <p className="text-sm font-semibold text-mission-primary-text truncate">
                {teacherProfile?.full_name || "Teacher"}
              </p>
              <p className="text-xs text-mission-muted-text truncate">Instructor</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="text-mission-muted-text hover:text-mission-danger p-2 transition-colors"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-mission-bg text-mission-primary-text">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-mission-panel border-r border-mission-border flex-col hidden md:flex z-20 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <aside className="relative w-72 max-w-[80%] bg-mission-panel border-r border-mission-border flex flex-col h-full animate-in slide-in-from-left duration-200 shadow-2xl">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-mission-secondary-text hover:text-white p-2"
            >
              <X size={24} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-mission-bg relative overflow-hidden">
        {/* Radar Background Texture */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0h40v40H0V0zm20 20h20v20H20V20zM0 20h20v20H0V20z' fill='%2339FF88' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`, backgroundSize: '20px 20px' }}></div>

        {/* Mobile Top Bar */}
        <header className="md:hidden flex items-center justify-between p-4 border-b border-mission-border bg-mission-panel/90 backdrop-blur-md relative z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="text-mission-primary-text hover:text-radar-green transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="font-bold text-lg text-white truncate max-w-[200px]">
              {activeClass ? activeClass.name : "Mission Control"}
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-auto relative z-10">
          <div className="max-w-[1440px] mx-auto w-full px-4 py-6 md:px-8 md:py-8 min-h-full">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

