-- Epic 0.2 — RLS access matrix for public.users and public.approved_properties.
--
-- For each identity — unauthenticated, traveler, partner, staff without 2FA,
-- staff with 2FA — this file proves both what it CAN do and, more importantly,
-- what it CANNOT do. Each request is simulated exactly as Supabase's API does
-- it: switch to the `anon` or `authenticated` database role and set the JWT
-- claims the API would set.
--
-- Since Epic 1.3, API roles cannot insert into approved_properties at all
-- (error 42501): approving happens by recording an "approved" decision in
-- vetting_decisions (see 07_vetting_decisions), which applies the owner's
-- rules and adds the hotel to the whitelist. Tests here check that every
-- other path is closed.
--
-- Run with: npm run db:test
begin;
select plan(60);

-- ── Test helpers (created inside this transaction, rolled back at the end) ──
create schema tests;

-- Become a signed-in user. aal = 'aal1' (password only) or 'aal2' (2FA done).
-- `extra` merges additional claims into the JWT, to try forging privileges.
create function tests.login_as(uid uuid, aal text default 'aal1', extra jsonb default '{}')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    (jsonb_build_object('sub', uid, 'role', 'authenticated', 'aal', aal) || extra)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

create function tests.logout_to_anon()
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Count rows an UPDATE actually touched (0 = silently filtered out by RLS).
create function tests.rows_updated(sql text)
returns bigint language plpgsql as $$
declare n bigint;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ── Fixtures (inserted as the database owner, like a migration would) ───────
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'traveler@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'partner@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'staff@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'staff2@test.local');
update public.users set role = 'partner' where id = '00000000-0000-0000-0000-00000000000b';
update public.users set role = 'staff'
  where id in ('00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000d');

insert into public.approved_properties (hid, status, approved_by, vetting_summary) values
  (5001, 'approved',  '00000000-0000-0000-0000-00000000000c', 'Fixture public summary'),
  (5002, 'suspended', '00000000-0000-0000-0000-00000000000c', 'Fixture public summary');

-- ════════════════════════════════════════════════════════════════════════════
-- 1. Unauthenticated visitor (anon)
-- ════════════════════════════════════════════════════════════════════════════
select tests.logout_to_anon();

select results_eq(
  $$ select hid from public.approved_properties order by hid $$,
  $$ values (5001::bigint) $$,
  'anon: sees approved properties only (suspended one is invisible)'
);
select throws_ok($$ select approved_by from public.approved_properties $$, '42501', null,
  'anon: cannot read approved_by');
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6001, '00000000-0000-0000-0000-00000000000c', 'Test public summary') $$, '42501', null,
  'anon: cannot insert a property, even naming a real staff approver');
select throws_ok($$ update public.approved_properties set status = 'approved' where hid = 5002 $$,
  '42501', null, 'anon: cannot update a property');
select throws_ok($$ delete from public.approved_properties where hid = 5001 $$, '42501', null,
  'anon: cannot delete a property');
select throws_ok($$ select * from public.users $$, '42501', null,
  'anon: cannot read users');
select throws_ok($$ insert into public.users (id) values (gen_random_uuid()) $$, '42501', null,
  'anon: cannot insert users');
select throws_ok($$ update public.users set role = 'staff' $$, '42501', null,
  'anon: cannot update users');
select throws_ok($$ select private.is_staff_with_mfa() is true from public.users $$, '42501', null,
  'anon: helper does not open a side door into users');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. Traveler
-- ════════════════════════════════════════════════════════════════════════════
select tests.login_as('00000000-0000-0000-0000-00000000000a');

select results_eq(
  $$ select id, role::text from public.users $$,
  $$ values ('00000000-0000-0000-0000-00000000000a'::uuid, 'traveler') $$,
  'traveler: reads exactly their own users row, nobody else''s'
);
select throws_ok($$ update public.users set role = 'staff'
  where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null,
  'traveler: cannot change their own role');
select throws_ok($$ insert into public.users (id) values (gen_random_uuid()) $$, '42501', null,
  'traveler: cannot insert users rows');
select throws_ok($$ delete from public.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'traveler: cannot delete their users row via the API');
select results_eq(
  $$ select hid from public.approved_properties order by hid $$,
  $$ values (5001::bigint) $$,
  'traveler: sees approved properties only'
);
select throws_ok($$ select approved_by from public.approved_properties $$, '42501', null,
  'traveler: cannot read approved_by');
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6002, '00000000-0000-0000-0000-00000000000a', 'Test public summary') $$, '42501', null,
  'traveler: cannot approve a property as themselves');
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6003, '00000000-0000-0000-0000-00000000000c', 'Test public summary') $$, '42501', null,
  'traveler: cannot approve a property in a staff member''s name');
