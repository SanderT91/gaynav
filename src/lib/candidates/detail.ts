import "server-only";
import type { HotelContent } from "@/lib/ratehawk/types";
import { mockEvidenceSources, mockHotelContent, type EvidenceSource } from "@/mock/ratehawk";

// One candidate's data for the staff detail view. Mock fixture in Phases 1–2;
// Phase 3 reads the stored RateHawk dump here instead.

export type CandidateDetail = { hotel: HotelContent; external: EvidenceSource[] };

/** `hidParam` comes from the URL, so it is validated before use. */
export function findCandidate(hidParam: string): CandidateDetail | null {
  if (!/^\d{1,15}$/.test(hidParam)) return null;
  const hid = Number(hidParam);
  const hotel = mockHotelContent.find((h) => h.hid === hid);
  if (!hotel) return null;
  return { hotel, external: mockEvidenceSources[String(hid)] ?? [] };
}

/** RateHawk image URLs carry a `{size}` placeholder. */
export function imageUrl(template: string, size = "640x400"): string {
  return template.replace("{size}", size);
}
