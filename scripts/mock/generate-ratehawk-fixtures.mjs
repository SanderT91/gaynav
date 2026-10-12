// Generates the mock RateHawk fixtures in src/mock/ratehawk/.
//
//   node scripts/mock/generate-ratehawk-fixtures.mjs
//
// EVERYTHING HERE IS FICTITIOUS. Hotel names end in "(mock)", streets are
// invented, reviews and press snippets are written for testing. `hid`s use the
// reserved range 9_990_000_001+ so they can never collide with a real RateHawk
// hotel id. Shapes follow ETG API v3 (see src/lib/ratehawk/types.ts).
//
// Hotel facts are written by hand below; prices, taxes and cancellation
// windows are computed so they stay internally consistent. Edit and re-run.
import { writeFileSync } from "node:fs";

const OUT = new URL("../../src/mock/ratehawk/", import.meta.url);

// The fixed search the mock rates answer (Phase 3 will search live instead).
const SEARCH = {
  checkin: "2026-11-13",
  checkout: "2026-11-15",
  nights: 2,
  guests: [{ adults: 2, children: [] }],
  residency: "nl",
  currency: "EUR",
};

const REGIONS = {
  amsterdam: { id: 2734, name: "Amsterdam", country_code: "NL", iata: "AMS", type: "City" },
  barcelona: { id: 1869, name: "Barcelona", country_code: "ES", iata: "BCN", type: "City" },
};

const emptyPolicy = () => ({
  add_fee: [],
  check_in_check_out: [],
  children: [],
  children_meal: [],
  cot: [],
  deposit: [],
  extra_bed: [],
  internet: [
    {
      inclusion: "included",
      internet_type: "wireless",
      work_area: "whole_hotel",
      price: "0.00",
      currency: "EUR",
      price_unit: "per_room_per_night",
    },
  ],
  meal: [],
  no_show: { availability: "available", day_period: "after_midday", time: null },
  parking: [],
  pets: [],
  shuttle: [],
  visa: { visa_support: "unsupported" },
});

const images = (hid, categories) =>
  categories.map((category_slug, i) => ({
    category_slug,
    url: `/mock/hotel-photo.svg?size={size}&hid=${hid}&n=${i + 1}`,
  }));

const amenities = (extra = []) => [
  {
    group_name: "General",
    amenities: ["24-hour reception", "Elevator", "Non-smoking rooms", ...extra],
    non_free_amenities: [],
  },
  { group_name: "Internet", amenities: ["Free Wi-Fi"], non_free_amenities: [] },
];

