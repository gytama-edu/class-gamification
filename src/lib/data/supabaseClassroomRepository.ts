import {
  ClassroomRepository,
  CreateClassInput,
  UpdateClassInput
} from "./classroomRepository";
import { supabase } from "../supabase/client";
import {
  Classroom,
  ClassroomDashboardData,
  DbStudent,
  LeaderboardEntry,
  Meeting,
  StudentWithCurrentState,
  MeetingHistoryItem,
  MeetingReport,
  StudentAchievement,
  TeacherRecognitionInput
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
    return (data || []).map((c: any) => ({
      ...c,
      class_type: c.class_type === 'private' ? 'private' : 'regular'
    }));
  }

  async getClassroomDashboard(
    classId: string,
  ): Promise<ClassroomDashboardData> {
    if (!supabase) throw new Error("Supabase client is not initialized.");

    const { data: rawClassroom, error: classError } = await supabase
      .from("classes")
      .select("*")
      .eq("id", classId)
      .single();
    if (classError) throw classError;
    
    const classroom = {
      ...rawClassroom,
      class_type: rawClassroom.class_type === 'private' ? 'private' : 'regular'
    } as Classroom;

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

    const { data: studentsData, error: studentsError } = await supabase
      .from("students")
      .select("*")
      .eq("class_id", classId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (studentsError) throw studentsError;

    if (activeMeeting) {
      const { data: statesData, error: statesError } = await supabase
        .from("student_meeting_states")
        .select("student_id, lives_remaining")
        .eq("meeting_id", activeMeeting.id);
      
      if (statesError) throw statesError;

      const stateMap = new Map();
      statesData.forEach(state => {
        stateMap.set(state.student_id, state.lives_remaining);
      });

      studentsWithStates = studentsData.map((s: any) => ({
        ...s,
        // If a state is missing during an active meeting, it's a data integrity issue.
        // It will be safely repaired on next mutation. Display the snapshot value.
        lives_remaining: stateMap.has(s.id) ? stateMap.get(s.id) : (activeMeeting.max_lives_snapshot ?? classroom.max_lives),
      }));
    } else {
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

  async createClass(input: CreateClassInput): Promise<Classroom> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("create_class", {
      p_name: input.name,
      p_level_name: input.level_name,
      p_max_lives: input.max_lives,
      p_class_type: input.class_type || "regular",
    });
    if (error) throw error;

    const { data: newClass, error: fetchErr } = await supabase
      .from("classes")
      .select("*")
      .eq("id", data)
      .single();
    if (fetchErr) throw fetchErr;
    
    // Fallback normalization if needed, though DB returns it
    return {
      ...newClass,
      class_type: newClass.class_type || "regular"
    };
  }

  async updateClass(
    classId: string,
    input: UpdateClassInput,
  ): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("update_class", {
      p_class_id: classId,
      p_name: input.name || null,
      p_level_name: input.level_name || null,
      p_max_lives: input.max_lives || null,
      p_class_type: input.class_type || null,
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
      .select(
        "id, class_id, display_name, avatar_key, total_points, is_active, student_auth_user_id, access_enabled, access_activated_at, created_at, updated_at, pin_generated_at, deleted_at",
      )
      .eq("class_id", classId)
      .is("deleted_at", null)
      .order("created_at");
    if (error) throw error;
    return (data || []).map((s: any) => ({
      ...s,
      has_pin: !!s.pin_generated_at,
    }));
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

  async deleteStudent(studentId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("delete_student", {
      p_student_id: studentId,
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

    const normalizedCode = classCode.trim().toUpperCase();
    const normalizedPin = pin.trim();

    // Ensure we have an anonymous session and not a teacher session
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session && !sessionData.session.user.is_anonymous) {
      throw new Error("Open student access in another browser or private window.");
    }

    if (!sessionData.session) {
      const { error: authError } = await supabase.auth.signInAnonymously();
      if (authError) throw authError;
    }

    const { data, error } = await supabase.rpc("join_class_as_student", {
      p_class_code: normalizedCode,
      p_student_pin: normalizedPin,
    });
    if (error) {
      console.warn(`Supabase RPC join failed:`, error);
      throw new Error("The class code or PIN is incorrect.");
    }
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

  async getStudentDashboard(studentId: string): Promise<{
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
      .select("id, class_id, display_name, avatar_key, total_points, is_active, student_auth_user_id, access_enabled, access_activated_at, created_at, updated_at, pin_generated_at")
      .eq("id", studentId)
      .single();
    if (error) throw error;
    if (!student) return null;

    const mappedStudent = {
      ...student,
      has_pin: !!student.pin_generated_at,
    };

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
      ...mappedStudent,
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

  // Helper to parse numeric returns safely
  private parseMutationNumber(data: any, label: string): number {
    if (data === null || data === undefined) {
      throw new Error(`The server did not return the updated ${label}.`);
    }
    const num = Number(data);
    if (!Number.isFinite(num)) {
      throw new Error(`The server returned an invalid ${label}.`);
    }
    return num;
  }

  async addPoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<number> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("award_points", {
      p_class_id: classId,
      p_student_id: studentId,
      p_points: points,
      p_reason: reason || null,
    });
    if (error) throw error;
    const result = this.parseMutationNumber(data, "point total");
    
    // Evaluate achievements asynchronously
    supabase.rpc("evaluate_student_achievements", { p_student_id: studentId })
      .catch(err => console.warn("Failed to evaluate achievements:", err));
      
    return result;
  }

  async removePoints(
    classId: string,
    studentId: string,
    points: number,
    reason?: string,
  ): Promise<number> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("remove_points", {
      p_class_id: classId,
      p_student_id: studentId,
      p_points: points,
      p_reason: reason || null,
    });
    if (error) throw error;
    const result = this.parseMutationNumber(data, "point total");
    
    // Evaluate achievements asynchronously
    supabase.rpc("evaluate_student_achievements", { p_student_id: studentId })
      .catch(err => console.warn("Failed to evaluate achievements:", err));
      
    return result;
  }

  async removeLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<number> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("remove_life", {
      p_class_id: classId,
      p_student_id: studentId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return this.parseMutationNumber(data, "lives remaining");
  }

  async restoreLife(
    classId: string,
    studentId: string,
    reason?: string,
  ): Promise<number> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("restore_life", {
      p_class_id: classId,
      p_student_id: studentId,
      p_reason: reason || null,
    });
    if (error) throw error;
    return this.parseMutationNumber(data, "lives remaining");
  }

  async resetStudentLives(classId: string, studentId: string): Promise<number> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("reset_student_lives", {
      p_class_id: classId,
      p_student_id: studentId,
    });
    if (error) throw error;
    return this.parseMutationNumber(data, "lives remaining");
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
    
    // Evaluate class achievements asynchronously
    supabase.rpc("evaluate_class_achievements", { p_class_id: classId })
      .catch(err => console.warn("Failed to evaluate class achievements:", err));
  }

  async getMeetingHistory(classId: string): Promise<MeetingHistoryItem[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("get_class_meeting_history", {
      p_class_id: classId,
    });
    if (error) throw error;
    return data || [];
  }

  async getMeetingReport(
    classId: string,
    meetingId: string,
  ): Promise<MeetingReport | null> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("get_meeting_report", {
      p_class_id: classId,
      p_meeting_id: meetingId,
    });
    if (error) throw error;
    return data;
  }

  async getStudentAchievements(studentId: string): Promise<StudentAchievement[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from("student_achievements")
      .select("*")
      .eq("student_id", studentId)
      .order("earned_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getClassAchievementSummary(classId: string): Promise<{ student_id: string; achievement: StudentAchievement }[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from("student_achievements")
      .select("*")
      .eq("class_id", classId)
      .order("earned_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(a => ({ student_id: a.student_id, achievement: a }));
  }

  async evaluateClassAchievements(classId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc("evaluate_class_achievements", {
      p_class_id: classId
    });
    if (error) throw error;
  }

  async awardTeacherRecognition(studentId: string, input: TeacherRecognitionInput): Promise<StudentAchievement> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc("award_teacher_recognition", {
      p_student_id: studentId,
      p_title: input.title,
      p_reason: input.reason,
      p_icon_key: input.iconKey
    });
    if (error) throw error;
    
    // The RPC returns the new achievement data, but we want the full record.
    // However, it's safer to just fetch it if needed, or return the partial data if it matches.
    // The instructions say "Return the created achievement". We'll just fetch the full row using the ID.
    const newId = data?.id;
    if (newId) {
      const { data: fullRecord, error: fetchError } = await supabase
        .from("student_achievements")
        .select("*")
        .eq("id", newId)
        .single();
      if (!fetchError && fullRecord) return fullRecord;
    }
    
    return data as any;
  }

  async restoreDefaultMockData(): Promise<void> {
    // Only applies to mock
  }
}
