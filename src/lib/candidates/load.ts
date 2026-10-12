import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent } from "@/mock/ratehawk";
import { buildCandidateRows, type Approval, type CandidateRow } from "./list";

// Loads the candidate list for the staff UI.
//
// Candidates come from the mock RateHawk fixture in Phases 1–2 (Phase 3 swaps
// in the stored RateHawk dump). Whitelist status comes from approved_properties
// through the signed-in staff member's own session, so RLS applies: staff with
// 2FA see approved and suspended rows.
export async function loadCandidateRows(): Promise<
  { ok: true; rows: CandidateRow[] } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("approved_properties").select("hid, status");
  if (error) {
    return { ok: false, error: "Couldn't load whitelist statuses. Refresh to try again." };
  }
  return { ok: true, rows: buildCandidateRows(mockHotelContent, (data ?? []) as Approval[]) };
}
