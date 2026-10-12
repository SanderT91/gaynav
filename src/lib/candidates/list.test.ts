import { describe, expect, it } from "vitest";
import { mockHotelContent } from "@/mock/ratehawk";
import { buildCandidateRows, citiesOf, filterByCity } from "./list";

describe("buildCandidateRows", () => {
  const rows = buildCandidateRows(mockHotelContent, [
    { hid: mockHotelContent[0].hid, status: "approved" },
    { hid: mockHotelContent[1].hid, status: "suspended" },
  ]);

  it("lists every candidate exactly once", () => {
    expect(rows).toHaveLength(mockHotelContent.length);
    expect(new Set(rows.map((r) => r.hid)).size).toBe(mockHotelContent.length);
  });

  it("shows the whitelist status from approved_properties, and not_reviewed otherwise", () => {
    const byHid = new Map(rows.map((r) => [r.hid, r.whitelist]));
    expect(byHid.get(mockHotelContent[0].hid)).toBe("approved");
    expect(byHid.get(mockHotelContent[1].hid)).toBe("suspended");
    expect(byHid.get(mockHotelContent[2].hid)).toBe("not_reviewed");
  });

  it("ignores approvals for hotels that aren't candidates", () => {
    const extra = buildCandidateRows(mockHotelContent, [{ hid: 1, status: "approved" }]);
    expect(extra).toHaveLength(mockHotelContent.length);
  });

  it("flags closed hotels so they are never approved by mistake", () => {
    expect(rows.some((r) => r.isClosed)).toBe(true);
  });

  it("is sorted by city, then name", () => {
    const keys = rows.map((r) => `${r.city}|${r.name}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
});

describe("city filter", () => {
  const rows = buildCandidateRows(mockHotelContent, []);
  const [firstCity] = citiesOf(rows);

  it("filters to one city", () => {
    const filtered = filterByCity(rows, firstCity);
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.every((r) => r.city === firstCity)).toBe(true);
  });

  it.each([undefined, "", "Atlantis"])("shows everything for %j", (city) => {
    expect(filterByCity(rows, city)).toHaveLength(rows.length);
  });
});
