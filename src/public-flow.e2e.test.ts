import { beforeAll, describe, expect, it } from "vitest";
import {
  APPROVED,
  NEVER_APPROVED,
  setUpWhitelist,
  STAFF_EMAIL,
  STAFF_ONLY_MARKERS,
  SUSPENDED,
  testClients,
} from "@/test/whitelist-fixture";

// Epic 2.1 — the whole public flow works with NO session at all: an anonymous
// visitor can search and open a property page, is never sent to a login
// page, and no staff-only data is in any response.
//
// Runs over HTTP against a real production build of the app, backed by the
// local (or CI) Supabase stack. Plain `fetch` carries no cookies, so every
// request is a first-time anonymous visitor.
// Run with: npm run test:public-flow (needs `npm run db:start`).

const base = process.env.PUBLIC_FLOW_BASE_URL;

const names = {
  [APPROVED]: "Casa Trastevere",
  [SUSPENDED]: "Sumida Garden Hotel",
  [NEVER_APPROVED]: "Sathorn Garden Rooms",
};

/** A stay ~two months ahead, so the dates are always valid. */
function stay() {
  const day = (offset: number) =>
    new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  return new URLSearchParams({ checkin: day(60), checkout: day(62), adults: "2" });
}

let staffId: string;

async function get(path: string) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  return {
    status: response.status,
    location: response.headers.get("location"),
    body: await response.text(),
  };
}

/** Everything that only staff may ever see. */
function expectNoStaffData(body: string) {
  expect(body).not.toContain(STAFF_ONLY_MARKERS.note);
  expect(body).not.toContain(STAFF_ONLY_MARKERS.evidence);
  expect(body).not.toContain(STAFF_EMAIL);
  expect(body).not.toContain(staffId);
  expect(body).not.toMatch(/approved_by|decided_by|evidence_pack|vetting_decisions/);
}

beforeAll(async () => {
  if (!base) throw new Error("Run via `npm run test:public-flow` (starts the app for you).");
  staffId = await setUpWhitelist(testClients().admin);
}, 30_000);

describe("public flow with no session", () => {
  it("search works anonymously and lists only the approved hotel", async () => {
    const res = await get(`/search?${stay()}`);
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.body).toContain(names[APPROVED]);
    expect(res.body).not.toContain(names[SUSPENDED]);
    expect(res.body).not.toContain(names[NEVER_APPROVED]);
    expect(res.body).toContain(`/hotels/${APPROVED}?`);
    expectNoStaffData(res.body);
  });

  it("the property page works anonymously, with the public summary and prices", async () => {
    const res = await get(`/hotels/${APPROVED}?${stay()}`);
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
    expect(res.body).toContain(names[APPROVED]);
    expect(res.body).toContain("Why we list it");
    expect(res.body).toContain("Integration test: approved.");
    expect(res.body).toContain("Standard Double Room");
    expectNoStaffData(res.body);
  });

  it("the property page works without dates too", async () => {
    const res = await get(`/hotels/${APPROVED}`);
    expect(res.status).toBe(200);
    expect(res.body).toContain(names[APPROVED]);
    expect(res.body).toContain("Choose your dates");
    expectNoStaffData(res.body);
  });

  it.each([
    ["suspended", SUSPENDED],
    ["never approved", NEVER_APPROVED],
  ])("a %s hotel's page shows nothing about it", async (_label, hid) => {
    const res = await get(`/hotels/${hid}?${stay()}`);
    // A streamed page can't change its status code any more; Next.js marks
    // the not-found page noindex instead.
    expect(res.body).toContain("could not be found");
    expect(res.body).toMatch(/<meta name="robots" content="noindex"/);
    expect(res.body).not.toContain(names[hid as keyof typeof names]);
    expectNoStaffData(res.body);
  });

  it("the home page loads anonymously", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.location).toBeNull();
  });

  it("About, Privacy and Terms load anonymously; unfinished legal text is flagged", async () => {
    const about = await get("/about");
    expect(about.status).toBe(200);
    expect(about.body).toContain("About GAYNAV");
    for (const path of ["/privacy", "/terms"]) {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(res.location).toBeNull();
      expect(res.body).toContain("Placeholder — not final legal text");
      // Not indexed until the final text is in place.
      expect(res.body).toMatch(/<meta name="robots" content="noindex"/);
    }
  });

  it("staff pages still send an anonymous visitor to sign in (and show nothing)", async () => {
    const res = await get("/staff/candidates");
    expect([302, 303, 307, 308]).toContain(res.status);
    expect(res.location).toMatch(/\/login/);
    expectNoStaffData(res.body);
  });
});
