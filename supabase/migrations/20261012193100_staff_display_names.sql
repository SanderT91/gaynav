-- Epic 1.4 — readable names in the staff audit log.
--
-- The audit log records WHO by user id. Emails stay in auth.users only (no
-- second copy of identity data, see the users migration), so staff get an
-- optional display name, set by an admin:
--
--   select * from admin.set_display_name('person@example.com', 'Alex (curation)');
--
-- Who can read it: the existing users policies apply — a user sees their own
-- row; staff with 2FA see everyone's. Nobody can set it through the API.

alter table public.users
  add column display_name text check (display_name is null or length(trim(display_name)) between 1 and 80);

comment on column public.users.display_name is
  'Optional name shown in the staff audit log. Set by admins via admin.set_display_name(); never through the API.';

create function admin.set_display_name(p_email text, p_display_name text)
returns table (user_id uuid, email text, display_name text)
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_email text;
begin
  select u.id, u.email into v_user_id, v_email
  from auth.users u
  where lower(u.email) = lower(trim(p_email));

  if v_user_id is null then
    raise exception 'no account with email %', p_email
      using errcode = 'no_data_found';
  end if;

  update public.users set display_name = nullif(trim(p_display_name), '') where id = v_user_id;
  return query select v_user_id, v_email, nullif(trim(p_display_name), '');
end;
$$;

revoke all on function admin.set_display_name(text, text) from public, anon, authenticated, service_role;
