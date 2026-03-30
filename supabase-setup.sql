-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- Create the planner table
create table if not exists planner (
  id text primary key default 'main',
  schedule jsonb not null default '{}',
  swim_hours jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Allow public read/write (single-user personal tool)
-- If you want auth later, replace these with user-specific RLS policies
alter table planner enable row level security;

create policy "Allow all access"
  on planner
  for all
  using (true)
  with check (true);

-- Insert a default row (the app will upsert over this)
insert into planner (id, schedule, swim_hours)
values ('main', '{}', '{}')
on conflict (id) do nothing;
