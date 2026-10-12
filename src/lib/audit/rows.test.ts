import { describe, expect, it } from "vitest";
import { parseAuditFilters, toAuditEntries, whoLabel, type DecisionRow } from "./rows";

const STAFF = "c0ffee00-1111-2222-3333-444455556666";

describe("whoLabel", () => {
  it("uses the display name when an admin set one", () => {
    expect(whoLabel(STAFF, new Map([[STAFF, "Alex (curation)"]]))).toBe("Alex (curation)");
  });

  it("falls back to a short id otherwise", () => {
    expect(whoLabel(STAFF, new Map([[STAFF, null]]))).toBe("Staff c0ffee00");
    expect(whoLabel(STAFF, new Map())).toBe("Staff c0ffee00");
  });
});

describe("toAuditEntries", () => {
  const row: DecisionRow = {
    id: 1,
    hid: 9990000003,
    decision: "approved",
    note: "n",
    concerns_acknowledged: true,
    public_summary: "s",
    evidence_pack_id: null,
    decided_by: STAFF,
    decided_at: "2026-10-12T19:00:00Z",
  };

  it("adds who and the hotel name", () => {
    const [entry] = toAuditEntries(
      [row],
      new Map(),
      new Map([[9990000003, "The Rose Stay (mock)"]]),
    );
    expect(entry).toMatchObject({
      who: "Staff c0ffee00",
      hotel: "The Rose Stay (mock)",
      note: "n",
    });
  });

  it("still shows decisions about hotels that are no longer candidates", () => {
    const [entry] = toAuditEntries([{ ...row, hid: 123 }], new Map(), new Map());
    expect(entry.hotel).toBe("Hotel 123 (not a current candidate)");
  });
});

describe("parseAuditFilters", () => {
  it("accepts a hotel id and a known decision", () => {
    expect(parseAuditFilters({ hid: "9990000003", decision: "suspended" })).toEqual({
      hid: 9990000003,
      decision: "suspended",
    });
  });

  it.each([
    [{ hid: "abc" }, {}],
    [{ hid: "1; drop table" }, {}],
    [{ decision: "deleted" }, {}],
    [{ hid: ["1", "2"] }, {}],
  ])("ignores invalid filters %j", (input, expected) => {
    expect(parseAuditFilters(input)).toEqual(expected);
  });
});
