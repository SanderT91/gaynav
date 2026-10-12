// Search inputs (Epic 2.1). RateHawk can't return real availability or prices
// without dates and a guest count, so a search only runs when all of them are
// present and valid. Pure function: the page passes in the raw URL values and
// today's date.

export const MAX_NIGHTS = 30;
export const MAX_ADULTS = 6;

export type SearchParams = {
  city?: string;
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  nights: number;
  adults: number;
};

export type ParsedSearch =
  | { status: "empty" } // nothing entered yet: show the form, no results
  | {
      status: "invalid";
      errors: Partial<Record<"city" | "checkin" | "checkout" | "adults", string>>;
      values: Record<string, string>;
    }
  | { status: "ok"; params: SearchParams };

type Raw = Record<string, string | string[] | undefined>;

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function asDate(value: string): Date | null {
  if (!isoDate.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates like 2026-02-30 (which JS would roll over).
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

const one = (raw: Raw, key: string) =>
  typeof raw[key] === "string" ? (raw[key] as string).trim() : "";

export function parseSearch(raw: Raw, today: string, cities: readonly string[]): ParsedSearch {
  const values = {
    city: one(raw, "city"),
    checkin: one(raw, "checkin"),
    checkout: one(raw, "checkout"),
    adults: one(raw, "adults"),
  };
  if (!values.checkin && !values.checkout && !values.adults) return { status: "empty" };

  const errors: Partial<Record<keyof typeof values, string>> = {};
  const todayDate = asDate(today)!;
  const checkin = asDate(values.checkin);
  const checkout = asDate(values.checkout);

  if (values.city && !cities.includes(values.city)) errors.city = "Choose one of our cities.";

  if (!values.checkin) errors.checkin = "Choose a check-in date.";
  else if (!checkin) errors.checkin = "Enter a valid check-in date.";
  else if (checkin < todayDate) errors.checkin = "Check-in can't be in the past.";

  if (!values.checkout) errors.checkout = "Choose a check-out date.";
  else if (!checkout) errors.checkout = "Enter a valid check-out date.";
  else if (checkin && checkout <= checkin) errors.checkout = "Check-out must be after check-in.";

  let nights = 0;
  if (checkin && checkout && !errors.checkin && !errors.checkout) {
    nights = Math.round((checkout.getTime() - checkin.getTime()) / 86_400_000);
    if (nights > MAX_NIGHTS) errors.checkout = `Stays can be at most ${MAX_NIGHTS} nights.`;
  }

  const adults = /^\d+$/.test(values.adults) ? Number(values.adults) : NaN;
  if (!values.adults) errors.adults = "Choose the number of guests.";
  else if (!(adults >= 1 && adults <= MAX_ADULTS))
    errors.adults = `Choose between 1 and ${MAX_ADULTS} guests.`;

  if (Object.keys(errors).length > 0) return { status: "invalid", errors, values };
  return {
    status: "ok",
    params: {
      city: values.city || undefined,
      checkin: values.checkin,
      checkout: values.checkout,
      nights,
      adults,
    },
  };
}
