-- Epic 0.2 — users table: structure, sign-up trigger, and locked-down defaults.
-- Run with: npm run db:test
begin;
select plan(11);

-- ── Structure ────────────────────────────────────────────────────────────────
select has_table('public', 'users', 'public.users exists');
select col_is_pk('public', 'users', 'id', 'id is the primary key');
select col_type_is('public', 'users', 'role', 'user_role', 'role uses the user_role enum');
select enum_has_labels('public', 'user_role', array['traveler', 'partner', 'staff'],
  'user_role has exactly traveler, partner, staff');
select col_not_null('public', 'users', 'role', 'role can never be null');
select is(
  (select relrowsecurity from pg_class where oid = 'public.users'::regclass),
  true,
  'row level security is enabled'
);

-- ── Sign-up trigger ──────────────────────────────────────────────────────────
insert into auth.users (id, email, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', 'plain@test.local', '{}'),
  ('22222222-2222-2222-2222-222222222222', 'sneaky@test.local', '{"role": "staff"}');

select is(
  (select role from public.users where id = '11111111-1111-1111-1111-111111111111'),
  'traveler'::public.user_role,
  'a new auth account gets a users row with role traveler'
);
select is(
  (select role from public.users where id = '22222222-2222-2222-2222-222222222222'),
  'traveler'::public.user_role,
  'role supplied in sign-up metadata is ignored (no self-promotion to staff)'
);

-- ── updated_at maintenance ───────────────────────────────────────────────────
update public.users set updated_at = '2000-01-01', role = 'partner'
where id = '11111111-1111-1111-1111-111111111111';
select isnt(
  (select updated_at from public.users where id = '11111111-1111-1111-1111-111111111111'),
  '2000-01-01'::timestamptz,
  'updated_at is set by the trigger, not by the caller'
);

-- ── Cascade on account deletion ──────────────────────────────────────────────
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select is_empty(
  $$ select 1 from public.users where id = '22222222-2222-2222-2222-222222222222' $$,
  'deleting the auth account removes the users row'
);

-- ── Trigger function is not an API endpoint ─────────────────────────────────
-- (Who may read/write the table is covered by 03_rls_policies.test.sql.)
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';
select throws_ok(
  $$ select public.handle_new_auth_user() $$,
  '42501', null,
  'the sign-up trigger function cannot be called directly'
);
reset role;

select * from finish();
rollback;
