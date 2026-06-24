import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Users, Plus, Edit2, Ban, CheckCircle, RotateCcw, Trash2 } from "lucide-react";
import { useAppContext } from "../store";
import { getRepository } from "../lib/data/repository";
import { DbStudent } from "../lib/types/database";

export const StudentManagement: React.FC = () => {
  const { classId } = useParams();
  const { dashboardData, isLoadingDashboard, refreshDashboard } =
    useAppContext();

  const [newStudentName, setNewStudentName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [allStudents, setAllStudents] = useState<DbStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentToDelete, setStudentToDelete] = useState<DbStudent | null>(null);

  useEffect(() => {
    const loadAllStudents = async () => {
      if (!classId) return;
      setIsLoadingStudents(true);
      try {
        const repo = getRepository();
        // We'll fetch all students, regardless of active status by calling the DB directly
        // Wait, repo.getStudents() currently returns only active.
        // Let's just adjust repo to return all if needed, or we just rely on getStudents
        // If repo.getStudents only returns active, we might need a new method.
        // Let's modify the component to just use repo.getStudents for now, and we'll fix the repo next.
        const students = await repo.getStudents(classId);
        setAllStudents(students);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingStudents(false);
      }
    };
    loadAllStudents();
  }, [classId, dashboardData]); // Re-fetch when dashboard updates (e.g. after adding)

  if (isLoadingDashboard || !dashboardData || isLoadingStudents) {
    return (
      <div className="p-8 text-center text-mission-muted-text">Loading students...</div>
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
    } catch (err) {
      console.error(err);
      alert("Failed to add student");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (
    studentId: string,
    currentStatus: boolean,
  ) => {
    if (processingId === studentId) return;
    setProcessingId(studentId);
    try {
      const repo = getRepository();
      await repo.updateStudent(studentId, { is_active: !currentStatus });
      await refreshDashboard();
      // Also update local allStudents to reflect change quickly
      setAllStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, is_active: !currentStatus } : s,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update student status");
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleAccess = async (
    studentId: string,
    currentAccess: boolean,
  ) => {
    if (processingId === studentId) return;
    setProcessingId(studentId);
    try {
      const repo = getRepository();
      await repo.updateStudentAccess(studentId, !currentAccess);
      setAllStudents((prev) =>
        prev.map((s) =>
          s.id === studentId ? { ...s, access_enabled: !currentAccess } : s,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to update student access");
    } finally {
      setProcessingId(null);
    }
  };

  const handleGeneratePin = async (studentId: string) => {
    if (processingId === studentId) return;
    if (
      !confirm(
        "Are you sure you want to generate a new PIN? The old PIN will no longer work.",
      )
    )
      return;

    setProcessingId(studentId);
    try {
      const repo = getRepository();
      const newPin = await repo.generateStudentPin(studentId);
      // We do not save the cleartext PIN to state, only show it once
      alert(
        `The new PIN is: ${newPin}\n\nPlease save this or give it to the student. It will not be shown again.`,
      );

      // We don't have the hash in the client, but we know they now have a pin.
      setAllStudents((prev) =>
        prev.map((s) => (s.id === studentId ? { ...s, has_pin: true } : s)),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to generate PIN");
    } finally {
      setProcessingId(null);
    }
  };

  const handleResetDevice = async (studentId: string) => {
    if (processingId === studentId) return;
    if (
      !confirm(
        "Are you sure you want to reset device access? The student will be logged out of their current device.",
      )
    )
      return;

    setProcessingId(studentId);
    try {
      const repo = getRepository();
      await repo.resetStudentDevice(studentId);
      setAllStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? { ...s, student_auth_user_id: null, access_activated_at: null }
            : s,
        ),
      );
    } catch (err) {
      console.error(err);
      alert("Failed to reset device access");
    } finally {
      setProcessingId(null);
    }
  };

  const executeDeleteStudent = async () => {
    if (!studentToDelete) return;
    const studentId = studentToDelete.id;
    setProcessingId(studentId);
    try {
      const repo = getRepository();
      await repo.deleteStudent(studentId);
      setAllStudents((prev) => prev.filter((s) => s.id !== studentId));
      await refreshDashboard();
      // Optional: show a toast, but for now we'll just alert or simply close.
      // alert("Student removed from the class.");
    } catch (err) {
      console.error(err);
      alert("Failed to delete student");
    } finally {
      setProcessingId(null);
      setStudentToDelete(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            Student Management
          </h1>
          <p className="text-mission-secondary-text">
            Add or manage students for {dashboardData.classroom.name}.
          </p>
        </div>
      </div>

      <div className="bg-mission-panel border border-mission-border rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-2">
            Class Access Info
          </h2>
          <p className="text-mission-secondary-text mb-4 text-sm">
            Students can join using this class code and their unique PIN.
          </p>
          <div className="flex gap-4 items-center">
            <div className="bg-mission-bg-secondary px-4 py-2 rounded-lg border border-mission-border">
              <span className="text-xs text-mission-muted-text block uppercase tracking-wider mb-1">
                Class Code
              </span>
              <span className="text-2xl font-mono text-radar-green font-bold tracking-widest">
                {dashboardData.classroom.join_code || "MISSING"}
              </span>
            </div>
            <div className="bg-mission-bg-secondary px-4 py-2 rounded-lg border border-mission-border">
              <span className="text-xs text-mission-muted-text block uppercase tracking-wider mb-1">
                Access
              </span>
              <span
                className={`text-sm font-medium ${dashboardData.classroom.student_access_enabled ? "text-radar-green" : "text-mission-danger"}`}
              >
                {dashboardData.classroom.student_access_enabled
                  ? "Enabled"
                  : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-mission-bg-secondary px-6 py-4 rounded-xl border border-mission-border min-w-[200px]">
          <div className="text-sm text-mission-muted-text mb-1">Students with PIN</div>
          <div className="text-3xl font-bold text-white">
            {allStudents.filter((s) => s.has_pin).length}{" "}
            <span className="text-lg text-mission-muted-text font-normal">
              / {allStudents.length}
            </span>
          </div>
        </div>
      </div>

      {import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE === "mock" && (
        <div className="bg-mission-warning/10 border border-mission-warning/30 rounded-3xl p-6">
          <h2 className="text-lg font-bold text-mission-warning mb-2">
            Development Recovery Tool
          </h2>
          <p className="text-sm text-mission-warning/80 mb-4">
            This tool generates missing class codes and mock PINs. It is only
            visible in mock development mode.
          </p>
          <button
            onClick={() => {
              const repo = getRepository() as any;
              if (repo.getDb) {
                const db = repo.getDb();
                let fixedClasses = 0;
                let fixedStudents = 0;
                db.classes.forEach((c: any) => {
                  if (!c.join_code) {
                    c.join_code = Math.random()
                      .toString(36)
                      .substring(2, 8)
                      .toUpperCase();
                    fixedClasses++;
                  }
                });
                db.students.forEach((s: any) => {
                  if (!s.access_pin_hash) {
                    s.access_pin_hash = String(
                      Math.floor(Math.random() * 10000),
                    ).padStart(4, "0");
                    fixedStudents++;
                  }
                });
                repo.saveDb(db);
                alert(
                  `Repaired ${fixedClasses} classes and ${fixedStudents} students. Refreshing...`,
                );
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-mission-warning/20 text-mission-warning hover:bg-mission-warning/30 rounded-lg text-sm font-medium transition-colors border border-mission-warning/30"
          >
            Repair Student Access Data
          </button>
        </div>
      )}

      <div className="bg-mission-panel border border-mission-border rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Add New Student</h2>
        <form onSubmit={handleAddStudent} className="flex gap-4">
          <input
            type="text"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            placeholder="Student Name"
            className="flex-1 bg-mission-input border border-mission-border rounded-xl px-4 py-3 text-white focus:border-radar-green transition-all"
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            className="flex items-center gap-2 px-6 py-3 bg-radar-green text-mission-bg font-bold rounded-xl hover:bg-strong-green transition-colors focus:outline-none focus:ring-2 focus:ring-radar-green focus:ring-offset-2 focus:ring-offset-mission-panel"
          >
            <Plus size={18} />
            {isAdding ? "Initializing..." : "Add Student"}
          </button>
        </form>
      </div>

      <div className="bg-mission-panel border border-mission-border rounded-3xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-mission-border">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} />
            Class Roster ({allStudents.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-mission-bg-secondary text-mission-secondary-text text-sm uppercase tracking-wider border-b border-mission-border">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Points</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-center">Access</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mission-border">
              {allStudents.map((student) => (
                <tr
                  key={student.id}
                  className={`hover:bg-mission-panel-elevated transition-colors ${!student.is_active ? "opacity-50" : ""}`}
                >
                  <td className="px-6 py-4 font-medium text-white">
                    {student.display_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-radar-green">
                    {student.total_points.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {student.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-radar-green/10 text-radar-green border border-radar-green/20">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-mission-secondary-text/10 text-mission-secondary-text border border-mission-secondary-text/20">
                        <Ban size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center gap-2">
                      {!student.access_enabled ? (
                        <span className="text-xs font-medium text-mission-danger bg-mission-danger/10 border border-mission-danger/20 px-2 py-1 rounded-md">
                          Access Disabled
                        </span>
                      ) : student.has_pin ? (
                        <span className="text-xs font-medium text-radar-green bg-radar-green/10 border border-radar-green/20 px-2 py-1 rounded-md">
                          PIN Ready
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-mission-warning bg-mission-warning/10 border border-mission-warning/20 px-2 py-1 rounded-md">
                          PIN Not Generated
                        </span>
                      )}

                      {student.student_auth_user_id && (
                        <span className="text-[10px] text-mission-muted-text bg-mission-panel-elevated border border-mission-border px-2 py-0.5 rounded-full">
                          Device Linked
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <button
                        onClick={() =>
                          handleToggleAccess(student.id, student.access_enabled)
                        }
                        disabled={processingId === student.id}
                        className="text-xs px-2 py-1 bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg text-mission-secondary-text rounded"
                      >
                        {student.access_enabled
                          ? "Revoke Access"
                          : "Restore Access"}
                      </button>
                      <button
                        onClick={() => handleGeneratePin(student.id)}
                        disabled={processingId === student.id}
                        className="text-xs px-2 py-1 bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg text-mission-secondary-text rounded"
                      >
                        {student.has_pin ? "Reset PIN" : "Generate PIN"}
                      </button>
                      {student.student_auth_user_id && (
                        <button
                          onClick={() => handleResetDevice(student.id)}
                          disabled={processingId === student.id}
                          className="text-xs px-2 py-1 bg-mission-danger/20 hover:bg-mission-danger/30 text-mission-danger border border-mission-danger/30 rounded"
                        >
                          Reset Device
                        </button>
                      )}

                      <Link
                        to={`/student/${student.id}`}
                        className="p-1.5 text-mission-muted-text hover:text-white bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg rounded transition-colors"
                        title="View Profile"
                      >
                        <Edit2 size={14} />
                      </Link>
                      {student.is_active ? (
                        <button
                          onClick={() => handleToggleActive(student.id, true)}
                          disabled={processingId === student.id}
                          className="p-1.5 text-mission-muted-text hover:text-mission-warning bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg disabled:opacity-50 transition-colors rounded"
                          title="Deactivate Student"
                        >
                          <Ban size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(student.id, false)}
                          disabled={processingId === student.id}
                          className="p-1.5 text-mission-muted-text hover:text-radar-green bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg disabled:opacity-50 transition-colors rounded"
                          title="Reactivate Student"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setStudentToDelete(student)}
                        disabled={processingId === student.id}
                        className="p-1.5 text-mission-muted-text hover:text-mission-danger bg-mission-panel-elevated border border-mission-border hover:bg-mission-bg disabled:opacity-50 transition-colors rounded"
                        title="Delete Student"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {allStudents.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-mission-muted-text"
                  >
                    No students found. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-mission-panel border border-mission-border rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4">Delete Student?</h2>
            <p className="text-mission-secondary-text mb-6">
              This will remove <span className="font-bold text-white">{studentToDelete.display_name}</span> from the active class roster and revoke their student access. Historical meeting records will be preserved.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setStudentToDelete(null)}
                disabled={processingId === studentToDelete.id}
                className="px-5 py-2.5 bg-mission-panel-elevated border border-mission-border text-mission-secondary-text font-bold rounded-xl hover:bg-mission-bg hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeDeleteStudent}
                disabled={processingId === studentToDelete.id}
                className="px-5 py-2.5 bg-mission-danger hover:bg-mission-danger/80 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(255,87,87,0.3)] transition-colors focus:outline-none focus:ring-2 focus:ring-mission-danger focus:ring-offset-2 focus:ring-offset-mission-panel"
              >
                {processingId === studentToDelete.id ? "Deleting..." : "Delete Student"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
