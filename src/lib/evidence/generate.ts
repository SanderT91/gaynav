import type { HotelContent } from "@/lib/ratehawk/types";
import type { EvidenceSource } from "@/mock/ratehawk";
import type { CallClaude } from "./claude";
import { evidenceFailure, failureFromError, type EvidenceFailure } from "./failures";
import { buildEvidenceUserMessage } from "./prompt";
import type { EvidencePack } from "./schema";
import { collectSources, type CitableSource } from "./sources";

// Builds an evidence pack for one candidate hotel: collects its citable
// sources, asks Claude for a structured summary, then checks the reply before
// accepting it. Anything short of a complete, fully-cited pack becomes an
// explicit failure (see failures.ts) — never a blank or partial summary.

export type EvidencePackSuccess = {
  ok: true;
  pack: EvidencePack;
  sources: CitableSource[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export type EvidencePackResult = EvidencePackSuccess | EvidenceFailure;

export async function generateEvidencePack(
  hotel: HotelContent,
  external: EvidenceSource[],
  callClaude: CallClaude,
): Promise<EvidencePackResult> {
  const sources = collectSources(hotel, external);
  if (sources.length === 0) {
    return evidenceFailure("no_sources", `hid ${hotel.hid}: no sources`);
  }

  let reply;
  try {
    reply = await callClaude(buildEvidenceUserMessage(hotel, sources));
  } catch (error) {
    return failureFromError(error);
  }

  // Check why the model stopped before looking at what it wrote.
  if (reply.stop_reason === "refusal") {
    return evidenceFailure(
      "refused",
      `hid ${hotel.hid}: stop_reason refusal (model ${reply.model})`,
    );
  }
  if (reply.stop_reason === "max_tokens") {
    return evidenceFailure("truncated", `hid ${hotel.hid}: hit max_tokens`);
  }
  if (reply.stop_reason !== "end_turn") {
    return evidenceFailure(
      "unparseable",
      `hid ${hotel.hid}: unexpected stop_reason ${reply.stop_reason}`,
    );
  }
  if (!reply.parsed) {
    return evidenceFailure("unparseable", `hid ${hotel.hid}: reply did not match the schema`);
  }

  const pack = reply.parsed;
  if (!pack.summary.trim()) {
    return evidenceFailure("incomplete", `hid ${hotel.hid}: empty summary`);
  }
  if (pack.signals.some((s) => !s.statement.trim())) {
    return evidenceFailure("incomplete", `hid ${hotel.hid}: a signal has no statement`);
  }

  const problems = citationProblems(pack, sources);
  if (problems.length > 0) {
    return evidenceFailure("invalid_citations", `hid ${hotel.hid}: ${problems.join(" ")}`);
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
