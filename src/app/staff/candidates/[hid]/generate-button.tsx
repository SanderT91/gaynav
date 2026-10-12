"use client";

import { useActionState } from "react";
import { generateEvidencePackAction, type GenerateState } from "./actions";

export function GenerateButton({ hid, label }: { hid: string; label: string }) {
  const [state, action, pending] = useActionState<GenerateState, FormData>(
    generateEvidencePackAction,
    {},
  );
  return (
    <form action={action} style={{ marginTop: "1rem" }}>
      <input type="hidden" name="hid" value={hid} />
      <button type="submit" disabled={pending}>
        {pending ? "Reading the sources… (this can take a minute)" : label}
      </button>
      {state.error && (
        <p role="alert" style={{ marginTop: "0.5rem", color: "#b42318" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
