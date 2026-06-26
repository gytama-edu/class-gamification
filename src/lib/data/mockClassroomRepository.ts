import {
  ClassroomRepository,
  CreateClassInput,
  UpdateClassInput
} from "./classroomRepository";
import {
  Classroom,
  ClassroomDashboardData,
  DbStudent,
  LeaderboardEntry,
  Meeting,
  StudentWithCurrentState,
  MeetingHistoryItem,
  MeetingReport,
  AchievementDefinition,
  StudentAchievement,
  TeacherRecognitionInput,
  ClassType,
  ClassTask, TaskWithSummary, TaskAssignment, TaskAssignmentWithStudent,
  StudentTask, CreateTaskInput, UpdateTaskInput, TaskReviewResult, TaskStatus,
  ProjectGroupWithMembers, ProjectGroupSummary, CreateProjectGroupInput,
  UpdateProjectGroupInput, ProjectGroupDistribution, ProjectGroupDistributionResult,
  MyProjectGroup, ProjectGroupMember, CreateProjectGroupBatchItem, CreateProjectGroupsBatchResult,
  PrepareGroupUploadInput, PrepareGroupUploadResult, TaskProjectGroupSubmissionFile, GroupSubmissionWithFiles
} from "../types/database";
import { notifyMockUpdate } from "../realtime/useClassroomRealtime";

const MOCK_STORAGE_KEY = "gytama_edu_mock_db";

interface MockDB {
  schema_version: number;
  classes: Classroom[];
  students: DbStudent[];
  meetings: Meeting[];
  student_meeting_states: {
    id: string;
    meeting_id: string;
    student_id: string;
    lives_remaining: number;
    student_name_snapshot?: string;
    points_before?: number;
    points_after?: number;
    final_rank?: number;
  }[];
  point_events: any[];
  life_events: any[];
  student_achievements: StudentAchievement[];
  tasks: ClassTask[];
  task_assignments: TaskAssignment[];
  project_groups: any[];
  project_group_memberships: any[];
}

const CURRENT_SCHEMA_VERSION = 5;

