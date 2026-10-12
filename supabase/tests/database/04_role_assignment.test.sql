-- Epic 0.3 — Role assignment: new accounts are travelers; only a human with
-- database-owner access can change roles, and every change is logged.
-- Run with: npm run db:test
begin;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data) values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'new.person@test.local', '{"role": "staff"}', '{}'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'curator@test.local', '{}', '{"role": "staff"}');

-- ── Account creation ─────────────────────────────────────────────────────────
select results_eq(
  $$ select role::text from public.users
     where id in ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
     order by id $$,
  $$ values ('traveler'), ('traveler') $$,
  'every new account starts as traveler, whatever role is put in user or app metadata'
);

-- ── Admin tooling, run as the database owner (dashboard SQL editor) ─────────
select results_eq(
  $$ select email, old_role::text, new_role::text
     from admin.set_user_role('Curator@Test.local', 'staff', 'Hired as curator') $$,
  $$ values ('curator@test.local'::text, 'traveler', 'staff') $$,
  'admin.set_user_role promotes a user (email match is case-insensitive)'
);
select is(
  (select role from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'staff'::public.user_role,
  'the new role is stored in public.users'
);
select results_eq(
  $$ select user_id, old_role::text, new_role::text, reason, changed_by = session_user
     from admin.role_changes order by id $$,
  $$ values ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'traveler', 'staff',
             'Hired as curator', true) $$,
  'the change is logged with old role, new role, reason and who ran it'
);
select throws_ok(
  $$ select * from admin.set_user_role('curator@test.local', 'staff', 'again') $$,
  '22023', null, 'setting the role a user already has is rejected (no silent no-ops in the log)'
);
select throws_ok(
  $$ select * from admin.set_user_role('nobody@test.local', 'staff', 'typo') $$,
  'P0002', null, 'an unknown email is rejected'
);
select throws_ok(
  $$ select * from admin.set_user_role('new.person@test.local', 'partner', '   ') $$,
  '22023', null, 'a reason is required'
);
select lives_ok(
  $$ select * from admin.set_user_role('curator@test.local', 'traveler', 'Left the team') $$,
  'admin.set_user_role can demote (staff offboarding)'
);
select is(
  (select count(*) from admin.role_changes), 2::bigint,
  'both changes are in the log'
);
select throws_ok(
  $$ update admin.role_changes set reason = 'edited' $$,
  '42501', 'admin.role_changes is append-only', 'log entries cannot be edited'
);
select throws_ok(
  $$ delete from admin.role_changes $$,
  '42501', 'admin.role_changes is append-only', 'log entries cannot be deleted'
);

-- ── Nobody else can use the tooling ──────────────────────────────────────────
set local role anon;
select throws_ok(
  $$ select * from admin.set_user_role('new.person@test.local', 'staff', 'x') $$,
  '42501', null, 'anon cannot change roles'
);
reset role;

-- A staff member with a 2FA session is still just `authenticated` to the API.
update public.users set role = 'staff' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select set_config('request.jwt.claims',
  '{"sub": "bbbbbbbb-0000-0000-0000-000000000002", "role": "authenticated", "aal": "aal2"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from admin.set_user_role('new.person@test.local', 'staff', 'x') $$,
  '42501', null, 'staff with 2FA cannot change roles through the app'
);
select throws_ok(
  $$ select * from admin.role_changes $$,
  '42501', null, 'staff cannot read the role change log through the app'
);
reset role;

-- service_role is what the app's server code uses. Per Decisions #1 the app
-- must not change roles either, so service_role is locked out too.
set local role service_role;
select throws_ok(
  $$ select * from admin.set_user_role('new.person@test.local', 'staff', 'x') $$,
  '42501', null, 'service_role (app server code) cannot change roles'
);
select throws_ok(
  $$ select * from admin.role_changes $$,
  '42501', null, 'service_role cannot read the role change log'
);
select throws_ok(
  $$ insert into admin.role_changes (user_id, old_role, new_role, reason)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'traveler', 'staff', 'forged') $$,
  '42501', null, 'service_role cannot forge log entries'
);
reset role;

select is(
  (select role from public.users where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'traveler'::public.user_role,
  'after all those attempts, the new account is still a traveler'
);
-- No API role can even look inside the admin schema. (It is also kept out
-- of the Data API in supabase/config.toml; CI checks that over HTTP.)
select ok(
  not has_schema_privilege('anon', 'admin', 'USAGE')
  and not has_schema_privilege('authenticated', 'admin', 'USAGE')
  and not has_schema_privilege('service_role', 'admin', 'USAGE'),
  'anon, authenticated and service_role have no access to the admin schema'
);

select * from finish();
rollback;
