import { 
  Classroom, ClassroomDashboardData, DbStudent, LeaderboardEntry, 
  Meeting, StudentWithCurrentState, MeetingHistoryItem, MeetingReport,
  StudentAchievement, TeacherRecognitionInput, ClassType,
  ClassTask, TaskWithSummary, TaskAssignment, TaskAssignmentWithStudent,
  StudentTask, CreateTaskInput, UpdateTaskInput, TaskReviewResult, TaskStatus,
  ProjectGroupWithMembers, ProjectGroupSummary, CreateProjectGroupInput,
  UpdateProjectGroupInput, ProjectGroupDistribution, ProjectGroupDistributionResult,
  MyProjectGroup
} from '../types/database';

export interface CreateClassInput {
  name: string;
  level_name: string;
  max_lives: number;
  class_type?: ClassType;
}

export interface UpdateClassInput {
  name?: string;
  level_name?: string;
  max_lives?: number;
  class_type?: ClassType;
}

export interface ClassroomRepository {
  getClasses(): Promise<Classroom[]>;
  getClassroomDashboard(classId: string): Promise<ClassroomDashboardData>;
  createClass(input: CreateClassInput): Promise<Classroom>;
  updateClass(classId: string, input: UpdateClassInput): Promise<void>;
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

  addPoints(classId: string, studentId: string, points: number, reason?: string): Promise<number>;
  removePoints(classId: string, studentId: string, points: number, reason?: string): Promise<number>;
  removeLife(classId: string, studentId: string, reason?: string): Promise<number>;
  restoreLife(classId: string, studentId: string, reason?: string): Promise<number>;
  resetStudentLives(classId: string, studentId: string): Promise<number>;
  startNewMeeting(classId: string): Promise<void>;
  endMeeting(classId: string): Promise<void>;
  
  getMeetingHistory(classId: string): Promise<MeetingHistoryItem[]>;
  getMeetingReport(classId: string, meetingId: string): Promise<MeetingReport | null>;
  
  getStudentAchievements(studentId: string): Promise<StudentAchievement[]>;
  getClassAchievementSummary(classId: string): Promise<{ student_id: string; achievement: StudentAchievement }[]>;
  evaluateClassAchievements(classId: string): Promise<void>;
  awardTeacherRecognition(studentId: string, input: TeacherRecognitionInput): Promise<StudentAchievement>;
  
  restoreDefaultMockData(): Promise<void>;
  
  // Tasks
  getClassTasks(classId: string): Promise<TaskWithSummary[]>;
  getTask(taskId: string): Promise<ClassTask | null>;
  createTask(classId: string, input: CreateTaskInput): Promise<string>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<void>;
  setTaskStatus(taskId: string, status: TaskStatus): Promise<void>;
  getTaskAssignments(taskId: string): Promise<TaskAssignmentWithStudent[]>;
  submitTaskAssignment(assignmentId: string, submissionText?: string): Promise<void>;
  reviewTaskAssignment(assignmentId: string, action: 'approve' | 'return', feedback?: string): Promise<TaskReviewResult>;
  getStudentTasks(studentId: string): Promise<StudentTask[]>;

  // Project Groups
  getProjectGroups(classId: string): Promise<{ groups: ProjectGroupWithMembers[], archivedGroups: ProjectGroupWithMembers[], summary: ProjectGroupSummary, unassignedStudents: DbStudent[] }>;
  createProjectGroup(classId: string, input: CreateProjectGroupInput): Promise<string>;
  updateProjectGroup(groupId: string, input: UpdateProjectGroupInput): Promise<void>;
  archiveProjectGroup(groupId: string): Promise<void>;
  assignStudentToProjectGroup(groupId: string, studentId: string): Promise<void>;
  removeStudentFromProjectGroup(groupId: string, studentId: string): Promise<void>;
  applyProjectGroupDistribution(classId: string, distribution: ProjectGroupDistribution[]): Promise<ProjectGroupDistributionResult>;
  getMyProjectGroup(): Promise<MyProjectGroup | null>;
}
