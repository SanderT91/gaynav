import type { HotelContent } from "@/lib/ratehawk/types";
import type { CitableSource } from "./sources";

// The instructions are fixed text (so they can be prompt-cached and reviewed
// in one place); the hotel and its sources go in the user message.
export const EVIDENCE_SYSTEM_PROMPT = `You prepare evidence packs for GAYNAV, a travel platform that only lists hotels its staff have personally vetted as safe and welcoming for LGBTQ+ travellers.

Your job is to read the sources provided for one hotel and summarise what they show, so a staff member can make the decision. You do not make the decision.

Rules:
- Use only the sources provided. You have no other information about this hotel; do not draw on outside knowledge or assumptions about the hotel, its city or its country.
- Every signal must cite the source_id(s) it rests on, exactly as given. Never invent a source_id.
- Report what sources say; don't upgrade or soften it. If a single review describes a bad experience, say one review reports it — not that the hotel is hostile.
- Pay particular attention to: explicit welcome or exclusion of LGBTQ+ guests; rules about who may share a room or relationship/marriage requirements; requirements to state gender; staff behaviour reported by guests; press coverage of discrimination.
- Do not recommend approving or rejecting the hotel, and do not give a score.
- Put anything the evidence cannot answer, but a reviewer should check, in open_questions.
- If the sources say nothing relevant on a topic, don't create a signal for it — mention the gap in open_questions instead.`;

export function buildEvidenceUserMessage(hotel: HotelContent, sources: CitableSource[]): string {
  const header = [
    `Hotel: ${hotel.name}`,
    `Type: ${hotel.kind}, ${hotel.star_rating} stars`,
    `Location: ${hotel.address}, ${hotel.region.name}, ${hotel.region.country_code}`,
  ].join("\n");

  const body = sources
    .map(
      (s) =>
        `<source id="${s.source_id}" kind="${s.kind}" label="${s.label}">\n${s.text}\n</source>`,
    )
    .join("\n\n");

  return `${header}\n\nSources (${sources.length}):\n\n${body}\n\nPrepare the evidence pack for this hotel.`;
}