function generateId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 15);
}

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getInitialMockDB(): MockDB {
  const class1Id = generateId();
  const class2Id = generateId();
  const class3Id = generateId();

  const c1: Classroom = {
    id: class1Id,
    owner_id: "mock-teacher-id",
    name: "Galaxy Explorers",
    level_name: "Grade 5",
    max_lives: 10,
    class_type: "regular",
    current_meeting_number: 1,
    is_archived: false,
    join_code: "GALAXY",
    student_access_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const c2: Classroom = {
    id: class2Id,
    owner_id: "mock-teacher-id",
    name: "Comet Crew",
    level_name: "Teen Class",
    max_lives: 15,
    class_type: "regular",
    current_meeting_number: 1,
    is_archived: false,
    join_code: "COMETS",
    student_access_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const c3: Classroom = {
    id: class3Id,
    owner_id: "mock-teacher-id",
    name: "Orion Academy",
    level_name: "IELTS Preparation",
    max_lives: 8,
    class_type: "private",
    current_meeting_number: 1,
    is_archived: false,
    join_code: "ORION1",
    student_access_enabled: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const m1: Meeting = {
    id: generateId(),
    class_id: class1Id,
    meeting_number: 1,
    max_lives_snapshot: 10,
    status: "active",
    started_at: new Date().toISOString(),
    ended_at: null,
    created_at: new Date().toISOString(),
  };
  const m2: Meeting = {
    id: generateId(),
    class_id: class2Id,
    meeting_number: 1,
    max_lives_snapshot: 15,
    status: "active",
    started_at: new Date().toISOString(),
    ended_at: null,
    created_at: new Date().toISOString(),
  };
  const m3: Meeting = {
    id: generateId(),
    class_id: class3Id,
    meeting_number: 1,
    max_lives_snapshot: 8,
    status: "active",
    started_at: new Date().toISOString(),
    ended_at: null,
    created_at: new Date().toISOString(),
  };

  const students: DbStudent[] = [];
  const states: any[] = [];

  const addMockStudent = (
    classId: string,
    meetingId: string,
    name: string,
    points: number,
    lives: number,
  ) => {
    const sId = generateId();
    let pin;
    let isUnique = false;
    while (!isUnique) {
      pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      isUnique = !students.some(
        (s) => s.class_id === classId && s.access_pin_hash === pin,
      );
    }
    students.push({
      id: sId,
      class_id: classId,
      display_name: name,
      avatar_key: null,
      total_points: points,
      is_active: true,
      student_auth_user_id: null,
      access_pin_hash: pin, // Using cleartext for mock simplicity
      access_enabled: true,
      access_activated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    states.push({
      id: generateId(),
      meeting_id: meetingId,
      student_id: sId,
      lives_remaining: lives,
    });
  };

  addMockStudent(class1Id, m1.id, "Luna Starfall", 120, 10);
  addMockStudent(class1Id, m1.id, "Orion Blaze", 95, 10);
  addMockStudent(class1Id, m1.id, "Zara Comet", 150, 8);

  addMockStudent(class2Id, m2.id, "Alex Nova", 200, 15);
  addMockStudent(class2Id, m2.id, "Sam Eclipse", 180, 12);

  addMockStudent(class3Id, m3.id, "Jordan Rings", 50, 8);
  addMockStudent(class3Id, m3.id, "Taylor Mars", 75, 7);

  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    classes: [c1, c2, c3],
    students,
    meetings: [m1, m2, m3],
    student_meeting_states: states,
    point_events: [],
    life_events: [],
    student_achievements: [],
    tasks: [],
    task_assignments: [],
    project_groups: [],
    project_group_memberships: []
  };
}

export class MockClassroomRepository implements ClassroomRepository {
  private getDb(): MockDB {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);

        // Validate and migrate old single-class schema
        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed.classes)
        ) {
          console.warn(
            "Detected old or invalid schema in localStorage. Attempting migration or reset...",
          );

          if (parsed.className && Array.isArray(parsed.students)) {
            // It's the old single-class schema, migrate it
            console.info(
              "Migrating old single-class data to multi-class structure...",
            );
            const newDb = getInitialMockDB();

            // Clear out the dummy data and use the old data
            newDb.classes = [];
            newDb.students = [];
            newDb.meetings = [];
            newDb.student_meeting_states = [];

            const classId = generateId();
            newDb.classes.push({
              id: classId,
              owner_id: "mock-teacher-id",
              name: parsed.className || "Migrated Class",
              level_name: parsed.classLevel || "General",
              max_lives: parsed.maxLives || 10,
              class_type: "regular",
              current_meeting_number: parsed.meetingNumber || 1,
              is_archived: false,
              join_code: generateJoinCode(),
              student_access_enabled: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

            const meetingId = generateId();
            newDb.meetings.push({
              id: meetingId,
              class_id: classId,
              meeting_number: parsed.meetingNumber || 1,
              max_lives_snapshot: parsed.maxLives || 10,
              status: "active",
              started_at: new Date().toISOString(),
              ended_at: null,
              created_at: new Date().toISOString(),
            });

            parsed.students.forEach((s: any) => {
              const studentId = s.id || generateId();
              newDb.students.push({
                id: studentId,
                class_id: classId,
                display_name: s.name || "Unknown",
                avatar_key: null,
                total_points: s.totalPoints || 0,
                is_active: true,
                student_auth_user_id: null,
                access_pin_hash: null,
                access_enabled: true,
                access_activated_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });

              newDb.student_meeting_states.push({
                id: generateId(),
                meeting_id: meetingId,
                student_id: studentId,
                lives_remaining:
                  s.currentLives !== undefined
                    ? s.currentLives
                    : parsed.maxLives || 10,
              });
            });

            this.saveDb(newDb);
            return newDb;
          } else {
            console.warn(
              "Stored data is invalid or incompatible. Resetting to initial mock data.",
            );
            const init = getInitialMockDB();
            this.saveDb(init);
            return init;
          }
        }

        // Ensure all required arrays exist
        parsed.classes = Array.isArray(parsed.classes) ? parsed.classes : [];
        parsed.students = Array.isArray(parsed.students) ? parsed.students : [];
        parsed.meetings = Array.isArray(parsed.meetings) ? parsed.meetings : [];
        parsed.student_meeting_states = Array.isArray(
          parsed.student_meeting_states,
        )
          ? parsed.student_meeting_states
          : [];
        parsed.schema_version = parsed.schema_version || 1;

        if (parsed.schema_version < 2) {
          console.info(
            "Migrating to schema version 2 (Adding join_code and access_pin_hash)...",
          );
          parsed.classes.forEach((c: any) => {
            if (!c.join_code) {
              c.join_code = generateJoinCode();
            }
            if (c.student_access_enabled === undefined) {
              c.student_access_enabled = true;
            }
          });
          parsed.students.forEach((s: any) => {
            if (s.access_enabled === undefined) {
              s.access_enabled = true;
            }
            if (!s.access_pin_hash) {
              let pin;
              let isUnique = false;
              while (!isUnique) {
                pin = String(Math.floor(Math.random() * 10000)).padStart(
                  4,
                  "0",
                );
                isUnique = !parsed.students.some(
                  (other: any) =>
                    other.class_id === s.class_id &&
                    other.access_pin_hash === pin,
                );
              }
              s.access_pin_hash = pin;
            }
          });
          parsed.schema_version = 2;
          this.saveDb(parsed);
        }

        if (parsed.schema_version < 3) {
          console.info("Migrating to schema version 3 (Adding achievements)...");
          parsed.student_achievements = parsed.student_achievements || [];
          parsed.schema_version = 3;
          this.saveDb(parsed);
        }

        if (parsed.schema_version < 4) {
          console.info("Migrating to schema version 4 (Adding tasks)...");
          parsed.tasks = parsed.tasks || [];
          parsed.task_assignments = parsed.task_assignments || [];
          parsed.schema_version = 4;
          this.saveDb(parsed);
        }

        if (parsed.schema_version < 5) {
          console.info("Migrating to schema version 5 (Adding project groups)...");
          parsed.project_groups = parsed.project_groups || [];
          parsed.project_group_memberships = parsed.project_group_memberships || [];
          parsed.schema_version = 5;
          this.saveDb(parsed);
        }

        // It's the new schema
        return parsed as MockDB;
      } catch (e) {
        console.error("Failed to parse mock DB", e);
        console.warn("Resetting to initial mock data due to parse error.");
      }
    }
    const init = getInitialMockDB();
    this.saveDb(init);
    return init;
  }

  private saveDb(db: MockDB) {
    localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(db));
  }

  async getClasses(): Promise<Classroom[]> {
    return this.getDb()
      .classes.filter((c) => !c.is_archived)
      .map((c) => ({
        ...c,
        class_type: (c.class_type === "private" ? "private" : "regular") as ClassType,
      }));
  }

  async getClassroomDashboard(
    classId: string,
  ): Promise<ClassroomDashboardData> {
    const db = this.getDb();
    const rawClassroom = db.classes.find((c) => c.id === classId);
    if (!rawClassroom) throw new Error("Class not found");
    const classroom = {
      ...rawClassroom,
      class_type: (rawClassroom.class_type === "private" ? "private" : "regular") as ClassType,
    };

    const latestMeeting =
      db.meetings
        .filter((m) => m.class_id === classId)
        .sort((a, b) => b.meeting_number - a.meeting_number)[0] || null;

    const activeMeeting =
      latestMeeting?.status === "active" ? latestMeeting : null;
    const classStudents = db.students.filter(
      (s) => s.class_id === classId && s.is_active && !s.deleted_at,
    );

    const studentsWithState: StudentWithCurrentState[] = classStudents.map(
      (s) => {
        let lives_remaining = classroom.max_lives;
        if (latestMeeting) {
          const state = db.student_meeting_states.find(
            (st) =>
              st.student_id === s.id && st.meeting_id === latestMeeting.id,
          );
          if (state) lives_remaining = state.lives_remaining;
        }
        return { ...s, lives_remaining };
      },
    );

    return { classroom, activeMeeting, students: studentsWithState };
  }

  async createClass(input: CreateClassInput): Promise<Classroom> {
    const db = this.getDb();
    const newClass: Classroom = {
      id: generateId(),
      owner_id: "mock-teacher-id",
      name: input.name,
      level_name: input.level_name,
      max_lives: input.max_lives,
      class_type: input.class_type ?? "regular",
      current_meeting_number: 0,
      is_archived: false,
      join_code: generateJoinCode(),
      student_access_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.classes.push(newClass);
    this.saveDb(db);
    return newClass;
  }

  async updateClass(
    classId: string,
    input: UpdateClassInput,
  ): Promise<void> {
    const db = this.getDb();
    const idx = db.classes.findIndex((c) => c.id === classId);
    if (idx !== -1) {
      db.classes[idx] = {
        ...db.classes[idx],
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.level_name !== undefined ? { level_name: input.level_name } : {}),
        ...(input.max_lives !== undefined ? { max_lives: input.max_lives } : {}),
        ...(input.class_type !== undefined ? { class_type: input.class_type } : {}),
        updated_at: new Date().toISOString(),
      };
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async archiveClass(classId: string): Promise<void> {
    const db = this.getDb();
    const idx = db.classes.findIndex((c) => c.id === classId);
    if (idx !== -1) {
      db.classes[idx].is_archived = true;
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async regenerateJoinCode(classId: string): Promise<string> {
    const db = this.getDb();
    const idx = db.classes.findIndex((c) => c.id === classId);
    if (idx !== -1) {
      const code = generateJoinCode();
      db.classes[idx].join_code = code;
      this.saveDb(db);
      notifyMockUpdate(classId);
      return code;
    }
    throw new Error("Class not found");
  }

  async updateStudentAccessEnabled(
    classId: string,
    enabled: boolean,
  ): Promise<void> {
    const db = this.getDb();
    const idx = db.classes.findIndex((c) => c.id === classId);
    if (idx !== -1) {
      db.classes[idx].student_access_enabled = enabled;
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async getStudents(classId: string): Promise<DbStudent[]> {
    return this.getDb()
      .students.filter((s) => s.class_id === classId && !s.deleted_at)
      .map((s) => ({
        ...s,
        has_pin: !!s.access_pin_hash,
        access_pin_hash: null, // Don't expose hash just like Supabase
      }));
  }

  async addStudent(
    classId: string,
    input: { display_name: string },
  ): Promise<DbStudent> {
    const db = this.getDb();
    const sId = generateId();
    const newStudent: DbStudent = {
      id: sId,
      class_id: classId,
      display_name: input.display_name,
      avatar_key: null,
      total_points: 0,
      is_active: true,
      student_auth_user_id: null,
      access_pin_hash: null,
      access_enabled: true,
      access_activated_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    db.students.push(newStudent);

    const activeMeeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (activeMeeting) {
      db.student_meeting_states.push({
        id: generateId(),
        meeting_id: activeMeeting.id,
        student_id: sId,
        lives_remaining: activeMeeting.max_lives_snapshot,
      });
    }

    this.saveDb(db);
    notifyMockUpdate(classId);
    return newStudent;
  }

  async updateStudent(
    studentId: string,
    input: { display_name?: string; is_active?: boolean },
  ): Promise<void> {
    const db = this.getDb();
    const idx = db.students.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      db.students[idx] = {
        ...db.students[idx],
        ...input,
        updated_at: new Date().toISOString(),
      };
      this.saveDb(db);
      notifyMockUpdate(db.students[idx].class_id);
    }
  }

  async deleteStudent(studentId: string): Promise<void> {
    const db = this.getDb();
    const idx = db.students.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      db.students[idx] = {
        ...db.students[idx],
        deleted_at: new Date().toISOString(),
        is_active: false,
        access_enabled: false,
        student_auth_user_id: null,
      } as any;
      this.saveDb(db);
      notifyMockUpdate(db.students[idx].class_id);
    }
  }

  async updateStudentAccess(
    studentId: string,
    enabled: boolean,
  ): Promise<void> {
    const db = this.getDb();
    const idx = db.students.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      db.students[idx].access_enabled = enabled;
      this.saveDb(db);
      notifyMockUpdate(db.students[idx].class_id);
    }
  }

  async generateStudentPin(studentId: string): Promise<string> {
    const db = this.getDb();
    const idx = db.students.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      const classId = db.students[idx].class_id;
      let pin;
      let isUnique = false;
      while (!isUnique) {
        pin = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        isUnique = !db.students.some(
          (s) => s.class_id === classId && s.access_pin_hash === pin,
        );
      }
      db.students[idx].access_pin_hash = pin; // Mock stores cleartext for simplicity
      this.saveDb(db);
      notifyMockUpdate(db.students[idx].class_id);
      return pin;
    }
    throw new Error("Student not found");
  }

  async resetStudentDevice(studentId: string): Promise<void> {
    const db = this.getDb();
    const idx = db.students.findIndex((s) => s.id === studentId);
    if (idx !== -1) {
      db.students[idx].student_auth_user_id = null;
      db.students[idx].access_activated_at = null;
      this.saveDb(db);
      notifyMockUpdate(db.students[idx].class_id);
    }
  }

  async joinClassAsStudent(
    classCode: string,
    pin: string,
  ): Promise<{ student_id: string; class_id: string }> {
    const normalizedCode = classCode.trim().toUpperCase();
    const normalizedPin = pin.trim();

    const db = this.getDb();
    const cls = db.classes.find(
      (c) => c.join_code === normalizedCode && c.student_access_enabled,
    );
    if (!cls) {
      console.warn(
        `Join failed: Class not found or disabled for code ${normalizedCode}`,
      );
      throw new Error("The class code or PIN is incorrect.");
    }

    const student = db.students.find(
      (s) =>
        s.class_id === cls.id &&
        s.is_active &&
        s.access_enabled &&
        s.access_pin_hash === normalizedPin,
    );
    if (!student) {
      console.warn(
        `Join failed: Student not found or disabled for class ${cls.id} with pin ${normalizedPin}`,
      );
      throw new Error("The class code or PIN is incorrect.");
    }

    // Since mock mode doesn't really have auth, we simulate a logged-in device
    const mockUserId = "mock-device-" + Date.now();
    student.student_auth_user_id = mockUserId;
    student.access_activated_at = new Date().toISOString();

    this.saveDb(db);
    localStorage.setItem('gytama_student_id', student.id);
    return { student_id: student.id, class_id: cls.id };
  }

  async getMyStudentSession(): Promise<any> {
    const studentId = localStorage.getItem('gytama_student_id');
    if (!studentId) return null;
    const db = this.getDb();
    const student = db.students.find((s: any) => s.id === studentId);
    if (!student || !student.is_active || !student.access_enabled || student.deleted_at) return null;
    const cls = db.classes.find((c: any) => c.id === student.class_id);
    if (!cls || !cls.student_access_enabled || cls.is_archived) return null;
    
    return {
      student_id: student.id,
      class_id: cls.id,
      display_name: student.display_name,
      class_name: cls.name,
      class_level: cls.level_name,
      class_type: cls.class_type,
      access_valid: true
    };
  }

  async releaseMyStudentSession(): Promise<void> {
    localStorage.removeItem('gytama_student_id');
    sessionStorage.removeItem('gytama_student_id');
  }

  async getMyStudentDashboard(): Promise<any> {
    const studentId = localStorage.getItem('gytama_student_id') || sessionStorage.getItem('gytama_student_id');
    if (!studentId) throw new Error("Not authenticated");
    const dash = await this.getStudentDashboard(studentId);
    if (!dash) throw new Error("Dashboard not found");
    
    // Convert to new shape
    return {
      student: {
        id: dash.student.id,
        class_id: dash.student.class_id,
        display_name: dash.student.display_name,
        avatar_key: dash.student.avatar_key,
        total_points: dash.student.total_points,
        is_active: dash.student.is_active
      },
      classroom: {
        id: dash.classroom.id,
        name: dash.classroom.name,
        level: dash.classroom.level_name,
        max_lives: dash.classroom.max_lives,
        current_meeting_number: dash.classroom.current_meeting_number,
        class_type: dash.classroom.class_type
      },
      current_meeting: dash.activeMeeting ? {
        id: dash.activeMeeting.id,
        meeting_number: dash.activeMeeting.meeting_number,
        status: dash.activeMeeting.status,
        start_time: dash.activeMeeting.started_at,
        max_lives_snapshot: dash.activeMeeting.max_lives_snapshot
      } : null,
      state: {
        lives_remaining: dash.lives_remaining,
        rank: dash.rank
      }
    };
  }

  async getStudentDashboard(studentId: string): Promise<{
    student: DbStudent;
    classroom: Classroom;
    activeMeeting: Meeting | null;
    lives_remaining: number;
    rank: number;
  } | null> {
    const db = this.getDb();
    const student = db.students.find((s) => s.id === studentId);
    if (!student || !student.access_enabled || student.deleted_at) return null;

    const classroom = db.classes.find((c) => c.id === student.class_id);
    if (!classroom) return null;

    const activeMeeting =
      db.meetings.find(
        (m) => m.class_id === classroom.id && m.status === "active",
      ) || null;

    let lives_remaining = 0;
    const latestMeeting =
      db.meetings
        .filter((m) => m.class_id === student.class_id)
        .sort((a, b) => b.meeting_number - a.meeting_number)[0] || null;

    if (latestMeeting) {
      const state = db.student_meeting_states.find(
        (st) =>
          st.student_id === studentId && st.meeting_id === latestMeeting.id,
      );
      if (state) lives_remaining = state.lives_remaining;
    }

    const classStudents = db.students.filter(
      (s) => s.class_id === classroom.id && s.is_active,
    );
    const sorted = [...classStudents].sort((a, b) => {
      if (b.total_points !== a.total_points) {
        return b.total_points - a.total_points;
      }
      return a.display_name.localeCompare(b.display_name);
    });

    const rank = sorted.findIndex((s) => s.id === studentId) + 1;

    const mappedStudent = {
      ...student,
      has_pin: !!student.access_pin_hash,
      access_pin_hash: null,
    };

    return {
      student: mappedStudent,
      classroom,
      activeMeeting,
      lives_remaining,
      rank,
    };
  }

  async getActiveMeeting(classId: string): Promise<Meeting | null> {
    const db = this.getDb();
    return (
      db.meetings.find(
        (m) => m.class_id === classId && m.status === "active",
      ) || null
    );
  }

  async getStudentProfile(
    studentId: string,
  ): Promise<StudentWithCurrentState | null> {
    const db = this.getDb();
    const student = db.students.find((s) => s.id === studentId);
    if (!student) return null;

    let lives_remaining = 0;
    const latestMeeting =
      db.meetings
        .filter((m) => m.class_id === student.class_id)
        .sort((a, b) => b.meeting_number - a.meeting_number)[0] || null;

    if (latestMeeting) {
      const state = db.student_meeting_states.find(
        (st) =>
          st.student_id === studentId && st.meeting_id === latestMeeting.id,
      );
      if (state) lives_remaining = state.lives_remaining;
    }

    const mappedStudent = {
      ...student,
      has_pin: !!student.access_pin_hash,
      access_pin_hash: null,
    };

    return { ...mappedStudent, lives_remaining };
  }

  async getLeaderboard(classId: string): Promise<LeaderboardEntry[]> {
    const dashboard = await this.getClassroomDashboard(classId);
    return dashboard.students
      .map((s) => ({
        id: s.id,
        display_name: s.display_name,
        total_points: s.total_points,
        lives_remaining: s.lives_remaining,
      }))
      .sort((a, b) => b.total_points - a.total_points);
  }

  async addPoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<number> {
    const db = this.getDb();
    const student = db.students.find(
      (s) => s.id === studentId && s.class_id === classId,
    );
    if (student) {
      student.total_points += points;
      this.saveDb(db);
      this.evaluateStudentAchievements(studentId); // evaluate asynchronously or immediately
      notifyMockUpdate(classId);
      return student.total_points;
    }
    return 0;
  }

  async removePoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<number> {
    const db = this.getDb();
    const student = db.students.find(
      (s) => s.id === studentId && s.class_id === classId,
    );
    if (student) {
      student.total_points = Math.max(0, student.total_points - points);
      this.saveDb(db);
      this.evaluateStudentAchievements(studentId);
      notifyMockUpdate(classId);
      return student.total_points;
    }
    return 0;
  }

  async removeLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<number> {
    const db = this.getDb();
    const meeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (meeting) {
      const state = db.student_meeting_states.find(
        (st) => st.meeting_id === meeting.id && st.student_id === studentId,
      );
      if (state) {
        if (state.lives_remaining > 0) {
          state.lives_remaining -= 1;
          this.saveDb(db);
          notifyMockUpdate(classId);
        }
        return state.lives_remaining;
      }
    }
    return 0;
  }

  async restoreLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<number> {
    const db = this.getDb();
    const meeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (meeting) {
      const state = db.student_meeting_states.find(
        (st) => st.meeting_id === meeting.id && st.student_id === studentId,
      );
      if (state) {
        if (state.lives_remaining < meeting.max_lives_snapshot) {
          state.lives_remaining += 1;
          this.saveDb(db);
          notifyMockUpdate(classId);
        }
        return state.lives_remaining;
      }
    }
    return 0;
  }

  async resetStudentLives(classId: string, studentId: string): Promise<number> {
    const db = this.getDb();
    const meeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (meeting) {
      const state = db.student_meeting_states.find(
        (st) => st.meeting_id === meeting.id && st.student_id === studentId,
      );
      if (state) {
        state.lives_remaining = meeting.max_lives_snapshot;
        this.saveDb(db);
        notifyMockUpdate(classId);
        return state.lives_remaining;
      }
    }
    return 0;
  }

  async startNewMeeting(classId: string): Promise<void> {
    const db = this.getDb();
    const classroom = db.classes.find((c) => c.id === classId);
    if (!classroom) return;

    const oldMeeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (oldMeeting) {
      oldMeeting.status = "completed";
      oldMeeting.ended_at = new Date().toISOString();
    }

    classroom.current_meeting_number += 1;
    classroom.updated_at = new Date().toISOString();

    const newMeetingId = generateId();
    db.meetings.push({
      id: newMeetingId,
      class_id: classId,
      meeting_number: classroom.current_meeting_number,
      max_lives_snapshot: classroom.max_lives,
      status: "active",
      started_at: new Date().toISOString(),
      ended_at: null,
      created_at: new Date().toISOString(),
    });

    const students = db.students.filter(
      (s) => s.class_id === classId && s.is_active,
    );
    for (const student of students) {
      db.student_meeting_states.push({
        id: generateId(),
        meeting_id: newMeetingId,
        student_id: student.id,
        lives_remaining: classroom.max_lives,
      });
    }

    this.saveDb(db);
    notifyMockUpdate(classId);
  }

  async endMeeting(classId: string): Promise<void> {
    const db = this.getDb();
    const classroom = db.classes.find((c) => c.id === classId);
    if (!classroom) return;

    const oldMeeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (oldMeeting) {
      // Ensure all participants have a state
      const pointEvents = db.point_events.filter(pe => pe.meeting_id === oldMeeting.id);
      const lifeEvents = db.life_events.filter(le => le.meeting_id === oldMeeting.id);
      
      for (const pe of pointEvents) {
        if (!db.student_meeting_states.find(sms => sms.meeting_id === oldMeeting.id && sms.student_id === pe.student_id)) {
          db.student_meeting_states.push({
            id: generateId(),
            meeting_id: oldMeeting.id,
            student_id: pe.student_id,
            lives_remaining: classroom.max_lives,
          });
        }
      }
      for (const le of lifeEvents) {
        if (!db.student_meeting_states.find(sms => sms.meeting_id === oldMeeting.id && sms.student_id === le.student_id)) {
          db.student_meeting_states.push({
            id: generateId(),
            meeting_id: oldMeeting.id,
            student_id: le.student_id,
            lives_remaining: classroom.max_lives,
          });
        }
      }

      const states = db.student_meeting_states.filter(sms => sms.meeting_id === oldMeeting.id);
      for (const state of states) {
        const student = db.students.find(s => s.id === state.student_id);
        if (student) {
          state.student_name_snapshot = student.display_name;
          state.points_after = student.total_points;
          const earned = pointEvents.filter(pe => pe.student_id === student.id).reduce((acc, pe) => acc + pe.points_delta, 0);
          state.points_before = student.total_points - earned;
        }
      }

      // Rank
      const sortedStates = [...states].sort((a, b) => {
        if ((b.points_after || 0) !== (a.points_after || 0)) {
          return (b.points_after || 0) - (a.points_after || 0);
        }
        if ((a.student_name_snapshot || '') !== (b.student_name_snapshot || '')) {
          return (a.student_name_snapshot || '').localeCompare(b.student_name_snapshot || '');
        }
        return a.student_id.localeCompare(b.student_id);
      });

      let rank = 1;
      let prevPoints: number | null = null;
      let prevName: string | null = null;
      for (let i = 0; i < sortedStates.length; i++) {
        const s = sortedStates[i];
        if (prevPoints !== null && (s.points_after !== prevPoints || s.student_name_snapshot !== prevName)) {
           // We're doing strict ranking with tie breakers so there shouldn't be ties if id is included, but just to be safe.
        }
        s.final_rank = i + 1; // It's strict ranking basically.
        prevPoints = s.points_after || 0;
        prevName = s.student_name_snapshot || '';
      }

      oldMeeting.status = "completed";
      oldMeeting.ended_at = new Date().toISOString();
      oldMeeting.class_name_snapshot = classroom.name;
      oldMeeting.level_name_snapshot = classroom.level_name;
      
      this.saveDb(db);
      
      try {
        await this.evaluateClassAchievements(classId);
      } catch (err) {
        console.error("Failed to evaluate achievements in mock mode", err);
      }
      
      notifyMockUpdate(classId);
    }
  }

  async getMeetingHistory(classId: string): Promise<MeetingHistoryItem[]> {
    const db = this.getDb();
    const meetings = db.meetings
      .filter((m) => m.class_id === classId && m.status === "completed")
      .sort((a, b) => b.meeting_number - a.meeting_number);

    return meetings.map((m) => {
      const states = db.student_meeting_states.filter((sms) => sms.meeting_id === m.id);
      const points = db.point_events.filter((pe) => pe.meeting_id === m.id);
      const lives = db.life_events.filter((le) => le.meeting_id === m.id);

      const points_awarded = points.filter(p => p.points_delta > 0).reduce((acc, p) => acc + p.points_delta, 0);
      const points_deducted = Math.abs(points.filter(p => p.points_delta < 0).reduce((acc, p) => acc + p.points_delta, 0));
      const net_points = points.reduce((acc, p) => acc + p.points_delta, 0);
      const lives_lost = Math.abs(lives.filter(l => l.lives_delta < 0).reduce((acc, l) => acc + l.lives_delta, 0));
      const lives_restored = lives.filter(l => l.lives_delta > 0).reduce((acc, l) => acc + l.lives_delta, 0);

      return {
        id: m.id,
        meeting_number: m.meeting_number,
        status: m.status,
        started_at: m.started_at,
        ended_at: m.ended_at,
        participant_count: states.length,
        points_awarded,
        points_deducted,
        net_points,
        lives_lost,
        lives_restored
      };
    });
  }

  async getMeetingReport(
    classId: string,
    meetingId: string,
  ): Promise<MeetingReport | null> {
    const db = this.getDb();
    const meeting = db.meetings.find(m => m.id === meetingId && m.class_id === classId);
    if (!meeting) return null;
    const cls = db.classes.find(c => c.id === classId);

    const states = db.student_meeting_states.filter((sms) => sms.meeting_id === meeting.id);
    const points = db.point_events.filter((pe) => pe.meeting_id === meeting.id);
    const lives = db.life_events.filter((le) => le.meeting_id === meeting.id);

    const points_awarded = points.filter(p => p.points_delta > 0).reduce((acc, p) => acc + p.points_delta, 0);
    const points_deducted = Math.abs(points.filter(p => p.points_delta < 0).reduce((acc, p) => acc + p.points_delta, 0));
    const net_points = points.reduce((acc, p) => acc + p.points_delta, 0);
    const lives_lost = Math.abs(lives.filter(l => l.lives_delta < 0).reduce((acc, l) => acc + l.lives_delta, 0));
    const lives_restored = lives.filter(l => l.lives_delta > 0).reduce((acc, l) => acc + l.lives_delta, 0);

    const students = states.map(sms => {
      const student = db.students.find(s => s.id === sms.student_id);
      const sPoints = points.filter(p => p.student_id === sms.student_id);
      const sLives = lives.filter(l => l.student_id === sms.student_id);
      
      const s_points_earned = sPoints.filter(p => p.points_delta > 0).reduce((acc, p) => acc + p.points_delta, 0);
      const s_points_deducted = Math.abs(sPoints.filter(p => p.points_delta < 0).reduce((acc, p) => acc + p.points_delta, 0));
      const s_net_points = sPoints.reduce((acc, p) => acc + p.points_delta, 0);
      const s_lives_lost = Math.abs(sLives.filter(l => l.lives_delta < 0).reduce((acc, l) => acc + l.lives_delta, 0));
      const s_lives_restored = sLives.filter(l => l.lives_delta > 0).reduce((acc, l) => acc + l.lives_delta, 0);

      return {
        student_id: sms.student_id,
        student_name: sms.student_name_snapshot || student?.display_name || 'Unknown',
        final_rank: sms.final_rank || null,
        points_before: sms.points_before || 0,
        points_earned: s_points_earned,
        points_deducted: s_points_deducted,
        net_points: s_net_points,
        points_after: sms.points_after || 0,
        starting_lives: meeting.max_lives_snapshot,
        lives_lost: s_lives_lost,
        lives_restored: s_lives_restored,
        final_lives: sms.lives_remaining
      };
    }).sort((a, b) => {
      if (a.final_rank !== null && b.final_rank !== null) {
        return a.final_rank - b.final_rank;
      }
      return b.points_after - a.points_after;
    });

    return {
      meeting: {
        id: meeting.id,
        meeting_number: meeting.meeting_number,
        class_name_snapshot: meeting.class_name_snapshot || cls?.name || 'Unknown',
        level_name_snapshot: meeting.level_name_snapshot || cls?.level_name || 'Unknown',
        started_at: meeting.started_at,
        ended_at: meeting.ended_at || null,
        max_lives_snapshot: meeting.max_lives_snapshot,
        participant_count: states.length,
        points_awarded,
        points_deducted,
        net_points,
        lives_lost,
        lives_restored
      },
      students
    };
  }

  async getStudentAchievements(studentId: string): Promise<StudentAchievement[]> {
    const db = this.getDb();
    return db.student_achievements
      .filter((a) => a.student_id === studentId)
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime());
  }

  async getMyAchievements(): Promise<StudentAchievement[]> {
    const studentId = localStorage.getItem('gytama_student_id') || sessionStorage.getItem('gytama_student_id');
    if (!studentId) throw new Error("Not authenticated");
    return this.getStudentAchievements(studentId);
  }

  async getClassAchievementSummary(classId: string): Promise<{ student_id: string; achievement: StudentAchievement }[]> {
    const db = this.getDb();
    return db.student_achievements
      .filter((a) => a.class_id === classId)
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
      .map(a => ({ student_id: a.student_id, achievement: a }));
  }

  async evaluateStudentAchievements(studentId: string): Promise<void> {
    const db = this.getDb();
    const student = db.students.find(s => s.id === studentId);
    if (!student) return;

    let updated = false;

    const award = (key: string, name: string, desc: string, category: string, tier: string, icon: string) => {
      const hasIt = db.student_achievements.some(a => a.student_id === studentId && a.achievement_key_snapshot === key);
      if (!hasIt) {
        db.student_achievements.push({
          id: generateId(),
          class_id: student.class_id,
          student_id: student.id,
          achievement_definition_id: generateId(),
          achievement_key_snapshot: key,
          achievement_name_snapshot: name,
          achievement_description_snapshot: desc,
          category_snapshot: category,
          tier_snapshot: tier,
          icon_key_snapshot: icon,
          source_type: 'automatic',
          source_meeting_id: null,
          awarded_by: null,
          reason: null,
          earned_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });
        updated = true;
      }
    };

    if (student.total_points > 0) award('first_point', 'First Signal', 'Earn your first Mission Point.', 'Points', 'Bronze', 'radio');
    if (student.total_points >= 50) award('points_50', 'Momentum Builder', 'Reach 50 Mission Points.', 'Points', 'Silver', 'zap');
    if (student.total_points >= 100) award('points_100', 'Century Operator', 'Reach 100 Mission Points.', 'Points', 'Silver', 'star');
    if (student.total_points >= 250) award('points_250', 'Command Specialist', 'Reach 250 Mission Points.', 'Points', 'Gold', 'award');
    if (student.total_points >= 500) award('points_500', 'Mission Veteran', 'Reach 500 Mission Points.', 'Points', 'Platinum', 'crown');

    const completedStates = db.student_meeting_states.filter(sms => sms.student_id === studentId && db.meetings.find(m => m.id === sms.meeting_id && m.status === 'completed'));
    const meetingCount = completedStates.length;
    
    if (meetingCount >= 1) award('first_meeting', 'First Deployment', 'Complete your first class meeting.', 'Participation', 'Bronze', 'flag');
    if (meetingCount >= 5) award('meetings_5', 'Reliable Crew', 'Participate in five completed meetings.', 'Participation', 'Silver', 'users');

    const firstPlaces = completedStates.filter(sms => sms.final_rank === 1).length;
    if (completedStates.some(sms => sms.final_rank && sms.final_rank <= 3)) award('first_top_three', 'Command Board Debut', 'Finish a meeting in the top three.', 'Ranking', 'Bronze', 'trending-up');
    if (firstPlaces >= 1) award('first_place', 'Mission Leader', 'Finish a meeting in first place.', 'Ranking', 'Silver', 'trophy');

    if (updated) {
      this.saveDb(db);
    }
  }

  async evaluateClassAchievements(classId: string): Promise<void> {
    const db = this.getDb();
    const students = db.students.filter(s => s.class_id === classId && s.is_active);
    for (const s of students) {
      await this.evaluateStudentAchievements(s.id);
    }
  }

  async awardTeacherRecognition(studentId: string, input: TeacherRecognitionInput): Promise<StudentAchievement> {
    const db = this.getDb();
    const student = db.students.find(s => s.id === studentId);
    if (!student) throw new Error("Student not found");

    const achievement: StudentAchievement = {
      id: generateId(),
      class_id: student.class_id,
      student_id: studentId,
      achievement_definition_id: null,
      achievement_key_snapshot: 'teacher_recognition',
      achievement_name_snapshot: input.title,
      achievement_description_snapshot: 'Receive special recognition from your teacher.',
      category_snapshot: 'Special',
      tier_snapshot: 'Special',
      icon_key_snapshot: input.iconKey,
      source_type: 'manual',
      source_meeting_id: null,
      awarded_by: 'mock-teacher-id',
      reason: input.reason || null,
      earned_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    db.student_achievements.push(achievement);
    this.saveDb(db);
    return achievement;
  }

  async restoreDefaultMockData(): Promise<void> {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    this.getDb();
  }

  // Tasks

  async getClassTasks(classId: string): Promise<TaskWithSummary[]> {
    const db = this.getDb();
    const tasks = db.tasks.filter(t => t.class_id === classId).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return tasks.map(t => {
      const assignments = db.task_assignments.filter(a => a.task_id === t.id);
      let assigned = assignments.length;
      let submitted = 0;
      let approved = 0;
      let overdue = 0;
      const now = new Date().getTime();

      assignments.forEach(a => {
        if (a.status === 'submitted') submitted++;
        if (a.status === 'approved') approved++;
        if (t.status === 'active' && a.status !== 'approved' && t.due_at && now > new Date(t.due_at).getTime()) {
          overdue++;
        }
      });

      return {
        ...t,
        assigned_count: assigned,
        submitted_count: submitted,
        approved_count: approved,
        overdue_count: overdue
      };
    });
  }

  async getTask(taskId: string): Promise<ClassTask | null> {
    const db = this.getDb();
    return db.tasks.find(t => t.id === taskId) || null;
  }

  async createTask(classId: string, input: CreateTaskInput): Promise<string> {
    const db = this.getDb();
    const taskId = generateId();
    const now = new Date().toISOString();
    
    const task: ClassTask = {
      id: taskId,
      class_id: classId,
      created_by: 'mock-teacher-id',
      title: input.title,
      instructions: input.instructions || '',
      due_at: input.due_at || null,
      reward_points: input.reward_points || 0,
      assignment_scope: input.assignment_scope,
      status: input.publish_immediately ? 'active' : 'draft',
      published_at: input.publish_immediately ? now : null,
      completed_at: null,
      created_at: now,
      updated_at: now,
      allow_submission_text: input.allow_submission_text ?? true,
      allow_submission_files: input.allow_submission_files ?? false,
      require_submission_file: input.require_submission_file ?? false,
      allowed_submission_file_categories: input.allowed_submission_file_categories ?? ['document', 'image'],
      max_submission_files: input.max_submission_files ?? 5,
      max_submission_file_size_bytes: input.max_submission_file_size_bytes ?? 10485760,
      max_submission_total_size_bytes: input.max_submission_total_size_bytes ?? 31457280
    };
    
    db.tasks.push(task);
    
    const activeStudents = db.students.filter(s => s.class_id === classId && s.is_active);
    const targetStudents = input.assignment_scope === 'all_students' 
      ? activeStudents 
      : activeStudents.filter(s => input.student_ids.includes(s.id));
      
    targetStudents.forEach(s => {
      db.task_assignments.push({
        id: generateId(),
        task_id: taskId,
        class_id: classId,
        student_id: s.id,
        status: 'assigned',
        submission_text: null,
        submitted_at: null,
        teacher_feedback: null,
        reviewed_at: null,
        reviewed_by: null,
        points_awarded: 0,
        points_awarded_at: null,
        created_at: now,
        updated_at: now
      });
    });
    
    this.saveDb(db);
    return taskId;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    const db = this.getDb();
    const taskIndex = db.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found");
    
    const task = db.tasks[taskIndex];
    if (task.status === 'archived') throw new Error("Cannot edit archived tasks");
    
    if (input.reward_points !== task.reward_points) {
      const hasApproved = db.task_assignments.some(a => a.task_id === taskId && a.status === 'approved');
      if (hasApproved) throw new Error("Cannot change reward points after assignments are approved");
    }
    
    db.tasks[taskIndex] = {
      ...task,
      title: input.title,
      instructions: input.instructions,
      due_at: input.due_at,
      reward_points: input.reward_points,
      assignment_scope: input.assignment_scope,
      updated_at: new Date().toISOString()
    };
    
    if (task.status !== 'completed') {
      const activeStudents = db.students.filter(s => s.class_id === task.class_id && s.is_active);
      
      if (input.assignment_scope === 'all_students') {
        if (task.assignment_scope !== 'all_students' && task.status === 'active') {
          activeStudents.forEach(student => {
            const exists = db.task_assignments.some(a => a.task_id === taskId && a.student_id === student.id);
            if (!exists) {
              db.task_assignments.push({
                id: generateId(),
                task_id: taskId,
                class_id: task.class_id,
                student_id: student.id,
                status: 'assigned',
                submission_text: null,
                submitted_at: null,
                teacher_feedback: null,
                reviewed_at: null,
                reviewed_by: null,
                points_awarded: 0,
                points_awarded_at: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            }
          });
        }
      } else if (input.student_ids) {
        // Remove unselected that aren't submitted
        db.task_assignments = db.task_assignments.filter(a => {
          if (a.task_id !== taskId) return true;
          if (input.student_ids.includes(a.student_id)) return true;
          return a.status !== 'assigned' || a.submission_text !== null; // Keep if they've submitted
        });

        input.student_ids.forEach(studentId => {
          const student = activeStudents.find(s => s.id === studentId);
          if (!student) return;
          
          const exists = db.task_assignments.some(a => a.task_id === taskId && a.student_id === student.id);
          if (!exists) {
            db.task_assignments.push({
              id: generateId(),
              task_id: taskId,
              class_id: task.class_id,
              student_id: student.id,
              status: 'assigned',
              submission_text: null,
              submitted_at: null,
              teacher_feedback: null,
              reviewed_at: null,
              reviewed_by: null,
              points_awarded: 0,
              points_awarded_at: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        });
      }
    }
    
    this.saveDb(db);
  }

  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    const db = this.getDb();
    const taskIndex = db.tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) throw new Error("Task not found");
    
    const task = db.tasks[taskIndex];
    const now = new Date().toISOString();
    
    if (task.status === 'draft' && status === 'active') {
      task.status = 'active';
      task.published_at = now;
    } else if (task.status === 'active' && status === 'completed') {
      task.status = 'completed';
      task.completed_at = now;
    } else if (status === 'archived') {
      task.status = 'archived';
    } else {
      throw new Error("Invalid status transition");
    }
    
    task.updated_at = now;
    this.saveDb(db);
  }

  async getTaskAssignments(taskId: string): Promise<TaskAssignmentWithStudent[]> {
    const db = this.getDb();
    const assignments = db.task_assignments.filter(a => a.task_id === taskId);
    
    return assignments.map(a => {
      const student = db.students.find(s => s.id === a.student_id);
      return {
        ...a,
        student_name: student?.display_name || 'Unknown'
      };
    });
  }

  async submitTaskAssignment(assignmentId: string, submissionText?: string): Promise<void> {
    const db = this.getDb();
    const aIndex = db.task_assignments.findIndex(a => a.id === assignmentId);
    if (aIndex === -1) throw new Error("Assignment not found");
    
    const assignment = db.task_assignments[aIndex];
    const task = db.tasks.find(t => t.id === assignment.task_id);
    
    if (!task || task.status !== 'active') throw new Error("Task is not active");
    if (!['assigned', 'returned'].includes(assignment.status)) throw new Error("Cannot submit");
    
    const now = new Date().toISOString();
    db.task_assignments[aIndex] = {
      ...assignment,
      status: 'submitted',
      submission_text: submissionText || null,
      submitted_at: now,
      updated_at: now
    };
    
    this.saveDb(db);
  }

  async reviewTaskAssignment(assignmentId: string, action: 'approve' | 'return', feedback?: string): Promise<TaskReviewResult> {
    const db = this.getDb();
    const aIndex = db.task_assignments.findIndex(a => a.id === assignmentId);
    if (aIndex === -1) throw new Error("Assignment not found");
    
    const assignment = db.task_assignments[aIndex];
    const task = db.tasks.find(t => t.id === assignment.task_id);
    if (!task) throw new Error("Task not found");
    
    const student = db.students.find(s => s.id === assignment.student_id);
    if (!student) throw new Error("Student not found");
    
    const now = new Date().toISOString();
    
    if (action === 'approve') {
      if (assignment.status === 'approved') return { assignment, points_awarded: 0, student_new_total: student.total_points };
      
      student.total_points += task.reward_points;
      
      const newAssignment = {
        ...assignment,
        status: 'approved' as const,
        teacher_feedback: feedback || null,
        reviewed_at: now,
        reviewed_by: 'mock-teacher-id',
        points_awarded: task.reward_points,
        points_awarded_at: now,
        updated_at: now
      };
      db.task_assignments[aIndex] = newAssignment;
      
      if (task.reward_points > 0) {
        db.point_events.push({
           id: generateId(),
           class_id: assignment.class_id,
           student_id: assignment.student_id,
           task_assignment_id: assignmentId,
           points_delta: task.reward_points,
           reason: 'Task reward: ' + task.title,
           created_at: now
        });
      }
      
      this.saveDb(db);
      return { assignment: newAssignment, points_awarded: task.reward_points, student_new_total: student.total_points };
    } else {
      if (assignment.status === 'approved') throw new Error("Already approved");
      if (assignment.status !== 'submitted') throw new Error("Not submitted");
      
      const newAssignment = {
        ...assignment,
        status: 'returned' as const,
        teacher_feedback: feedback || null,
        reviewed_at: now,
        reviewed_by: 'mock-teacher-id',
        updated_at: now
      };
      db.task_assignments[aIndex] = newAssignment;
      
      this.saveDb(db);
      return { assignment: newAssignment, points_awarded: 0, student_new_total: student.total_points };
    }
  }

  async getStudentTasks(studentId: string): Promise<StudentTask[]> {
    const db = this.getDb();
    const assignments = db.task_assignments.filter(a => a.student_id === studentId);
    const taskIds = assignments.map(a => a.task_id);
    
    const tasks = db.tasks.filter(t => taskIds.includes(t.id) && ['active', 'completed'].includes(t.status));
    
    const now = new Date().getTime();
    
    return tasks.map(t => {
      const assignment = assignments.find(a => a.task_id === t.id)!;
      let overdue = false;
      if (t.status === 'active' && assignment.status !== 'approved' && t.due_at && now > new Date(t.due_at).getTime()) {
         overdue = true;
      }
      return {
        ...t,
        assignment,
        is_overdue: overdue
      };
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getProjectGroups(classId: string): Promise<{ groups: ProjectGroupWithMembers[], archivedGroups: ProjectGroupWithMembers[], summary: ProjectGroupSummary, unassignedStudents: DbStudent[] }> {
    const db = this.getDb();
    
    // Fetch active groups
    const groups = db.project_groups
      .filter((g: any) => g.class_id === classId && g.status === 'active')
      .sort((a: any, b: any) => a.display_order - b.display_order);
      
    // Fetch archived groups
    const archivedGroupsRaw = db.project_groups
      .filter((g: any) => g.class_id === classId && g.status === 'archived')
      .sort((a: any, b: any) => new Date(b.archived_at || 0).getTime() - new Date(a.archived_at || 0).getTime());
      
    // Fetch active students in the class
    const students = db.students
      .filter((s) => s.class_id === classId && s.is_active && !s.deleted_at);
      
    // Fetch active memberships
    const memberships = db.project_group_memberships
      .filter((m: any) => m.class_id === classId && !m.removed_at);
      
    // Group memberships by group
    const groupsWithMembers = groups.map((group: any) => {
      const groupMemberships = memberships.filter((m: any) => m.group_id === group.id);
      const members: ProjectGroupMember[] = groupMemberships.map((m: any) => {
        const student = students.find((s: any) => s.id === m.student_id);
        return {
          student_id: m.student_id,
          display_name: student ? student.display_name : 'Unknown Student'
        };
      }).sort((a: any, b: any) => a.display_name.localeCompare(b.display_name));
      
      return {
        ...group,
        members
      };
    });
    
    const archivedGroups = archivedGroupsRaw.map((group: any) => ({
      ...group,
      members: [] // Archived groups have no active members
    }));
    
    // Determine assigned and unassigned students
    const assignedStudentIds = new Set(memberships.map((m: any) => m.student_id));
    const unassignedStudents = students.filter((s: any) => !assignedStudentIds.has(s.id));
    
    const assignedCount = assignedStudentIds.size;
    const unassignedCount = unassignedStudents.length;
    const activeGroupsCount = groupsWithMembers.length;
    const averageGroupSize = activeGroupsCount > 0 ? (assignedCount / activeGroupsCount) : 0;
    
    const summary: ProjectGroupSummary = {
      active_groups_count: activeGroupsCount,
      assigned_students_count: assignedCount,
      unassigned_students_count: unassignedCount,
      average_group_size: averageGroupSize
    };
    
    return {
      groups: groupsWithMembers,
      archivedGroups,
      summary,
      unassignedStudents
    };
  }

  async createProjectGroup(classId: string, input: CreateProjectGroupInput): Promise<string> {
    const db = this.getDb();
    
    // Check name uniqueness among active groups
    const normalizedName = input.name.trim().toLowerCase();
    const existing = db.project_groups.find((g: any) => g.class_id === classId && g.status === 'active' && g.name.trim().toLowerCase() === normalizedName);
    if (existing) {
      throw new Error("A project group with this name already exists in the class.");
    }
    
    // Determine max display order
    const classGroups = db.project_groups.filter((g: any) => g.class_id === classId && g.status === 'active');
    const maxOrder = classGroups.reduce((max: number, g: any) => Math.max(max, g.display_order), -1);
    const nextOrder = maxOrder + 1;
    
    const newGroup = {
      id: generateId(),
      class_id: classId,
      created_by: 'mock-teacher-id',
      name: input.name.trim(),
      description: input.description.trim(),
      color_key: input.color_key,
      display_order: nextOrder,
      status: 'active' as const,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      archived_at: null
    };
    
    db.project_groups.push(newGroup);
    this.saveDb(db);
    notifyMockUpdate('project_groups');
    return newGroup.id;
  }

  async createProjectGroupsBatch(classId: string, groups: CreateProjectGroupBatchItem[]): Promise<CreateProjectGroupsBatchResult[]> {
    const db = this.getDb();
    
    if (groups.length === 0) throw new Error("Groups payload cannot be empty");
    if (groups.length > 20) throw new Error("The number of groups must be between 2 and 20.");
    
    const names = new Set<string>();
    for (const g of groups) {
      const normalized = g.name.trim().toLowerCase();
      if (normalized.length < 2 || normalized.length > 60) {
        throw new Error("Group name must be between 2 and 60 characters.");
      }
      if (names.has(normalized)) {
        throw new Error("Two generated groups have the same name.");
      }
      names.add(normalized);
    }
    
    for (const name of names) {
      const existing = db.project_groups.find((g: any) => g.class_id === classId && g.status === 'active' && g.name.trim().toLowerCase() === name);
      if (existing) {
        throw new Error("A group with this name already exists.");
      }
    }
    
    let maxOrder = db.project_groups.filter((g: any) => g.class_id === classId && g.status === 'active')
      .reduce((max: number, g: any) => Math.max(max, g.display_order), -1);
      
    const results: CreateProjectGroupsBatchResult[] = [];
    
    for (const g of groups) {
      maxOrder++;
      const newGroup = {
        id: generateId(),
        class_id: classId,
        created_by: 'mock-teacher-id',
        name: g.name.trim(),
        description: g.description.trim(),
        color_key: g.color_key,
        display_order: maxOrder,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null
      };
      db.project_groups.push(newGroup);
      results.push({ id: newGroup.id, name: newGroup.name, color_key: newGroup.color_key });
    }
    
    this.saveDb(db);
    notifyMockUpdate('project_groups');
    return results;
  }

  async createAndDistributeProjectGroups(classId: string, groups: CreateProjectGroupBatchItem[], distribution: ProjectGroupDistribution[]): Promise<void> {
    const db = this.getDb();
    const groupMap = new Map<string, string>();
    
    if (groups && groups.length > 0) {
      if (groups.length > 20) throw new Error("The number of groups must be between 2 and 20.");
      
      const names = new Set<string>();
      for (const g of groups) {
        const normalized = g.name.trim().toLowerCase();
        if (normalized.length < 2 || normalized.length > 60) {
          throw new Error("Group name must be between 2 and 60 characters.");
        }
        if (names.has(normalized)) {
          throw new Error("Two generated groups have the same name.");
        }
        names.add(normalized);
      }
      
      for (const name of names) {
        const existing = db.project_groups.find((g: any) => g.class_id === classId && g.status === 'active' && g.name.trim().toLowerCase() === name);
        if (existing) {
          throw new Error("A group with this name already exists.");
        }
      }
      
      let maxOrder = db.project_groups.filter((g: any) => g.class_id === classId && g.status === 'active')
        .reduce((max: number, g: any) => Math.max(max, g.display_order), -1);
        
      for (const g of groups) {
        maxOrder++;
        const newGroup = {
          id: generateId(),
          class_id: classId,
          created_by: 'mock-teacher-id',
          name: g.name.trim(),
          description: g.description.trim(),
          color_key: g.color_key,
          display_order: maxOrder,
          status: 'active' as const,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          archived_at: null
        };
        db.project_groups.push(newGroup);
        if (g.temp_id) {
          groupMap.set(g.temp_id, newGroup.id);
        }
      }
      this.saveDb(db);
    }
    
    const finalDistribution: ProjectGroupDistribution[] = distribution.map(d => ({
      groupId: groupMap.get(d.groupId) || d.groupId,
      studentIds: d.studentIds
    }));
    
    await this.applyProjectGroupDistribution(classId, finalDistribution);
  }

  async updateProjectGroup(groupId: string, input: UpdateProjectGroupInput): Promise<void> {
    const db = this.getDb();
    const groupIndex = db.project_groups.findIndex((g: any) => g.id === groupId);
    if (groupIndex === -1) throw new Error("Group not found");
    
    const group = db.project_groups[groupIndex];
    if (group.status === 'archived') throw new Error("Cannot edit an archived project group");
    
    const normalizedName = input.name.trim().toLowerCase();
    const existing = db.project_groups.find((g: any) => g.id !== groupId && g.class_id === group.class_id && g.status === 'active' && g.name.trim().toLowerCase() === normalizedName);
    if (existing) {
      throw new Error("A project group with this name already exists in the class.");
    }
    
    db.project_groups[groupIndex] = {
      ...group,
      name: input.name.trim(),
      description: input.description.trim(),
      color_key: input.color_key,
      updated_at: new Date().toISOString()
    };
    
    this.saveDb(db);
    notifyMockUpdate('project_groups');
  }

  async archiveProjectGroup(groupId: string): Promise<void> {
    const db = this.getDb();
    const groupIndex = db.project_groups.findIndex((g: any) => g.id === groupId);
    if (groupIndex === -1) throw new Error("Group not found");
    
    const group = db.project_groups[groupIndex];
    if (group.status === 'archived') return;
    
    db.project_groups[groupIndex] = {
      ...group,
      status: 'archived' as const,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Close memberships
    let membershipsChanged = false;
    db.project_group_memberships.forEach((m: any) => {
      if (m.group_id === groupId && !m.removed_at) {
        m.removed_at = new Date().toISOString();
        m.removed_by = 'mock-teacher-id';
        m.removal_reason = 'group_archived';
        membershipsChanged = true;
      }
    });
    
    this.saveDb(db);
    notifyMockUpdate('project_groups');
    if (membershipsChanged) {
      notifyMockUpdate('project_group_memberships');
    }
  }

  async assignStudentToProjectGroup(groupId: string, studentId: string): Promise<void> {
    const db = this.getDb();
    const group = db.project_groups.find((g: any) => g.id === groupId);
    if (!group) throw new Error("Group not found");
    
    const student = db.students.find(s => s.id === studentId);
    if (!student) throw new Error("Student not found");
    
    if (group.class_id !== student.class_id) throw new Error("Class mismatch");
    if (!student.is_active || student.deleted_at) throw new Error("Invalid student state");
    if (group.status === 'archived') throw new Error("Cannot assign to archived group");
    
    const existingActive = db.project_group_memberships.find((m: any) => m.student_id === studentId && !m.removed_at);
    if (existingActive) {
      if (existingActive.group_id === groupId) return;
      existingActive.removed_at = new Date().toISOString();
      existingActive.removed_by = 'mock-teacher-id';
      existingActive.removal_reason = 'moved';
    }
    
    const newMembership = {
      id: generateId(),
      group_id: groupId,
      class_id: group.class_id,
      student_id: studentId,
      assigned_by: 'mock-teacher-id',
      assigned_at: new Date().toISOString(),
      removed_at: null,
      removed_by: null,
      removal_reason: null
    };
    
    db.project_group_memberships.push(newMembership);
    
    this.saveDb(db);
    notifyMockUpdate('project_group_memberships');
  }

  async removeStudentFromProjectGroup(groupId: string, studentId: string): Promise<void> {
    const db = this.getDb();
    const membership = db.project_group_memberships.find((m: any) => m.group_id === groupId && m.student_id === studentId && !m.removed_at);
    
    if (membership) {
      membership.removed_at = new Date().toISOString();
      membership.removed_by = 'mock-teacher-id';
      membership.removal_reason = 'manual_removal';
      this.saveDb(db);
      notifyMockUpdate('project_group_memberships');
    }
  }

  async applyProjectGroupDistribution(classId: string, distribution: ProjectGroupDistribution[]): Promise<ProjectGroupDistributionResult> {
    const db = this.getDb();
    
    let groupsUpdated = 0;
    let studentsAssigned = 0;
    let studentsMoved = 0;
    
    // First, validate everything
    for (const g of distribution) {
      const group = db.project_groups.find((pg: any) => pg.id === g.groupId);
      if (!group || group.class_id !== classId || group.status !== 'active') {
        throw new Error("Invalid active project group");
      }
      
      for (const studentId of g.studentIds) {
        const student = db.students.find(s => s.id === studentId);
        if (!student || student.class_id !== classId || !student.is_active || student.deleted_at) {
          throw new Error("Invalid or inactive student " + studentId);
        }
      }
    }
    
    // Apply changes
    for (const g of distribution) {
      groupsUpdated++;
      for (const studentId of g.studentIds) {
        const existingActive = db.project_group_memberships.find((m: any) => m.student_id === studentId && !m.removed_at);
        if (existingActive) {
          if (existingActive.group_id !== g.groupId) {
            existingActive.removed_at = new Date().toISOString();
            existingActive.removed_by = 'mock-teacher-id';
            existingActive.removal_reason = 'distribution_moved';
            
            db.project_group_memberships.push({
              id: generateId(),
              group_id: g.groupId,
              class_id: classId,
              student_id: studentId,
              assigned_by: 'mock-teacher-id',
              assigned_at: new Date().toISOString(),
              removed_at: null,
              removed_by: null,
              removal_reason: null
            });
            studentsMoved++;
            studentsAssigned++;
          }
        } else {
          db.project_group_memberships.push({
            id: generateId(),
            group_id: g.groupId,
            class_id: classId,
            student_id: studentId,
            assigned_by: 'mock-teacher-id',
            assigned_at: new Date().toISOString(),
            removed_at: null,
            removed_by: null,
            removal_reason: null
          });
          studentsAssigned++;
        }
      }
    }
    
    this.saveDb(db);
    notifyMockUpdate('project_group_memberships');
    
    return {
      groupsUpdated,
      studentsAssigned,
      studentsMoved
    };
  }

  async getMyProjectGroup(): Promise<MyProjectGroup | null> {
    const db = this.getDb();
    
    // Find the current mock student
    const studentId = localStorage.getItem('gytama_student_id');
    let student;
    if (studentId) {
      student = db.students.find(s => s.id === studentId && s.is_active && !s.deleted_at);
    } else {
      student = db.students.find(s => s.is_active && s.access_enabled && !s.deleted_at);
    }
    
    if (!student) return null;
    
    const membership = db.project_group_memberships.find((m: any) => m.student_id === student.id && !m.removed_at);
    if (!membership) return null;
    
    const group = db.project_groups.find((g: any) => g.id === membership.group_id && g.status === 'active');
    if (!group) return null;
    
    // Get all active member names
    const allMemberships = db.project_group_memberships.filter((m: any) => m.group_id === group.id && !m.removed_at);
    const member_names = allMemberships.map((m: any) => {
      const s = db.students.find(st => st.id === m.student_id);
      return s && s.is_active && !s.deleted_at ? s.display_name : null;
    }).filter(Boolean).sort();
    
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      color_key: group.color_key,
      member_names
    };
  }

  // Project Group Tasks
  async createProjectGroupTask(classId: string, input: any): Promise<string> {
    console.warn("createProjectGroupTask not fully implemented in mock");
    return generateId();
  }

  async updateProjectGroupTask(taskId: string, input: any): Promise<void> {
    console.warn("updateProjectGroupTask not fully implemented in mock");
  }

  async setProjectGroupTaskStatus(taskId: string, status: any): Promise<void> {
    console.warn("setProjectGroupTaskStatus not fully implemented in mock");
  }

  async getTaskProjectGroupAssignments(taskId: string): Promise<any[]> {
    console.warn("getTaskProjectGroupAssignments not fully implemented in mock");
    return [];
  }

  async submitProjectGroupTask(groupAssignmentId: string, submissionText?: string): Promise<void> {
    console.warn("submitProjectGroupTask not fully implemented in mock");
  }

  async reviewProjectGroupTask(groupAssignmentId: string, action: 'approve' | 'return', feedback?: string): Promise<any> {
    console.warn("reviewProjectGroupTask not fully implemented in mock");
    return {
      id: groupAssignmentId,
      status: action === 'approve' ? 'approved' : 'returned',
      points_per_member_awarded: 0,
      member_count: 0,
      total_distributed: 0,
      group_name_snapshot: 'Mock Group',
      reviewed_at: new Date().toISOString(),
      member_results: []
    };
  }

  async getMyProjectGroupTasks(): Promise<any[]> {
    console.warn("getMyProjectGroupTasks not fully implemented in mock");
    return [];
  }

  // Group Task Submissions
  async prepareGroupSubmissionUpload(input: PrepareGroupUploadInput): Promise<PrepareGroupUploadResult> {
    console.warn("prepareGroupSubmissionUpload not fully implemented in mock");
    return {
      attachment_id: crypto.randomUUID(),
      storage_bucket: 'group-task-submissions',
      storage_path: 'mock/path/' + input.original_filename,
      allowed_size: 10485760,
      attempt_id: crypto.randomUUID()
    };
  }

  async uploadGroupSubmissionFile(bucket: string, path: string, file: File): Promise<void> {
    console.warn("uploadGroupSubmissionFile not fully implemented in mock");
  }

  async finalizeGroupSubmissionUpload(attachmentId: string): Promise<TaskProjectGroupSubmissionFile> {
    console.warn("finalizeGroupSubmissionUpload not fully implemented in mock");
    return {
      id: attachmentId,
      submission_attempt_id: crypto.randomUUID(),
      group_assignment_id: crypto.randomUUID(),
      task_id: crypto.randomUUID(),
      class_id: crypto.randomUUID(),
      uploaded_by_student_id: crypto.randomUUID(),
      uploaded_by_name_snapshot: 'Mock Student',
      original_file_name: 'mock_file.pdf',
      safe_file_name: 'mock_file.pdf',
      storage_bucket: 'group-task-submissions',
      storage_path: 'mock/path/mock_file.pdf',
      mime_type: 'application/pdf',
      file_extension: 'pdf',
      file_size_bytes: 1024,
      file_category: 'document',
      upload_status: 'ready',
      created_at: new Date().toISOString(),
      ready_at: new Date().toISOString(),
      deleted_at: null,
      deleted_by_student_id: null
    };
  }

  async removeGroupSubmissionFile(attachmentId: string): Promise<void> {
    console.warn("removeGroupSubmissionFile not fully implemented in mock");
  }

  async getGroupSubmissionAttempts(groupAssignmentId: string): Promise<GroupSubmissionWithFiles[]> {
    console.warn("getGroupSubmissionAttempts not fully implemented in mock");
    return [];
  }

  async getGroupSubmissionFileUrl(attachmentId: string): Promise<string> {
    console.warn("getGroupSubmissionFileUrl not fully implemented in mock");
    return "https://example.com/mock-file";
  }
}
