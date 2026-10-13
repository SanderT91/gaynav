import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { mockSearchRates } from "@/lib/rates/mock-search";
import { mockHotelContent } from "@/mock/ratehawk";
import {
  APPROVED,
  NEVER_APPROVED,
  setUpWhitelist,
  SUSPENDED,
  testClients,
  whitelistStatus,
} from "@/test/whitelist-fixture";
import { searchApproved } from "./search";
import { fetchPublicApproval, fetchPublicWhitelist } from "./whitelist";

// Epic 2.1 — SERVER-SIDE ENFORCEMENT: an unapproved or suspended hotel can
// never appear in public search results.
//
// Runs against a real Supabase database (the local stack, or the throwaway
// one in CI) through the exact query and search logic the public site uses.
// Run with: npm run test:integration (needs `npm run db:start`).

let admin: SupabaseClient; // service role: bypasses RLS, reads everything
let anon: SupabaseClient; // an anonymous visitor

const isOnWhitelist = (hid: number) => whitelistStatus(admin, hid);

beforeAll(async () => {
  ({ admin, anon } = testClients());
  await setUpWhitelist(admin);
}, 30_000);

const allCitySearch = () =>
  mockSearchRates(
    { checkin: "2027-03-01", checkout: "2027-03-03", nights: 2, adults: 2 },
    "2026-10-12",
  );

describe("public whitelist (real database)", () => {
  it("an anonymous visitor sees the approved hotel, not the suspended or unapproved one", async () => {
    const wl = await fetchPublicWhitelist(anon);
    expect(wl.ok).toBe(true);
    const hids = wl.ok ? wl.approved.map((a) => a.hid) : [];
    expect(hids).toContain(APPROVED);
    expect(hids).not.toContain(SUSPENDED);
    expect(hids).not.toContain(NEVER_APPROVED);
  });

  it("even a reader allowed to see suspended rows gets only approved ones through the public query", async () => {
    // Proof the explicit status filter matters: the raw table shows the
    // suspended hotel to this reader…
    const { data: raw } = await admin.from("approved_properties").select("hid");
    expect(raw!.map((r) => r.hid)).toContain(SUSPENDED);
    // …but the public query never returns it.
    const wl = await fetchPublicWhitelist(admin);
    expect(wl.ok && wl.approved.map((a) => a.hid)).not.toContain(SUSPENDED);
  });

  it("search results built from it contain only approved hotels, whatever the rates say", async () => {
    const wl = await fetchPublicWhitelist(anon);
    if (!wl.ok) throw new Error("whitelist query failed");
    const search = allCitySearch();
    // The rates include all three hotels — availability alone must not list them.
    const ratedHids = search.data.hotels.map((h) => h.hid);
    expect(ratedHids).toEqual(expect.arrayContaining([APPROVED, SUSPENDED, NEVER_APPROVED]));

    const results = searchApproved({ approved: wl.approved, hotels: mockHotelContent, search });
    const resultHids = results.map((r) => r.hid);
    expect(resultHids).toContain(APPROVED);
    expect(resultHids).not.toContain(SUSPENDED);
    expect(resultHids).not.toContain(NEVER_APPROVED);
    // And every result is something the whitelist actually approved.
    const approvedHids = new Set(wl.approved.map((a) => a.hid));
    expect(resultHids.every((hid) => approvedHids.has(hid))).toBe(true);
  });

  it("an anonymous visitor cannot add a hotel to the whitelist, by any route", async () => {
    const direct = await anon.from("approved_properties").insert({
      hid: NEVER_APPROVED,
      approved_by: "00000000-0000-0000-0000-000000000000",
      vetting_summary: "x",
    });
    expect(direct.error?.code).toBe("42501");
    const viaDecision = await anon
      .from("vetting_decisions")
      .insert({ hid: NEVER_APPROVED, decision: "approved", public_summary: "x", note: "x" });
    expect(viaDecision.error?.code).toBe("42501");
    expect(await isOnWhitelist(NEVER_APPROVED)).toBeUndefined();
  });
});

describe("public approval of one hotel (property page, real database)", () => {
  it.each([
    ["approved", APPROVED, true],
    ["suspended", SUSPENDED, false],
    ["never approved", NEVER_APPROVED, false],
  ])("%s hotel → visible: %s", async (_label, hid, visible) => {
    for (const reader of [anon, admin]) {
      const result = await fetchPublicApproval(reader, hid);
      expect(result.ok).toBe(true);
      expect(result.ok && result.approved !== null).toBe(visible);
    }
  });
});
