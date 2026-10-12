// TypeScript shapes of the RateHawk (ETG API v3, B2B) responses GAYNAV uses.
//
// Written from ETG's API documentation (docs.emergingtravel.com) — only the
// fields GAYNAV needs are typed; real responses carry more. Phases 1–2 read
// mock data in these shapes (src/mock/ratehawk/); Phase 3's real client must
// return the same shapes, so nothing downstream changes when mock is swapped
// for live data (CLAUDE.md, Open Items).
//
// `hid` (numeric) is the stable hotel identifier for every internal reference;
// the string `id` is deprecated by RateHawk and kept only for completeness.

/** Decimal amounts arrive as strings (e.g. "214.00") to avoid float rounding. */
export type DecimalString = string;

// ── Static hotel content (hotel content API / weekly + daily dumps) ─────────

export type HotelRegion = {
  id: number;
  name: string;
  country_code: string; // ISO 3166-1 alpha-2
  iata: string | null;
  type: string; // e.g. "City"
};

export type HotelImage = {
  category_slug: string; // e.g. "exterior", "room", "lobby"
  /** Contains a `{size}` placeholder, e.g. 1024x768 (fit) or 640x400 (crop). */
  url: string;
};

export type AmenityGroup = {
  group_name: string;
  amenities: string[];
  non_free_amenities: string[];
};

export type DescriptionSection = {
  title: string;
  paragraphs: string[];
};

/** House rules and extra fees. Every key may be an empty array. */
export type MetapolicyStruct = {
  add_fee: { fee_type: string; price: DecimalString; currency: string; price_unit: string }[];
  check_in_check_out: {
    check_in_check_out_type: string;
    inclusion: string;
    price: DecimalString;
    currency: string;
  }[];
  children: {
    age_start: number;
    age_end: number;
    extra_bed: string;
    price: DecimalString;
    currency: string;
  }[];
  children_meal: unknown[];
  cot: unknown[];
  deposit: {
    availability: string;
    deposit_type: string;
    payment_type: string;
    price: DecimalString;
    currency: string;
    pricing_method: string;
  }[];
  extra_bed: unknown[];
  internet: {
    inclusion: string;
    internet_type: string;
    work_area: string;
    price: DecimalString;
    currency: string;
    price_unit: string;
  }[];
  meal: { inclusion: string; meal_type: string; price: DecimalString; currency: string }[];
  no_show: { availability: string; day_period: string; time: string | null };
  parking: {
    inclusion: string;
    territory_type: string;
    price: DecimalString;
    currency: string;
    price_unit: string;
  }[];
  pets: {
    inclusion: string;
    pets_type: string;
    price: DecimalString;
    currency: string;
    price_unit: string;
  }[];
  shuttle: unknown[];
  visa: { visa_support: string };
};

export type HotelContent = {
  /** @deprecated by RateHawk — use `hid`. */
  id: string;
  hid: number;
  name: string;
  kind: string; // e.g. "Hotel", "Boutique_and_Design", "Apartment"
  star_rating: number; // 0–5
  is_closed: boolean;
  address: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  region: HotelRegion;
  check_in_time: string; // "15:00:00"
  check_out_time: string; // "11:00:00"
  is_gender_specification_required: boolean;
  images_ext: HotelImage[];
  amenity_groups: AmenityGroup[];
  description_struct: DescriptionSection[];
  metapolicy_struct: MetapolicyStruct;
  /** Free-text house rules from the hotel; may contain anything — vetting reads it. */
  metapolicy_extra_info: string;
};

// ── Search results (SERP / hotel page): live rates and availability ─────────

export type Tax = {
  name: string; // e.g. "city_tax", "vat"
  /** false = NOT in the quoted price; must be shown separately, paid at the hotel. */
  included_by_supplier: boolean;
  amount: DecimalString;
  currency_code: string;
};

export type CancellationPolicy = {
  /** null = from booking time. UTC+0. */
  start_at: string | null;
  /** null = until check-in. UTC+0. */
  end_at: string | null;
  amount_charge: DecimalString;
  amount_show: DecimalString;
};

export type CancellationPenalties = {
  policies: CancellationPolicy[];
  /** null = no free cancellation at any point. UTC+0. */
  free_cancellation_before: string | null;
};

export type PaymentType = {
  amount: DecimalString;
  show_amount: DecimalString;
  currency_code: string;
  show_currency_code: string;
  by: string | null;
  is_need_credit_card_data: boolean;
  is_need_cvc: boolean;
  /** B2B contract: "deposit" — GAYNAV collects payment, RateHawk debits its deposit. */
  type: "deposit" | "now" | "hotel";
  vat_data: {
    included: boolean;
    applied: boolean;
    amount: DecimalString;
    currency_code: string;
    value: DecimalString;
  };
  tax_data: { taxes: Tax[] };
  cancellation_penalties: CancellationPenalties;
};

export type Rate = {
  match_hash: string;
  book_hash: string;
  room_name: string;
  meal: string; // e.g. "nomeal", "breakfast"
  meal_data: { value: string; has_breakfast: boolean; no_child_meal: boolean };
  /** One entry per night. */
  daily_prices: DecimalString[];
  amenities_data: string[];
  allotment: number;
  rg_ext: {
    class: number;
    quality: number;
    sex: number;
    bathroom: number;
    bedding: number;
    family: number;
    capacity: number;
    club: number;
    bedrooms: number;
    balcony: number;
    view: number;
    floor: number;
  };
  payment_options: { payment_types: PaymentType[] };
};

export type SearchHotel = {
  /** @deprecated by RateHawk — use `hid`. */
  id: string;
  hid: number;
  /** Empty = no availability for these dates (sold out). */
  rates: Rate[];
};

export type SearchResponse = {
  status: "ok" | "error";
  error: string | null;
  data: { hotels: SearchHotel[]; total_hotels: number };
};
