import { ClassroomRepository } from "./classroomRepository";
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
  TeacherRecognitionInput
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
}

const CURRENT_SCHEMA_VERSION = 3;

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
    return this.getDb().classes.filter((c) => !c.is_archived);
  }

  async getClassroomDashboard(
    classId: string,
  ): Promise<ClassroomDashboardData> {
    const db = this.getDb();
    const classroom = db.classes.find((c) => c.id === classId);
    if (!classroom) throw new Error("Class not found");

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

  async createClass(input: {
    name: string;
    level_name: string;
    max_lives: number;
  }): Promise<Classroom> {
    const db = this.getDb();
    const newClass: Classroom = {
      id: generateId(),
      owner_id: "mock-teacher-id",
      name: input.name,
      level_name: input.level_name,
      max_lives: input.max_lives,
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
    input: { name?: string; level_name?: string; max_lives?: number },
  ): Promise<void> {
    const db = this.getDb();
    const idx = db.classes.findIndex((c) => c.id === classId);
    if (idx !== -1) {
      db.classes[idx] = {
        ...db.classes[idx],
        ...input,
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
    return { student_id: student.id, class_id: cls.id };
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
}
