import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovedHotel } from "./search";

// The one query the public site uses to read the whitelist.
//
// RLS lets anonymous visitors read approved rows only, but staff with 2FA (and
// the service role) can read suspended rows too. Filtering on status here
// means the public site shows exactly the approved hotels, whoever is looking.
// Proven against a real database in whitelist.integration.test.ts.
export async function fetchPublicWhitelist(
  supabase: SupabaseClient,
): Promise<{ ok: true; approved: ApprovedHotel[] } | { ok: false }> {
  const { data, error } = await supabase
    .from("approved_properties")
    .select("hid, vetting_summary")
    .eq("status", "approved");
  if (error) return { ok: false };
  return { ok: true, approved: (data ?? []) as ApprovedHotel[] };
}

/** The same rule for one hotel (the property page): approved, or null. */
export async function fetchPublicApproval(
  supabase: SupabaseClient,
  hid: number,
): Promise<{ ok: true; approved: ApprovedHotel | null } | { ok: false }> {
  const { data, error } = await supabase
    .from("approved_properties")
    .select("hid, vetting_summary")
    .eq("hid", hid)
    .eq("status", "approved")
    .maybeSingle();
  if (error) return { ok: false };
  return { ok: true, approved: (data as ApprovedHotel | null) ?? null };
}
