import { Classroom, ClassroomDashboardData, DbStudent, LeaderboardEntry, Meeting, StudentWithCurrentState } from '../types/database';

export interface ClassroomRepository {
  getClasses(): Promise<Classroom[]>;
  getClassroomDashboard(classId: string): Promise<ClassroomDashboardData>;
  createClass(input: { name: string; level_name: string; max_lives: number }): Promise<Classroom>;
  updateClass(classId: string, input: { name?: string; level_name?: string; max_lives?: number }): Promise<void>;
  archiveClass(classId: string): Promise<void>;
  regenerateJoinCode(classId: string): Promise<string>;
  updateStudentAccessEnabled(classId: string, enabled: boolean): Promise<void>;

  getStudents(classId: string): Promise<DbStudent[]>;
  addStudent(classId: string, input: { display_name: string }): Promise<DbStudent>;
  updateStudent(studentId: string, input: { display_name?: string; is_active?: boolean }): Promise<void>;
  deleteStudent(studentId: string): Promise<void>;
  updateStudentAccess(studentId: string, enabled: boolean): Promise<void>;
  generateStudentPin(studentId: string): Promise<string>;
  resetStudentDevice(studentId: string): Promise<void>;

  joinClassAsStudent(classCode: string, pin: string): Promise<{ student_id: string; class_id: string }>;

  getActiveMeeting(classId: string): Promise<Meeting | null>;
  getStudentDashboard(studentId: string): Promise<{ student: DbStudent; classroom: Classroom; activeMeeting: Meeting | null; lives_remaining: number; rank: number } | null>;
  getStudentProfile(studentId: string): Promise<StudentWithCurrentState | null>;
  getLeaderboard(classId: string): Promise<LeaderboardEntry[]>;

  addPoints(classId: string, studentId: string, points: number, reason?: string): Promise<void>;
  removePoints(classId: string, studentId: string, points: number, reason?: string): Promise<void>;
  removeLife(classId: string, studentId: string, reason?: string): Promise<void>;
  restoreLife(classId: string, studentId: string, reason?: string): Promise<void>;
  resetStudentLives(classId: string, studentId: string): Promise<void>;
  startNewMeeting(classId: string): Promise<void>;
  endMeeting(classId: string): Promise<void>;
  
  restoreDefaultMockData(): Promise<void>;
}
