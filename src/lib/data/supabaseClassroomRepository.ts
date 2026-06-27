import {
  ClassroomRepository,
  CreateClassInput,
  UpdateClassInput
} from "./classroomRepository";
import { supabase } from "../supabase/client";
import { studentSupabase } from "../supabase/studentClient";
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
  TeacherRecognitionInput,
  ClassTask, TaskWithSummary, TaskAssignment, TaskAssignmentWithStudent,
  StudentTask, CreateTaskInput, UpdateTaskInput, TaskReviewResult, TaskStatus,
  TaskProjectGroupWithMembers, ProjectGroupTaskReviewResult, StudentProjectGroupTask, CreateProjectGroupTaskInput, UpdateProjectGroupTaskInput, ProjectGroupWithMembers, ProjectGroupSummary, CreateProjectGroupInput, UpdateProjectGroupInput, ProjectGroupDistribution, ProjectGroupDistributionResult, MyProjectGroup, ProjectGroupMember, CreateProjectGroupBatchItem, CreateProjectGroupsBatchResult,
  PrepareGroupUploadInput, PrepareGroupUploadResult, TaskProjectGroupSubmissionFile, GroupSubmissionWithFiles
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
    if (!studentSupabase) throw new Error("Student Supabase not initialized");

    const normalizedCode = classCode.trim().toUpperCase();
    const normalizedPin = pin.trim();

    const { data: sessionData } = await studentSupabase.auth.getSession();
    if (!sessionData.session) {
      const { error: authError } = await studentSupabase.auth.signInAnonymously();
      if (authError) throw authError;
    }

    const { data, error } = await studentSupabase.rpc("join_class_as_student", {
      p_class_code: normalizedCode,
      p_student_pin: normalizedPin,
    });
    if (error) {
      console.warn(`Supabase RPC join failed:`, error);
      throw new Error(error.message || "The class code or PIN is incorrect.");
    }
    return data;
  }

  async getMyStudentSession(): Promise<any> {
    if (!studentSupabase) return null;
    const { data, error } = await studentSupabase.rpc("get_my_student_session");
    if (error) throw error;
    return data;
  }

  async releaseMyStudentSession(): Promise<void> {
    if (!studentSupabase) return;
    await studentSupabase.rpc("release_my_student_session");
    await studentSupabase.auth.signOut();
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
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data, error } = await studentSupabase.rpc("get_student_dashboard_data", {
      p_student_id: studentId,
    });
    if (error) throw error;
    return data;
  }

  async getMyStudentDashboard(): Promise<any> {
    if (!studentSupabase) throw new Error("Student Supabase not initialized");
    const { data, error } = await studentSupabase.rpc("get_my_student_dashboard");
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
    (async () => {
      const { error: evalError } = await supabase!.rpc("evaluate_student_achievements", { p_student_id: studentId });
      if (evalError) console.warn("Failed to evaluate achievements:", evalError);
    })();
      
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
    (async () => {
      const { error: evalError } = await supabase!.rpc("evaluate_student_achievements", { p_student_id: studentId });
      if (evalError) console.warn("Failed to evaluate achievements:", evalError);
    })();
      
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
    (async () => {
      const { error: evalError } = await supabase!.rpc("evaluate_class_achievements", { p_class_id: classId });
      if (evalError) console.warn("Failed to evaluate class achievements:", evalError);
    })();
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

  async getMyAchievements(): Promise<StudentAchievement[]> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data: session } = await studentSupabase.auth.getSession();
    if (!session.session) throw new Error("Not authenticated");
    
    const { data, error } = await studentSupabase
      .from("student_achievements")
      .select("*, students!inner(student_auth_user_id)")
      .eq("students.student_auth_user_id", session.session.user.id)
      .order("earned_at", { ascending: false });
    if (error) throw error;
    // Omit the students join data from the result
    return (data || []).map((a: any) => {
      const { students, ...rest } = a;
      return rest;
    });
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

  // Tasks

  async getClassTasks(classId: string): Promise<TaskWithSummary[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    // We fetch tasks for the class, and compute summaries
    const { data: tasksData, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('class_id', classId)
      .order('created_at', { ascending: false });
    
    if (tasksError) throw tasksError;

    if (!tasksData || tasksData.length === 0) return [];

    const taskIds = tasksData.map(t => t.id);

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from('task_assignments')
      .select('task_id, status, submitted_at')
      .in('task_id', taskIds);

    if (assignmentsError) throw assignmentsError;

    const summaryMap = new Map<string, { assigned: number, submitted: number, approved: number, overdue: number }>();
    taskIds.forEach(id => summaryMap.set(id, { assigned: 0, submitted: 0, approved: 0, overdue: 0 }));

    const now = new Date().getTime();

    assignmentsData?.forEach(a => {
      const s = summaryMap.get(a.task_id);
      if (s) {
        s.assigned++;
        if (a.status === 'submitted') s.submitted++;
        if (a.status === 'approved') s.approved++;
        
        // Calculate overdue if active and not approved and past due date
        const task = tasksData.find(t => t.id === a.task_id);
        if (task && task.status === 'active' && a.status !== 'approved' && task.due_at) {
           const due = new Date(task.due_at).getTime();
           if (now > due) {
              s.overdue++;
           }
        }
      }
    });

    return tasksData.map(t => {
      const s = summaryMap.get(t.id)!;
      return {
        ...t,
        assigned_count: s.assigned,
        submitted_count: s.submitted,
        approved_count: s.approved,
        overdue_count: s.overdue
      };
    });
  }

  async getTask(taskId: string): Promise<ClassTask | null> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }
    return data;
  }

  async createTask(classId: string, input: CreateTaskInput): Promise<string> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('create_task', {
      p_class_id: classId,
      p_title: input.title,
      p_instructions: input.instructions,
      p_due_at: input.due_at,
      p_reward_points: input.reward_points,
      p_assignment_scope: input.assignment_scope,
      p_student_ids: input.student_ids,
      p_publish_immediately: input.publish_immediately
    });
    if (error) throw error;
    return data;
  }

  async updateTask(taskId: string, input: UpdateTaskInput): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('update_task', {
      p_task_id: taskId,
      p_title: input.title,
      p_instructions: input.instructions,
      p_due_at: input.due_at,
      p_reward_points: input.reward_points,
      p_assignment_scope: input.assignment_scope,
      p_student_ids: input.student_ids
    });
    if (error) throw error;
  }

  async setTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('set_task_status', {
      p_task_id: taskId,
      p_status: status
    });
    if (error) throw error;
  }

  async getTaskAssignments(taskId: string): Promise<TaskAssignmentWithStudent[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from('task_assignments')
      .select('*, students(display_name)')
      .eq('task_id', taskId);
    
    if (error) throw error;
    
    return (data || []).map((a: any) => ({
      ...a,
      student_name: a.students?.display_name || 'Unknown Student'
    }));
  }

  async submitTaskAssignment(assignmentId: string, submissionText?: string): Promise<void> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { error } = await studentSupabase.rpc('submit_task_assignment', {
      p_assignment_id: assignmentId,
      p_submission_text: submissionText || ''
    });
    if (error) throw error;
  }

  async reviewTaskAssignment(assignmentId: string, action: 'approve' | 'return', feedback?: string): Promise<TaskReviewResult> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('review_task_assignment', {
      p_assignment_id: assignmentId,
      p_action: action,
      p_feedback: feedback || ''
    });
    if (error) throw error;
    
    // We need to return the updated assignment as well. Fetch it.
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('task_assignments')
      .select('*')
      .eq('id', assignmentId)
      .single();
      
    if (assignmentError) throw assignmentError;
    
    return {
      assignment: assignmentData,
      points_awarded: data.points_awarded,
      student_new_total: data.student_new_total
    };
  }

  async getStudentTasks(studentId: string): Promise<StudentTask[]> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    
    // Student can only see tasks assigned to them that are active or completed
    const { data: assignments, error: assignmentsError } = await studentSupabase
      .from('task_assignments')
      .select('*')
      .eq('student_id', studentId);
      
    if (assignmentsError) throw assignmentsError;
    
    if (!assignments || assignments.length === 0) return [];
    
    const taskIds = assignments.map(a => a.task_id);
    
    const { data: tasks, error: tasksError } = await studentSupabase
      .from('tasks')
      .select('*')
      .in('id', taskIds)
      .in('status', ['active', 'completed'])
      .order('created_at', { ascending: false });
      
    if (tasksError) throw tasksError;
    
    const now = new Date().getTime();
    
    return (tasks || []).map(task => {
      const assignment = assignments.find(a => a.task_id === task.id)!;
      let is_overdue = false;
      if (task.status === 'active' && assignment.status !== 'approved' && task.due_at) {
        const due = new Date(task.due_at).getTime();
        if (now > due) {
          is_overdue = true;
        }
      }
      
      return {
        ...task,
        assignment,
        is_overdue
      };
    });
  }

  async getProjectGroups(classId: string): Promise<{ groups: ProjectGroupWithMembers[], archivedGroups: ProjectGroupWithMembers[], summary: ProjectGroupSummary, unassignedStudents: DbStudent[] }> {
    if (!supabase) throw new Error("Supabase not initialized");
    
    // Fetch active groups
    const { data: groups, error: groupsError } = await supabase
      .from('project_groups')
      .select('*')
      .eq('class_id', classId)
      .eq('status', 'active')
      .order('display_order', { ascending: true });
      
    if (groupsError) throw groupsError;
    
    // Fetch archived groups
    const { data: archivedGroupsRaw, error: archivedGroupsError } = await supabase
      .from('project_groups')
      .select('*')
      .eq('class_id', classId)
      .eq('status', 'archived')
      .order('archived_at', { ascending: false });

    if (archivedGroupsError) throw archivedGroupsError;

    // Fetch active students in the class
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .eq('is_active', true)
      .is('deleted_at', null);
      
    if (studentsError) throw studentsError;
    
    // Fetch active memberships
    const { data: memberships, error: membershipsError } = await supabase
      .from('project_group_memberships')
      .select('*')
      .eq('class_id', classId)
      .is('removed_at', null);
      
    if (membershipsError) throw membershipsError;
    
    // Group memberships by group
    const groupsWithMembers = (groups || []).map((group: any) => {
      const groupMemberships = (memberships || []).filter((m: any) => m.group_id === group.id);
      const members: ProjectGroupMember[] = groupMemberships.map((m: any) => {
        const student = (students || []).find((s: any) => s.id === m.student_id);
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

    const archivedGroups = (archivedGroupsRaw || []).map((group: any) => ({
      ...group,
      members: [] // Archived groups have no active members
    }));
    
    // Determine assigned and unassigned students
    const assignedStudentIds = new Set((memberships || []).map((m: any) => m.student_id));
    const unassignedStudents = (students || []).filter((s: any) => !assignedStudentIds.has(s.id));
    
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
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('create_project_group', {
      p_class_id: classId,
      p_name: input.name,
      p_description: input.description,
      p_color_key: input.color_key
    });
    if (error) throw error;
    return data;
  }

  async createProjectGroupsBatch(classId: string, groups: CreateProjectGroupBatchItem[]): Promise<CreateProjectGroupsBatchResult[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('create_project_groups_batch', {
      p_class_id: classId,
      p_groups: groups
    });
    if (error) throw error;
    return data;
  }

  async createAndDistributeProjectGroups(classId: string, groups: CreateProjectGroupBatchItem[], distribution: ProjectGroupDistribution[]): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('create_and_distribute_project_groups', {
      p_class_id: classId,
      p_groups: groups,
      p_distribution: distribution.map(d => ({ group_id: d.groupId, student_ids: d.studentIds }))
    });
    if (error) throw error;
  }

  async updateProjectGroup(groupId: string, input: UpdateProjectGroupInput): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('update_project_group', {
      p_group_id: groupId,
      p_name: input.name,
      p_description: input.description,
      p_color_key: input.color_key
    });
    if (error) throw error;
  }

  async archiveProjectGroup(groupId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('archive_project_group', {
      p_group_id: groupId
    });
    if (error) throw error;
  }

  async assignStudentToProjectGroup(groupId: string, studentId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('assign_student_to_project_group', {
      p_group_id: groupId,
      p_student_id: studentId
    });
    if (error) throw error;
  }

  async removeStudentFromProjectGroup(groupId: string, studentId: string): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('remove_student_from_project_group', {
      p_group_id: groupId,
      p_student_id: studentId
    });
    if (error) throw error;
  }

  async applyProjectGroupDistribution(classId: string, distribution: ProjectGroupDistribution[]): Promise<ProjectGroupDistributionResult> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('apply_project_group_distribution', {
      p_class_id: classId,
      p_assignments: distribution
    });
    if (error) throw error;
    return data;
  }

  async getMyProjectGroup(): Promise<MyProjectGroup | null> {
    if (!studentSupabase) throw new Error("Student Supabase not initialized");
    const { data, error } = await studentSupabase.rpc('get_my_project_group');
    if (error) throw error;
    return data as MyProjectGroup | null;
  }

  async createProjectGroupTask(classId: string, input: CreateProjectGroupTaskInput): Promise<string> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('create_project_group_task', {
      p_class_id: classId,
      p_title: input.title,
      p_instructions: input.instructions,
      p_due_at: input.due_at,
      p_reward_points: input.reward_points,
      p_project_group_ids: input.project_group_ids,
      p_publish_immediately: input.publish_immediately,
      p_allow_submission_text: input.allow_submission_text ?? true,
      p_allow_submission_files: input.allow_submission_files ?? false,
      p_require_submission_file: input.require_submission_file ?? false,
      p_allowed_submission_file_categories: input.allowed_submission_file_categories ?? ['image', 'document'],
      p_max_submission_files: input.max_submission_files ?? 5,
      p_max_submission_file_size_bytes: input.max_submission_file_size_bytes ?? 10485760,
      p_max_submission_total_size_bytes: input.max_submission_total_size_bytes ?? 31457280
    });
    if (error) throw error;
    return data;
  }

  async updateProjectGroupTask(taskId: string, input: UpdateProjectGroupTaskInput): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('update_project_group_task', {
      p_task_id: taskId,
      p_title: input.title,
      p_instructions: input.instructions,
      p_due_at: input.due_at,
      p_reward_points: input.reward_points,
      p_project_group_ids: input.project_group_ids,
      p_allow_submission_text: input.allow_submission_text ?? true,
      p_allow_submission_files: input.allow_submission_files ?? false,
      p_require_submission_file: input.require_submission_file ?? false,
      p_allowed_submission_file_categories: input.allowed_submission_file_categories ?? ['image', 'document'],
      p_max_submission_files: input.max_submission_files ?? 5,
      p_max_submission_file_size_bytes: input.max_submission_file_size_bytes ?? 10485760,
      p_max_submission_total_size_bytes: input.max_submission_total_size_bytes ?? 31457280
    });
    if (error) throw error;
  }

  async setProjectGroupTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { error } = await supabase.rpc('set_project_group_task_status', {
      p_task_id: taskId,
      p_status: status
    });
    if (error) throw error;
  }

  async getTaskProjectGroupAssignments(taskId: string): Promise<TaskProjectGroupWithMembers[]> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase
      .from('task_project_group_assignments')
      .select('*')
      .eq('task_id', taskId);
      
    if (error) throw error;
    
    const pgaIds = (data || []).map((a: any) => a.id);
    
    let assignmentsData: any[] = [];
    if (pgaIds.length > 0) {
      const { data: aData, error: aError } = await supabase
        .from('task_assignments')
        .select('project_group_assignment_id, student_id, students(display_name)')
        .in('project_group_assignment_id', pgaIds);
      if (aError) throw aError;
      assignmentsData = aData || [];
    }
    
    return (data || []).map((pga: any) => {
      const membersData = assignmentsData.filter((a: any) => a.project_group_assignment_id === pga.id);
      const members: ProjectGroupMember[] = membersData.map((m: any) => ({
        student_id: m.student_id,
        display_name: m.students?.display_name || 'Unknown Student'
      }));
      
      return {
        ...pga,
        members
      };
    });
  }

  async submitProjectGroupTask(groupAssignmentId: string, submissionText?: string): Promise<void> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { error } = await studentSupabase.rpc('submit_project_group_task', {
      p_group_assignment_id: groupAssignmentId,
      p_submission_text: submissionText || null
    });
    if (error) throw error;
  }

  async reviewProjectGroupTask(groupAssignmentId: string, action: 'approve' | 'return', feedback?: string): Promise<ProjectGroupTaskReviewResult> {
    if (!supabase) throw new Error("Supabase not initialized");
    const { data, error } = await supabase.rpc('review_project_group_task', {
      p_group_assignment_id: groupAssignmentId,
      p_action: action,
      p_teacher_feedback: feedback || null
    });
    if (error) throw error;
    return data;
  }

  async getMyProjectGroupTasks(): Promise<StudentProjectGroupTask[]> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data, error } = await studentSupabase.rpc('get_my_project_group_tasks');
    if (error) throw error;
    
    const now = new Date().getTime();
    return (data || []).map((t: any) => {
      let is_overdue = false;
      if (t.task_status === 'active' && t.group_assignment_status !== 'approved' && t.due_at) {
        const due = new Date(t.due_at).getTime();
        if (now > due) {
          is_overdue = true;
        }
      }
      return {
        ...t,
        is_overdue
      };
    });
  }

  // Group Task Submissions
  async prepareGroupSubmissionUpload(input: PrepareGroupUploadInput): Promise<PrepareGroupUploadResult> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data, error } = await studentSupabase.rpc('prepare_project_group_submission_upload', {
      p_group_assignment_id: input.group_assignment_id,
      p_original_filename: input.original_filename,
      p_mime_type: input.mime_type,
      p_file_size_bytes: input.file_size_bytes,
      p_file_category: input.file_category
    });
    if (error) throw error;
    return data as any;
  }

  async uploadGroupSubmissionFile(bucket: string, path: string, file: File): Promise<void> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { error } = await studentSupabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });
    if (error) throw error;
  }

  async finalizeGroupSubmissionUpload(attachmentId: string): Promise<TaskProjectGroupSubmissionFile> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data, error } = await studentSupabase.rpc('finalize_project_group_submission_upload', {
      p_attachment_id: attachmentId
    });
    if (error) throw error;
    return data as any;
  }

  async removeGroupSubmissionFile(attachmentId: string): Promise<void> {
    if (!studentSupabase) throw new Error("Supabase not initialized");
    const { data: path, error } = await studentSupabase.rpc('remove_project_group_submission_file', {
      p_attachment_id: attachmentId
    });
    if (error) throw error;
    if (path) {
      await studentSupabase.storage.from('group-task-submissions').remove([path]);
    }
  }

  async getGroupSubmissionAttempts(groupAssignmentId: string, asStudent?: boolean): Promise<GroupSubmissionWithFiles[]> {
    const client = asStudent ? studentSupabase : supabase;
    if (!client) throw new Error("Supabase not initialized");

    const { data, error } = await client
      .from('task_project_group_submission_attempts')
      .select('*, files:task_project_group_submission_files(*)')
      .eq('group_assignment_id', groupAssignmentId)
      .order('attempt_number', { ascending: false });
    
    if (error) throw error;
    
    return (data || []).map((attempt: any) => ({
      ...attempt,
      files: (attempt.files || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }));
  }

  async getGroupSubmissionFileUrl(attachmentId: string, asStudent?: boolean): Promise<string> {
    const client = asStudent ? studentSupabase : supabase;
    if (!client) throw new Error("Supabase not initialized");

    const { data: file, error: fetchError } = await client
      .from('task_project_group_submission_files')
      .select('storage_bucket, storage_path')
      .eq('id', attachmentId)
      .single();

    if (fetchError) throw fetchError;
    if (!file) throw new Error("File not found");

    const { data, error } = await client.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 300);

    if (error) throw error;
    return data.signedUrl;
  }
}
