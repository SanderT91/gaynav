-- Epic 1.3: suspending or reactivating a hotel needs a reason (CLAUDE.md:
-- "suspend and reactivate actions … each with a required reason"). The
-- original trigger allowed an empty note. Same function, one extra rule,
-- checked after the state rules so those errors still come first.
-- Admin SQL status changes are unaffected: they log their own note.

create or replace function public.check_vetting_decision()
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
    if new.note is null then
      raise exception 'Suspending or reactivating requires a reason'
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

revoke execute on function public.check_vetting_decision() from public, anon, authenticated;
