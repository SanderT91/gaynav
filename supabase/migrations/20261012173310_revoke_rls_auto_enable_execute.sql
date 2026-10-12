-- Epic 0.2 follow-up — clear Supabase security-advisor warnings 0028/0029.
--
-- The hosted project has a Supabase-provided safety net: an event trigger
-- (`ensure_rls`) whose function `public.rls_auto_enable()` switches RLS on for
-- every new table in `public`. We keep it. But as created, its function is
-- executable by `anon` and `authenticated` through /rest/v1/rpc/, which the
-- security advisor flags. It can't actually be run that way (it returns
-- `event_trigger`, which the API refuses — verified: HTTP 400), but revoking
-- the grant removes the exposure and keeps the advisor clean, so real
-- warnings stand out. Event triggers don't need EXECUTE for the roles that
-- fire them, so the safety net keeps working.
--
-- The function exists on the hosted project only (not in the local stack),
-- hence the existence check.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
