import { ClassroomRepository } from "./classroomRepository";
import {
  Classroom,
  ClassroomDashboardData,
  DbStudent,
  LeaderboardEntry,
  Meeting,
  StudentWithCurrentState,
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
  }[];
  point_events: any[];
  life_events: any[];
}

const CURRENT_SCHEMA_VERSION = 1;

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
    students.push({
      id: sId,
      class_id: classId,
      display_name: name,
      avatar_key: null,
      total_points: points,
      is_active: true,
      student_auth_user_id: null,
      access_pin_hash: "1234", // Using cleartext '1234' for mock simplicity
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
        parsed.schema_version = parsed.schema_version || CURRENT_SCHEMA_VERSION;

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
      (s) => s.class_id === classId && s.is_active,
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
    return this.getDb().students.filter((s) => s.class_id === classId);
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
      access_pin_hash: "1234",
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
      const pin = Math.floor(1000 + Math.random() * 9000).toString();
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
    const db = this.getDb();
    const cls = db.classes.find(
      (c) =>
        c.join_code === classCode.toUpperCase() && c.student_access_enabled,
    );
    if (!cls) {
      throw new Error("The class code or PIN is incorrect.");
    }

    const student = db.students.find(
      (s) =>
        s.class_id === cls.id &&
        s.is_active &&
        s.access_enabled &&
        s.access_pin_hash === pin,
    );
    if (!student) {
      throw new Error("The class code or PIN is incorrect.");
    }

    // Since mock mode doesn't really have auth, we simulate a logged-in device
    const mockUserId = "mock-device-" + Date.now();
    student.student_auth_user_id = mockUserId;
    student.access_activated_at = new Date().toISOString();

    this.saveDb(db);
    return { student_id: student.id, class_id: cls.id };
  }

  async getStudentDashboard(
    studentId: string,
  ): Promise<{
    student: DbStudent;
    classroom: Classroom;
    activeMeeting: Meeting | null;
    lives_remaining: number;
    rank: number;
  } | null> {
    const db = this.getDb();
    const student = db.students.find((s) => s.id === studentId);
    if (!student || !student.access_enabled) return null;

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

    return {
      student,
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

    return { ...student, lives_remaining };
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
  ): Promise<void> {
    const db = this.getDb();
    const student = db.students.find(
      (s) => s.id === studentId && s.class_id === classId,
    );
    if (student) {
      student.total_points += points;
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async removePoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<void> {
    const db = this.getDb();
    const student = db.students.find(
      (s) => s.id === studentId && s.class_id === classId,
    );
    if (student) {
      student.total_points = Math.max(0, student.total_points - points);
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async removeLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<void> {
    const db = this.getDb();
    const meeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (meeting) {
      const state = db.student_meeting_states.find(
        (st) => st.meeting_id === meeting.id && st.student_id === studentId,
      );
      if (state && state.lives_remaining > 0) {
        state.lives_remaining -= 1;
        this.saveDb(db);
        notifyMockUpdate(classId);
      }
    }
  }

  async restoreLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<void> {
    const db = this.getDb();
    const meeting = db.meetings.find(
      (m) => m.class_id === classId && m.status === "active",
    );
    if (meeting) {
      const state = db.student_meeting_states.find(
        (st) => st.meeting_id === meeting.id && st.student_id === studentId,
      );
      if (state && state.lives_remaining < meeting.max_lives_snapshot) {
        state.lives_remaining += 1;
        this.saveDb(db);
        notifyMockUpdate(classId);
      }
    }
  }

  async resetStudentLives(classId: string, studentId: string): Promise<void> {
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
      }
    }
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
      oldMeeting.status = "completed";
      oldMeeting.ended_at = new Date().toISOString();
      this.saveDb(db);
      notifyMockUpdate(classId);
    }
  }

  async restoreDefaultMockData(): Promise<void> {
    localStorage.removeItem(MOCK_STORAGE_KEY);
    this.getDb();
  }
}
