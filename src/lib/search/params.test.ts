import { describe, expect, it } from "vitest";
import { parseSearch } from "./params";

const TODAY = "2026-10-12";
const CITIES = ["London", "Paris"];
const parse = (raw: Record<string, string | string[] | undefined>) =>
  parseSearch(raw, TODAY, CITIES);

describe("parseSearch", () => {
  it("does not search before anything is entered", () => {
    expect(parse({})).toEqual({ status: "empty" });
    expect(parse({ city: "London" })).toEqual({ status: "empty" });
  });

  it("accepts a complete, valid search", () => {
    expect(
      parse({ city: "Paris", checkin: "2026-11-13", checkout: "2026-11-15", adults: "2" }),
    ).toEqual({
      status: "ok",
      params: {
        city: "Paris",
        checkin: "2026-11-13",
        checkout: "2026-11-15",
        nights: 2,
        adults: 2,
      },
    });
  });

  it("treats the city as optional", () => {
    const r = parse({ checkin: "2026-11-13", checkout: "2026-11-14", adults: "1" });
    expect(r).toMatchObject({ status: "ok", params: { city: undefined, nights: 1 } });
  });

  it.each([
    ["no check-in", { checkout: "2026-11-15", adults: "2" }, "checkin"],
    ["no check-out", { checkin: "2026-11-13", adults: "2" }, "checkout"],
    ["no guests", { checkin: "2026-11-13", checkout: "2026-11-15" }, "adults"],
    [
      "check-in in the past",
      { checkin: "2026-10-11", checkout: "2026-10-13", adults: "2" },
      "checkin",
    ],
    [
      "check-out on check-in day",
      { checkin: "2026-11-13", checkout: "2026-11-13", adults: "2" },
      "checkout",
    ],
    [
      "check-out before check-in",
      { checkin: "2026-11-13", checkout: "2026-11-10", adults: "2" },
      "checkout",
    ],
    [
      "a stay over 30 nights",
      { checkin: "2026-11-01", checkout: "2026-12-02", adults: "2" },
      "checkout",
    ],
    [
      "an impossible date",
      { checkin: "2026-02-30", checkout: "2026-03-02", adults: "2" },
      "checkin",
    ],
    ["a malformed date", { checkin: "13/11/2026", checkout: "2026-11-15", adults: "2" }, "checkin"],
    ["0 guests", { checkin: "2026-11-13", checkout: "2026-11-15", adults: "0" }, "adults"],
    ["7 guests", { checkin: "2026-11-13", checkout: "2026-11-15", adults: "7" }, "adults"],
    [
      "non-numeric guests",
      { checkin: "2026-11-13", checkout: "2026-11-15", adults: "two" },
      "adults",
    ],
    [
      "an unknown city",
      { city: "Atlantis", checkin: "2026-11-13", checkout: "2026-11-15", adults: "2" },
      "city",
    ],
  ])("refuses to search with %s", (_label, raw, field) => {
    const r = parse(raw);
    expect(r.status).toBe("invalid");
    if (r.status === "invalid") expect(r.errors).toHaveProperty(field);
  });

  it("allows check-in today and exactly 30 nights", () => {
    expect(parse({ checkin: TODAY, checkout: "2026-11-11", adults: "2" })).toMatchObject({
      status: "ok",
      params: { nights: 30 },
    });
  });

  it("ignores repeated parameters instead of guessing", () => {
    expect(
      parse({ checkin: ["2026-11-13", "2026-11-14"], checkout: "2026-11-15", adults: "2" }).status,
    ).toBe("invalid");
  });
});
