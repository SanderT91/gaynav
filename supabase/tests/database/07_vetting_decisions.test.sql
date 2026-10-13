-- Epic 1.3 / 1.4 — approve & reject (owner decisions 2026-10-12) and the audit
-- log of every staff decision. Approving = inserting an "approved" decision;
-- the database checks the rules and adds the hotel to the whitelist.
-- Run with: npm run db:test
begin;
select plan(50);

create schema tests;
create function tests.login_as(uid uuid, aal text default 'aal2')
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
  ('eeeeeeee-0000-0000-0000-00000000000a', 'traveler@test.local'),
  ('eeeeeeee-0000-0000-0000-00000000000c', 'staff@test.local'),
  ('eeeeeeee-0000-0000-0000-00000000000d', 'staff2@test.local');
update public.users set role = 'staff'
  where id in ('eeeeeeee-0000-0000-0000-00000000000c', 'eeeeeeee-0000-0000-0000-00000000000d');

-- Evidence packs: hotel 101 clean, hotel 102 with a concern, hotel 103 only a
-- FAILED attempt (counts as "no pack").
insert into public.evidence_packs (id, hid, status, pack, sources, generated_by) values
  ('11111111-0000-0000-0000-000000000101', 101, 'ready',
   '{"summary":"ok","signals":[{"topic":"lgbtq_welcome","tone":"positive","statement":"x","source_ids":["a"]}],"open_questions":[]}',
   '[]', 'eeeeeeee-0000-0000-0000-00000000000c'),
  ('11111111-0000-0000-0000-000000000102', 102, 'ready',
   '{"summary":"hm","signals":[{"topic":"house_rules","tone":"concern","statement":"x","source_ids":["a"]}],"open_questions":[]}',
   '[]', 'eeeeeeee-0000-0000-0000-00000000000c');
insert into public.evidence_packs (hid, status, failure_reason, failure_message, generated_by)
  values (103, 'failed', 'refused', 'declined', 'eeeeeeee-0000-0000-0000-00000000000c');

select tests.login_as('eeeeeeee-0000-0000-0000-00000000000c');

-- ── Approving: rules ─────────────────────────────────────────────────────────
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note)
  values (101, 'approved', 'fine') $$,
  '23514', 'Approving requires a public vetting summary',
  'no public summary → refused');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, public_summary)
  values (100, 'approved', 'Welcoming boutique hotel.') $$,
  '23514', 'Approving without an evidence pack requires a note',
  'no evidence pack + no note → refused');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (103, 'approved', '   ', 'Welcoming.') $$,
  '23514', 'Approving without an evidence pack requires a note',
  'only a failed pack counts as no pack; a blank note is no note');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (100, 'approved', 'Visited in person, welcoming owners', '  Family-run, openly LGBTQ+-friendly hotel.  ') $$,
  'no evidence pack + a note + a summary → approved');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, public_summary)
  values (101, 'approved', 'Inclusive policy, strong reviews.') $$,
  'clean evidence pack → approved without a note');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (102, 'approved', 'fine', 'OK hotel.') $$,
  '23514', 'The evidence pack has concerns: confirm you reviewed them',
  'pack with concerns + no acknowledgement → refused');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, concerns_acknowledged, public_summary)
  values (102, 'approved', true, 'OK hotel.') $$,
  '23514', 'The evidence pack has concerns: explain why the hotel is still approved',
  'pack with concerns + acknowledgement but no note → refused');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, concerns_acknowledged, note, public_summary)
  values (102, 'approved', true, 'Rule only applies to unregistered guests; confirmed by phone', 'Welcoming; see house rules.') $$,
  'pack with concerns + acknowledgement + note → approved');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (100, 'approved', 'again', 'Again.') $$,
  '23505', 'This hotel is already on the whitelist',
  'a hotel already on the whitelist cannot be approved again');

