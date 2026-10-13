// The launch cities (owner decision 2026-10-12), in the order the site shows
// them. One place for names and URL slugs: search, city pages and the
// homepage all read from here.

export type City = {
  /** URL segment: /cities/<slug>. */
  slug: string;
  /** Exactly as in RateHawk's region name, which search filters on. */
  name: string;
  country: string;
  /**
   * City card photo, taken from the old gaynav.com on 2026-10-13 (its
   * per-country "destinations" images). RIGHTS NOT YET CONFIRMED: check with
   * the owner that GAYNAV may use these before launch.
   */
  photo: string;
};

export const CITIES: readonly City[] = [
  { slug: "london", name: "London", country: "United Kingdom", photo: "/brand/london.avif" },
  { slug: "paris", name: "Paris", country: "France", photo: "/brand/paris.avif" },
  { slug: "rome", name: "Rome", country: "Italy", photo: "/brand/rome.avif" },
  { slug: "tokyo", name: "Tokyo", country: "Japan", photo: "/brand/tokyo.avif" },
  { slug: "bangkok", name: "Bangkok", country: "Thailand", photo: "/brand/bangkok.avif" },
  {
    slug: "ho-chi-minh-city",
    name: "Ho Chi Minh City",
    country: "Vietnam",
    photo: "/brand/ho-chi-minh-city.avif",
  },
];

export const LAUNCH_CITIES: readonly string[] = CITIES.map((c) => c.name);

export function cityBySlug(slug: string): City | undefined {
  return CITIES.find((c) => c.slug === slug);
}
