import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent } from "@/mock/ratehawk";
import { toAuditEntries, whoLabel, type AuditEntry, type Decision, type DecisionRow } from "./rows";

export type EvidenceRun = {
  hid: number;
  hotel: string;
  status: "ready" | "failed";
  failure_reason: string | null;
  model: string | null;
  who: string;
  generated_at: string;
};

const LIMIT = 200;

// Loads the audit log for the staff view, through the signed-in staff
// member's own session: RLS lets only staff with 2FA read it.
export async function loadAudit(filters: {
  hid?: number;
  decision?: Decision;
}): Promise<
  | { ok: true; decisions: AuditEntry[]; evidenceRuns: EvidenceRun[]; truncated: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();

  let decisionQuery = supabase
    .from("vetting_decisions")
    .select(
      "id, hid, decision, note, concerns_acknowledged, public_summary, evidence_pack_id, decided_by, decided_at",
    )
    .order("decided_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMIT + 1);
  if (filters.hid) decisionQuery = decisionQuery.eq("hid", filters.hid);
  if (filters.decision) decisionQuery = decisionQuery.eq("decision", filters.decision);

  let runQuery = supabase
    .from("evidence_packs")
    .select("hid, status, failure_reason, model, generated_by, generated_at")
    .order("generated_at", { ascending: false })
    .limit(LIMIT);
  if (filters.hid) runQuery = runQuery.eq("hid", filters.hid);

  const [decisionsRes, runsRes] = await Promise.all([decisionQuery, runQuery]);
  if (decisionsRes.error || runsRes.error) {
    return { ok: false, error: "Couldn't load the audit log. Refresh to try again." };
  }

  const decisionRows = (decisionsRes.data ?? []) as DecisionRow[];
  const runRows = runsRes.data ?? [];

  const userIds = [
    ...new Set([...decisionRows.map((r) => r.decided_by), ...runRows.map((r) => r.generated_by)]),
  ];
  const names = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data } = await supabase.from("users").select("id, display_name").in("id", userIds);
    for (const u of data ?? []) names.set(u.id, u.display_name);
  }
  const hotelNames = new Map(mockHotelContent.map((h) => [h.hid, h.name]));

  const decisions = toAuditEntries(decisionRows.slice(0, LIMIT), names, hotelNames);
  const evidenceRuns: EvidenceRun[] = runRows.map((r) => ({
    hid: r.hid,
    hotel: hotelNames.get(r.hid) ?? `Hotel ${r.hid}`,
    status: r.status,
    failure_reason: r.failure_reason,
    model: r.model,
    who: whoLabel(r.generated_by, names),
    generated_at: r.generated_at,
  }));

  return { ok: true, decisions, evidenceRuns, truncated: decisionRows.length > LIMIT };
}
