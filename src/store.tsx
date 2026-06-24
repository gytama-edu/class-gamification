import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Classroom, ClassroomDashboardData } from "./lib/types/database";
import { getRepository } from "./lib/data/repository";

interface AppContextType {
  classes: Classroom[];
  isLoadingClasses: boolean;
  refreshClasses: () => Promise<void>;
  createClass: (
    name: string,
    levelName: string,
    maxLives: number,
  ) => Promise<string>;
  archiveClass: (classId: string) => Promise<void>;

  selectedClassId: string | null;
  setSelectedClassId: (id: string | null) => void;

  dashboardData: ClassroomDashboardData | null;
  isLoadingDashboard: boolean;
  error: string | null;
  refreshDashboard: () => Promise<void>;

  updateMaxLives: (classId: string, newMax: number) => Promise<void>;
  startNewMeeting: (classId: string) => Promise<void>;
  endMeeting: (classId: string) => Promise<void>;

  addPoints: (
    classId: string,
    studentId: string,
    points: number,
  ) => Promise<void>;
  removePoints: (
    classId: string,
    studentId: string,
    points: number,
  ) => Promise<void>;
  removeLife: (classId: string, studentId: string) => Promise<void>;
  restoreLife: (classId: string, studentId: string) => Promise<void>;
  resetStudentLives: (classId: string, studentId: string) => Promise<void>;

  addStudent: (classId: string, name: string) => Promise<void>;
  updateStudent: (
    studentId: string,
    name: string,
    isActive: boolean,
  ) => Promise<void>;

  restoreDefaultData: () => Promise<void>;
  toastMessage: string | null;
  setToastMessage: (msg: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [dashboardData, setDashboardData] =
    useState<ClassroomDashboardData | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // A ref to keep track of the latest dashboard request
  const dashboardRequestIdRef = React.useRef(0);

  const dashboardDataRef = React.useRef(dashboardData);
  useEffect(() => {
    dashboardDataRef.current = dashboardData;
  }, [dashboardData]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const repo = getRepository();

  const refreshClasses = useCallback(async () => {
    setIsLoadingClasses(true);
    try {
      const cls = await repo.getClasses();
      setClasses(cls);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load classes");
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    refreshClasses();
  }, [refreshClasses]);

  const refreshDashboard = useCallback(async () => {
    if (!selectedClassId) {
      setDashboardData(null);
      return;
    }

    const reqId = ++dashboardRequestIdRef.current;

    // Only set loading if we don't have data, to prevent flicker on background refreshes
    if (!dashboardDataRef.current) {
      setIsLoadingDashboard(true);
    }
    setError(null);
    try {
      const db = await repo.getClassroomDashboard(selectedClassId);
      if (dashboardRequestIdRef.current === reqId) {
        setDashboardData(db);
      }
    } catch (err: any) {
      console.error(err);
      if (dashboardRequestIdRef.current === reqId) {
        setError(err.message || "Failed to load classroom dashboard");
      }
    } finally {
      if (dashboardRequestIdRef.current === reqId) {
        setIsLoadingDashboard(false);
      }
    }
  }, [selectedClassId]);

  useEffect(() => {
    refreshDashboard();
  }, [selectedClassId]); // Removed refreshDashboard to avoid loops

  const createClass = async (
    name: string,
    levelName: string,
    maxLives: number,
  ) => {
    const newClass = await repo.createClass({
      name,
      level_name: levelName,
      max_lives: maxLives,
    });
    await refreshClasses();
    return newClass.id;
  };

  const archiveClass = async (classId: string) => {
    await repo.archiveClass(classId);
    if (selectedClassId === classId) {
      setSelectedClassId(null);
    }
    await refreshClasses();
  };

  const updateMaxLives = async (classId: string, newMax: number) => {
    await repo.updateClass(classId, { max_lives: newMax });
    if (selectedClassId === classId) await refreshDashboard();
  };

  const startNewMeeting = async (classId: string) => {
    await repo.startNewMeeting(classId);
    if (selectedClassId === classId) await refreshDashboard();
    await refreshClasses(); // Meeting number changed
  };

  const endMeeting = async (classId: string) => {
    await repo.endMeeting(classId);
    if (selectedClassId === classId) await refreshDashboard();
  };

  const updateStudentLocalState = (studentId: string, updates: any) => {
    setDashboardData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        students: prev.students.map((s) =>
          s.id === studentId ? { ...s, ...updates } : s,
        ),
      };
    });
  };

  const addPoints = async (
    classId: string,
    studentId: string,
    points: number,
  ) => {
    try {
      const newTotal = await repo.addPoints(
        classId,
        studentId,
        points,
        "teacher awarded",
      );
      updateStudentLocalState(studentId, { total_points: newTotal });
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to add points.");
    } finally {
      if (selectedClassId === classId) refreshDashboard();
    }
  };

  const removePoints = async (
    classId: string,
    studentId: string,
    points: number,
  ) => {
    try {
      const newTotal = await repo.removePoints(
        classId,
        studentId,
        points,
        "teacher deducted",
      );
      updateStudentLocalState(studentId, { total_points: newTotal });
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to remove points.");
    } finally {
      if (selectedClassId === classId) refreshDashboard();
    }
  };

  const removeLife = async (classId: string, studentId: string) => {
    try {
      const newLives = await repo.removeLife(
        classId,
        studentId,
        "teacher removed",
      );
      updateStudentLocalState(studentId, { lives_remaining: newLives });
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to remove life.");
    } finally {
      if (selectedClassId === classId) refreshDashboard();
    }
  };

  const restoreLife = async (classId: string, studentId: string) => {
    try {
      const newLives = await repo.restoreLife(
        classId,
        studentId,
        "teacher restored",
      );
      updateStudentLocalState(studentId, { lives_remaining: newLives });
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to restore life.");
    } finally {
      if (selectedClassId === classId) refreshDashboard();
    }
  };

  const resetStudentLives = async (classId: string, studentId: string) => {
    try {
      const newLives = await repo.resetStudentLives(classId, studentId);
      updateStudentLocalState(studentId, { lives_remaining: newLives });
    } catch (err: any) {
      console.error(err);
      setToastMessage(err.message || "Failed to reset lives.");
    } finally {
      if (selectedClassId === classId) refreshDashboard();
    }
  };

  const addStudent = async (classId: string, name: string) => {
    await repo.addStudent(classId, { display_name: name });
    if (selectedClassId === classId) await refreshDashboard();
  };

  const updateStudent = async (
    studentId: string,
    name: string,
    isActive: boolean,
  ) => {
    await repo.updateStudent(studentId, {
      display_name: name,
      is_active: isActive,
    });
    await refreshDashboard();
  };

  const restoreDefaultData = async () => {
    await repo.restoreDefaultMockData();
    setSelectedClassId(null);
    await refreshClasses();
  };

  return (
    <AppContext.Provider
      value={{
        classes,
        isLoadingClasses,
        refreshClasses,
        createClass,
        archiveClass,
        selectedClassId,
        setSelectedClassId,
        dashboardData,
        isLoadingDashboard,
        error,
        refreshDashboard,
        updateMaxLives,
        startNewMeeting,
        endMeeting,
        addPoints,
        removePoints,
        removeLife,
        restoreLife,
        resetStudentLives,
        addStudent,
        updateStudent,
        restoreDefaultData,
        toastMessage,
        setToastMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
