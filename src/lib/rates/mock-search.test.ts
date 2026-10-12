import { describe, expect, it } from "vitest";
import { mockSearchResponse } from "@/mock/ratehawk";
import { mockSearchRates } from "./mock-search";

const TODAY = "2026-10-12";
const RIVE_GAUCHE = 9990000004; // Paris: city tax not included, has refundable rates
const VICOLO_SOLD_OUT = 9990000008;

const params = (over: Partial<Parameters<typeof mockSearchRates>[0]> = {}) => ({
  checkin: "2026-12-01",
  checkout: "2026-12-04",
  nights: 3,
  adults: 2,
  ...over,
});
const hotel = (res: ReturnType<typeof mockSearchRates>, hid: number) =>
  res.data.hotels.find((h) => h.hid === hid)!;
const firstPt = (res: ReturnType<typeof mockSearchRates>, hid: number, rate = 0) =>
  hotel(res, hid).rates[rate].payment_options.payment_types[0];

describe("mockSearchRates", () => {
  it("prices one entry per night, adding up to the total", () => {
    const res = mockSearchRates(params(), TODAY);
    for (const h of res.data.hotels) {
      for (const r of h.rates) {
        expect(r.daily_prices).toHaveLength(3);
        const sum = r.daily_prices.reduce((s, d) => s + Number(d), 0);
        expect(Number(r.payment_options.payment_types[0].amount)).toBeCloseTo(sum, 2);
      }
    }
  });

  it("charges more for more guests and less for one", () => {
    const one = Number(firstPt(mockSearchRates(params({ adults: 1 }), TODAY), RIVE_GAUCHE).amount);
    const two = Number(firstPt(mockSearchRates(params({ adults: 2 }), TODAY), RIVE_GAUCHE).amount);
    const four = Number(firstPt(mockSearchRates(params({ adults: 4 }), TODAY), RIVE_GAUCHE).amount);
    expect(one).toBeLessThan(two);
    expect(two).toBeLessThan(four);
  });

  it("scales city tax per guest per night", () => {
    const tax = (adults: number, nights: number) =>
      Number(
        firstPt(
          mockSearchRates(params({ adults, nights, checkout: "2026-12-0" + (1 + nights) }), TODAY),
          RIVE_GAUCHE,
        ).tax_data.taxes[0].amount,
      );
    expect(tax(4, 3)).toBeCloseTo(tax(2, 3) * 2, 2);
    expect(tax(2, 6)).toBeCloseTo(tax(2, 3) * 2, 2);
  });

  it("keeps free cancellation the same number of days before check-in", () => {
    const original = mockSearchResponse.data.hotels.find((h) => h.hid === RIVE_GAUCHE)!.rates[1]
      .payment_options.payment_types[0].cancellation_penalties.free_cancellation_before;
    expect(original).toBe("2026-11-06T00:00:00"); // 7 days before 13 Nov
    const pt = firstPt(mockSearchRates(params(), TODAY), RIVE_GAUCHE, 1);
    expect(pt.cancellation_penalties.free_cancellation_before).toBe("2026-11-24T00:00:00"); // 7 days before 1 Dec
  });

  it("makes a rate non-refundable when free cancellation would already be over", () => {
    const pt = firstPt(
      mockSearchRates(params({ checkin: "2026-10-14", checkout: "2026-10-16", nights: 2 }), TODAY),
      RIVE_GAUCHE,
      1,
    );
    expect(pt.cancellation_penalties.free_cancellation_before).toBeNull();
    expect(pt.cancellation_penalties.policies).toHaveLength(1);
    expect(pt.cancellation_penalties.policies[0].amount_charge).toBe(pt.amount);
  });

  it("keeps a sold-out hotel sold out", () => {
    expect(hotel(mockSearchRates(params(), TODAY), VICOLO_SOLD_OUT).rates).toEqual([]);
  });
});
