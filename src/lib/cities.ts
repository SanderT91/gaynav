// The launch cities (owner decision 2026-10-12), in the order the site shows
// them. One place for names and URL slugs: search, city pages and the
// homepage all read from here.

export type City = {
  /** URL segment: /cities/<slug>. */
  slug: string;
  /** Exactly as in RateHawk's region name, which search filters on. */
  name: string;
  country: string;
};

export const CITIES: readonly City[] = [
  { slug: "london", name: "London", country: "United Kingdom" },
  { slug: "paris", name: "Paris", country: "France" },
  { slug: "rome", name: "Rome", country: "Italy" },
  { slug: "tokyo", name: "Tokyo", country: "Japan" },
  { slug: "bangkok", name: "Bangkok", country: "Thailand" },
  { slug: "ho-chi-minh-city", name: "Ho Chi Minh City", country: "Vietnam" },
];

export const LAUNCH_CITIES: readonly string[] = CITIES.map((c) => c.name);

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
