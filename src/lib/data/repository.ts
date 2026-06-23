import { ClassroomRepository } from './classroomRepository';
import { MockClassroomRepository } from './mockClassroomRepository';
import { SupabaseClassroomRepository } from './supabaseClassroomRepository';

const dataSource = import.meta.env.VITE_DATA_SOURCE || 'mock';

let instance: ClassroomRepository | null = null;

export function getRepository(): ClassroomRepository {
  if (!instance) {
    if (dataSource === 'supabase') {
      instance = new SupabaseClassroomRepository();
    } else {
      instance = new MockClassroomRepository();
    }
  }
  return instance;
}