select throws_ok($$ update public.approved_properties set status = 'suspended' where hid = 5001 $$, '42501', null,
  'traveler: cannot suspend an approved property');
select throws_ok($$ update public.approved_properties set status = 'approved' where hid = 5002 $$, '42501', null,
  'traveler: cannot reinstate a suspended property');
select throws_ok($$ delete from public.approved_properties where hid = 5001 $$, '42501', null,
  'traveler: cannot delete a property');
reset role;

-- Forging privileges through the JWT does not help: a traveler who completed
-- 2FA and stuffs "staff" into every metadata claim is still a traveler,
-- because the role is read from public.users, never from the token.
select tests.login_as('00000000-0000-0000-0000-00000000000a', 'aal2',
  '{"user_metadata": {"role": "staff"}, "app_metadata": {"role": "staff"}, "user_role": "staff"}');
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6004, '00000000-0000-0000-0000-00000000000a', 'Test public summary') $$, '42501', null,
  'traveler with 2FA and forged "staff" claims: still cannot approve');
select results_eq(
  $$ select count(*) from public.users $$, $$ values (1::bigint) $$,
  'traveler with 2FA and forged "staff" claims: still sees only their own users row'
);
select results_eq(
  $$ select count(*) from public.approved_properties $$, $$ values (1::bigint) $$,
  'traveler with 2FA and forged "staff" claims: still cannot see suspended properties'
);
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. Partner (same rights as a traveler on these tables in Phase 0)
-- ════════════════════════════════════════════════════════════════════════════
select tests.login_as('00000000-0000-0000-0000-00000000000b', 'aal2');

select results_eq(
  $$ select id, role::text from public.users $$,
  $$ values ('00000000-0000-0000-0000-00000000000b'::uuid, 'partner') $$,
  'partner: reads exactly their own users row'
);
select throws_ok($$ update public.users set role = 'staff'
  where id = '00000000-0000-0000-0000-00000000000b' $$, '42501', null,
  'partner: cannot change their own role');
select results_eq(
  $$ select hid from public.approved_properties order by hid $$,
  $$ values (5001::bigint) $$,
  'partner: sees approved properties only'
);
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6005, '00000000-0000-0000-0000-00000000000b', 'Test public summary') $$, '42501', null,
  'partner: cannot approve a property');
select throws_ok($$ update public.approved_properties set status = 'suspended' where hid = 5001 $$, '42501', null,
  'partner: cannot suspend a property');
select throws_ok($$ delete from public.approved_properties where hid = 5001 $$, '42501', null,
  'partner: cannot delete a property');
select throws_ok($$ select approved_by from public.approved_properties $$, '42501', null,
  'partner: cannot read approved_by');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. Staff WITHOUT 2FA (password-only session, aal1): no staff powers at all
-- ════════════════════════════════════════════════════════════════════════════
select tests.login_as('00000000-0000-0000-0000-00000000000c', 'aal1');

select results_eq(
  $$ select id from public.users $$,
  $$ values ('00000000-0000-0000-0000-00000000000c'::uuid) $$,
  'staff without 2FA: reads only their own users row'
);
select results_eq(
  $$ select hid from public.approved_properties order by hid $$,
  $$ values (5001::bigint) $$,
  'staff without 2FA: does not see suspended properties'
);
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6006, '00000000-0000-0000-0000-00000000000c', 'Test public summary') $$, '42501', null,
  'staff without 2FA: cannot approve a property');
select throws_ok($$ update public.approved_properties set status = 'suspended' where hid = 5001 $$, '42501', null,
  'staff without 2FA: cannot suspend a property');
reset role;

-- A missing aal claim is treated the same as aal1.
select set_config('request.jwt.claims',
  '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);
set local role authenticated;
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (6007, '00000000-0000-0000-0000-00000000000c', 'Test public summary') $$, '42501', null,
  'staff with no aal claim at all: cannot approve a property');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. Staff WITH 2FA (aal2)
-- ════════════════════════════════════════════════════════════════════════════
select tests.login_as('00000000-0000-0000-0000-00000000000c', 'aal2');

select results_eq(
  $$ select count(*) from public.users $$, $$ values (4::bigint) $$,
  'staff with 2FA: reads all users rows'
);
select throws_ok($$ update public.users set role = 'staff'
  where id = '00000000-0000-0000-0000-00000000000a' $$, '42501', null,
  'staff with 2FA: cannot promote another user (roles change only server-side)');
select throws_ok($$ update public.users set role = 'traveler'
  where id = '00000000-0000-0000-0000-00000000000d' $$, '42501', null,
  'staff with 2FA: cannot demote another staff member via the API');
select throws_ok($$ insert into public.users (id) values (gen_random_uuid()) $$, '42501', null,
  'staff with 2FA: cannot insert users rows');
