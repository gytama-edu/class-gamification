import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const STUDENT_PREF_KEY = 'mission-control-student-persist';
const STUDENT_AUTH_KEY = 'mission-control-student-auth';

// Custom storage adapter that reads from localStorage or sessionStorage
// depending on the user's preference.
const customStorage = {
  getItem: (key: string): string | null => {
    // If the preference is not set to true, try reading from sessionStorage first,
    // otherwise fallback to localStorage just in case, but prefer what's there.
    // Actually, we should check where it currently lives.
    const fromSession = sessionStorage.getItem(key);
    const fromLocal = localStorage.getItem(key);
    return fromLocal || fromSession;
  },
  setItem: (key: string, value: string): void => {
    const isPersistent = localStorage.getItem(STUDENT_PREF_KEY) === 'true';
    if (isPersistent) {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    } else {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    }
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};

export const setStudentPersistentLogin = (persist: boolean) => {
  if (persist) {
    localStorage.setItem(STUDENT_PREF_KEY, 'true');
  } else {
    localStorage.setItem(STUDENT_PREF_KEY, 'false');
  }
  
  // If we have an existing session string in the wrong place, move it.
  const currentLocal = localStorage.getItem(STUDENT_AUTH_KEY);
  const currentSession = sessionStorage.getItem(STUDENT_AUTH_KEY);
  
  if (persist) {
    if (currentSession) {
      localStorage.setItem(STUDENT_AUTH_KEY, currentSession);
      sessionStorage.removeItem(STUDENT_AUTH_KEY);
    }
  } else {
    if (currentLocal) {
      sessionStorage.setItem(STUDENT_AUTH_KEY, currentLocal);
      localStorage.removeItem(STUDENT_AUTH_KEY);
    }
  }
};

export const isStudentPersistentLogin = (): boolean => {
  return localStorage.getItem(STUDENT_PREF_KEY) !== 'false'; // default to true if not set
};

export const studentSupabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: customStorage,
        storageKey: STUDENT_AUTH_KEY,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    })
  : null as any;
