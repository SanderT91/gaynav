import type { HotelContent } from "@/lib/ratehawk/types";
import type { EvidenceSource } from "@/mock/ratehawk";

// Everything the AI may cite, flattened into one list with stable ids.
//
// RateHawk's own content (description, house rules, the gender-specification
// flag) is turned into sources here, alongside reviews and press, so policy
// claims are citable too. The AI sees ONLY these sources — no web access — so
// every statement it makes can be traced back to something on this list.

export type CitableSource = {
  source_id: string;
  kind: "description" | "house_rules" | "booking_requirement" | "review" | "press";
  /** Short human label shown next to a citation in the staff UI. */
  label: string;
  text: string;
};

export function collectSources(hotel: HotelContent, external: EvidenceSource[]): CitableSource[] {
  const sources: CitableSource[] = [];
  const description = hotel.description_struct.flatMap((s) => s.paragraphs).join(" ");

  if (description) {
    sources.push({
      source_id: `desc-${hotel.hid}`,
      kind: "description",
      label: "Hotel description (RateHawk)",
      text: description,
    });
  }
  if (hotel.metapolicy_extra_info.trim()) {
    sources.push({
      source_id: `rules-${hotel.hid}`,
      kind: "house_rules",
      label: "House rules (RateHawk)",
      text: hotel.metapolicy_extra_info,
    });
  }
  if (hotel.is_gender_specification_required) {
    sources.push({
      source_id: `gender-${hotel.hid}`,
      kind: "booking_requirement",
      label: "Booking requirement (RateHawk)",
      text: "The hotel requires each guest's gender to be specified when booking.",
    });
  }
  for (const s of external) {
    sources.push(
      s.kind === "review"
        ? {
            source_id: s.source_id,
            kind: "review",
            label: `Guest review, ${s.rating}/5, ${s.date}`,
            text: s.text,
          }
        : { source_id: s.source_id, kind: "press", label: `${s.outlet}, ${s.date}`, text: s.text },
    );
  }
  return sources;
}
