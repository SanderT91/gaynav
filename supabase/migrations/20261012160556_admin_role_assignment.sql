-- Epic 0.3 — Role assignment.
--
-- New accounts are always `traveler` (sign-up trigger, users migration).
-- Any other role is assigned by a human through admin tooling, never by the
-- app (CLAUDE.md, Decisions #1). The tooling is one SQL function:
--
--   select admin.set_user_role('person@example.com', 'staff', 'Hired as curator');
--
-- run in the Supabase dashboard's SQL editor (or `supabase db` / psql), which
-- connects as the database owner. It is deliberately NOT executable by:
--   - anon / authenticated  — nobody can change roles through the public API;
--   - service_role          — the app's server code holds that key, and the app
--                             must not be able to change roles either.
-- The `admin` schema is not exposed through the Data API.
--
-- Every change is recorded in admin.role_changes (append-only), so there is
-- always an answer to "when did this person become staff, and why?".

create schema admin;
revoke all on schema admin from public, anon, authenticated, service_role;

create table admin.role_changes (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  old_role public.user_role not null,
  new_role public.user_role not null,
  reason text not null check (length(trim(reason)) > 0),
  -- The database login that made the change (e.g. `postgres` for the
  -- dashboard SQL editor). Auth users can't call the function, so there is no
  -- auth.uid() to record.
  changed_by text not null default session_user,
  changed_at timestamptz not null default now()
);

comment on table admin.role_changes is
  'Append-only log of role changes made through admin.set_user_role(). Not reachable through the API.';

revoke all on table admin.role_changes from public, anon, authenticated, service_role;

-- Append-only: the log can't be edited or trimmed, even by the owner, without
-- first dropping this trigger (which itself would show up in a migration).
create function admin.prevent_role_change_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'admin.role_changes is append-only'
    using errcode = 'insufficient_privilege';
end;
$$;

create trigger role_changes_append_only
  before update or delete on admin.role_changes
  for each row execute function admin.prevent_role_change_edits();

create function admin.set_user_role(
  p_email text,
  p_role public.user_role,
  p_reason text
)
returns table (user_id uuid, email text, old_role public.user_role, new_role public.user_role)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
  v_old public.user_role;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required for every role change'
      using errcode = 'invalid_parameter_value';
  end if;

  select u.id, u.email into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'no account with email %', p_email
      using errcode = 'no_data_found';
  end if;

  select pu.role into v_old from public.users pu where pu.id = v_user_id for update;

  if v_old = p_role then
    raise exception '% already has role %', v_email, p_role
      using errcode = 'invalid_parameter_value';
  end if;

  update public.users set role = p_role where id = v_user_id;

  insert into admin.role_changes (user_id, old_role, new_role, reason)
  values (v_user_id, v_old, p_role, trim(p_reason));

  return query select v_user_id, v_email, v_old, p_role;
end;
$$;

comment on function admin.set_user_role(text, public.user_role, text) is
  'Admin tooling: change a user''s role (logged). Run from the Supabase SQL editor. Not callable by anon, authenticated or service_role.';

revoke all on function admin.set_user_role(text, public.user_role, text)
  from public, anon, authenticated, service_role;
revoke all on function admin.prevent_role_change_edits()
  from public, anon, authenticated, service_role;
