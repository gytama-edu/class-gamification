import fs from 'fs';

function main() {
    const content = fs.readFileSync('fresh_supabase_setup.sql', 'utf-8');
    const tasksContent = fs.readFileSync('supabase/migrations/026_tasks_foundation.sql', 'utf-8');
    
    const startStr = "-- 1. Modify point_events table safely";
    const endStr = "NOTIFY pgrst, 'reload schema';";
    
    const startIdx = tasksContent.indexOf(startStr);
    const endIdx = tasksContent.indexOf(endStr);
    
    if (startIdx === -1 || endIdx === -1) {
        console.log("Could not find start/end in tasks migration");
        return;
    }
        
    const tasksBlock = tasksContent.substring(startIdx, endIdx + endStr.length);
    
    const freshStartIdx = content.indexOf(startStr);
    const freshEndIdx = content.indexOf(endStr, freshStartIdx);
    
    if (freshStartIdx !== -1 && freshEndIdx !== -1) {
        const newContent = content.substring(0, freshStartIdx) + tasksBlock + content.substring(freshEndIdx + endStr.length);
        fs.writeFileSync('fresh_supabase_setup.sql', newContent);
        console.log("Successfully patched fresh_supabase_setup.sql");
    } else {
        console.log("Could not patch fresh_supabase_setup.sql");
    }
}

main();
