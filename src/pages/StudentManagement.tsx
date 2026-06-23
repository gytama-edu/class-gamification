import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, Plus, Edit2, Ban, CheckCircle, RotateCcw } from 'lucide-react';
import { useAppContext } from '../store';
import { getRepository } from '../lib/data/repository';
import { DbStudent } from '../lib/types/database';

export const StudentManagement: React.FC = () => {
  const { classId } = useParams();
  const { dashboardData, isLoadingDashboard, refreshDashboard } = useAppContext();
  
  const [newStudentName, setNewStudentName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [allStudents, setAllStudents] = useState<DbStudent[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);

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
    return <div className="p-8 text-center text-slate-400">Loading students...</div>;
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim() || !classId) return;
    setIsAdding(true);
    try {
      const repo = getRepository();
      await repo.addStudent(classId, { display_name: newStudentName.trim() });
      setNewStudentName('');
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      alert('Failed to add student');
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggleActive = async (studentId: string, currentStatus: boolean) => {
    try {
      const repo = getRepository();
      await repo.updateStudent(studentId, { is_active: !currentStatus });
      await refreshDashboard();
    } catch (err) {
      console.error(err);
      alert('Failed to update student status');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8">
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Student Management</h1>
          <p className="text-slate-400">Add or manage students for {dashboardData.classroom.name}.</p>
        </div>
      </div>

      <div className="bg-cosmic-panel border border-slate-800 rounded-3xl p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-6">Add New Student</h2>
        <form onSubmit={handleAddStudent} className="flex gap-4">
          <input
            type="text"
            value={newStudentName}
            onChange={(e) => setNewStudentName(e.target.value)}
            placeholder="Student Name"
            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:border-cosmic-cyan transition-all"
            required
          />
          <button
            type="submit"
            disabled={isAdding}
            className="flex items-center gap-2 px-6 py-3 bg-cosmic-cyan text-slate-900 font-bold rounded-xl hover:bg-cyan-400 transition-colors"
          >
            <Plus size={18} />
            {isAdding ? 'Adding...' : 'Add Student'}
          </button>
        </form>
      </div>

      <div className="bg-cosmic-panel border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users size={20} />
            Class Roster ({allStudents.length})
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800/50 text-slate-300 text-sm uppercase tracking-wider border-b border-slate-800">
                <th className="px-6 py-4 font-medium">Name</th>
                <th className="px-6 py-4 font-medium">Points</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {allStudents.map((student) => (
                <tr key={student.id} className={`hover:bg-slate-800/30 transition-colors ${!student.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-6 py-4 font-medium text-white">
                    {student.display_name}
                  </td>
                  <td className="px-6 py-4 font-mono text-cosmic-cyan">
                    {student.total_points.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {student.is_active ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle size={12} /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        <Ban size={12} /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        to={`/student/${student.id}`}
                        className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        title="View Profile"
                      >
                        <Edit2 size={16} />
                      </Link>
                      {student.is_active ? (
                        <button
                          onClick={() => handleToggleActive(student.id, true)}
                          className="p-2 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Deactivate Student"
                        >
                          <Ban size={16} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(student.id, false)}
                          className="p-2 text-slate-400 hover:text-emerald-400 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                          title="Reactivate Student"
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {allStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                    No students found. Add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
