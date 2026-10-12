import { describe, expect, it } from "vitest";
import {
  MOCK_HID_MAX,
  MOCK_HID_MIN,
  mockEvidenceSources,
  mockHotelContent,
  mockSearchResponse,
} from "./index";
import scenariosJson from "./vetting-scenarios.json";

// The mock fixtures stand in for RateHawk until Phase 3. These tests make sure
// they (a) really have RateHawk's shape, so swapping in live data later is a
// data-source change only, (b) can never be mistaken for real hotels, and
// (c) keep covering the edge cases later features must handle.

const decimal = /^\d+\.\d{2}$/;
const utc = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const hotels = mockHotelContent;
const searchHotels = mockSearchResponse.data.hotels;
const allPaymentTypes = searchHotels.flatMap((h) =>
  h.rates.flatMap((r) => r.payment_options.payment_types),
);

describe("mock hotel content (RateHawk static shape)", () => {
  it("has unique hids, all inside the reserved mock range", () => {
    const hids = hotels.map((h) => h.hid);
    expect(new Set(hids).size).toBe(hids.length);
    for (const hid of hids) {
      expect(Number.isSafeInteger(hid)).toBe(true);
      expect(hid).toBeGreaterThanOrEqual(MOCK_HID_MIN);
      expect(hid).toBeLessThanOrEqual(MOCK_HID_MAX);
    }
  });

  it("labels every hotel as mock, by name and by its deprecated id", () => {
    for (const h of hotels) {
      expect(h.name).toMatch(/\(mock\)$/);
      expect(h.id).toMatch(/_mock$/);
    }
  });

  it("has the required static fields with the right types", () => {
    for (const h of hotels) {
      expect(typeof h.address).toBe("string");
      expect(h.latitude).toBeGreaterThan(-90);
      expect(h.longitude).toBeLessThan(180);
      expect(h.star_rating).toBeGreaterThanOrEqual(0);
      expect(h.star_rating).toBeLessThanOrEqual(5);
      expect(h.region.country_code).toMatch(/^[A-Z]{2}$/);
      expect(h.check_in_time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
      expect(Array.isArray(h.amenity_groups)).toBe(true);
      expect(Array.isArray(h.description_struct)).toBe(true);
      expect(typeof h.metapolicy_extra_info).toBe("string");
      expect(typeof h.is_gender_specification_required).toBe("boolean");
    }
  });

  it("uses RateHawk's image URL template with a {size} placeholder", () => {
    for (const h of hotels) {
      expect(h.images_ext.length).toBeGreaterThan(0);
      for (const img of h.images_ext) expect(img.url).toContain("{size}");
    }
  });

  it("covers the launch cities", () => {
    expect(new Set(hotels.map((h) => h.region.name))).toEqual(new Set(["Amsterdam", "Barcelona"]));
  });
});

describe("mock search results (RateHawk SERP shape)", () => {
  it("only lists hotels that exist in the static content, and never a closed one", () => {
    const byHid = new Map(hotels.map((h) => [h.hid, h]));
    for (const sh of searchHotels) {
      expect(byHid.has(sh.hid)).toBe(true);
      expect(byHid.get(sh.hid)!.is_closed).toBe(false);
    }
    expect(mockSearchResponse.data.total_hotels).toBe(searchHotels.length);
  });

  it("prices every rate per night, matching the search length", () => {
    const nights = mockSearchResponse._search.nights;
    for (const r of searchHotels.flatMap((h) => h.rates)) {
      expect(r.daily_prices).toHaveLength(nights);
      for (const p of r.daily_prices) expect(p).toMatch(decimal);
      const total = r.daily_prices.reduce((s, p) => s + Number(p), 0);
      expect(Number(r.payment_options.payment_types[0].amount)).toBeCloseTo(total, 2);
    }
  });

  it("uses the B2B deposit payment type with decimal-string amounts", () => {
    for (const pt of allPaymentTypes) {
      expect(pt.type).toBe("deposit");
      expect(pt.amount).toMatch(decimal);
      expect(pt.show_amount).toMatch(decimal);
      expect(pt.currency_code).toBe(mockSearchResponse._search.currency);
      for (const tax of pt.tax_data.taxes) {
        expect(typeof tax.included_by_supplier).toBe("boolean");
        expect(tax.amount).toMatch(decimal);
      }
    }
  });

  it("has well-formed, chronological cancellation policies", () => {
    const checkin = `${mockSearchResponse._search.checkin}T00:00:00`;
    for (const pt of allPaymentTypes) {
      const { policies, free_cancellation_before } = pt.cancellation_penalties;
      expect(policies.length).toBeGreaterThan(0);
      for (const p of policies) {
        if (p.start_at) expect(p.start_at).toMatch(utc);
        if (p.end_at) expect(p.end_at).toMatch(utc);
        if (p.start_at && p.end_at) expect(p.start_at < p.end_at).toBe(true);
      }
      for (let i = 1; i < policies.length; i++) {
        expect(policies[i].start_at).toBe(policies[i - 1].end_at);
      }
      if (free_cancellation_before) {
        expect(free_cancellation_before < checkin).toBe(true);
        expect(policies[0].amount_charge).toBe("0.00");
      }
    }
  });
});

describe("mock evidence sources", () => {
  it("has an entry for every hotel, with unique, citable source ids", () => {
    const ids = Object.values(mockEvidenceSources).flatMap((list) => list.map((s) => s.source_id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const h of hotels) expect(mockEvidenceSources[String(h.hid)]).toBeDefined();
    for (const [hid, list] of Object.entries(mockEvidenceSources)) {
      for (const s of list) expect(s.source_id).toMatch(new RegExp(`^(rev|press)-${hid}-\\d{2}$`));
    }
  });
});

// Later features (vetting, search, pricing, cancellation) need these cases to
// exist in the mock data, or their tests would only ever see the happy path.
describe("edge-case coverage", () => {
  const scenarios = scenariosJson.scenarios as Record<string, string>;
  const has = (label: string) => Object.values(scenarios).some((s) => s.startsWith(label));

  it("documents a vetting scenario for every hotel", () => {
    for (const h of hotels) expect(scenarios[String(h.hid)]).toBeTruthy();
  });

  it.each([
    "clear-positive",
    "neutral",
    "red-flag",
    "mixed",
    "ineligible",
    "sold-out",
    "gender-specification",
  ])("includes a '%s' vetting scenario", (label) => {
    expect(has(label)).toBe(true);
  });

  it("includes a closed hotel and a sold-out hotel", () => {
    expect(hotels.some((h) => h.is_closed)).toBe(true);
    expect(searchHotels.some((h) => h.rates.length === 0)).toBe(true);
  });

  it("includes taxes both included in and excluded from the quoted price", () => {
    const flags = allPaymentTypes.flatMap((pt) =>
      pt.tax_data.taxes.map((t) => t.included_by_supplier),
    );
    expect(flags).toContain(true);
    expect(flags).toContain(false);
  });

  it("includes non-refundable and tiered-cancellation rates", () => {
    const fcb = allPaymentTypes.map((pt) => pt.cancellation_penalties.free_cancellation_before);
    expect(fcb).toContain(null);
    expect(allPaymentTypes.some((pt) => pt.cancellation_penalties.policies.length >= 3)).toBe(true);
  });
});
