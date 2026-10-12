-- Epic 1.2 — evidence_packs is staff-only (Decisions #6) and append-only.
-- Run with: npm run db:test
begin;
select plan(18);

create schema tests;
create function tests.login_as(uid uuid, aal text default 'aal1')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    jsonb_build_object('sub', uid, 'role', 'authenticated', 'aal', aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-00000000000a', 'traveler@test.local'),
  ('dddddddd-0000-0000-0000-00000000000b', 'partner@test.local'),
  ('dddddddd-0000-0000-0000-00000000000c', 'staff@test.local'),
  ('dddddddd-0000-0000-0000-00000000000d', 'staff2@test.local');
update public.users set role = 'partner' where id = 'dddddddd-0000-0000-0000-00000000000b';
update public.users set role = 'staff'
  where id in ('dddddddd-0000-0000-0000-00000000000c', 'dddddddd-0000-0000-0000-00000000000d');

insert into public.evidence_packs (hid, status, pack, sources, model, generated_by) values
  (9990000003, 'ready', '{"summary":"x","signals":[],"open_questions":[]}', '[]', 'claude-opus-5-5',
   'dddddddd-0000-0000-0000-00000000000c');

-- ── Integrity ────────────────────────────────────────────────────────────────
select throws_ok(
  $$ insert into public.evidence_packs (hid, status, sources, generated_by)
     values (9990000001, 'ready', '[]', 'dddddddd-0000-0000-0000-00000000000c') $$,
  '23514', null, 'a ready pack must have content'
);
select throws_ok(
  $$ insert into public.evidence_packs (hid, status, pack, failure_reason, failure_message, generated_by)
     values (9990000001, 'failed', '{}', 'refused', 'msg', 'dddddddd-0000-0000-0000-00000000000c') $$,
  '23514', null, 'a failed attempt can never carry a pack (no partial summaries)'
);
select throws_ok(
  $$ insert into public.evidence_packs (hid, status, generated_by)
     values (9990000001, 'failed', 'dddddddd-0000-0000-0000-00000000000c') $$,
  '23514', null, 'a failed attempt must record why and what staff were told'
);

-- ── Nobody but staff with 2FA can read ───────────────────────────────────────
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select throws_ok($$ select * from public.evidence_packs $$, '42501', null, 'anon: cannot read evidence packs');
select throws_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by)
  values (1, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000c') $$, '42501', null, 'anon: cannot add evidence packs');
reset role;

select tests.login_as('dddddddd-0000-0000-0000-00000000000a', 'aal2');
select is_empty($$ select 1 from public.evidence_packs $$, 'traveler (even with 2FA): sees no evidence packs');
select throws_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by)
  values (1, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000a') $$, '42501', null, 'traveler: cannot add evidence packs');
reset role;

select tests.login_as('dddddddd-0000-0000-0000-00000000000b', 'aal2');
select is_empty($$ select 1 from public.evidence_packs $$, 'partner: sees no evidence packs');
reset role;

select tests.login_as('dddddddd-0000-0000-0000-00000000000c', 'aal1');
select is_empty($$ select 1 from public.evidence_packs $$, 'staff without 2FA: sees no evidence packs');
select throws_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by)
  values (1, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000c') $$, '42501', null, 'staff without 2FA: cannot add evidence packs');
reset role;

-- ── Staff with 2FA ───────────────────────────────────────────────────────────
select tests.login_as('dddddddd-0000-0000-0000-00000000000c', 'aal2');
select is((select count(*) from public.evidence_packs), 1::bigint, 'staff with 2FA: reads evidence packs');
select lives_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, model, generated_by)
  values (9990000003, 'failed', 'rate_limited', 'Too many AI requests right now.', 'claude-opus-5-5',
          'dddddddd-0000-0000-0000-00000000000c') $$, 'staff with 2FA: records a (failed) attempt as themselves');
select throws_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by)
  values (9990000003, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000d') $$, '42501', null,
  'staff with 2FA: cannot record an attempt in a colleague''s name');
select throws_ok($$ update public.evidence_packs set pack = '{"summary":"edited"}' $$, '42501', null,
  'staff with 2FA: cannot edit a stored pack');
select throws_ok($$ delete from public.evidence_packs $$, '42501', null,
  'staff with 2FA: cannot delete pack history');
select throws_ok($$ insert into public.evidence_packs (id, hid, status, failure_reason, failure_message, generated_by)
  values (gen_random_uuid(), 9990000003, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000c') $$, '42501', null,
  'staff with 2FA: cannot choose the row id');
select throws_ok($$ insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by, generated_at)
  values (9990000003, 'failed', 'x', 'x', 'dddddddd-0000-0000-0000-00000000000c', '2000-01-01') $$, '42501', null,
  'staff with 2FA: cannot backdate an attempt');
reset role;

select ok(
  (select relrowsecurity from pg_class where oid = 'public.evidence_packs'::regclass),
  'RLS is enabled on evidence_packs'
);

select * from finish();
rollback;
