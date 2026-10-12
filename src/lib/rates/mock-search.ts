import type { CancellationPenalties, Rate, SearchResponse } from "@/lib/ratehawk/types";
import { mockSearchResponse } from "@/mock/ratehawk";
import type { SearchParams } from "@/lib/search/params";

// MOCK rates for any search (Phases 1–2). The fixture was generated for one
// fixed stay (13–15 Nov 2026, 2 adults); this adapts its rates to the dates
// and guests the visitor asked for, so the search page behaves realistically.
// Phase 3 replaces this function with a real RateHawk search returning the
// same SearchResponse shape.

const DAY = 86_400_000;
const money = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const iso = (d: Date) => d.toISOString().slice(0, 19);
const atMidnight = (date: string) => new Date(`${date}T00:00:00Z`);

/** One room: a single guest pays a little less, each extra guest adds 35%. */
function guestFactor(adults: number): number {
  return adults === 1 ? 0.9 : 1 + 0.35 * (adults - 2);
}

function cancellation(
  original: CancellationPenalties,
  originalCheckin: string,
  params: SearchParams,
  total: number,
  today: string,
): CancellationPenalties {
  const nonRefundable: CancellationPenalties = {
    policies: [
      { start_at: null, end_at: null, amount_charge: money(total), amount_show: money(total) },
    ],
    free_cancellation_before: null,
  };
  if (!original.free_cancellation_before) return nonRefundable;

  // Keep the same number of days of free cancellation before check-in.
  const daysBefore = Math.round(
    (atMidnight(originalCheckin).getTime() -
      new Date(`${original.free_cancellation_before}Z`).getTime()) /
      DAY,
  );
  const checkin = atMidnight(params.checkin);
  const free = new Date(checkin.getTime() - daysBefore * DAY);
  const half = new Date(checkin.getTime() - DAY);
  // Free cancellation that would already have ended is no free cancellation.
  if (free <= atMidnight(today) || half <= free) return nonRefundable;

  return {
    policies: [
      { start_at: null, end_at: iso(free), amount_charge: "0.00", amount_show: "0.00" },
      {
        start_at: iso(free),
        end_at: iso(half),
        amount_charge: money(total / 2),
        amount_show: money(total / 2),
      },
      { start_at: iso(half), end_at: null, amount_charge: money(total), amount_show: money(total) },
    ],
    free_cancellation_before: iso(free),
  };
}

function adaptRate(rate: Rate, params: SearchParams, today: string): Rate {
  const fixture = mockSearchResponse._search;
  const fixtureGuests = fixture.guests[0].adults;
  const pt = rate.payment_options.payment_types[0];

  const nightly = Number(rate.daily_prices[0]) * guestFactor(params.adults);
  const daily = Array.from({ length: params.nights }, () => money(nightly));
  const total = daily.reduce((sum, d) => sum + Number(d), 0);
  const scale = total / Number(pt.amount);

  return {
    ...rate,
    daily_prices: daily,
    payment_options: {
      payment_types: [
        {
          ...pt,
          amount: money(total),
          show_amount: money(total),
          vat_data: { ...pt.vat_data, amount: money(Number(pt.vat_data.amount) * scale) },
          tax_data: {
            taxes: pt.tax_data.taxes.map((t) => ({
              ...t,
              // City tax is per guest per night.
              amount: money(
                (Number(t.amount) / (fixtureGuests * fixture.nights)) *
                  params.adults *
                  params.nights,
              ),
            })),
          },
          cancellation_penalties: cancellation(
            pt.cancellation_penalties,
            fixture.checkin,
            params,
            total,
            today,
          ),
        },
      ],
    },
  };
}

export function mockSearchRates(params: SearchParams, today: string): SearchResponse {
  const hotels = mockSearchResponse.data.hotels.map((h) => ({
    ...h,
    rates: h.rates.map((r) => adaptRate(r, params, today)),
  }));
  return { status: "ok", error: null, data: { hotels, total_hotels: hotels.length } };
}