select throws_ok($$ delete from public.users where id = '00000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'staff with 2FA: cannot delete users rows');
select results_eq(
  $$ select hid from public.approved_properties order by hid $$,
  $$ values (5001::bigint), (5002::bigint) $$,
  'staff with 2FA: sees approved and suspended properties'
);
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (7001, 'approved', 'Approved on own research (no evidence pack)', 'Test public summary') $$,
  'staff with 2FA: can approve a property as themselves');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary, decided_by)
  values (7002, 'approved', 'x', 'Test public summary', '00000000-0000-0000-0000-00000000000d') $$, '42501', null,
  'staff with 2FA: cannot approve in another staff member''s name');
select throws_ok($$ insert into public.approved_properties (hid, status, approved_by, vetting_summary)
  values (7003, 'suspended', '00000000-0000-0000-0000-00000000000c', 'Test public summary') $$, '42501', null,
  'staff with 2FA: cannot set columns outside the insert grant (status) on insert');
select throws_ok($$ update public.approved_properties set status = 'suspended' where hid = 5001 $$, '42501', null,
  'staff with 2FA: cannot change the status directly (it must be a logged decision)');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note) values (5001, 'suspended', 'Complaint under review') $$,
  'staff with 2FA: can suspend a property by recording the decision');
select lives_ok($$ insert into public.vetting_decisions (hid, decision) values (5002, 'reinstated') $$,
  'staff with 2FA: can reactivate a property by recording the decision');
select throws_ok($$ update public.approved_properties set hid = 9999 where hid = 5001 $$, '42501', null,
  'staff with 2FA: cannot change a property''s hid');
select throws_ok($$ update public.approved_properties
  set approved_by = '00000000-0000-0000-0000-00000000000d' where hid = 5001 $$, '42501', null,
  'staff with 2FA: cannot rewrite who approved a property');
select throws_ok($$ delete from public.approved_properties where hid = 5001 $$, '42501', null,
  'staff with 2FA: cannot delete a property (suspend instead)');
select throws_ok($$ select approved_by from public.approved_properties $$, '42501', null,
  'staff with 2FA: approved_by is not exposed through the API (audit log covers it)');
reset role;

-- The writes above really happened, as the right person.
select results_eq(
  $$ select hid, status::text, approved_by from public.approved_properties order by hid $$,
  $$ values (5001::bigint, 'suspended', '00000000-0000-0000-0000-00000000000c'::uuid),
            (5002::bigint, 'approved',  '00000000-0000-0000-0000-00000000000c'::uuid),
            (7001::bigint, 'approved',  '00000000-0000-0000-0000-00000000000c'::uuid) $$,
  'staff writes landed exactly as intended, attributed to the acting staff member'
);

-- ════════════════════════════════════════════════════════════════════════════
-- 6. Demotion takes effect immediately, even with a still-valid 2FA session
-- ════════════════════════════════════════════════════════════════════════════
update public.users set role = 'traveler' where id = '00000000-0000-0000-0000-00000000000d';
select tests.login_as('00000000-0000-0000-0000-00000000000d', 'aal2');
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (7004, '00000000-0000-0000-0000-00000000000d', 'Test public summary') $$, '42501', null,
  'demoted staff with a live 2FA session: can no longer approve');
select results_eq(
  $$ select count(*) from public.users $$, $$ values (1::bigint) $$,
  'demoted staff with a live 2FA session: no longer reads all users'
);
select throws_ok($$ update public.approved_properties set status = 'approved' where hid = 5001 $$, '42501', null,
  'demoted staff with a live 2FA session: can no longer change status');
reset role;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. Exposure checks
-- ════════════════════════════════════════════════════════════════════════════
select is_empty(
  $$ select 1 from pg_policies where schemaname = 'public'
       and tablename in ('users', 'approved_properties')
       and 'public' = any(roles) $$,
  'no policy is granted to the catch-all PUBLIC role'
);
select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and table_name in ('users', 'approved_properties')
       and grantee in ('anon', 'authenticated')
       and privilege_type in ('DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER') $$,
  'anon and authenticated hold no DELETE/TRUNCATE/REFERENCES/TRIGGER on either table'
);
select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'users'
       and grantee = 'anon' $$,
  'anon holds no privileges at all on users'
);
-- The private schema is also kept out of the Data API (supabase/config.toml
-- [api].schemas); CI checks that over HTTP. Here: it holds no data at all,
-- only the helper function, so nothing in it could leak even if exposed.
select is_empty(
  $$ select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'private' and c.relkind in ('r', 'v', 'm', 'p', 'f') $$,
  'the private schema contains no tables or views'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.approved_properties'::regclass),
  'RLS is still enabled on both tables'
);

select * from finish();
rollback;