-- ── An approval puts the hotel on the whitelist, with the public summary ────
reset role;
select results_eq(
  $$ select hid, status::text, approved_by, vetting_summary from public.approved_properties order by hid $$,
  $$ values
     (100::bigint, 'approved', 'eeeeeeee-0000-0000-0000-00000000000c'::uuid, 'Family-run, openly LGBTQ+-friendly hotel.'),
     (101::bigint, 'approved', 'eeeeeeee-0000-0000-0000-00000000000c'::uuid, 'Inclusive policy, strong reviews.'),
     (102::bigint, 'approved', 'eeeeeeee-0000-0000-0000-00000000000c'::uuid, 'Welcoming; see house rules.') $$,
  'approved hotels are on the whitelist, attributed to the approver, with their (trimmed) public summary'
);
select results_eq(
  $$ select hid, note, concerns_acknowledged, evidence_pack_id from public.vetting_decisions
     where decision = 'approved' order by hid $$,
  $$ values
     (100::bigint, 'Visited in person, welcoming owners', false, null::uuid),
     (101::bigint, null, false, '11111111-0000-0000-0000-000000000101'::uuid),
     (102::bigint, 'Rule only applies to unregistered guests; confirmed by phone', true, '11111111-0000-0000-0000-000000000102'::uuid) $$,
  'the log keeps the staff note, the acknowledgement, and the evidence pack on record (set by the database)'
);
select is(
  (select count(*) from public.approved_properties where hid = 103), 0::bigint,
  'a refused approval adds nothing to the whitelist'
);
select is(
  (select count(*) from public.vetting_decisions where hid = 103), 0::bigint,
  'a refused approval leaves no log entry'
);

-- ── The evidence pack on record can't be chosen by the client ───────────────
select tests.login_as('eeeeeeee-0000-0000-0000-00000000000c');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, public_summary, evidence_pack_id)
  values (104, 'approved', 'x', '11111111-0000-0000-0000-000000000101') $$,
  '42501', null, 'the client cannot pick which evidence pack is recorded');

-- ── Staff can no longer write to the whitelist directly ─────────────────────
select throws_ok($$ insert into public.approved_properties (hid, approved_by, vetting_summary)
  values (104, 'eeeeeeee-0000-0000-0000-00000000000c', 'x') $$,
  '42501', null, 'direct inserts into approved_properties are closed (no way around the rules or the log)');

-- ── Rejecting ────────────────────────────────────────────────────────────────
select lives_ok($$ insert into public.vetting_decisions (hid, decision) values (104, 'rejected') $$,
  'reject without a reason (reason is optional)');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note) values (105, 'rejected', 'Discriminatory house rule') $$,
  'reject with a reason');
select is(
  (select decided_by from public.vetting_decisions where hid = 104),
  'eeeeeeee-0000-0000-0000-00000000000c'::uuid,
  'a decision is attributed to the signed-in staff member automatically'
);
select throws_ok($$ insert into public.vetting_decisions (hid, decision, public_summary) values (106, 'rejected', 'x') $$,
  '23514', 'A rejection has no public summary or concerns acknowledgement',
  'a rejection cannot carry a public summary');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (100, 'rejected') $$,
  '23505', 'This hotel is already on the whitelist',
  'a whitelisted hotel cannot be rejected (it must be suspended instead)');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, decided_by)
  values (106, 'rejected', 'eeeeeeee-0000-0000-0000-00000000000d') $$,
  '42501', null, 'cannot record a decision in a colleague''s name');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (106, 'suspended') $$,
  '23514', 'Only an approved hotel can be suspended', 'a "suspended" entry can only be recorded for a hotel that is actually approved');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, decided_at)
  values (106, 'rejected', '2000-01-01') $$,
  '42501', null, 'cannot backdate a decision');

-- ── Re-review: a rejected hotel can be approved later, both entries kept ────
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (105, 'approved', 'Rule removed after we contacted the hotel', 'Now welcoming to all guests.') $$,
  'a previously rejected hotel can be approved');
select results_eq(
  $$ select decision::text from public.vetting_decisions where hid = 105 order by id $$,
  $$ values ('rejected'), ('approved') $$,
  'both the rejection and the later approval stay in the log'
);

-- ── Suspend / reactivate: recorded decisions too, with a reason ─────────────
select tests.login_as('eeeeeeee-0000-0000-0000-00000000000d');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (100, 'reinstated') $$,
  '23514', 'Only a suspended hotel can be reactivated', 'an approved hotel cannot be reactivated');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (100, 'suspended') $$,
  '23514', 'Suspending or reactivating requires a reason', 'suspending without a reason is refused');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note) values (100, 'suspended', '   ') $$,
  '23514', 'Suspending or reactivating requires a reason', 'a blank reason does not count');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note) values (100, 'suspended', 'Guest complaint under review') $$,
  'suspend with a reason');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (100, 'suspended') $$,
  '23514', 'Only an approved hotel can be suspended', 'a suspended hotel cannot be suspended again');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, public_summary) values (100, 'reinstated', 'x') $$,
  '23514', 'Suspending or reactivating has no public summary or concerns acknowledgement',
  'reactivating cannot change the public summary');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (100, 'reinstated') $$,
  '23514', 'Suspending or reactivating requires a reason', 'reactivating without a reason is refused');
