-- Create payroll_settings table for overtime calculation configuration
create table if not exists public.payroll_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid default gen_random_uuid(), -- For multi-tenant support in future
  regular_hour_rate numeric(10, 2) default 15.00 not null,
  extra_hour_multiplier numeric(4, 2) default 1.50 not null,
  weekend_multiplier numeric(4, 2) default 2.00 not null,
  night_multiplier numeric(4, 2) default 1.25 not null,
  regular_hours_per_day integer default 8 not null,
  night_start_hour integer default 22 not null check (night_start_hour >= 0 and night_start_hour <= 23),
  night_end_hour integer default 6 not null check (night_end_hour >= 0 and night_end_hour <= 23),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.payroll_settings enable row level security;

-- Policies for payroll_settings
-- Admins can view payroll settings
create policy "Admins can view payroll settings"
  on public.payroll_settings for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can insert payroll settings
create policy "Admins can insert payroll settings"
  on public.payroll_settings for insert
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Admins can update payroll settings
create policy "Admins can update payroll settings"
  on public.payroll_settings for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Create updated_at trigger
create trigger payroll_settings_updated_at
  before update on public.payroll_settings
  for each row
  execute function public.handle_updated_at();

-- Insert default payroll settings
insert into public.payroll_settings (
  regular_hour_rate,
  extra_hour_multiplier,
  weekend_multiplier,
  night_multiplier,
  regular_hours_per_day,
  night_start_hour,
  night_end_hour
) values (
  15.00,
  1.50,
  2.00,
  1.25,
  8,
  22,
  6
) on conflict do nothing;
