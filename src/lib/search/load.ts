import "server-only";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent, mockSearchResponse, type MockSearch } from "@/mock/ratehawk";
import { searchApproved, type ApprovedHotel, type SearchResult } from "./search";

// Loads public search results on the server.
//
// The whitelist is read with the visitor's own session (anonymous for most
// visitors). RLS lets anyone read approved rows only — but staff with 2FA may
// read suspended rows too, so the query also filters on status explicitly:
// a staff member browsing the public site must see exactly what travellers see.
export async function loadSearch(
  city?: string,
): Promise<
  { ok: true; results: SearchResult[]; searched: MockSearch } | { ok: false; error: string }
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approved_properties")
    .select("hid, vetting_summary")
    .eq("status", "approved");

  if (error) {
    return { ok: false, error: "We couldn't load hotels just now. Please try again in a moment." };
  }

  const results = searchApproved({
    approved: (data ?? []) as ApprovedHotel[],
    hotels: mockHotelContent,
    search: mockSearchResponse,
    city,
  });
  return { ok: true, results, searched: mockSearchResponse._search };
}

/** The launch cities, for the city filter. */
export const LAUNCH_CITIES = ["London", "Paris", "Rome", "Tokyo", "Bangkok", "Ho Chi Minh City"];
