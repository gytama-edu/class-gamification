import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (import.meta.env.VITE_DATA_SOURCE === 'supabase') {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase configuration error: Missing URL or Anon Key. Please check your .env file.');
  }
}

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null as any; // Safe fallback if disabled
