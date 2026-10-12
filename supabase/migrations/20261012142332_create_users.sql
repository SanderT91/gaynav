-- Epic 0.2 — `users` table with role column.
--
-- One row per Supabase Auth account, holding the application role. The role
-- lives here (not in auth.users.raw_user_meta_data) because users can edit
-- their own metadata through the Auth API — storing the role there would let
-- anyone promote themselves to staff.
--
-- Email and other identity fields are NOT copied here: auth.users stays the
-- single source of truth for login identity, so there is no second copy of
-- personal data to keep in sync or delete.

create type public.user_role as enum ('traveler', 'partner', 'staff');

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'traveler',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.users is
  'Application profile per auth account. Role changes only via service_role (server-side admin tooling); see RLS policies.';
comment on column public.users.role is
  'traveler | partner | staff. New accounts are always traveler; staff and partner are assigned server-side, never via self-signup.';

-- Secure by default: RLS on with no policies = nobody but service_role can
-- touch the table. Access is granted deliberately in the RLS policy migration.
alter table public.users enable row level security;
revoke all on table public.users from anon, authenticated;

-- Keep updated_at honest without relying on callers.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Every new auth account gets a profile row with the default `traveler` role.
-- Anything the client sends in sign-up metadata (e.g. {"role": "staff"}) is
-- deliberately ignored. SECURITY DEFINER because the inserting session is the
-- Auth service, which has no rights on public.users.
create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Trigger functions must not be callable directly through the API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
