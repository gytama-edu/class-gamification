import { Classroom, ClassroomDashboardData, DbStudent, LeaderboardEntry, Meeting, StudentWithCurrentState } from '../types/database';

export interface ClassroomRepository {
  getClasses(): Promise<Classroom[]>;
  getClassroomDashboard(classId: string): Promise<ClassroomDashboardData>;
  createClass(input: { name: string; level_name: string; max_lives: number }): Promise<Classroom>;
  updateClass(classId: string, input: { name?: string; level_name?: string; max_lives?: number }): Promise<void>;
  archiveClass(classId: string): Promise<void>;

  getStudents(classId: string): Promise<DbStudent[]>;
  addStudent(classId: string, input: { display_name: string }): Promise<DbStudent>;
  updateStudent(studentId: string, input: { display_name?: string; is_active?: boolean }): Promise<void>;

  getActiveMeeting(classId: string): Promise<Meeting | null>;
  getStudentProfile(studentId: string): Promise<StudentWithCurrentState | null>;
  getLeaderboard(classId: string): Promise<LeaderboardEntry[]>;

  addPoints(classId: string, studentId: string, points: number, reason?: string): Promise<void>;
  removePoints(classId: string, studentId: string, points: number, reason?: string): Promise<void>;
  removeLife(classId: string, studentId: string, reason?: string): Promise<void>;
  restoreLife(classId: string, studentId: string, reason?: string): Promise<void>;
  resetStudentLives(classId: string, studentId: string): Promise<void>;
  startNewMeeting(classId: string): Promise<void>;
  
  restoreDefaultMockData(): Promise<void>;
}
