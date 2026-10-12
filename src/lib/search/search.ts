import type { HotelContent, PaymentType, Rate, SearchResponse } from "@/lib/ratehawk/types";

// Public hotel search (Epic 2.1): ONLY whitelisted hotels, joined with live
// rates. Today the rates come from the mock RateHawk search response; Phase 3
// swaps in real RateHawk calls — this function doesn't change.
//
// Whitelist-first (CLAUDE.md): the list of hotels to show starts from
// `approved`, never from the catalogue or the rates. A hotel that isn't in
// `approved` can't appear, however it got into the other inputs.

export type ApprovedHotel = { hid: number; vetting_summary: string };

export type PriceSummary = {
  /** Total for the whole stay, as quoted (taxes "included by supplier" are in it). */
  total: number;
  currency: string;
  nights: number;
  /** Taxes NOT in the total, paid separately (shown as their own line, Epic 3.4). */
  excludedTaxes: number;
  breakfastIncluded: boolean;
  /** null = non-refundable. */
  freeCancellationBefore: string | null;
};

export type SearchResult = {
  hid: number;
  name: string;
  city: string;
  countryCode: string;
  kind: string;
  stars: number;
  photo: string | null;
  vettingSummary: string;
  /** null = no availability for these dates. */
  price: PriceSummary | null;
};

function priceOf(rate: Rate): PriceSummary | null {
  const pt: PaymentType | undefined = rate.payment_options.payment_types[0];
  if (!pt) return null;
  const excluded = pt.tax_data.taxes
    .filter((t) => !t.included_by_supplier)
    .reduce((sum, t) => sum + Number(t.amount), 0);
  return {
    total: Number(pt.show_amount),
    currency: pt.show_currency_code,
    nights: rate.daily_prices.length,
    excludedTaxes: Math.round(excluded * 100) / 100,
    breakfastIncluded: rate.meal_data.has_breakfast,
    freeCancellationBefore: pt.cancellation_penalties.free_cancellation_before,
  };
}

/** The cheapest bookable rate, comparing what the guest actually pays. */
export function cheapestPrice(rates: Rate[]): PriceSummary | null {
  let best: PriceSummary | null = null;
  for (const rate of rates) {
    const price = priceOf(rate);
    if (!price) continue;
    if (!best || price.total + price.excludedTaxes < best.total + best.excludedTaxes) best = price;
  }
  return best;
}

export function searchApproved(input: {
  approved: ApprovedHotel[];
  hotels: HotelContent[];
  search: SearchResponse;
  city?: string;
}): SearchResult[] {
  const hotelByHid = new Map(input.hotels.map((h) => [h.hid, h]));
  const ratesByHid = new Map(input.search.data.hotels.map((h) => [h.hid, h.rates]));

  const results: SearchResult[] = [];
  for (const { hid, vetting_summary } of input.approved) {
    const hotel = hotelByHid.get(hid);
    // No content, or closed since approval: never show it.
    if (!hotel || hotel.is_closed) continue;
    if (input.city && hotel.region.name !== input.city) continue;

    results.push({
      hid,
      name: hotel.name,
      city: hotel.region.name,
      countryCode: hotel.region.country_code,
      kind: hotel.kind.replaceAll("_", " "),
      stars: hotel.star_rating,
      photo: hotel.images_ext[0]?.url ?? null,
      vettingSummary: vetting_summary,
      price: cheapestPrice(ratesByHid.get(hid) ?? []),
    });
  }

  // Available hotels first, cheapest first; then the ones without availability.
  return results.sort((a, b) => {
    if (a.price && !b.price) return -1;
    if (!a.price && b.price) return 1;
    if (a.price && b.price) return a.price.total - b.price.total;
    return a.name.localeCompare(b.name);
  });
}
