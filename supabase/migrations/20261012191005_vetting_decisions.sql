-- Epic 1.3 (approve / reject) + Epic 1.4 (audit log of every staff decision).
--
-- Owner decisions (2026-10-12):
--   - Rejecting: a reason is optional.
--   - Approving without an AI evidence pack: allowed, with a written note.
--   - Approving when the latest evidence pack contains "concern" signals:
--     requires an explicit "I have reviewed the concerns" and a note.
--   - A rejected hotel can be reviewed again at any time; both decisions stay
--     in the log.
--   - On approval, staff write the short PUBLIC vetting summary (separate from
--     the AI evidence pack; CLAUDE.md Decisions #6).
--
-- How it fits together:
--   - A decision is recorded by inserting into vetting_decisions (staff-only,
--     append-only). That is the ONLY way staff approve or reject a hotel.
--   - The database checks the rules on that insert, then — for an approval —
--     adds the hotel to approved_properties itself. Staff can no longer insert
--     into approved_properties directly, so nothing can skip the rules or the
--     log.
--   - approved_properties keeps only public fields (Decisions #6): it gains the
--     public vetting summary; staff notes stay in the staff-only log.
--   - Suspending and reinstating work the same way (Epic 1.4: every approve,
--     reject, suspend and reactivate is logged with who, what, when and the
--     reason): staff record the decision, the database changes the status.
--     Staff can no longer change the whitelist status directly. A status
--     change made directly in admin SQL is still logged, by a trigger.

create type public.vetting_decision as enum ('approved', 'rejected', 'suspended', 'reinstated');

-- ── Public vetting summary on the whitelist (public field) ──────────────────
alter table public.approved_properties
  add column vetting_summary text not null
    check (length(trim(vetting_summary)) between 1 and 600);

grant select (vetting_summary) on table public.approved_properties to anon, authenticated;

-- Staff no longer write to the whitelist directly; see vetting_decisions.
revoke insert, update on table public.approved_properties from authenticated;
drop policy "approved_properties: staff with 2FA approve, as themselves" on public.approved_properties;
drop policy "approved_properties: staff with 2FA change status" on public.approved_properties;

-- ── The decision log ─────────────────────────────────────────────────────────
create table public.vetting_decisions (
  id bigint generated always as identity primary key,
  hid bigint not null check (hid > 0),
  decision public.vetting_decision not null,
  -- Staff-only reasoning. Never shown publicly.
  note text check (note is null or length(note) <= 2000),
  concerns_acknowledged boolean not null default false,
  -- The public summary written on approval (copied to approved_properties).
  public_summary text check (public_summary is null or length(public_summary) <= 600),
  -- The evidence pack that was the latest one when the decision was made.
  -- Set by the database, not the client.
  evidence_pack_id uuid references public.evidence_packs (id) on delete restrict,
  decided_by uuid not null default auth.uid() references public.users (id) on delete restrict,
  decided_at timestamptz not null default now()
);

create index vetting_decisions_hid on public.vetting_decisions (hid, decided_at desc);

comment on table public.vetting_decisions is
  'Audit log of every staff vetting decision (who, what, when, why). Staff-only (2FA), append-only. Inserting an "approved" row is how a hotel is approved.';

alter table public.vetting_decisions enable row level security;
revoke all on table public.vetting_decisions from anon, authenticated;
grant select on table public.vetting_decisions to authenticated;
grant insert (hid, decision, note, concerns_acknowledged, public_summary)
  on table public.vetting_decisions to authenticated;

create policy "vetting_decisions: staff with 2FA read"
  on public.vetting_decisions for select
  to authenticated
  using ((select private.is_staff_with_mfa()));

create policy "vetting_decisions: staff with 2FA record a decision, as themselves"
  on public.vetting_decisions for insert
  to authenticated
  with check (
    (select private.is_staff_with_mfa())
    and decided_by = (select auth.uid())
  );

-- ── Rules, checked on every approve / reject ────────────────────────────────
-- SECURITY DEFINER so it can read evidence_packs and approved_properties
-- regardless of who inserts. Not callable through the API.
create function public.check_vetting_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack_id uuid;
  v_has_concerns boolean := false;
  v_on_whitelist boolean;
  v_status public.property_status;
begin
  -- Rows written by log_whitelist_status_change() (admin SQL) are already
  -- facts; don't re-check them.
  if current_setting('gaynav.logging_status_change', true) = 'on' then
    return new;
  end if;

  select ep.id,
         exists (
           select 1 from jsonb_array_elements(coalesce(ep.pack -> 'signals', '[]'::jsonb)) s
           where s ->> 'tone' = 'concern'
         )
    into v_pack_id, v_has_concerns
  from public.evidence_packs ep
  where ep.hid = new.hid and ep.status = 'ready'
  order by ep.generated_at desc
  limit 1;

  new.evidence_pack_id := v_pack_id;  -- never trust the client for this
  new.note := nullif(trim(new.note), '');
  new.public_summary := nullif(trim(new.public_summary), '');

  select ap.status into v_status from public.approved_properties ap where ap.hid = new.hid;
  v_on_whitelist := found;

  if new.decision in ('suspended', 'reinstated') then
    if new.public_summary is not null or new.concerns_acknowledged then
      raise exception 'Suspending or reactivating has no public summary or concerns acknowledgement'
        using errcode = 'check_violation';
    end if;
    if new.decision = 'suspended' and v_status is distinct from 'approved' then
      raise exception 'Only an approved hotel can be suspended'
        using errcode = 'check_violation';
    end if;
    if new.decision = 'reinstated' and v_status is distinct from 'suspended' then
      raise exception 'Only a suspended hotel can be reactivated'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if v_on_whitelist then
    raise exception 'This hotel is already on the whitelist'
      using errcode = 'unique_violation';
  end if;

  if new.decision = 'rejected' then
    if new.public_summary is not null or new.concerns_acknowledged then
      raise exception 'A rejection has no public summary or concerns acknowledgement'
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  -- Approved:
  if new.public_summary is null then
    raise exception 'Approving requires a public vetting summary'
      using errcode = 'check_violation';
  end if;
  if v_pack_id is null and new.note is null then
    raise exception 'Approving without an evidence pack requires a note'
      using errcode = 'check_violation';
  end if;
  if v_has_concerns and not new.concerns_acknowledged then
    raise exception 'The evidence pack has concerns: confirm you reviewed them'
      using errcode = 'check_violation';
  end if;
  if v_has_concerns and new.note is null then
    raise exception 'The evidence pack has concerns: explain why the hotel is still approved'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger vetting_decisions_check
  before insert on public.vetting_decisions
  for each row execute function public.check_vetting_decision();

-- ── An approval puts the hotel on the whitelist ─────────────────────────────
create function public.apply_vetting_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('gaynav.logging_status_change', true) = 'on' then
    return new;  -- the status already changed; this row only records it
  end if;
  if new.decision = 'approved' then
    insert into public.approved_properties (hid, approved_by, vetting_summary)
    values (new.hid, new.decided_by, new.public_summary);
  elsif new.decision in ('suspended', 'reinstated') then
    perform set_config('gaynav.applying_decision', 'on', true);
    update public.approved_properties
      set status = case when new.decision = 'suspended' then 'suspended' else 'approved' end::public.property_status
      where hid = new.hid;
    perform set_config('gaynav.applying_decision', 'off', true);
  end if;
  return new;
end;
$$;

create trigger vetting_decisions_apply
  after insert on public.vetting_decisions
  for each row execute function public.apply_vetting_decision();

-- ── Status changes made outside a decision (admin SQL) are logged too ──────
create function public.log_whitelist_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pack_id uuid;
begin
  if new.status is distinct from old.status
     and coalesce(current_setting('gaynav.applying_decision', true), 'off') <> 'on' then
    select ep.id into v_pack_id
    from public.evidence_packs ep
    where ep.hid = new.hid and ep.status = 'ready'
    order by ep.generated_at desc
    limit 1;

    perform set_config('gaynav.logging_status_change', 'on', true);
    insert into public.vetting_decisions (hid, decision, note, evidence_pack_id, decided_by)
    values (
      new.hid,
      case when new.status = 'suspended' then 'suspended' else 'reinstated' end::public.vetting_decision,
      'Changed directly in the database (admin)',
      v_pack_id,
      -- Admin SQL has no auth.uid(); fall back to the original approver
      -- rather than leave it blank. The note above marks it as an admin change.
      coalesce(auth.uid(), new.approved_by)
    );
    perform set_config('gaynav.logging_status_change', 'off', true);
  end if;
  return new;
end;
$$;

create trigger approved_properties_log_status_change
  after update of status on public.approved_properties
  for each row execute function public.log_whitelist_status_change();

revoke execute on function public.check_vetting_decision() from public, anon, authenticated;
revoke execute on function public.apply_vetting_decision() from public, anon, authenticated;
revoke execute on function public.log_whitelist_status_change() from public, anon, authenticated;
