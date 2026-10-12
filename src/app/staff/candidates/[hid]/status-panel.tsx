"use client";

import { useActionState } from "react";
import { reactivateAction, suspendAction, type DecisionState } from "./actions";

// Suspend an approved hotel, or reactivate a suspended one. Reason optional,
// logged either way.
export function StatusPanel({ hid, status }: { hid: string; status: "approved" | "suspended" }) {
  const isApproved = status === "approved";
  const [state, action, pending] = useActionState<DecisionState, FormData>(
    isApproved ? suspendAction : reactivateAction,
    {},
  );
  return (
    <form action={action} style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
      <p>
        {isApproved
          ? "This hotel is on the whitelist and visible to travellers. Suspending hides it until it is reactivated."
          : "This hotel is suspended and hidden from travellers."}
      </p>
      <input type="hidden" name="hid" value={hid} />
      <label htmlFor="status-note">Reason (optional, staff only)</label>
      <textarea id="status-note" name="note" rows={2} maxLength={2000} />
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : isApproved ? "Suspend" : "Reactivate"}
      </button>
      {state.error && (
        <p role="alert" style={{ color: "#b42318" }}>
          {state.error}
        </p>
      )}
      {state.done && <p role="status">{state.done}</p>}
    </form>
  );
}
