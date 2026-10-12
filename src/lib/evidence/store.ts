import type { SupabaseClient } from "@supabase/supabase-js";
import type { EvidencePackResult } from "./generate";
import { EvidencePackSchema, type EvidencePack } from "./schema";
import type { CitableSource } from "./sources";

// Saves and loads evidence packs in public.evidence_packs (staff-only, 2FA).
// Always called with the signed-in staff member's Supabase client — never the
// service role — so the database's RLS policies decide who may read and write.

export type EvidencePackRow = {
  hid: number;
  status: "ready" | "failed";
  pack: EvidencePack | null;
  sources: CitableSource[] | null;
  failure_reason: string | null;
  failure_message: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  generated_by: string;
};

export type StoredEvidencePack =
  | {
      status: "ready";
      pack: EvidencePack;
      sources: CitableSource[];
      model: string | null;
      generated_at: string;
    }
  | { status: "failed"; failure_message: string; generated_at: string };

/** One attempt → one row. A failure is stored too, but never with a pack. */
export function toEvidencePackRow(
  hid: number,
  result: EvidencePackResult,
  generatedBy: string,
): EvidencePackRow {
  if (result.ok) {
    return {
      hid,
      status: "ready",
      pack: result.pack,
      sources: result.sources,
      failure_reason: null,
      failure_message: null,
      model: result.model,
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      generated_by: generatedBy,
    };
  }
  return {
    hid,
    status: "failed",
    pack: null,
    sources: null,
    failure_reason: result.reason,
    failure_message: result.message,
    model: null,
    input_tokens: null,
    output_tokens: null,
    generated_by: generatedBy,
  };
}

export async function saveEvidencePack(
  supabase: SupabaseClient,
  row: EvidencePackRow,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("evidence_packs").insert(row);
  return { error: error ? error.message : null };
}

/**
 * The most recent attempt for a hotel, or null if there has been none. A
 * stored pack is re-validated on the way out: if it somehow doesn't match the
 * schema, it is treated as failed rather than shown.
 */
export async function loadLatestEvidencePack(
  supabase: SupabaseClient,
  hid: number,
): Promise<StoredEvidencePack | null> {
  const { data, error } = await supabase
    .from("evidence_packs")
    .select("status, pack, sources, model, failure_message, generated_at")
    .eq("hid", hid)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  if (data.status === "failed") {
    return {
      status: "failed",
      failure_message: data.failure_message,
      generated_at: data.generated_at,
    };
  }
  const parsed = EvidencePackSchema.safeParse(data.pack);
  if (!parsed.success || !Array.isArray(data.sources)) {
    return {
      status: "failed",
      failure_message: "The stored evidence pack is damaged and can't be shown. Generate it again.",
      generated_at: data.generated_at,
    };
  }
  return {
    status: "ready",
    pack: parsed.data,
    sources: data.sources as CitableSource[],
    model: data.model,
    generated_at: data.generated_at,
  };
}
