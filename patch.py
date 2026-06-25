import sys

def main():
    with open('fresh_supabase_setup.sql', 'r') as f:
        content = f.read()

    with open('supabase/migrations/026_tasks_foundation.sql', 'r') as f:
        tasks_content = f.read()
    
    start_str = "-- 1. Modify point_events table safely"
    end_str = "NOTIFY pgrst, 'reload schema';"
    
    start_idx = tasks_content.find(start_str)
    end_idx = tasks_content.find(end_str)
    if start_idx == -1 or end_idx == -1:
        print("Could not find start/end in tasks migration")
        return
        
    tasks_block = tasks_content[start_idx:end_idx + len(end_str)]
    
    fresh_start_idx = content.find(start_str)
    fresh_end_idx = content.find(end_str, fresh_start_idx)
    
    if fresh_start_idx != -1 and fresh_end_idx != -1:
        new_content = content[:fresh_start_idx] + tasks_block + content[fresh_end_idx + len(end_str):]
        with open('fresh_supabase_setup.sql', 'w') as f:
            f.write(new_content)
        print("Successfully patched fresh_supabase_setup.sql")
    else:
        print("Could not patch fresh_supabase_setup.sql")

if __name__ == '__main__':
    main()
