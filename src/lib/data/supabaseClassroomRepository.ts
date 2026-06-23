import { ClassroomRepository } from "./classroomRepository";
import { supabase } from "../supabase/client";
import {
  Classroom,
  ClassroomDashboardData,
  DbStudent,
  LeaderboardEntry,
  Meeting,
  StudentWithCurrentState,
} from "../types/database";

export class SupabaseClassroomRepository implements ClassroomRepository {
  async getClasses(): Promise<Classroom[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from("classes")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getClassroomDashboard(
    classId: string,
  ): Promise<ClassroomDashboardData> {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data: classroom, error: classError } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();
    if (classError) throw classError;

    const { data: latestMeeting, error: meetingError } = await supabase
      .from("meetings")
      .select("*")
      .eq("class_id", classId)
      .order("meeting_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (meetingError) throw meetingError;

    const activeMeeting =
      latestMeeting?.status === "active" ? latestMeeting : null;

    let studentsWithStates: StudentWithCurrentState[] = [];
    if (latestMeeting) {
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(
          `
          *,
          student_meeting_states ( lives_remaining )
        `,
        )
        .eq("class_id", classId)
        .eq("is_active", true)
        .eq("student_meeting_states.meeting_id", latestMeeting.id);

      if (studentsError) throw studentsError;

      studentsWithStates = studentsData.map((s: any) => ({
        ...s,
        lives_remaining:
          s.student_meeting_states?.[0]?.lives_remaining ?? classroom.max_lives,
      }));
    } else {
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .eq("is_active", true);

      if (studentsError) throw studentsError;

      studentsWithStates = studentsData.map((s: any) => ({
        ...s,
        lives_remaining: classroom.max_lives,
      }));
    }

    return {
      classroom,
      activeMeeting,
      students: studentsWithStates,
    };
  }

  async createClass(input: {
    name: string;
    level_name: string;
    max_lives: number;
  }): Promise<Classroom> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("create_class", {
      p_name: input.name,
      p_level_name: input.level_name,
      p_max_lives: input.max_lives,
    });
    if (error) throw error;

    const { data: newClass, error: fetchErr } = await supabase
      .from("classes")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchErr) throw fetchErr;
    return newClass;
  }

  async updateClass(
    classId: string,
    input: { name?: string; level_name?: string; max_lives?: number },
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("update_class", {
      p_class_id: classId,
      p_name: input.name || null,
      p_level_name: input.level_name || null,
      p_max_lives: input.max_lives || null,
    });
    if (error) throw error;
  }

  async archiveClass(classId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("archive_class", {
      p_class_id: classId,
    });
    if (error) throw error;
  }

  async regenerateJoinCode(classId: string): Promise<string> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("regenerate_class_join_code", {
      p_class_id: classId,
    });
    if (error) throw error;
    return data;
  }

  async updateStudentAccessEnabled(
    classId: string,
    enabled: boolean,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase
      .from("classes")
      .update({ student_access_enabled: enabled })
      .eq("id", classId);
    if (error) throw error;
  }

  async getStudents(classId: string): Promise<DbStudent[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classId)
      .order("created_at");
    if (error) throw error;
    return data || [];
  }

  async addStudent(
    classId: string,
    input: { display_name: string },
  ): Promise<DbStudent> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("add_student", {
      p_class_id: classId,
      p_display_name: input.display_name,
    });
    if (error) throw error;

    const { data: student, error: fetchErr } = await supabase
      .from("students")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchErr) throw fetchErr;
    return student;
  }

  async updateStudent(
    studentId: string,
    input: { display_name?: string; is_active?: boolean },
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("update_student", {
      p_student_id: studentId,
      p_display_name: input.display_name || null,
      p_is_active: input.is_active !== undefined ? input.is_active : null,
    });
    if (error) throw error;
  }

  async updateStudentAccess(
    studentId: string,
    enabled: boolean,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase
      .from("students")
      .update({ access_enabled: enabled })
      .eq("id", studentId);
    if (error) throw error;
  }

  async generateStudentPin(studentId: string): Promise<string> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("generate_student_pin", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data;
  }

  async resetStudentDevice(studentId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("reset_student_device", {
      p_student_id: studentId,
    });
    if (error) throw error;
  }

  async joinClassAsStudent(
    classCode: string,
    pin: string,
  ): Promise<{ student_id: string; class_id: string }> {
    if (!supabase) throw new Error("Supabase not initialized");

    // Ensure we have an anonymous session
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
    }

    const { data, error } = await supabase.rpc("join_class_as_student", {
      p_class_code: classCode,
      p_student_pin: pin,
    });
    if (error) throw error;
    return data;
  }

  async getActiveMeeting(classId: string): Promise<Meeting | null> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from("meetings")
      .select("*")
      .eq("class_id", classId)
      .eq("status", "active")
      .maybeSingle();
    if (error) throw error;
    return data;
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
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("get_student_dashboard_data", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data;
  }

  async getStudentProfile(
    studentId: string,
  ): Promise<StudentWithCurrentState | null> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single();
    if (error) throw error;
    if (!student) return null;

    const { data: latestMeeting } = await supabase
      .from("meetings")
      .select("*")
      .eq("class_id", student.class_id)
      .order("meeting_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    let lives_remaining = 0;
    if (latestMeeting) {
      const { data: state } = await supabase
        .from("student_meeting_states")
        .select("lives_remaining")
        .eq("student_id", studentId)
        .eq("meeting_id", latestMeeting.id)
        .maybeSingle();
      lives_remaining = state?.lives_remaining ?? 0;
    }

    return {
      ...student,
      lives_remaining,
    };
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
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("award_points", {
      p_class_id: classId,
      p_student_id: studentId,
      p_points: points,
      p_reason: reason || null,
    });
    if (error) throw error;
  }

  async removePoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("remove_points", {
      p_class_id: classId,
      p_student_id: studentId,
      p_points: points,
      p_reason: reason || null,
    });
    if (error) throw error;
  }

  async removeLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("remove_life", {
      p_class_id: classId,
      p_student_id: studentId,
      p_reason: reason || null,
    });
    if (error) throw error;
  }

  async restoreLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("restore_life", {
      p_class_id: classId,
      p_student_id: studentId,
      p_reason: reason || null,
    });
    if (error) throw error;
  }

  async resetStudentLives(classId: string, studentId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("reset_student_lives", {
      p_class_id: classId,
      p_student_id: studentId,
    });
    if (error) throw error;
  }

  async startNewMeeting(classId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("start_new_meeting", {
      p_class_id: classId,
    });
    if (error) throw error;
  }

  async endMeeting(classId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("end_meeting", {
      p_class_id: classId,
    });
    if (error) throw error;
  }

  async restoreDefaultMockData(): Promise<void> {
    // Only applies to mock
  }
}
