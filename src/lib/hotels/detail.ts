import type { HotelContent, MetapolicyStruct, Rate } from "@/lib/ratehawk/types";
import { priceOf, type ApprovedHotel, type PriceSummary } from "@/lib/search/search";

// The public property page (Epic 2.2), as plain data. Pure: the loader passes
// in what it read, the page only renders.
//
// Whitelist-first, like search: no approval → no page. The text shown under
// "Why we list it" is the public vetting summary staff wrote on approval —
// never the AI evidence pack, which stays staff-only.

export type RoomOption = {
  name: string;
  price: PriceSummary;
};

export type HotelDetail = {
  hid: number;
  name: string;
  city: string;
  countryCode: string;
  kind: string;
  stars: number;
  address: string;
  /** `{size}` placeholder still in the URL; the page picks the size. */
  photos: { url: string; category: string }[];
  amenities: { group: string; free: string[]; paid: string[] }[];
  description: { title: string; paragraphs: string[] }[];
  checkIn: string; // "15:00"
  checkOut: string; // "11:00"
  /** Structured rules (deposits, fees, pets…) as short sentences. */
  rules: string[];
  /** The hotel's own free-text rules, shown as written. */
  extraInfo: string | null;
  vettingSummary: string;
  /** null = no stay chosen yet; [] = no rooms for the chosen stay. */
  rooms: RoomOption[] | null;
};

const human = (value: string) => value.replaceAll("_", " ");
const time = (value: string) => value.slice(0, 5);
const amount = (price: string, currency: string) =>
  Number(price) > 0 ? `${currency} ${Number(price).toFixed(2)}` : "free";

/** House rules from RateHawk's structured policy, in plain words. */
export function houseRules(policy: MetapolicyStruct): string[] {
  const rules: string[] = [];
  for (const d of policy.deposit) {
    rules.push(
      `${human(d.deposit_type)} deposit: ${amount(d.price, d.currency)} ${human(d.pricing_method)}`.replace(
        /^./,
        (c) => c.toUpperCase(),
      ),
    );
  }
  for (const f of policy.add_fee) {
    rules.push(
      `Extra fee (${human(f.fee_type)}): ${amount(f.price, f.currency)} ${human(f.price_unit)}`,
    );
  }
  for (const p of policy.pets) {
    rules.push(
      p.inclusion === "not_allowed"
        ? "Pets are not allowed"
        : `Pets allowed: ${amount(p.price, p.currency)}${Number(p.price) > 0 ? ` ${human(p.price_unit)}` : ""}`,
    );
  }
  for (const p of policy.parking) {
    rules.push(
      `Parking (${human(p.territory_type)}): ${amount(p.price, p.currency)}${Number(p.price) > 0 ? ` ${human(p.price_unit)}` : ""}`,
    );
  }
  for (const i of policy.internet) {
    rules.push(
      `Internet (${human(i.internet_type)}): ${amount(i.price, i.currency)}${Number(i.price) > 0 ? ` ${human(i.price_unit)}` : ""}`,
    );
  }
  return rules;
}

/** Room options for the chosen stay, cheapest first (what the guest pays in total). */
export function roomOptions(rates: Rate[]): RoomOption[] {
  const rooms: RoomOption[] = [];
  for (const rate of rates) {
    const price = priceOf(rate);
    if (price) rooms.push({ name: rate.room_name, price });
  }
  const paid = (r: RoomOption) => r.price.total + r.price.excludedTaxes;
  return rooms.sort((a, b) => paid(a) - paid(b));
}

export function buildHotelDetail(input: {
  /** The hotel's whitelist row, or undefined if it isn't approved. */
  approval: ApprovedHotel | undefined;
  hotel: HotelContent | undefined;
  /** null = no stay chosen; otherwise the rates for that stay (may be empty). */
  rates: Rate[] | null;
}): HotelDetail | null {
  const { approval, hotel } = input;
  if (!approval || !hotel || hotel.is_closed || approval.hid !== hotel.hid) return null;

  return {
    hid: hotel.hid,
    name: hotel.name,
    city: hotel.region.name,
    countryCode: hotel.region.country_code,
    kind: human(hotel.kind),
    stars: hotel.star_rating,
    address: [hotel.address, hotel.postal_code].filter(Boolean).join(", "),
    photos: hotel.images_ext.map((i) => ({ url: i.url, category: human(i.category_slug) })),
    amenities: hotel.amenity_groups
      .map((g) => ({ group: g.group_name, free: g.amenities, paid: g.non_free_amenities }))
      .filter((g) => g.free.length + g.paid.length > 0),
    description: hotel.description_struct,
    checkIn: time(hotel.check_in_time),
    checkOut: time(hotel.check_out_time),
    rules: houseRules(hotel.metapolicy_struct),
    extraInfo: hotel.metapolicy_extra_info.trim() || null,
    vettingSummary: approval.vetting_summary,
    rooms: input.rates === null ? null : roomOptions(input.rates),
  };
}

/** A hotel id from the URL: digits only, so nothing else reaches a query. */
export function parseHid(value: string): number | null {
  if (!/^[1-9]\d{0,14}$/.test(value)) return null;
  return Number(value);
}
