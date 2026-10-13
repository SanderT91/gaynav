import "server-only";
import { mockSearchRates } from "@/lib/rates/mock-search";
import type { SearchParams } from "@/lib/search/params";
import { fetchPublicApproval } from "@/lib/search/whitelist";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent } from "@/mock/ratehawk";
import { buildHotelDetail, parseHid, type HotelDetail } from "./detail";

// Loads one public property page on the server (Epic 2.2).
//
// `not-found` covers every hotel a traveller may not see — unknown, never
// approved, suspended or closed — so the page can't be used to probe which
// hotels exist in the catalogue or are under review.
export async function loadPublicHotel(
  hidParam: string,
  stay: SearchParams | null,
  today: string,
): Promise<{ status: "ok"; hotel: HotelDetail } | { status: "not-found" } | { status: "error" }> {
  const hid = parseHid(hidParam);
  if (hid === null) return { status: "not-found" };

  const approval = await fetchPublicApproval(await createClient(), hid);
  if (!approval.ok) return { status: "error" };

  const rates = stay
    ? (mockSearchRates(stay, today).data.hotels.find((h) => h.hid === hid)?.rates ?? []) // MOCK until Phase 3
    : null;

  const hotel = buildHotelDetail({
    approval: approval.approved ?? undefined,
    hotel: mockHotelContent.find((h) => h.hid === hid), // MOCK until Phase 3
    rates,
  });
  return hotel ? { status: "ok", hotel } : { status: "not-found" };
}