// ── Hotels (static content) ─────────────────────────────────────────────────
// `vetting_note` is NOT part of RateHawk's shape — it documents, for humans and
// tests, which vetting scenario each mock hotel exists to exercise. It is
// stripped before writing hotel-content.json.
const HOTELS = [
  {
    hid: 9990000001,
    slug: "canal_lantern_hotel_mock",
    name: "Canal Lantern Hotel (mock)",
    kind: "Boutique_and_Design",
    stars: 4,
    region: "amsterdam",
    address: "Lantaarngracht 14",
    postal: "1016 AB",
    lat: 52.3731,
    lon: 4.8846,
    vetting_note: "clear-positive: visible inclusion commitments, strong guest reviews",
    description:
      "A canal-house boutique hotel in the Jordaan with 24 rooms. The team runs a published inclusion policy and partners with local LGBTQ+ venues for guest recommendations.",
    extra_info:
      "Quiet hours from 22:00. Guests of all identities and relationships are welcome; no questions asked about who shares a room.",
    amenityExtra: ["Bar", "Garden"],
    rateBase: 214,
    taxIncluded: false,
  },
  {
    hid: 9990000002,
    slug: "harbour_light_rooms_mock",
    name: "Harbour Light Rooms (mock)",
    kind: "Hotel",
    stars: 3,
    region: "amsterdam",
    address: "Kadewerf 3",
    postal: "1018 CZ",
    lat: 52.3714,
    lon: 4.9152,
    vetting_note: "neutral: nothing positive or negative stated — needs human judgement",
    description:
      "A practical, modern hotel near the eastern docks, 10 minutes by tram from Centraal Station.",
    extra_info: "Photo ID required at check-in for all guests.",
    amenityExtra: ["Bicycle rental"],
    rateBase: 139,
    taxIncluded: false,
  },
  {
    hid: 9990000003,
    slug: "the_tulip_stay_mock",
    name: "The Tulip Stay (mock)",
    kind: "Hotel",
    stars: 3,
    region: "amsterdam",
    address: "Bloembollenweg 88",
    postal: "1062 HK",
    lat: 52.3576,
    lon: 4.8392,
    vetting_note: "red-flag: house rule restricts who may share a room",
    description: "Family-run hotel near Vondelpark with garden views.",
    extra_info:
      "Only married couples may share a double room. The hotel may ask for a marriage certificate at check-in.",
    amenityExtra: [],
    rateBase: 119,
    taxIncluded: true,
  },
  {
    hid: 9990000004,
    slug: "prinsen_suites_mock",
    name: "Prinsen Suites (mock)",
    kind: "Apartment",
    stars: 4,
    region: "amsterdam",
    address: "Vorstenstraat 21",
    postal: "1015 RN",
    lat: 52.3779,
    lon: 4.8858,
    vetting_note: "mixed: good policies but several reviews describe unwelcoming staff",
    description: "Serviced apartments with kitchenettes, suited to longer stays.",
    extra_info: "Security deposit of EUR 200 taken at check-in, refunded at check-out.",
    amenityExtra: ["Kitchenette"],
    rateBase: 189,
    taxIncluded: false,
    deposit: true,
  },
  {
    hid: 9990000005,
    slug: "dam_square_inn_mock",
    name: "Dam Square Inn (mock)",
    kind: "Hotel",
    stars: 2,
    region: "amsterdam",
    address: "Pleinpad 2",
    postal: "1012 JS",
    lat: 52.373,
    lon: 4.8926,
    vetting_note: "ineligible: permanently closed (is_closed: true)",
    description: "Small budget hotel. This property has closed.",
    extra_info: "",
    amenityExtra: [],
    rateBase: 0,
    closed: true,
  },
  {
    hid: 9990000006,
    slug: "casa_eixample_mock",
    name: "Casa Eixample (mock)",
    kind: "Boutique_and_Design",
    stars: 4,
    region: "barcelona",
    address: "Carrer de la Mostra 120",
    postal: "08011",
    lat: 41.3889,
    lon: 2.1611,
    vetting_note: "clear-positive: LGBTQ+-owned, in the Gaixample neighbourhood",
    description:
      "A modernista building in the Eixample, owned and run by an LGBTQ+ couple. Rooftop terrace with city views.",
    extra_info: "All guests welcome. Rooftop open 10:00–23:00.",
    amenityExtra: ["Rooftop terrace", "Bar"],
    rateBase: 176,
    taxIncluded: false,
  },
  {
    hid: 9990000007,
    slug: "hotel_mar_blava_mock",
    name: "Hotel Mar Blava (mock)",
    kind: "Hotel",
    stars: 4,
    region: "barcelona",
    address: "Passeig de les Onades 7",
    postal: "08003",
    lat: 41.3795,
    lon: 2.1916,
    vetting_note: "neutral-positive: large beach hotel, decent reviews, no explicit statements",
    description: "Beachfront hotel in Barceloneta with an outdoor pool.",
    extra_info: "Pool towels provided. Pool closes at 20:00.",
    amenityExtra: ["Outdoor pool", "Restaurant"],
    rateBase: 205,
    taxIncluded: false,
  },
  {
    hid: 9990000008,
    slug: "gotic_hideaway_mock",
    name: "Gòtic Hideaway (mock)",
    kind: "Hotel",
    stars: 3,
    region: "barcelona",
    address: "Carrer del Rellotge 5",
    postal: "08002",
    lat: 41.3829,
    lon: 2.177,
    vetting_note: "sold-out: no rates for the mock dates (empty rates array)",
    description: "Small hotel in the Gothic Quarter, steps from the cathedral.",
    extra_info: "No elevator; rooms are on floors 1–4.",
    amenityExtra: [],
    rateBase: 0,
    soldOut: true,
  },
  {
    hid: 9990000009,
    slug: "montjuic_garden_hotel_mock",
    name: "Montjuïc Garden Hotel (mock)",
    kind: "Hotel",
    stars: 3,
    region: "barcelona",
    address: "Carrer dels Jardins 44",
    postal: "08004",
    lat: 41.3712,
    lon: 2.1592,
    vetting_note:
      "red-flag: press coverage of a discrimination complaint (2025), hotel response unclear",
    description: "Quiet hotel at the foot of Montjuïc with a garden courtyard.",
    extra_info: "Breakfast served 07:00–10:30.",
    amenityExtra: ["Garden"],
    rateBase: 128,
    taxIncluded: true,
  },
  {
    hid: 9990000010,
    slug: "rambla_loft_mock",
    name: "Rambla Loft (mock)",
    kind: "Apartment",
    stars: 0,
    region: "barcelona",
    address: "Passatge del Teler 9",
    postal: "08001",
    lat: 41.381,
    lon: 2.172,
    vetting_note:
      "gender-specification: is_gender_specification_required is true — check how the field is used",
    description: "Loft apartments in El Raval. Self check-in with a keypad.",
    extra_info:
      "Guest names and genders must match ID documents for registration with the police (Spanish guest registration law).",
    amenityExtra: ["Kitchen", "Washing machine"],
    rateBase: 158,
    taxIncluded: false,
    genderSpec: true,
  },
];

