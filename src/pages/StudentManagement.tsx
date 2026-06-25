import React, { useState, useEffect, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { 
  Users, 
  UserPlus, 
  Ban, 
  RotateCcw, 
  Trash2, 
  Copy, 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone, 
  Search,
  MoreVertical,
  Key,
  ShieldOff,
  CheckCircle,
  Loader2,
  ExternalLink
} from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import { DbStudent } from "../lib/types/database";
import { 
  PageHeader, 
  Panel, 
  Button, 
  StatusBadge, 
  EmptyState, 
  LoadingSkeleton,
  ConfirmDialog,
  PinResultDialog
} from "../components/ui";

export const StudentManagement: React.FC = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { dashboardData, isLoadingDashboard, refreshDashboard, setToastMessage } =
    useAppContext();

  const [newStudentName, setNewStudentName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<DbStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  
  // Menus
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Dialogs
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    warningText?: string;
    variant?: 'danger' | 'warning' | 'primary';
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  useEffect(() => {
    const loadAllStudents = async () => {
      if (!classId) return;
      setIsLoadingStudents(true);
      try {
        const repo = getRepository();
        const students = await repo.getStudents(classId);
        setAllStudents(students);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingStudents(false);
      }
    };
    loadAllStudents();
  }, [classId, dashboardData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoadingDashboard || !dashboardData || isLoadingStudents) {
    return (
      <div className="space-y-6 pt-4 pb-12">
        <LoadingSkeleton />
      </div>
    );
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !classId) return;
    setIsAdding(true);
    try {
      const repo = getRepository();
      await repo.addStudent(classId, { display_name: newStudentName.trim() });
      setNewStudentName("");
      await refreshDashboard();
      setToastMessage("Student added successfully");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to add student");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (student: DbStudent) => {
    const currentStatus = student.is_active;
    if (currentStatus) {
      setConfirmState({
        isOpen: true,
        title: "Deactivate Student?",
        message: `Are you sure you want to deactivate ${student.display_name}?`,
        warningText: "They will not be able to join meetings until reactivated.",
        variant: "warning",
        onConfirm: async () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await executeToggleActive(student.id, currentStatus);
        }
      });
    } else {
      await executeToggleActive(student.id, currentStatus);
    }
  };

  const executeToggleActive = async (studentId: string, currentStatus: boolean) => {
    setProcessingId(studentId);
    setOpenMenuId(null);
    try {
      const repo = getRepository();
      await repo.updateStudent(studentId, { is_active: !currentStatus });
      await refreshDashboard();
      setAllStudents((prev) =>
        prev.map((s) => s.id === studentId ? { ...s, is_active: !currentStatus } : s)
      );
      setToastMessage(`Student ${!currentStatus ? 'reactivated' : 'deactivated'} successfully`);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to update student status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleAccess = async (studentId: string, currentAccess: boolean) => {
    setProcessingId(studentId);
    setOpenMenuId(null);
    try {
      const repo = getRepository();
      await repo.updateStudentAccess(studentId, !currentAccess);
      setAllStudents((prev) =>
        prev.map((s) => s.id === studentId ? { ...s, access_enabled: !currentAccess } : s)
      );
      setToastMessage(`Student access ${!currentAccess ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to update student access");
    } finally {
      setProcessingId(null);
    }
  };

  const handleGeneratePin = async (student: DbStudent) => {
    if (student.has_pin) {
      setConfirmState({
        isOpen: true,
        title: "Reset PIN?",
        message: `Generate a new PIN for ${student.display_name}?`,
        warningText: "The old PIN will no longer work.",
        variant: "warning",
        onConfirm: async () => {
          setConfirmState(prev => ({ ...prev, isOpen: false }));
          await executeGeneratePin(student.id);
        }
      });
    } else {
      await executeGeneratePin(student.id);
    }
  };

  const executeGeneratePin = async (studentId: string) => {
    setProcessingId(studentId);
    setOpenMenuId(null);
    try {
      const repo = getRepository();
      const newPin = await repo.generateStudentPin(studentId);
      setGeneratedPin(newPin);
      setAllStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, has_pin: true } : s))
      );
      setToastMessage("New PIN generated");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to generate PIN");
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetDevice = async (student: DbStudent) => {
    setConfirmState({
      isOpen: true,
      title: "Reset Device?",
      message: `Reset linked device for ${student.display_name}?`,
      warningText: "The student will be logged out of their current device.",
      variant: "warning",
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        await executeResetDevice(student.id);
      }
    });
  };

  const executeResetDevice = async (studentId: string) => {
    setProcessingId(studentId);
    setOpenMenuId(null);
    try {
      const repo = getRepository();
      await repo.resetStudentDevice(studentId);
      setAllStudents((prev) =>
        prev.map((s) => s.id === studentId ? { ...s, student_auth_user_id: null, access_activated_at: null } : s)
      );
      setToastMessage("Device access reset successfully");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to reset device access");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteStudent = (student: DbStudent) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Student?",
      message: (
        <>
          This will remove <span className="font-bold text-white">{student.display_name}</span> from the active class roster and revoke their student access.
        </>
      ),
      warningText: "Historical meeting records will be preserved.",
      variant: "danger",
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        await executeDeleteStudent(student.id);
      }
    });
  };

  const executeDeleteStudent = async (studentId: string) => {
    setProcessingId(studentId);
    setOpenMenuId(null);
    try {
      const repo = getRepository();
      await repo.deleteStudent(studentId);
      setAllStudents((prev) => prev.filter((s) => s.id !== studentId));
      await refreshDashboard();
      setToastMessage("Student removed from the class");
    } catch (err) {
      console.error(err);
      setToastMessage("Failed to delete student");
    } finally {
      setProcessingId(null);
    }
  };

  const copyJoinCode = () => {
    if (dashboardData.classroom.join_code) {
      navigator.clipboard.writeText(dashboardData.classroom.join_code);
      setToastMessage("Class code copied to clipboard");
    }
  };

  // Filter students
  const filteredStudents = allStudents.filter(s => {
    const matchesSearch = s.display_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
                          (statusFilter === 'active' && s.is_active) || 
                          (statusFilter === 'inactive' && !s.is_active);
    return matchesSearch && matchesStatus;
  });

  const activeCount = allStudents.filter(s => s.is_active).length;
  const pinReadyCount = allStudents.filter(s => s.has_pin).length;
  const inactiveCount = allStudents.length - activeCount;

  return (
    <div className="space-y-6 pt-2 pb-16 animate-in fade-in duration-200">
      <PageHeader
        contextLabel="CLASS ROSTER"
        title="Students"
        description="Manage student profiles, access, and class participation."
      />

      {/* Class Access Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Panel className="p-5 flex flex-col justify-between overflow-hidden relative border-mission-border/50 col-span-1 md:col-span-2">
          <div className="absolute top-0 left-0 w-full h-1 bg-radar-green opacity-80" />
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-1">
                Class Join Code
              </p>
              <div className="flex items-center gap-3">
                <span className="text-3xl font-mono text-radar-green font-bold tracking-widest bg-mission-bg-secondary px-3 py-1 rounded-lg border border-mission-border/50">
                  {dashboardData.classroom.join_code || "MISSING"}
                </span>
                <Button variant="secondary" size="sm" onClick={copyJoinCode}>
                  <Copy size={16} />
                </Button>
              </div>
            </div>
            <div className="text-right">
               <p className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-2">
                Overall Access
              </p>
              {dashboardData.classroom.student_access_enabled ? (
                <StatusBadge variant="success" dot>Enabled</StatusBadge>
              ) : (
                <StatusBadge variant="danger" dot>Disabled</StatusBadge>
              )}
            </div>
          </div>
          <p className="text-sm text-mission-secondary-text">
            Students can join using this class code and their unique PIN.
          </p>
        </Panel>

        <Panel className="p-5 flex flex-col justify-between overflow-hidden relative border-mission-border/50">
          <div className="absolute top-0 left-0 w-full h-1 bg-cyan-500 opacity-80" />
           <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center border bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
              <Key size={20} />
            </div>
          </div>
          <div>
            <p className="text-xs text-mission-muted-text uppercase tracking-wider font-bold mb-1">
              PIN Readiness
            </p>
            <div className="text-2xl font-bold text-white">
              {pinReadyCount} <span className="text-lg text-mission-secondary-text font-normal">/ {allStudents.length} ready</span>
            </div>
          </div>
        </Panel>
      </div>

      {/* Add Student Panel */}
      <Panel className="p-6 border-mission-border/50 overflow-hidden relative">
         <div className="absolute top-0 left-0 w-1 h-full bg-mission-primary-text opacity-80" />
         <div className="flex items-center gap-4 mb-4">
            <div className="bg-mission-panel-strong p-2 rounded-lg border border-mission-border/50 shadow-sm">
              <UserPlus size={20} className="text-mission-primary-text" />
            </div>
            <div>
              <h2 className="text-lg font-display font-bold text-white">Add Student</h2>
              <p className="text-sm text-mission-secondary-text">Add a new student to the class roster.</p>
            </div>
         </div>
         <form onSubmit={handleAddStudent} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={newStudentName}
              onChange={(e) => setNewStudentName(e.target.value)}
              placeholder="Student Name"
              className="flex-1 bg-mission-bg-secondary border border-mission-border/50 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
              required
            />
            <Button type="submit" disabled={isAdding || !newStudentName.trim()}>
              {isAdding ? <Loader2 size={18} className="animate-spin mr-2" /> : <Plus size={18} className="mr-2" />}
              {isAdding ? "Adding..." : "Add Student"}
            </Button>
         </form>
      </Panel>

      {/* Roster Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-8 mb-4">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold text-white">Student Roster</h2>
          <div className="flex gap-2">
            <span className="text-xs font-bold text-mission-secondary-text bg-mission-panel px-2.5 py-1 rounded-md border border-mission-border/50">
              Total {allStudents.length}
            </span>
            <span className="text-xs font-bold text-radar-green bg-radar-green/10 px-2.5 py-1 rounded-md border border-radar-green/20">
              Active {activeCount}
            </span>
            {inactiveCount > 0 && (
              <span className="text-xs font-bold text-mission-muted-text bg-mission-panel-strong px-2.5 py-1 rounded-md border border-mission-border/50">
                Inactive {inactiveCount}
              </span>
            )}
          </div>
        </div>

        <div className="flex w-full sm:w-auto gap-3">
           <div className="relative flex-1 sm:w-64">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={16} className="text-mission-muted-text" />
             </div>
             <input
                type="text"
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-mission-panel border border-mission-border/50 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-radar-green focus:ring-1 focus:ring-radar-green transition-all"
             />
           </div>
           
           <div className="relative">
             <select
               value={statusFilter}
               onChange={(e) => setStatusFilter(e.target.value as any)}
               className="appearance-none bg-mission-panel border border-mission-border/50 rounded-lg pl-9 pr-8 py-2 text-sm text-white focus:outline-none focus:border-radar-green transition-all"
             >
               <option value="all">All Status</option>
               <option value="active">Active Only</option>
               <option value="inactive">Inactive Only</option>
             </select>
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter size={14} className="text-mission-muted-text" />
             </div>
           </div>
        </div>
      </div>

      {/* Roster Area */}
      {filteredStudents.length === 0 ? (
        <EmptyState
          icon={Users}
          title={allStudents.length === 0 ? "No Students Yet" : "No Match Found"}
          description={allStudents.length === 0 ? "Add the first student to prepare this class for meetings." : "Try adjusting your search or filters."}
          className="mt-4"
        />
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="block md:hidden space-y-4">
            {filteredStudents.map(student => (
               <div key={student.id} className={`bg-mission-panel border border-mission-border/50 rounded-xl p-4 flex flex-col relative overflow-hidden group ${!student.is_active ? 'opacity-70 bg-mission-bg-secondary' : ''}`}>
                 {processingId === student.id && (
                   <div className="absolute inset-0 bg-mission-panel/80 backdrop-blur-sm z-10 flex items-center justify-center">
                      <div className="flex items-center gap-2 text-radar-green bg-mission-panel-elevated px-4 py-2 rounded-lg border border-mission-border">
                        <Loader2 size={16} className="animate-spin" />
                        <span className="text-xs font-bold uppercase tracking-wider">Updating</span>
                      </div>
                   </div>
                 )}
                 <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-mission-panel-strong border border-mission-border/50 flex items-center justify-center font-display font-bold text-white text-lg">
                         {student.display_name.charAt(0).toUpperCase()}
                       </div>
                       <div>
                         <Link to={`/student/${student.id}`} className="font-bold text-white text-base hover:text-radar-green transition-colors">
                           {student.display_name}
                         </Link>
                         <div className="flex items-center gap-2 mt-1">
                           {student.is_active ? (
                             <span className="text-[10px] font-bold text-radar-green uppercase tracking-wider">Active</span>
                           ) : (
                             <span className="text-[10px] font-bold text-mission-muted-text uppercase tracking-wider">Inactive</span>
                           )}
                           <span className="text-mission-muted-text text-[10px]">•</span>
                           <span className="font-mono text-xs font-medium text-radar-green/80">
                             {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()} pts
                           </span>
                         </div>
                       </div>
                    </div>
                    
                    {/* Mobile Menu */}
                    <div className="relative">
                       <button
                         onClick={() => setOpenMenuId(openMenuId === student.id ? null : student.id)}
                         className="p-1.5 text-mission-muted-text hover:text-white hover:bg-mission-panel-strong rounded-md transition-colors"
                       >
                         <MoreVertical size={18} />
                       </button>
                       {openMenuId === student.id && (
                         <div className="absolute right-0 mt-1 w-48 bg-mission-panel-elevated border border-mission-border/50 rounded-xl shadow-xl overflow-hidden z-20 py-1">
                            <Link
                               to={`/student/${student.id}`}
                               className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                            >
                               <ExternalLink size={14} className="text-mission-secondary-text" />
                               View Profile
                            </Link>
                            <div className="w-full h-px bg-mission-border/50 my-1"></div>
                            <button
                               onClick={() => handleToggleAccess(student.id, student.access_enabled)}
                               className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                            >
                               {student.access_enabled ? <ShieldOff size={14} className="text-mission-danger" /> : <ShieldCheck size={14} className="text-radar-green" />}
                               {student.access_enabled ? "Disable Access" : "Enable Access"}
                            </button>
                            <button
                               onClick={() => handleGeneratePin(student)}
                               className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                            >
                               <Key size={14} className="text-mission-secondary-text" />
                               {student.has_pin ? "Reset PIN" : "Generate PIN"}
                            </button>
                            {student.student_auth_user_id && (
                               <button
                                  onClick={() => handleResetDevice(student)}
                                  className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                               >
                                  <SmartphoneNfc size={14} className="text-amber-500" />
                                  Reset Device
                               </button>
                            )}
                            <div className="w-full h-px bg-mission-border/50 my-1"></div>
                            <button
                               onClick={() => handleToggleActive(student)}
                               className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                            >
                               {student.is_active ? <Ban size={14} className="text-amber-500" /> : <RotateCcw size={14} className="text-radar-green" />}
                               {student.is_active ? "Deactivate" : "Reactivate"}
                            </button>
                            <button
                               onClick={() => handleDeleteStudent(student)}
                               className="w-full text-left px-4 py-2 text-sm text-mission-danger hover:bg-mission-danger/10 flex items-center gap-2"
                            >
                               <Trash2 size={14} className="text-mission-danger" />
                               Delete Student
                            </button>
                         </div>
                       )}
                    </div>
                 </div>

                 <div className="mt-2 pt-3 border-t border-mission-border/30">
                   <div className="flex flex-col gap-2">
                      {!student.access_enabled ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mission-danger">
                          <ShieldAlert size={14} /> Access Disabled
                        </span>
                      ) : student.has_pin ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-radar-green">
                          <ShieldCheck size={14} /> PIN Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mission-warning">
                          <Key size={14} /> PIN Required
                        </span>
                      )}

                      {student.student_auth_user_id && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mission-secondary-text">
                          <Smartphone size={14} /> Device Linked
                        </span>
                      )}
                   </div>
                 </div>
               </div>
            ))}
          </div>

          {/* Desktop Table */}
          <Panel className="hidden md:block overflow-x-auto p-0 border-mission-border/50">
            <table className="w-full text-left border-collapse" ref={menuRef}>
              <thead>
                <tr className="bg-mission-bg/50 text-mission-secondary-text text-xs uppercase tracking-wider border-b border-mission-border/50">
                  <th className="px-5 py-3 font-medium">Student</th>
                  <th className="px-5 py-3 font-medium">Points</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Access</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mission-border/30 bg-mission-panel/30">
                {filteredStudents.map((student) => (
                  <tr
                    key={student.id}
                    className={`hover:bg-mission-panel/50 transition-colors group relative h-[68px] ${!student.is_active ? 'opacity-80 bg-mission-bg-secondary/30' : ''}`}
                  >
                    <td className="px-5 py-3 whitespace-nowrap">
                       <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-mission-panel-strong border border-mission-border/50 flex items-center justify-center font-display font-bold text-white text-sm shrink-0">
                           {student.display_name.charAt(0).toUpperCase()}
                         </div>
                         <div className="flex flex-col">
                           <Link
                             to={`/student/${student.id}`}
                             className="font-medium text-sm text-white hover:text-radar-green transition-colors"
                           >
                             {student.display_name}
                           </Link>
                           {student.student_auth_user_id && (
                             <span className="text-[10px] text-mission-muted-text flex items-center gap-1 mt-0.5">
                               <Smartphone size={10} /> Device Linked
                             </span>
                           )}
                         </div>
                       </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                       <div className="font-mono font-medium text-radar-green text-sm">
                         {(Number.isFinite(Number(student.total_points)) ? Number(student.total_points) : 0).toLocaleString()}
                       </div>
                       <div className="text-[10px] text-mission-muted-text">Permanent</div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      {student.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-radar-green/10 text-radar-green border border-radar-green/20">
                           Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-mission-secondary-text/10 text-mission-secondary-text border border-mission-secondary-text/20">
                           Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {!student.access_enabled ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mission-danger">
                            <ShieldAlert size={14} /> Disabled
                          </span>
                        ) : student.has_pin ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-radar-green">
                            <ShieldCheck size={14} /> PIN Ready
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-mission-warning">
                            <Key size={14} /> PIN Required
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap text-right">
                       <div className="flex items-center justify-end gap-2 relative">
                         {processingId === student.id ? (
                           <div className="flex items-center gap-2 text-radar-green px-3">
                             <Loader2 size={14} className="animate-spin" />
                             <span className="text-[10px] font-bold uppercase tracking-wider">Updating</span>
                           </div>
                         ) : (
                           <>
                             <Button
                               variant="secondary"
                               size="sm"
                               onClick={() => navigate(`/student/${student.id}`)}
                               className="hidden sm:flex"
                             >
                               View Profile
                             </Button>
                             <div className="relative">
                               <button
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setOpenMenuId(openMenuId === student.id ? null : student.id);
                                 }}
                                 className="p-2 text-mission-secondary-text hover:text-white hover:bg-mission-panel-strong rounded-md transition-colors"
                               >
                                 <MoreVertical size={18} />
                               </button>
                               {openMenuId === student.id && (
                                 <div className="absolute right-0 top-full mt-1 w-48 bg-mission-panel-elevated border border-mission-border/50 rounded-xl shadow-xl overflow-hidden z-20 py-1">
                                    <button
                                       onClick={() => handleToggleAccess(student.id, student.access_enabled)}
                                       className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                                    >
                                       {student.access_enabled ? <ShieldOff size={14} className="text-mission-danger" /> : <ShieldCheck size={14} className="text-radar-green" />}
                                       {student.access_enabled ? "Disable Access" : "Enable Access"}
                                    </button>
                                    <button
                                       onClick={() => handleGeneratePin(student)}
                                       className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                                    >
                                       <Key size={14} className="text-mission-secondary-text" />
                                       {student.has_pin ? "Reset PIN" : "Generate PIN"}
                                    </button>
                                    {student.student_auth_user_id && (
                                       <button
                                          onClick={() => handleResetDevice(student)}
                                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                                       >
                                          <SmartphoneNfc size={14} className="text-amber-500" />
                                          Reset Device
                                       </button>
                                    )}
                                    <div className="w-full h-px bg-mission-border/50 my-1"></div>
                                    <button
                                       onClick={() => handleToggleActive(student)}
                                       className="w-full text-left px-4 py-2 text-sm text-white hover:bg-mission-bg-secondary flex items-center gap-2"
                                    >
                                       {student.is_active ? <Ban size={14} className="text-amber-500" /> : <RotateCcw size={14} className="text-radar-green" />}
                                       {student.is_active ? "Deactivate" : "Reactivate"}
                                    </button>
                                    <button
                                       onClick={() => handleDeleteStudent(student)}
                                       className="w-full text-left px-4 py-2 text-sm text-mission-danger hover:bg-mission-danger/10 flex items-center gap-2"
                                    >
                                       <Trash2 size={14} className="text-mission-danger" />
                                       Delete Student
                                    </button>
                                 </div>
                               )}
                             </div>
                           </>
                         )}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}

      {/* Development Recovery Tool */}
      {import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE === "mock" && (
        <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 flex items-start gap-4">
          <ShieldAlert className="text-amber-500 shrink-0 mt-1" size={24} />
          <div>
            <h2 className="text-sm font-bold text-amber-500 mb-1 uppercase tracking-wider">
              Development Only
            </h2>
            <p className="text-sm text-amber-500/80 mb-3">
              This tool generates missing class codes and mock PINs. It is only visible in mock development mode.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                const repo = getRepository() as any;
                if (repo.getDb) {
                  const db = repo.getDb();
                  let fixedClasses = 0;
                  let fixedStudents = 0;
                  db.classes.forEach((c: any) => {
                    if (!c.join_code) {
                      c.join_code = Math.random().toString(36).substring(2, 8).toUpperCase();
                      fixedClasses++;
                    }
                  });
                  db.students.forEach((s: any) => {
                    if (!s.access_pin_hash) {
                      s.access_pin_hash = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
                      fixedStudents++;
                    }
                  });
                  repo.saveDb(db);
                  alert(`Repaired ${fixedClasses} classes and ${fixedStudents} students. Refreshing...`);
                  window.location.reload();
                }
              }}
            >
              Repair Student Access Data
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        warningText={confirmState.warningText}
        variant={confirmState.variant}
        onConfirm={confirmState.onConfirm}
        onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
      />

      <PinResultDialog
        isOpen={!!generatedPin}
        pin={generatedPin}
        onClose={() => setGeneratedPin(null)}
      />
    </div>
  );
};
