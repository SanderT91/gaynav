-- Epic 0.2 — `approved_properties`: GAYNAV's hotel whitelist.
--
-- Every public search is filtered against this table before RateHawk is asked
-- for rates. A row exists only because a staff member approved that hotel.
--
-- The table holds the *decision*, not the hotel content. Hotels are keyed by
-- RateHawk's `hid` (their stable numeric hotel id — not the string `id`, per
-- RateHawk's mapping guidance). Name, photos, amenities etc. come from the data
-- layer (mock fixture in Phases 1–2, stored RateHawk static dump from Phase 3)
-- and are joined on `hid`, so swapping mock data for real data never touches
-- this table.

create type public.property_status as enum ('approved', 'suspended');

create table public.approved_properties (
  id uuid primary key default gen_random_uuid(),
  hid bigint not null unique check (hid > 0),
  status public.property_status not null default 'approved',
  -- Accountability: who approved it. ON DELETE RESTRICT means a staff account
  -- that has approved properties cannot be hard-deleted and silently erase
  -- that trail; staff offboarding is a role change / ban instead.
  approved_by uuid not null references public.users (id) on delete restrict,
  approved_at timestamptz not null default now(),
  -- Staff-only working notes; never exposed to the public (see RLS policies).
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.approved_properties is
  'Hotel whitelist. Only rows with status = approved may ever appear publicly. Rows are created by staff approval only — never automatically.';
comment on column public.approved_properties.hid is
  'RateHawk hotel id (hid). Join key to static hotel content and live rates.';
comment on column public.approved_properties.status is
  'approved = publicly visible. suspended = temporarily pulled (kept for history instead of deleting).';

-- Closed by default, exactly like public.users: RLS on, no policies, no grants.
alter table public.approved_properties enable row level security;
revoke all on table public.approved_properties from anon, authenticated;

create trigger approved_properties_set_updated_at
  before update on public.approved_properties
  for each row execute function public.set_updated_at();

-- The approver must hold the staff role at the time of approval. Enforced in
-- the database so it holds for every write path, including server-side code
-- running as service_role (which bypasses RLS).
create function public.assert_approver_is_staff()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.users u
    where u.id = new.approved_by and u.role = 'staff'
  ) then
    raise exception 'approved_by must reference a user with the staff role'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger approved_properties_approver_is_staff
  before insert or update of approved_by on public.approved_properties
  for each row execute function public.assert_approver_is_staff();

revoke execute on function public.assert_approver_is_staff() from public, anon, authenticated;
