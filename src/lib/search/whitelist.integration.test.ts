import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { mockSearchRates } from "@/lib/rates/mock-search";
import { mockHotelContent } from "@/mock/ratehawk";
import { searchApproved } from "./search";
import { fetchPublicWhitelist } from "./whitelist";

// Epic 2.1 — SERVER-SIDE ENFORCEMENT: an unapproved or suspended hotel can
// never appear in public search results.
//
// Runs against a real Supabase database (the local stack, or the throwaway
// one in CI) through the exact query and search logic the public site uses.
// Run with: npm run test:integration (needs `npm run db:start`).

const url = process.env.SUPABASE_TEST_URL;
const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;

const APPROVED = 9990000006; // Casa Trastevere, Rome
const SUSPENDED = 9990000007; // Sumida Garden Hotel, Tokyo
const NEVER_APPROVED = 9990000012; // Sathorn Garden Rooms, Bangkok
const STAFF_EMAIL = "whitelist-test-staff@gaynav.test";

const options = { auth: { persistSession: false, autoRefreshToken: false } };
let admin: SupabaseClient; // service role: bypasses RLS, reads everything
let anon: SupabaseClient; // an anonymous visitor

async function staffId(): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: STAFF_EMAIL,
    password: "integration-test-only-password",
    email_confirm: true,
  });
  let id = created.data.user?.id;
  if (!id) {
    // Already exists from an earlier local run.
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    id = data.users.find((u) => u.email === STAFF_EMAIL)!.id;
  }
  await admin.from("users").update({ role: "staff" }).eq("id", id);
  return id;
}

async function isOnWhitelist(hid: number) {
  const { data } = await admin.from("approved_properties").select("status").eq("hid", hid);
  return data?.[0]?.status as "approved" | "suspended" | undefined;
}

async function decide(hid: number, decision: string, decidedBy: string, extra = {}) {
  const { error } = await admin
    .from("vetting_decisions")
    .insert({ hid, decision, decided_by: decidedBy, ...extra });
  if (error) throw new Error(`${decision} ${hid}: ${error.message}`);
}

beforeAll(async () => {
  if (!url || !publishableKey || !secretKey) {
    throw new Error("Run via `npm run test:integration` (needs the local Supabase stack).");
  }
  admin = createClient(url, secretKey, options);
  anon = createClient(url, publishableKey, options);
  const staff = await staffId();

  // Set up the three cases. Idempotent, so it can run on a local database
  // more than once (the whitelist is append-only by design).
  if (!(await isOnWhitelist(APPROVED))) {
    await decide(APPROVED, "approved", staff, {
      note: "integration test",
      public_summary: "Integration test: approved.",
    });
  }
  if (!(await isOnWhitelist(SUSPENDED))) {
    await decide(SUSPENDED, "approved", staff, {
      note: "integration test",
      public_summary: "Integration test: will be suspended.",
    });
  }
  if ((await isOnWhitelist(SUSPENDED)) === "approved") {
    await decide(SUSPENDED, "suspended", staff, { note: "integration test" });
  }
  expect(await isOnWhitelist(APPROVED)).toBe("approved");
  expect(await isOnWhitelist(SUSPENDED)).toBe("suspended");
  expect(await isOnWhitelist(NEVER_APPROVED)).toBeUndefined();
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
