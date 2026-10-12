// Typed access to the mock RateHawk fixtures (Phases 1–2).
//
// MOCK DATA: fictitious hotels, reviews and press. Phase 3 replaces these
// imports with the real RateHawk client and stored hotel dump; because both
// return the shapes in src/lib/ratehawk/types.ts, callers don't change.
// Shape correctness of the JSON is checked by fixtures.test.ts.
import type { HotelContent, SearchResponse } from "@/lib/ratehawk/types";
import evidenceJson from "./evidence-sources.json";
import contentJson from "./hotel-content.json";
import searchJson from "./search-results.json";

/** A review or press snippet an AI evidence pack may cite by `source_id`. */
export type EvidenceSource =
  | { source_id: string; kind: "review"; rating: number; date: string; text: string }
  | { source_id: string; kind: "press"; outlet: string; date: string; text: string };

/** The fixed search the mock rates answer. */
export type MockSearch = {
  checkin: string;
  checkout: string;
  nights: number;
  guests: { adults: number; children: number[] }[];
  residency: string;
  currency: string;
};

// JSON imports are typed loosely by TypeScript (strings instead of literal
// unions), so they are cast here once; the fixture test validates them.
export const mockHotelContent = contentJson.hotels as unknown as HotelContent[];
export const mockSearchResponse = searchJson as unknown as SearchResponse & { _search: MockSearch };
export const mockEvidenceSources = evidenceJson.sources as unknown as Record<
  string,
  EvidenceSource[]
>;

/** Mock reserved `hid` range — never a real RateHawk hotel. */
export const MOCK_HID_MIN = 9_990_000_001;
export const MOCK_HID_MAX = 9_990_999_999;