function hotelContent(h) {
  const policy = emptyPolicy();
  if (h.deposit) {
    policy.deposit.push({
      availability: "available",
      deposit_type: "damage",
      payment_type: "card",
      price: "200.00",
      currency: "EUR",
      pricing_method: "per_stay",
    });
  }
  policy.add_fee.push({
    fee_type: "city_tax",
    price: h.region === "amsterdam" ? "12.50" : "5.50",
    currency: "EUR",
    price_unit: "per_guest_per_night",
  });
  return {
    id: h.slug,
    hid: h.hid,
    name: h.name,
    kind: h.kind,
    star_rating: h.stars,
    is_closed: Boolean(h.closed),
    address: h.address,
    postal_code: h.postal,
    latitude: h.lat,
    longitude: h.lon,
    region: REGIONS[h.region],
    check_in_time: "15:00:00",
    check_out_time: "11:00:00",
    is_gender_specification_required: Boolean(h.genderSpec),
    images_ext: images(h.hid, ["exterior", "room", "room", "bathroom", "lobby"]),
    amenity_groups: amenities(h.amenityExtra),
    description_struct: [{ title: "About the property", paragraphs: [h.description] }],
    metapolicy_struct: policy,
    metapolicy_extra_info: h.extra_info,
  };
}

// ── Rates (search results for SEARCH) ───────────────────────────────────────
const money = (n) => n.toFixed(2);

