import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Shared set-up for tests that run against a real (local or CI) Supabase
// database: one approved, one suspended and one never-approved hotel, plus
// staff-only data (a staff account, decision notes, an evidence pack) that
// must never reach a public page.
//
// Idempotent, so it can run on a local database more than once (the
// whitelist and the decision log are append-only by design).

export const APPROVED = 9990000006; // Casa Trastevere, Rome
export const SUSPENDED = 9990000007; // Sumida Garden Hotel, Tokyo
export const NEVER_APPROVED = 9990000012; // Sathorn Garden Rooms, Bangkok

export const STAFF_EMAIL = "whitelist-test-staff@gaynav.test";
/** Text that exists only in staff-only places; a public page must never contain it. */
export const STAFF_ONLY_MARKERS = {
  note: "Staff-only note (integration test)",
  evidence: "Evidence pack text (integration test, staff only)",
};

const options = { auth: { persistSession: false, autoRefreshToken: false } };

export function testClients() {
  const url = process.env.SUPABASE_TEST_URL;
  const publishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_TEST_SECRET_KEY;
  if (!url || !publishableKey || !secretKey) {
    throw new Error(
      "Run via `npm run test:integration` or `npm run test:public-flow` (needs the local Supabase stack).",
    );
  }
  return {
    /** Service role: bypasses RLS, reads everything. */
    admin: createClient(url, secretKey, options),
    /** An anonymous visitor. */
    anon: createClient(url, publishableKey, options),
  };
}

export async function whitelistStatus(admin: SupabaseClient, hid: number) {
  const { data } = await admin.from("approved_properties").select("status").eq("hid", hid);
  return data?.[0]?.status as "approved" | "suspended" | undefined;
}

async function staffUserId(admin: SupabaseClient): Promise<string> {
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

async function decide(
  admin: SupabaseClient,
  hid: number,
  decision: string,
  decidedBy: string,
  extra = {},
) {
  const { error } = await admin
    .from("vetting_decisions")
    .insert({ hid, decision, decided_by: decidedBy, note: STAFF_ONLY_MARKERS.note, ...extra });
  if (error) throw new Error(`${decision} ${hid}: ${error.message}`);
}

/** Sets up the three cases and returns the staff member's user id. */
export async function setUpWhitelist(admin: SupabaseClient): Promise<string> {
  const staff = await staffUserId(admin);

  const { data: packs } = await admin.from("evidence_packs").select("id").eq("hid", APPROVED);
  if (!packs?.length) {
    const { error } = await admin.from("evidence_packs").insert({
      hid: APPROVED,
      status: "ready",
      pack: { summary: STAFF_ONLY_MARKERS.evidence, signals: [], open_questions: [] },
      sources: [],
      model: "test",
      generated_by: staff,
    });
    if (error) throw new Error(`evidence pack: ${error.message}`);
  }

  if (!(await whitelistStatus(admin, APPROVED))) {
    await decide(admin, APPROVED, "approved", staff, {
      public_summary: "Integration test: approved.",
    });
  }
  if (!(await whitelistStatus(admin, SUSPENDED))) {
    await decide(admin, SUSPENDED, "approved", staff, {
      public_summary: "Integration test: will be suspended.",
    });
  }
  if ((await whitelistStatus(admin, SUSPENDED)) === "approved") {
    await decide(admin, SUSPENDED, "suspended", staff);
  }

  if (
    (await whitelistStatus(admin, APPROVED)) !== "approved" ||
    (await whitelistStatus(admin, SUSPENDED)) !== "suspended" ||
    (await whitelistStatus(admin, NEVER_APPROVED)) !== undefined
  ) {
    throw new Error("Whitelist test set-up did not reach the expected state.");
  }
  return staff;
}
