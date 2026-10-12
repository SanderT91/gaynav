-- Epic 0.3 — Lost-authenticator recovery for staff (CLAUDE.md, Decisions #2).
--
-- There is no self-service bypass. If a staff member loses their authenticator
-- app, a human admin runs, in the Supabase dashboard's SQL editor:
--
--   select * from admin.reset_user_mfa('person@example.com', 'Lost phone, verified by video call');
--
-- This removes all of the person's 2FA factors and ends all of their sessions
-- (every device is signed out). On their next sign-in they are sent to set up a
-- new authenticator before they get staff access again. The reset is logged in
-- admin.mfa_resets (append-only).
--
-- Like admin.set_user_role, it can only be run by the database owner — not by
-- anon, authenticated or service_role — so neither users nor the app can strip
-- someone's second factor.

create table admin.mfa_resets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete restrict,
  factors_removed integer not null,
  sessions_ended integer not null,
  reason text not null check (length(trim(reason)) > 0),
  reset_by text not null default session_user,
  reset_at timestamptz not null default now()
);

comment on table admin.mfa_resets is
  'Append-only log of 2FA resets made through admin.reset_user_mfa(). Not reachable through the API.';

revoke all on table admin.mfa_resets from public, anon, authenticated, service_role;

create trigger mfa_resets_append_only
  before update or delete on admin.mfa_resets
  for each row execute function admin.prevent_role_change_edits();

-- The shared trigger function's message names role_changes; give it a neutral
-- message now that it guards more than one log.
create or replace function admin.prevent_role_change_edits()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_schema || '.' || tg_table_name
    using errcode = 'insufficient_privilege';
end;
$$;

create function admin.reset_user_mfa(p_email text, p_reason text)
returns table (user_id uuid, email text, factors_removed integer, sessions_ended integer)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
  v_factors integer;
  v_sessions integer;
begin
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'a reason is required for every 2FA reset'
      using errcode = 'invalid_parameter_value';
  end if;

  select u.id, u.email into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'no account with email %', p_email
      using errcode = 'no_data_found';
  end if;

  delete from auth.mfa_factors f where f.user_id = v_user_id;
  get diagnostics v_factors = row_count;

  -- Ending the sessions also revokes their refresh tokens (cascade), so no
  -- device can quietly renew an old 2FA session.
  delete from auth.sessions s where s.user_id = v_user_id;
  get diagnostics v_sessions = row_count;

  insert into admin.mfa_resets (user_id, factors_removed, sessions_ended, reason)
  values (v_user_id, v_factors, v_sessions, trim(p_reason));

  return query select v_user_id, v_email, v_factors, v_sessions;
end;
$$;

comment on function admin.reset_user_mfa(text, text) is
  'Admin tooling: remove a user''s 2FA factors and end their sessions (logged). Run from the Supabase SQL editor.';

revoke all on function admin.reset_user_mfa(text, text)
  from public, anon, authenticated, service_role;
