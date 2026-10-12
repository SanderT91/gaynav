-- Epic 1.4 — staff display names for the audit log.
-- Run with: npm run db:test
begin;
select plan(9);

insert into auth.users (id, email) values
  ('ffffffff-0000-0000-0000-00000000000a', 'traveler@test.local'),
  ('ffffffff-0000-0000-0000-00000000000c', 'curator@test.local');
update public.users set role = 'staff' where id = 'ffffffff-0000-0000-0000-00000000000c';

select results_eq(
  $$ select display_name from admin.set_display_name('Curator@test.local', '  Alex (curation)  ') $$,
  $$ values ('Alex (curation)'::text) $$,
  'an admin sets a display name (email match ignores case; name is trimmed)'
);
select is(
  (select display_name from public.users where id = 'ffffffff-0000-0000-0000-00000000000c'),
  'Alex (curation)', 'the name is stored on the user'
);
select throws_ok($$ select * from admin.set_display_name('nobody@test.local', 'x') $$,
  'P0002', null, 'unknown email is rejected');
select throws_ok($$ update public.users set display_name = repeat('x', 81) $$,
  '23514', null, 'names are at most 80 characters');

-- Staff with 2FA see names; others don't see anyone else's.
select set_config('request.jwt.claims',
  '{"sub": "ffffffff-0000-0000-0000-00000000000c", "role": "authenticated", "aal": "aal2"}', true);
set local role authenticated;
select results_eq(
  $$ select display_name from public.users where id = 'ffffffff-0000-0000-0000-00000000000c' $$,
  $$ values ('Alex (curation)'::text) $$,
  'staff with 2FA can read display names'
);
select throws_ok($$ update public.users set display_name = 'Me' where id = 'ffffffff-0000-0000-0000-00000000000c' $$,
  '42501', null, 'nobody can change a display name through the API');
select throws_ok($$ select * from admin.set_display_name('curator@test.local', 'x') $$,
  '42501', null, 'staff cannot use the admin tool');
reset role;

select set_config('request.jwt.claims',
  '{"sub": "ffffffff-0000-0000-0000-00000000000a", "role": "authenticated", "aal": "aal2"}', true);
set local role authenticated;
select is_empty(
  $$ select 1 from public.users where id = 'ffffffff-0000-0000-0000-00000000000c' $$,
  'a traveler cannot see staff names'
);
reset role;

set local role service_role;
select throws_ok($$ select * from admin.set_display_name('curator@test.local', 'x') $$,
  '42501', null, 'service_role (app server code) cannot set names');
reset role;

select * from finish();
rollback;
