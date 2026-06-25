import fs from 'fs';
fs.copyFileSync('supabase/migrations/026_tasks_foundation.sql', 'manual_install_tasks_foundation.sql');
