import type { HotelContent } from "@/lib/ratehawk/types";

// The staff candidate list: every candidate hotel, with where it stands on
// GAYNAV's whitelist. Pure functions here; data loading is in load.ts.

export type WhitelistStatus = "not_reviewed" | "approved" | "suspended";

export type CandidateRow = {
  hid: number;
  name: string;
  city: string;
  countryCode: string;
  kind: string;
  stars: number;
  isClosed: boolean;
  whitelist: WhitelistStatus;
};

export type Approval = { hid: number; status: "approved" | "suspended" };

export function buildCandidateRows(hotels: HotelContent[], approvals: Approval[]): CandidateRow[] {
  const statusByHid = new Map(approvals.map((a) => [a.hid, a.status]));
  return hotels
    .map((h) => ({
      hid: h.hid,
      name: h.name,
      city: h.region.name,
      countryCode: h.region.country_code,
      kind: h.kind.replaceAll("_", " "),
      stars: h.star_rating,
      isClosed: h.is_closed,
      whitelist: statusByHid.get(h.hid) ?? ("not_reviewed" as const),
    }))
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name));
}

export function citiesOf(rows: CandidateRow[]): string[] {
  return [...new Set(rows.map((r) => r.city))].sort((a, b) => a.localeCompare(b));
}

/** Unknown city values show everything rather than an empty, confusing list. */
export function filterByCity(rows: CandidateRow[], city: string | undefined): CandidateRow[] {
  if (!city || !rows.some((r) => r.city === city)) return rows;
  return rows.filter((r) => r.city === city);
}