select lives_ok($$ insert into public.vetting_decisions (hid, decision, note) values (100, 'reinstated', 'Complaint resolved') $$,
  'reactivate with a reason');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (999, 'suspended') $$,
  '23514', 'Only an approved hotel can be suspended', 'a hotel that is not on the whitelist cannot be suspended');
reset role;
select is((select status::text from public.approved_properties where hid = 100), 'approved',
  'the whitelist status follows the decisions');
select results_eq(
  $$ select decision::text, note, decided_by from public.vetting_decisions where hid = 100 order by id $$,
  $$ values ('approved', 'Visited in person, welcoming owners', 'eeeeeeee-0000-0000-0000-00000000000c'::uuid),
            ('suspended', 'Guest complaint under review', 'eeeeeeee-0000-0000-0000-00000000000d'::uuid),
            ('reinstated', 'Complaint resolved', 'eeeeeeee-0000-0000-0000-00000000000d'::uuid) $$,
  'every approve, suspend and reactivate is logged with who, what and the reason'
);

-- ── Public vs staff-only (Decisions #6) ─────────────────────────────────────
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;
select results_eq(
  $$ select vetting_summary from public.approved_properties where hid = 101 $$,
  $$ values ('Inclusive policy, strong reviews.'::text) $$,
  'anyone can read the public vetting summary of an approved hotel'
);
select throws_ok($$ select * from public.vetting_decisions $$, '42501', null,
  'anon cannot read the decision log (staff notes stay private)');
reset role;
select is_empty(
  $$ select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'approved_properties'
       and column_name in ('approval_note', 'note', 'concerns_acknowledged', 'internal_notes') $$,
  'approved_properties holds no staff-only columns'
);

-- ── The log is append-only and staff-only ───────────────────────────────────
select tests.login_as('eeeeeeee-0000-0000-0000-00000000000c');
select is((select count(*) from public.vetting_decisions), 8::bigint,
  'staff with 2FA read the whole log (4 approvals, 2 rejections, 1 suspension, 1 reinstatement)');
select throws_ok($$ update public.vetting_decisions set note = 'edited' $$, '42501', null, 'staff cannot edit the log');
select throws_ok($$ delete from public.vetting_decisions $$, '42501', null, 'staff cannot delete from the log');
reset role;

select tests.login_as('eeeeeeee-0000-0000-0000-00000000000c', 'aal1');
select is_empty($$ select 1 from public.vetting_decisions $$, 'staff without 2FA: cannot read the log');
select throws_ok($$ insert into public.vetting_decisions (hid, decision) values (107, 'rejected') $$,
  '42501', null, 'staff without 2FA: cannot reject');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (107, 'approved', 'n', 's') $$, '42501', null, 'staff without 2FA: cannot approve');
reset role;

select tests.login_as('eeeeeeee-0000-0000-0000-00000000000a');
select is_empty($$ select 1 from public.vetting_decisions $$, 'traveler (even with 2FA): cannot read the log');
select throws_ok($$ insert into public.vetting_decisions (hid, decision, note, public_summary)
  values (107, 'approved', 'n', 's') $$, '42501', null, 'traveler: cannot approve');
reset role;

-- ── Admin SQL bypasses the app, but not the log ─────────────────────────────
-- Admin SQL runs with no signed-in user.
select set_config('request.jwt.claims', '', true);
update public.approved_properties set status = 'suspended' where hid = 101;
select results_eq(
  $$ select decision::text, note, decided_by from public.vetting_decisions
     where hid = 101 order by id desc limit 1 $$,
  $$ values ('suspended', 'Changed directly in the database (admin)', 'eeeeeeee-0000-0000-0000-00000000000c'::uuid) $$,
  'a status change made directly in admin SQL is logged and marked as an admin change'
);

-- ── The trigger functions are not API endpoints ─────────────────────────────
select throws_ok($$ select public.apply_vetting_decision() $$, '0A000', null,
  'the approval trigger function cannot be called directly');
select ok(
  not has_function_privilege('authenticated', 'public.check_vetting_decision()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.apply_vetting_decision()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.log_whitelist_status_change()', 'EXECUTE'),
  'API roles cannot execute the trigger functions'
);

select * from finish();
rollback;
