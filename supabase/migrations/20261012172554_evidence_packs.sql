-- Epic 1.2 — Stored AI evidence packs. STAFF-ONLY (CLAUDE.md, Decisions #6).
--
-- One row per generation attempt, successful or not. Rows are never edited or
-- deleted: regenerating adds a new row, so there is a full history of what the
-- AI said about a hotel, when, and who asked. The staff UI shows the latest.
--
-- Candidates themselves are not in the database in Phases 1–2 (they come from
-- the mock RateHawk fixtures), so `hid` is a plain RateHawk hotel id, not a
-- foreign key.

create type public.evidence_pack_status as enum ('ready', 'failed');

create table public.evidence_packs (
  id uuid primary key default gen_random_uuid(),
  hid bigint not null check (hid > 0),
  status public.evidence_pack_status not null,
  -- The validated pack (summary, signals, open questions). Only when ready.
  pack jsonb,
  -- Snapshot of the sources the AI was given, so citations still resolve
  -- even if the underlying data changes later.
  sources jsonb,
  -- Why it failed and what staff were told. Only when failed.
  failure_reason text,
  failure_message text,
  model text,
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  generated_by uuid not null references public.users (id) on delete restrict,
  generated_at timestamptz not null default now(),
  -- A ready pack always has content and sources; a failed one never has a pack.
  constraint evidence_packs_ready_has_content check (
    (status = 'ready' and pack is not null and sources is not null and failure_reason is null)
    or (status = 'failed' and pack is null and failure_reason is not null and failure_message is not null)
  )
);

create index evidence_packs_hid_latest on public.evidence_packs (hid, generated_at desc);

comment on table public.evidence_packs is
  'AI evidence packs for candidate hotels. Staff-only (2FA). Append-only: never updated or deleted through the API.';

alter table public.evidence_packs enable row level security;
revoke all on table public.evidence_packs from anon, authenticated;

-- Staff with a 2FA session can read and add packs. No update/delete grants at
-- all, so history can't be rewritten through the API.
grant select on table public.evidence_packs to authenticated;
grant insert (hid, status, pack, sources, failure_reason, failure_message, model, input_tokens, output_tokens, generated_by)
  on table public.evidence_packs to authenticated;

create policy "evidence_packs: staff with 2FA read"
  on public.evidence_packs for select
  to authenticated
  using ((select private.is_staff_with_mfa()));

create policy "evidence_packs: staff with 2FA add, as themselves"
  on public.evidence_packs for insert
  to authenticated
  with check (
    (select private.is_staff_with_mfa())
    and generated_by = (select auth.uid())
  );
