"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, sessionHasMfa } from "@/lib/auth/current-user";
import { findCandidate } from "@/lib/candidates/detail";
import { callClaude } from "@/lib/evidence/claude";
import { generateEvidencePack } from "@/lib/evidence/generate";
import { saveEvidencePack, toEvidencePackRow } from "@/lib/evidence/store";
import { createClient } from "@/lib/supabase/server";

export type GenerateState = { error?: string };

// Generates and stores an evidence pack for one candidate. A Server Action is
// a public endpoint, so it checks staff role + 2FA itself rather than trusting
// the page. The result (success or failure) is saved with the staff member's
// own session, so the database's RLS decides again.
export async function generateEvidencePackAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const hidParam = String(formData.get("hid") ?? "");
  const user = await getCurrentUser();
  if (!user || user.role !== "staff" || !(await sessionHasMfa())) {
    return { error: "Only staff signed in with two-factor authentication can do this." };
  }

  const candidate = findCandidate(hidParam);
  if (!candidate) return { error: "This candidate doesn't exist." };

  const result = await generateEvidencePack(candidate.hotel, candidate.external, callClaude);
  if (!result.ok) {
    // Technical detail goes to the server log only; staff see `message`.
    console.error(`[evidence-pack] ${result.reason}: ${result.detail}`);
  }

  const supabase = await createClient();
  const saved = await saveEvidencePack(
    supabase,
    toEvidencePackRow(candidate.hotel.hid, result, user.id),
  );
  if (saved.error) {
    console.error(`[evidence-pack] save failed: ${saved.error}`);
    return { error: "The result couldn't be saved. Try again." };
  }

  revalidatePath(`/staff/candidates/${candidate.hotel.hid}`);
  return {};
}
