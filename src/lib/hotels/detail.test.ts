import { describe, expect, it } from "vitest";
import { mockSearchRates } from "@/lib/rates/mock-search";
import type { HotelContent, MetapolicyStruct } from "@/lib/ratehawk/types";
import { mockHotelContent } from "@/mock/ratehawk";
import { buildHotelDetail, houseRules, parseHid, roomOptions } from "./detail";

const hotel = (hid: number) => mockHotelContent.find((h) => h.hid === hid)!;
const approval = (hid: number) => ({ hid, vetting_summary: "Reviewed by our team." });
const stay = { checkin: "2027-03-01", checkout: "2027-03-03", nights: 2, adults: 2 };
const ratesFor = (hid: number) =>
  mockSearchRates(stay, "2026-10-13").data.hotels.find((h) => h.hid === hid)?.rates ?? [];

describe("buildHotelDetail", () => {
  it("shows nothing for a hotel that isn't approved", () => {
    expect(
      buildHotelDetail({ approval: undefined, hotel: hotel(9990000006), rates: null }),
    ).toBeNull();
  });

  it("shows nothing for an approved hotel that has since closed", () => {
    expect(hotel(9990000005).is_closed).toBe(true);
    expect(
      buildHotelDetail({ approval: approval(9990000005), hotel: hotel(9990000005), rates: null }),
    ).toBeNull();
  });

  it("shows nothing when the approval and the content are for different hotels", () => {
    expect(
      buildHotelDetail({ approval: approval(9990000001), hotel: hotel(9990000006), rates: null }),
    ).toBeNull();
  });

  it("shows nothing without content", () => {
    expect(
      buildHotelDetail({ approval: approval(9990000006), hotel: undefined, rates: null }),
    ).toBeNull();
  });

  it("builds the page for an approved hotel, with the staff-written summary", () => {
    const detail = buildHotelDetail({
      approval: approval(9990000006),
      hotel: hotel(9990000006),
      rates: null,
    })!;
    expect(detail.name).toBe(hotel(9990000006).name);
    expect(detail.vettingSummary).toBe("Reviewed by our team.");
    expect(detail.photos.length).toBe(hotel(9990000006).images_ext.length);
    expect(detail.checkIn).toMatch(/^\d{2}:\d{2}$/);
    expect(detail.extraInfo).toBe(hotel(9990000006).metapolicy_extra_info);
    // No stay chosen yet: no room list, rather than "nothing available".
    expect(detail.rooms).toBeNull();
  });

  it("never carries anything from an AI evidence pack", () => {
    const detail = buildHotelDetail({
      approval: approval(9990000006),
      hotel: hotel(9990000006),
      rates: null,
    })!;
    const text = JSON.stringify(detail);
    expect(text).not.toMatch(/signals|evidence|source_id|concern/i);
  });

  it("lists rooms for a chosen stay, cheapest first", () => {
    const detail = buildHotelDetail({
      approval: approval(9990000006),
      hotel: hotel(9990000006),
      rates: ratesFor(9990000006),
    })!;
    expect(detail.rooms!.length).toBeGreaterThan(0);
    const paid = detail.rooms!.map((r) => r.price.total + r.price.excludedTaxes);
    expect(paid).toEqual([...paid].sort((a, b) => a - b));
    expect(detail.rooms!.every((r) => r.price.nights === 2)).toBe(true);
  });

  it("says 'no rooms' (an empty list) when the hotel is sold out for the stay", () => {
    expect(ratesFor(9990000008)).toEqual([]);
    const detail = buildHotelDetail({
      approval: approval(9990000008),
      hotel: hotel(9990000008),
      rates: ratesFor(9990000008),
    })!;
    expect(detail.rooms).toEqual([]);
  });
});

describe("roomOptions", () => {
  it("skips a rate without a payment option", () => {
    const [rate] = ratesFor(9990000006);
    const broken = { ...rate, payment_options: { payment_types: [] } };
    expect(roomOptions([broken, rate])).toHaveLength(1);
  });
});

describe("houseRules", () => {
  const empty: MetapolicyStruct = hotel(9990000001).metapolicy_struct;
  const base: MetapolicyStruct = {
    ...empty,
    internet: [],
    deposit: [],
    add_fee: [],
    pets: [],
    parking: [],
  };

  it("puts deposits, fees and pets into plain words", () => {
    const rules = houseRules({
      ...base,
      deposit: [
        {
          availability: "available",
          deposit_type: "damage",
          payment_type: "cash",
          price: "200.00",
          currency: "EUR",
          pricing_method: "per_stay",
        },
      ],
      add_fee: [
        {
          fee_type: "service_fee",
          price: "5.00",
          currency: "EUR",
          price_unit: "per_guest_per_night",
        },
      ],
      pets: [
        {
          inclusion: "not_allowed",
          pets_type: "unspecified",
          price: "0.00",
          currency: "EUR",
          price_unit: "per_room_per_night",
        },
      ],
    });
    expect(rules).toEqual([
      "Damage deposit: EUR 200.00 per stay",
      "Extra fee (service fee): EUR 5.00 per guest per night",
      "Pets are not allowed",
    ]);
  });

  it("says 'free' for a zero price", () => {
    expect(houseRules(empty)).toEqual(["Internet (wireless): free"]);
  });

  it("works on every fixture hotel", () => {
    for (const h of mockHotelContent as HotelContent[]) {
      expect(() => houseRules(h.metapolicy_struct)).not.toThrow();
    }
  });
});

describe("parseHid", () => {
  it.each(["9990000006", "1"])("accepts %s", (v) => expect(parseHid(v)).toBe(Number(v)));
  it.each(["", "0", "01", "-5", "12a", "1e9", "9990000006 ", "99999999999999999999"])(
    "rejects %j",
    (v) => expect(parseHid(v)).toBeNull(),
  );
});
