"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, sessionHasMfa } from "@/lib/auth/current-user";
import { decisionErrorMessage } from "@/lib/candidates/decisions";
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

export type DecisionState = { error?: string; done?: string };

async function staffWithMfa() {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff" || !(await sessionHasMfa())) return null;
  return user;
}

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, 2000) : "";
}

// Approve: records an "approved" decision. The database checks the owner's
// rules on that insert and then adds the hotel to the whitelist itself, with
// the public vetting summary; this action only checks who is asking and that
// the hotel can be approved at all.
export async function approveAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const user = await staffWithMfa();
  if (!user) return { error: "Only staff signed in with two-factor authentication can do this." };

  const candidate = findCandidate(text(formData, "hid"));
  if (!candidate) return { error: "This candidate doesn't exist." };
  if (candidate.hotel.is_closed) return { error: "This hotel is closed and cannot be approved." };

  const supabase = await createClient();
  const { error } = await supabase.from("vetting_decisions").insert({
    hid: candidate.hotel.hid,
    decision: "approved",
    note: text(formData, "note") || null,
    concerns_acknowledged: formData.get("concerns_acknowledged") === "on",
    public_summary: text(formData, "public_summary").slice(0, 600) || null,
  });
  if (error) return { error: decisionErrorMessage(error) };

  revalidatePath(`/staff/candidates/${candidate.hotel.hid}`);
  revalidatePath("/staff/candidates");
  return { done: "Approved. The hotel is now on the whitelist." };
}

// Reject: records the decision in the audit log (reason optional). The hotel
// stays off the whitelist and can be reviewed again later.
export async function rejectAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  const user = await staffWithMfa();
  if (!user) return { error: "Only staff signed in with two-factor authentication can do this." };

  const candidate = findCandidate(text(formData, "hid"));
  if (!candidate) return { error: "This candidate doesn't exist." };

  // The database refuses to reject a hotel that is on the whitelist.
  const supabase = await createClient();
  const { error } = await supabase.from("vetting_decisions").insert({
    hid: candidate.hotel.hid,
    decision: "rejected",
    note: text(formData, "note") || null,
  });
  if (error) return { error: decisionErrorMessage(error) };

  revalidatePath(`/staff/candidates/${candidate.hotel.hid}`);
  return { done: "Rejected. The decision is in the log; the hotel can be reviewed again later." };
}

// Suspend / reactivate: also recorded as decisions (Epic 1.4: every approve,
// reject, suspend and reactivate is logged with who, what, when and the
// reason). The database changes the whitelist status itself.
async function recordStatusDecision(
  formData: FormData,
  decision: "suspended" | "reinstated",
): Promise<DecisionState> {
  const user = await staffWithMfa();
  if (!user) return { error: "Only staff signed in with two-factor authentication can do this." };

  const candidate = findCandidate(text(formData, "hid"));
  if (!candidate) return { error: "This candidate doesn't exist." };

  const supabase = await createClient();
  const { error } = await supabase.from("vetting_decisions").insert({
    hid: candidate.hotel.hid,
    decision,
    note: text(formData, "note") || null,
  });
  if (error) return { error: decisionErrorMessage(error) };

  revalidatePath(`/staff/candidates/${candidate.hotel.hid}`);
  revalidatePath("/staff/candidates");
  return {
    done:
      decision === "suspended"
        ? "Suspended. The hotel is hidden from travellers until it is reactivated."
        : "Reactivated. The hotel is visible to travellers again.",
  };
}

export async function suspendAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  return recordStatusDecision(formData, "suspended");
}

export async function reactivateAction(
  _prev: DecisionState,
  formData: FormData,
): Promise<DecisionState> {
  return recordStatusDecision(formData, "reinstated");
}
