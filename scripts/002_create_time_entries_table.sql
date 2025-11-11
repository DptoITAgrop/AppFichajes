-- Create time_entries table for clock in/out records
create table if not exists public.time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  employee_id text not null,
  employee_name text not null,
  type text not null check (type in ('entrada', 'salida')),
  timestamp timestamptz default now() not null,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accuracy numeric(10, 2),
  address text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.time_entries enable row level security;

-- Policies for time_entries
-- Admins can view all time entries
create policy "Admins can view all time entries"
  on public.time_entries for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Users can view their own time entries
create policy "Users can view own time entries"
  on public.time_entries for select
  using (user_id = auth.uid());

-- Users can insert their own time entries
create policy "Users can insert own time entries"
  on public.time_entries for insert
  with check (user_id = auth.uid());

-- Admins can insert time entries for any user
create policy "Admins can insert time entries"
  on public.time_entries for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update time entries
create policy "Admins can update time entries"
  on public.time_entries for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can delete time entries
create policy "Admins can delete time entries"
  on public.time_entries for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create indexes for faster queries
create index if not exists time_entries_user_id_idx on public.time_entries(user_id);
create index if not exists time_entries_employee_id_idx on public.time_entries(employee_id);
create index if not exists time_entries_timestamp_idx on public.time_entries(timestamp desc);
create index if not exists time_entries_type_idx on public.time_entries(type);
