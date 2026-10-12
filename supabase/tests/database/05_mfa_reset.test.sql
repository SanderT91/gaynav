-- Epic 0.3 — Lost-authenticator recovery: admin.reset_user_mfa removes 2FA
-- factors and ends sessions, is logged, and is owner-only.
-- Run with: npm run db:test
begin;
select plan(12);

insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000001', 'staff.lost.phone@test.local'),
  ('cccccccc-0000-0000-0000-000000000002', 'other.staff@test.local');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
values
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000001', 'old phone', 'totp', 'verified', now(), now(), 'x'),
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000002', 'phone', 'totp', 'verified', now(), now(), 'y');

insert into auth.sessions (id, user_id, created_at, updated_at, aal) values
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000001', now(), now(), 'aal2'),
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000001', now(), now(), 'aal1'),
  (gen_random_uuid(), 'cccccccc-0000-0000-0000-000000000002', now(), now(), 'aal2');

-- ── As the database owner (dashboard SQL editor) ─────────────────────────────
select results_eq(
  $$ select email, factors_removed, sessions_ended
     from admin.reset_user_mfa('STAFF.lost.phone@test.local', 'Lost phone, verified by video call') $$,
  $$ values ('staff.lost.phone@test.local'::text, 1, 2) $$,
  'reset removes the factor and ends every session of that user (email match ignores case)'
);
select is_empty(
  $$ select 1 from auth.mfa_factors where user_id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'the user has no 2FA factors left'
);
select is_empty(
  $$ select 1 from auth.sessions where user_id = 'cccccccc-0000-0000-0000-000000000001' $$,
  'the user has no sessions left (signed out everywhere)'
);
select is(
  (select count(*) from auth.mfa_factors where user_id = 'cccccccc-0000-0000-0000-000000000002'),
  1::bigint, 'other users'' factors are untouched'
);
select is(
  (select count(*) from auth.sessions where user_id = 'cccccccc-0000-0000-0000-000000000002'),
  1::bigint, 'other users'' sessions are untouched'
);
select results_eq(
  $$ select user_id, factors_removed, sessions_ended, reason, reset_by = session_user
     from admin.mfa_resets $$,
  $$ values ('cccccccc-0000-0000-0000-000000000001'::uuid, 1, 2,
             'Lost phone, verified by video call', true) $$,
  'the reset is logged with counts, reason and who ran it'
);
select throws_ok(
  $$ delete from admin.mfa_resets $$,
  '42501', 'admin.mfa_resets is append-only', 'the reset log cannot be deleted'
);
select throws_ok(
  $$ select * from admin.reset_user_mfa('nobody@test.local', 'typo') $$,
  'P0002', null, 'an unknown email is rejected'
);
select throws_ok(
  $$ select * from admin.reset_user_mfa('other.staff@test.local', '') $$,
  '22023', null, 'a reason is required'
);

-- ── Nobody else can strip a second factor ────────────────────────────────────
select set_config('request.jwt.claims',
  '{"sub": "cccccccc-0000-0000-0000-000000000002", "role": "authenticated", "aal": "aal2"}', true);
set local role authenticated;
select throws_ok(
  $$ select * from admin.reset_user_mfa('other.staff@test.local', 'x') $$,
  '42501', null, 'a signed-in user (even staff with 2FA) cannot reset 2FA'
);
reset role;

set local role service_role;
select throws_ok(
  $$ select * from admin.reset_user_mfa('other.staff@test.local', 'x') $$,
  '42501', null, 'service_role (app server code) cannot reset 2FA'
);
reset role;

set local role anon;
select throws_ok(
  $$ select * from admin.reset_user_mfa('other.staff@test.local', 'x') $$,
  '42501', null, 'anon cannot reset 2FA'
);
reset role;

select * from finish();
rollback;
