import type { HotelContent } from "@/lib/ratehawk/types";
import type { EvidenceSource } from "@/mock/ratehawk";
import type { CallClaude } from "./claude";
import { buildEvidenceUserMessage } from "./prompt";
import type { EvidencePack } from "./schema";
import { collectSources, type CitableSource } from "./sources";

// Builds an evidence pack for one candidate hotel: collects its citable
// sources, asks Claude for a structured summary, then checks every citation
// against the sources Claude was actually given.

export type EvidencePackResult =
  | {
      ok: true;
      pack: EvidencePack;
      sources: CitableSource[];
      model: string;
      usage: { input_tokens: number; output_tokens: number };
    }
  | { ok: false; reason: EvidenceFailureReason; detail: string };

export type EvidenceFailureReason =
  | "no_sources" // nothing to summarise — don't ask the AI to make something up
  | "invalid_citations"; // the reply cited sources that don't exist, or none at all

export async function generateEvidencePack(
  hotel: HotelContent,
  external: EvidenceSource[],
  callClaude: CallClaude,
): Promise<EvidencePackResult> {
  const sources = collectSources(hotel, external);
  if (sources.length === 0) {
    return {
      ok: false,
      reason: "no_sources",
      detail: "There are no sources to summarise for this hotel.",
    };
  }

  const reply = await callClaude(buildEvidenceUserMessage(hotel, sources));
  const pack = reply.parsed!;

  const problems = citationProblems(pack, sources);
  if (problems.length > 0) {
    return { ok: false, reason: "invalid_citations", detail: problems.join(" ") };
  }

  return { ok: true, pack, sources, model: reply.model, usage: reply.usage };
}

/**
 * Every signal must cite at least one source, and every cited id must be one
 * Claude was given. A single unknown id rejects the whole pack: a fabricated
 * citation means the pack can't be trusted, and showing it would let an
 * invented claim look sourced.
 */
export function citationProblems(pack: EvidencePack, sources: CitableSource[]): string[] {
  const known = new Set(sources.map((s) => s.source_id));
  const problems: string[] = [];
  pack.signals.forEach((signal, i) => {
    if (signal.source_ids.length === 0) problems.push(`Signal ${i + 1} cites no source.`);
    for (const id of signal.source_ids) {
      if (!known.has(id)) problems.push(`Signal ${i + 1} cites unknown source "${id}".`);
    }
  });
  return problems;
}
