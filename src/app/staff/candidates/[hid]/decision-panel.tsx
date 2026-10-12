"use client";

import { useActionState } from "react";
import type { ApprovalRequirements } from "@/lib/candidates/decisions";
import { approveAction, rejectAction, type DecisionState } from "./actions";

function Feedback({ state }: { state: DecisionState }) {
  if (state.error) {
    return (
      <p role="alert" style={{ marginTop: "0.5rem", color: "#b42318" }}>
        {state.error}
      </p>
    );
  }
  if (state.done) {
    return (
      <p role="status" style={{ marginTop: "0.5rem" }}>
        {state.done}
      </p>
    );
  }
  return null;
}

export function DecisionPanel({
  hid,
  requirements,
}: {
  hid: string;
  requirements: ApprovalRequirements;
}) {
  const [approveState, approve, approving] = useActionState<DecisionState, FormData>(
    approveAction,
    {},
  );
  const [rejectState, reject, rejecting] = useActionState<DecisionState, FormData>(
    rejectAction,
    {},
  );

  return (
    <div style={{ display: "grid", gap: "1.5rem", marginTop: "1rem" }}>
      <form action={approve} style={{ display: "grid", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1rem" }}>Approve</h3>
        <p>{requirements.explanation}</p>
        <input type="hidden" name="hid" value={hid} />
        <label htmlFor="approve-summary">
          Public vetting summary (required) — shown to travellers on the hotel page
        </label>
        <textarea id="approve-summary" name="public_summary" rows={3} maxLength={600} required />
        <label htmlFor="approve-note">
          Staff note{requirements.noteRequired ? " (required)" : " (optional)"} — only staff see
          this
        </label>
        <textarea
          id="approve-note"
          name="note"
          rows={3}
          maxLength={2000}
          required={requirements.noteRequired}
        />
        {requirements.acknowledgementRequired && (
          <label>
            <input type="checkbox" name="concerns_acknowledged" required /> I have reviewed the
            concerns in the evidence pack
          </label>
        )}
        <button type="submit" disabled={approving}>
          {approving ? "Approving…" : "Approve — add to the whitelist"}
        </button>
        <Feedback state={approveState} />
      </form>

      <form action={reject} style={{ display: "grid", gap: "0.5rem" }}>
        <h3 style={{ fontSize: "1rem" }}>Reject</h3>
        <input type="hidden" name="hid" value={hid} />
        <label htmlFor="reject-note">Reason (optional)</label>
        <textarea id="reject-note" name="note" rows={2} maxLength={2000} />
        <button type="submit" disabled={rejecting}>
          {rejecting ? "Rejecting…" : "Reject"}
        </button>
        <Feedback state={rejectState} />
      </form>
    </div>
  );
}
