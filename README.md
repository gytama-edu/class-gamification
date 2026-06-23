# GYTama EDU Classes Gamification

A Phase 1B prototype for an online classroom gamification platform with a "Cosmic Classroom" theme.

## Setup Instructions

### 1. Supabase Database Configuration
This project supports an optional Supabase backend. Follow these steps to configure it:

1. Create a free project on [Supabase](https://supabase.com).
2. Go to **Project Settings -> API** to find your keys.
3. You will need:
   - **Project URL**
   - **anon / public key**
   - **service_role / secret key** (Keep this safe!)

### 2. Environment Variables
Create a `.env.local` file in the root directory based on `.env.example`:

```env
# Required for Supabase mode:
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Never expose this to the browser/client-side code!
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Choose your data source ('mock' or 'supabase')
NEXT_PUBLIC_DATA_SOURCE=mock
```

*(Note: We use `NEXT_PUBLIC_` for standard compatibility, which are exposed via Vite config alongside `VITE_`)*

### 3. Database Migrations
Go to the SQL Editor in your Supabase dashboard and run the files in the `/supabase/migrations/` directory sequentially:
- `001_initial_schema.sql`
- `002_constraints_and_indexes.sql`
- `003_rls.sql`

### 4. Database Seeding
To populate the database with the initial "Galaxy Explorers" demo class, run the seed script in your Supabase SQL Editor:
- `/supabase/seed.sql`

### 5. Running the Application
Switch between mock mode and Supabase mode by modifying `NEXT_PUBLIC_DATA_SOURCE` in your `.env.local` file.
Run the application using standard NPM scripts:
```bash
npm run dev
```

## Database Tables Overview

- `classes`: Stores classroom details (name, level, max lives limit, current meeting number).
- `students`: Stores permanent student identities and accumulated points.
- `meetings`: Tracks individual meeting sessions and the maximum lives snapshot for each meeting.
- `student_meeting_states`: Stores the current lives remaining for each student in a specific meeting.
- `point_events`: Immutable history log of all point additions and deductions.
- `life_events`: Immutable history log of life removals, restorations, and resets.

## Security Warning
**NEVER expose the `SUPABASE_SERVICE_ROLE_KEY` to client-side browsers.** This key bypasses all Row-Level Security (RLS) policies. Only use it in server-only functions (`lib/supabase/admin.ts`).