function paymentType(total, h, { refundable, tieredDays }) {
  // City tax: per guest per night. Amsterdam ~12.5%, Barcelona flat 5.50.
  const guests = SEARCH.guests[0].adults;
  const cityTax = h.region === "amsterdam" ? total * 0.125 : 5.5 * guests * SEARCH.nights;
  const vat = total * (h.region === "amsterdam" ? 0.09 / 1.09 : 0.1 / 1.1);
  const checkinUtc = `${SEARCH.checkin}T14:00:00`;
  let cancellation;
  if (!refundable) {
    cancellation = {
      policies: [
        { start_at: null, end_at: null, amount_charge: money(total), amount_show: money(total) },
      ],
      free_cancellation_before: null,
    };
  } else {
    const free = new Date(`${SEARCH.checkin}T00:00:00Z`);
    free.setUTCDate(free.getUTCDate() - tieredDays);
    const half = new Date(`${SEARCH.checkin}T00:00:00Z`);
    half.setUTCDate(half.getUTCDate() - 1);
    const iso = (d) => d.toISOString().slice(0, 19);
    cancellation = {
      policies: [
        { start_at: null, end_at: iso(free), amount_charge: "0.00", amount_show: "0.00" },
        {
          start_at: iso(free),
          end_at: iso(half),
          amount_charge: money(total / 2),
          amount_show: money(total / 2),
        },
        {
          start_at: iso(half),
          end_at: null,
          amount_charge: money(total),
          amount_show: money(total),
        },
      ],
      free_cancellation_before: iso(free),
    };
  }
  return {
    amount: money(total),
    show_amount: money(total),
    currency_code: SEARCH.currency,
    show_currency_code: SEARCH.currency,
    by: null,
    is_need_credit_card_data: false,
    is_need_cvc: false,
    type: "deposit",
    vat_data: {
      included: true,
      applied: true,
      amount: money(vat),
      currency_code: SEARCH.currency,
      value: h.region === "amsterdam" ? "9.00" : "10.00",
    },
    tax_data: {
      taxes: [
        {
          name: "city_tax",
          included_by_supplier: Boolean(h.taxIncluded),
          amount: money(cityTax),
          currency_code: SEARCH.currency,
        },
      ],
    },
    cancellation_penalties: cancellation,
    _checkin_reference: checkinUtc, // stripped below
  };
}

function rate(h, n, { room, nightly, breakfast, refundable, tieredDays = 7 }) {
  const daily = Array.from({ length: SEARCH.nights }, (_, i) =>
    money(nightly + (i === 1 ? 10 : 0)),
  );
  const total = daily.reduce((s, d) => s + Number(d), 0);
  const pt = paymentType(total, h, { refundable, tieredDays });
  delete pt._checkin_reference;
  return {
    match_hash: `m-mock-${h.hid}-${n}`,
    book_hash: `h-mock-${h.hid}-${n}`,
    room_name: room,
    meal: breakfast ? "breakfast" : "nomeal",
    meal_data: {
      value: breakfast ? "breakfast" : "nomeal",
      has_breakfast: breakfast,
      no_child_meal: true,
    },
    daily_prices: daily,
    amenities_data: breakfast ? ["breakfast", "wifi"] : ["wifi"],
    allotment: 3,
    rg_ext: {
      class: 3,
      quality: 2,
      sex: 0,
      bathroom: 2,
      bedding: 3,
      family: 0,
      capacity: 2,
      club: 0,
      bedrooms: 0,
      balcony: 0,
      view: 0,
      floor: 0,
    },
    payment_options: { payment_types: [pt] },
  };
}

function searchHotel(h) {
  if (h.closed) return null; // closed hotels never appear in search
  const rates = h.soldOut
    ? []
    : [
        rate(h, 1, {
          room: "Standard Double Room",
          nightly: h.rateBase,
          breakfast: false,
          refundable: false,
        }),
        rate(h, 2, {
          room: "Standard Double Room",
          nightly: h.rateBase + 18,
          breakfast: true,
          refundable: true,
        }),
        rate(h, 3, {
          room: "Deluxe Double Room",
          nightly: h.rateBase + 45,
          breakfast: true,
          refundable: true,
          tieredDays: 3,
        }),
      ];
  return { id: hotelContent(h).id, hid: h.hid, rates };
}

