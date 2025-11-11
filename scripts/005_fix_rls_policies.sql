-- Drop existing policies that cause infinite recursion
drop policy if exists "Admins can view all profiles" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;
drop policy if exists "Admins can insert profiles" on public.profiles;
drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Admins can delete profiles" on public.profiles;

-- Create a security definer function to check if user is admin
-- This prevents infinite recursion by using security definer
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Create simplified policies that avoid recursion

-- Policy 1: Users can always view their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Policy 2: Admins can view all profiles (using security definer function)
create policy "Admins can view all profiles"
  on public.profiles for select
  using (public.is_admin());

-- Policy 3: Only admins can insert new profiles
create policy "Admins can insert profiles"
  on public.profiles for insert
  with check (public.is_admin());

-- Policy 4: Admins can update any profile
create policy "Admins can update all profiles"
  on public.profiles for update
  using (public.is_admin());

-- Policy 5: Users can update their own profile (except role and employee_id)
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Ensure users can't change their own role or employee_id
    and (
      (old.role = new.role and old.employee_id = new.employee_id)
      or public.is_admin()
    )
  );

-- Policy 6: Only admins can delete profiles
create policy "Admins can delete profiles"
  on public.profiles for delete
  using (public.is_admin());

-- Grant execute permission on the is_admin function
grant execute on function public.is_admin() to authenticated;
