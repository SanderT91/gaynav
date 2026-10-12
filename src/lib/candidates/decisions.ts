import type { StoredEvidencePack } from "@/lib/evidence/store";

// What approving a candidate requires, given its latest evidence pack. The
// database enforces the same rules (enforce_approval_rules trigger); this is
// only so the form can say upfront what's needed.
//
// Owner decisions 2026-10-12: no pack → note required; a pack with
// "concern" signals → explicit acknowledgement AND a note.

export type ApprovalRequirements = {
  noteRequired: boolean;
  acknowledgementRequired: boolean;
  /** Shown above the approve form. */
  explanation: string;
};

export function approvalRequirements(latest: StoredEvidencePack | null): ApprovalRequirements {
  if (!latest || latest.status !== "ready") {
    return {
      noteRequired: true,
      acknowledgementRequired: false,
      explanation:
        "There is no evidence pack for this hotel. You can still approve it, but explain what you based the decision on.",
    };
  }
  const concerns = latest.pack.signals.filter((s) => s.tone === "concern").length;
  if (concerns > 0) {
    return {
      noteRequired: true,
      acknowledgementRequired: true,
      explanation: `The evidence pack lists ${concerns} concern${concerns === 1 ? "" : "s"}. To approve, confirm you reviewed ${concerns === 1 ? "it" : "them"} and explain why the hotel is still suitable.`,
    };
  }
  return {
    noteRequired: false,
    acknowledgementRequired: false,
    explanation: "The evidence pack lists no concerns. A note is optional.",
  };
}

/** The database's rule messages are written for staff; anything else is generic. */
const RULE_MESSAGES = [
  "Approving requires a public vetting summary",
  "Approving without an evidence pack requires a note",
  "The evidence pack has concerns: confirm you reviewed them",
  "The evidence pack has concerns: explain why the hotel is still approved",
];

export function decisionErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === "23514" && RULE_MESSAGES.includes(error.message)) return `${error.message}.`;
  if (error.code === "23505")
    return "This hotel is already on the whitelist. To take it off, suspend it instead.";
  if (error.code === "42501")
    return "You're not allowed to do this. Sign in again with two-factor authentication.";
  return "The decision couldn't be saved. Try again.";
}

export type DecisionEntry = {
  decision: "approved" | "rejected" | "suspended" | "reinstated";
  note: string | null;
  concerns_acknowledged: boolean;
  decided_at: string;
};