// ── Evidence sources for AI evidence packs (GAYNAV mock, not RateHawk) ──────
// RateHawk provides policies; reviews and press come from elsewhere in real
// life. Each source has a stable id so AI summaries can cite it.
const REVIEWS = {
  9990000001: [
    [
      5,
      "2026-08-02",
      "We were greeted warmly as a same-sex couple and the staff recommended great queer bars nearby.",
    ],
    [
      5,
      "2026-06-19",
      "Lovely canal views. The inclusion policy is printed in every room — small thing, but it mattered to us.",
    ],
    [4, "2026-05-11", "Rooms are small but beautiful. Breakfast could be better."],
  ],
  9990000002: [
    [4, "2026-07-30", "Clean, efficient, good tram connection."],
    [3, "2026-04-02", "Fine for a short stay. Nothing special."],
  ],
  9990000003: [
    [
      2,
      "2026-07-14",
      "We were asked whether we were married before we could get our double room. Uncomfortable.",
    ],
    [4, "2026-05-21", "Beautiful garden and friendly owners."],
  ],
  9990000004: [
    [
      2,
      "2026-08-18",
      "Receptionist rolled his eyes when we asked for one bed instead of two. Apartment itself was great.",
    ],
    [
      3,
      "2026-07-02",
      "Felt watched at the front desk when my boyfriend and I came back late. Not sure if it was just us.",
    ],
    [5, "2026-03-15", "Spacious, well equipped, would stay again."],
  ],
  9990000006: [
    [5, "2026-09-01", "The owners made us feel at home. Perfect base for Pride week."],
    [5, "2026-06-28", "Rooftop is stunning, and the hosts are part of the local community."],
  ],
  9990000007: [
    [4, "2026-08-10", "Great pool, busy in summer. Staff were professional."],
    [4, "2026-07-07", "Good location for the beach. No issues as a gay couple."],
  ],
  9990000008: [[4, "2026-05-05", "Charming but the stairs are a workout."]],
  9990000009: [
    [3, "2026-06-11", "Nice garden. Some staff seemed cold."],
    [4, "2026-02-20", "Quiet and good value."],
  ],
  9990000010: [
    [
      4,
      "2026-08-25",
      "Self check-in was easy. The registration form asked for gender, which was awkward for my non-binary partner.",
    ],
  ],
};

const PRESS = {
  9990000001: [
    [
      "Mock City Guide (fictitious)",
      "2026-04-10",
      "Named one of Amsterdam's most welcoming small hotels for LGBTQ+ travellers.",
    ],
  ],
  9990000006: [
    [
      "Fictional Travel Weekly",
      "2025-11-03",
      "Profile of the couple who restored the building and opened it to queer travellers.",
    ],
  ],
  9990000009: [
    [
      "Mock Barcelona Herald (fictitious)",
      "2025-09-14",
      "Two guests filed a complaint alleging they were refused a shared room; the hotel said it was a booking error.",
    ],
  ],
};

function evidenceFor(hid) {
  const reviews = (REVIEWS[hid] ?? []).map(([rating, date, text], i) => ({
    source_id: `rev-${hid}-${String(i + 1).padStart(2, "0")}`,
    kind: "review",
    rating,
    date,
    text,
  }));
  const press = (PRESS[hid] ?? []).map(([outlet, date, text], i) => ({
    source_id: `press-${hid}-${String(i + 1).padStart(2, "0")}`,
    kind: "press",
    outlet,
    date,
    text,
  }));
  return [...reviews, ...press];
}

// ── Write ───────────────────────────────────────────────────────────────────
const MOCK_NOTICE =
  "MOCK DATA — fictitious hotels, reviews and press for development (Phases 1–2). Not real properties. Generated by scripts/mock/generate-ratehawk-fixtures.mjs.";

const write = (name, data) =>
  writeFileSync(new URL(name, OUT), `${JSON.stringify(data, null, 2)}\n`);

write("hotel-content.json", { _mock: MOCK_NOTICE, hotels: HOTELS.map(hotelContent) });

const hotels = HOTELS.map(searchHotel).filter(Boolean);
write("search-results.json", {
  _mock: MOCK_NOTICE,
  _search: SEARCH,
  status: "ok",
  error: null,
  data: { hotels, total_hotels: hotels.length },
});

write("evidence-sources.json", {
  _mock: MOCK_NOTICE,
  sources: Object.fromEntries(HOTELS.map((h) => [h.hid, evidenceFor(h.hid)])),
});

write("vetting-scenarios.json", {
  _mock: MOCK_NOTICE,
  _note:
    "Why each mock hotel exists. For humans and tests only — never shown to the AI or the public.",
  scenarios: Object.fromEntries(HOTELS.map((h) => [h.hid, h.vetting_note])),
});

console.log(`wrote ${HOTELS.length} hotels, ${hotels.length} search results`);
