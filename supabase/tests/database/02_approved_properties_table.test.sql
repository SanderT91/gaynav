-- Epic 0.2 — approved_properties: structure, integrity rules, locked-down defaults.
-- Run with: npm run db:test
begin;
select plan(15);

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'approved_properties', 'public.approved_properties exists');
select col_type_is('public', 'approved_properties', 'hid', 'bigint', 'hid is a bigint (RateHawk numeric hotel id)');
select col_not_null('public', 'approved_properties', 'approved_by', 'approved_by is required');
select enum_has_labels('public', 'property_status', array['approved', 'suspended'],
  'property_status has exactly approved, suspended');
select is(
  (select relrowsecurity from pg_class where oid = 'public.approved_properties'::regclass),
  true,
  'row level security is enabled'
);

-- ── Fixtures: one staff member, one traveler ─────────────────────────────────
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'staff@test.local'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'traveler@test.local');
update public.users set role = 'staff' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- ── Integrity rules ──────────────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.approved_properties (hid, approved_by)
     values (1001, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'a staff member can be recorded as approver'
);
select is(
  (select status from public.approved_properties where hid = 1001),
  'approved'::public.property_status,
  'new rows default to status approved'
);
select throws_ok(
  $$ insert into public.approved_properties (hid, approved_by)
     values (1002, 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  '23514', 'approved_by must reference a user with the staff role',
  'a non-staff user cannot be recorded as approver (enforced even for service_role)'
);
select throws_ok(
  $$ update public.approved_properties
     set approved_by = 'aaaaaaaa-0000-0000-0000-000000000002' where hid = 1001 $$,
  '23514', 'approved_by must reference a user with the staff role',
  'approver cannot be changed to a non-staff user'
);
select throws_ok(
  $$ insert into public.approved_properties (hid, approved_by)
     values (1001, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23505', null,
  'the same hotel (hid) cannot be whitelisted twice'
);
select throws_ok(
  $$ insert into public.approved_properties (hid, approved_by)
     values (0, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23514', null,
  'hid must be a positive number'
);
select throws_ok(
  $$ delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '23503', null,
  'a staff account that approved properties cannot be hard-deleted (audit trail kept)'
);

-- ── Secure by default ────────────────────────────────────────────────────────
select is_empty(
  $$ select privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and table_name = 'approved_properties'
       and grantee in ('anon', 'authenticated') $$,
  'anon and authenticated hold no table privileges on approved_properties'
);

set local role anon;
select throws_ok(
  $$ select * from public.approved_properties $$,
  '42501', null,
  'anon cannot read approved_properties until policies are added'
);
reset role;

set local role authenticated;
set local request.jwt.claims to '{"sub": "aaaaaaaa-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal2"}';
select throws_ok(
  $$ insert into public.approved_properties (hid, approved_by)
     values (2001, 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null,
  'even staff cannot write through the API until policies are added'
);
reset role;

select * from finish();
rollback;
