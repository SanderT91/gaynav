-- Epic 0.2 — Row level security for `users` and `approved_properties`.
--
-- This is GAYNAV's real access boundary (CLAUDE.md: "Security enforcement lives
-- in the database, not the UI"). Two layers work together:
--
--   1. GRANTs decide which *operations and columns* a database role may use at
--      all. Supabase maps every request to one of two roles: `anon` (no session)
--      or `authenticated` (any signed-in user — traveler, partner AND staff).
--   2. RLS POLICIES decide which *rows* that operation may touch, based on who
--      the signed-in user is (auth.uid()), their role in public.users, and
--      whether their session passed 2FA.
--
-- Because traveler, partner and staff all share the `authenticated` database
-- role, a column granted to `authenticated` is readable by every signed-in user
-- on every row they can see. Column grants are therefore kept to what the
-- least-privileged user may see; staff power comes from row policies.
--
-- Access matrix (anything not listed is denied):
--
--   public.users
--     anon .................. nothing
--     traveler / partner .... SELECT own row
--     staff (2FA) ........... SELECT all rows
--     anyone via the API .... no INSERT / UPDATE / DELETE. Rows are created by
--                             the sign-up trigger; roles change only through
--                             service_role (server-side admin tooling), so not
--                             even a compromised staff session can mint staff.
--
--   public.approved_properties
--     anon / traveler / partner / staff without 2FA
--                             SELECT (id, hid, status, approved_at, created_at,
--                             updated_at) of rows with status = 'approved' only
--     staff (2FA) ........... SELECT the same columns of ALL rows (incl. suspended)
--                             INSERT (hid, approved_by) with approved_by = self
--                             UPDATE (status) — suspend / reinstate
--     anyone via the API .... no DELETE (suspend instead, history is kept);
--                             `approved_by` is not readable through the API
--                             (who-did-what is the job of the staff-only audit
--                             log, Epic 1.4).
--
-- service_role bypasses RLS by design and is used only in server-side code.

-- ── Helpers ──────────────────────────────────────────────────────────────────
-- Kept in a `private` schema that is NOT exposed through the Data API, so they
-- can be used inside policies but not called as RPC endpoints.
create schema private;
grant usage on schema private to anon, authenticated;

-- True only when the caller (a) is signed in, (b) holds the staff role in
-- public.users right now, and (c) completed a second factor in this session
-- (JWT claim aal = 'aal2'). The role is read from the table on every call, not
-- from the JWT, so demoting a staff member takes effect immediately, and
-- client-editable JWT metadata is never trusted.
--
-- SECURITY DEFINER so it can read public.users without the caller needing
-- (or recursing into) users' own RLS policies.
create function private.is_staff_with_mfa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid()) and u.role = 'staff'
    );
$$;

revoke execute on function private.is_staff_with_mfa() from public;
grant execute on function private.is_staff_with_mfa() to anon, authenticated;

-- ── public.users ─────────────────────────────────────────────────────────────
grant select on table public.users to authenticated;

create policy "users: read own row"
  on public.users for select
  to authenticated
  using (id = (select auth.uid()));

create policy "users: staff with 2FA read all rows"
  on public.users for select
  to authenticated
  using ((select private.is_staff_with_mfa()));

-- ── public.approved_properties ───────────────────────────────────────────────
grant select (id, hid, status, approved_at, created_at, updated_at)
  on table public.approved_properties to anon, authenticated;
grant insert (hid, approved_by)
  on table public.approved_properties to authenticated;
grant update (status)
  on table public.approved_properties to authenticated;

create policy "approved_properties: public reads approved rows"
  on public.approved_properties for select
  to anon, authenticated
  using (status = 'approved');

create policy "approved_properties: staff with 2FA read all rows"
  on public.approved_properties for select
  to authenticated
  using ((select private.is_staff_with_mfa()));

create policy "approved_properties: staff with 2FA approve, as themselves"
  on public.approved_properties for insert
  to authenticated
  with check (
    (select private.is_staff_with_mfa())
    and approved_by = (select auth.uid())
  );

create policy "approved_properties: staff with 2FA change status"
  on public.approved_properties for update
  to authenticated
  using ((select private.is_staff_with_mfa()))
  with check ((select private.is_staff_with_mfa()));
