import "server-only";
import { mockSearchRates } from "@/lib/rates/mock-search";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent } from "@/mock/ratehawk";
import type { SearchParams } from "./params";
import { approvedInCity, searchApproved, type SearchResult } from "./search";
import { fetchPublicWhitelist } from "./whitelist";

// Loads public search results on the server, for a complete, validated search
// (dates and guests are required — see params.ts).
//
// The whitelist is read with the visitor's own session (anonymous for most
// visitors). RLS lets anyone read approved rows only — but staff with 2FA may
// read suspended rows too, so the query also filters on status explicitly:
// a staff member browsing the public site must see exactly what travellers see.
export async function loadSearch(
  params: SearchParams,
  today: string,
): Promise<
  { ok: true; results: SearchResult[]; approvedAnywhere: number } | { ok: false; error: string }
> {
  const whitelist = await fetchPublicWhitelist(await createClient());
  if (!whitelist.ok) {
    return { ok: false, error: "We couldn't load hotels just now. Please try again in a moment." };
  }

  const approved = whitelist.approved;
  const rates = mockSearchRates(params, today); // MOCK until Phase 3
  const results = searchApproved({
    approved,
    hotels: mockHotelContent,
    search: rates,
    city: params.city,
  });
  // For the empty state: are there hotels in other cities?
  const approvedAnywhere = params.city
    ? searchApproved({ approved, hotels: mockHotelContent, search: rates }).length
    : results.length;
  return { ok: true, results, approvedAnywhere };
}

/** Approved hotels in one city, for its city page (no dates, no prices). */
export async function loadCityHotels(
  city: string,
): Promise<{ ok: true; hotels: SearchResult[] } | { ok: false }> {
  const whitelist = await fetchPublicWhitelist(await createClient());
  if (!whitelist.ok) return { ok: false };
  return {
    ok: true,
    hotels: approvedInCity({ approved: whitelist.approved, hotels: mockHotelContent, city }),
  };
}
