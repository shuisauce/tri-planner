# 70.3 Training Planner

Monthly calendar planner for coordinating work shifts, triathlon training, YMCA swim hours, and vacations leading up to Frankfort 70.3 (Sep 20, 2026).

## Setup (5 minutes)

### 1. Supabase

Open your existing Supabase project (or create one at [supabase.com](https://supabase.com)):

1. Go to **SQL Editor** → **New Query**
2. Paste the contents of `supabase-setup.sql` and run it
3. Go to **Settings** → **API** and copy:
   - **Project URL** (e.g. `https://abc123.supabase.co`)
   - **anon public** key

### 2. Local Dev

```bash
git clone <your-repo-url>
cd tri-planner
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Deploy to Vercel

1. Push to GitHub: `git push origin main`
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### How It Works

- **Supabase** stores your schedule (syncs across phone + laptop)
- **localStorage** acts as a backup if Supabase is unreachable
- Header shows sync status: `● synced` (green) or `● local only` (red)
- All changes auto-save with 800ms debounce

## Features

- Monthly calendar view with week navigation
- Drag-and-drop work shifts (8h/10h/12h) and workouts (Swim/Bike/Run)
- Weekly budget tracker: 🏊 2/2 · 🚴 2/2 · 🏃 2/2
- Vacation overlays with blocked workout indicators
- YMCA lap swim hours per day of week (editable via 🏊 button)
- Strength auto-tags on Mon/Thu
- CSV export of work schedule
- Pre-loaded: Mar 30 – Sep 27, 2026
