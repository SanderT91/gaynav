import type { Metadata } from "next";
import { CITIES } from "@/lib/cities";
import type { HotelDetail } from "@/lib/hotels/detail";

// Search-engine and social-sharing metadata (Epic 2.3), as pure functions so
// the rules are testable: what a property or search page says about itself,
// and what a hidden hotel must NOT say.

/**
 * The site's public address, for absolute URLs in canonical links and Open
 * Graph tags. Vercel sets VERCEL_PROJECT_PRODUCTION_URL (also on preview
 * deployments, so previews point search engines at production, never at
 * themselves).
 */
export function siteUrl(): URL {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(host ? `https://${host}` : "http://localhost:3000");
}

/** Cut text to a search-snippet length at a word boundary. */
export function snippet(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ") > 0 ? cut.lastIndexOf(" ") : cut.length)}…`;
}

/**
 * A property page. `null` = a hotel the visitor may not see (unknown, not
 * approved, suspended, closed): generic, unindexed, and never the hotel's
 * name — the metadata must not reveal what the page hides.
 */
export function hotelMetadata(hotel: HotelDetail | null): Metadata {
  if (!hotel) {
    return { title: "Hotel not found — GAYNAV", robots: { index: false, follow: false } };
  }
  const title = `${hotel.name}, ${hotel.city} — GAYNAV`;
  const description = snippet(
    `LGBTQ+ friendly ${hotel.kind.toLowerCase()} in ${hotel.city}, reviewed by the GAYNAV team. Why we list it: ${hotel.vettingSummary}`,
  );
  const url = `/hotels/${hotel.hid}`;
  const photo = hotel.photos[0];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "GAYNAV",
      title,
      description,
      url,
      images: photo
        ? [
            {
              url: photo.url.replace("{size}", "1200x630"),
              width: 1200,
              height: 630,
              alt: `${hotel.name}: ${photo.category}`,
            },
          ]
        : undefined,
    },
    twitter: { card: photo ? "summary_large_image" : "summary", title, description },
  };
}

/**
 * The search page. With a launch city it is about that city, but the city
 * page is the version search engines should index (stable URL, no dates).
 */
export function searchMetadata(cityName: string | undefined): Metadata {
  const city = CITIES.find((c) => c.name === cityName);
  if (city) {
    const title = `Hotels in ${city.name} — GAYNAV`;
    const description = `Search hotels in ${city.name}, ${city.country}, each reviewed by the GAYNAV team as safe and welcoming for LGBTQ+ travellers.`;
    return {
      title,
      description,
      alternates: { canonical: `/cities/${city.slug}` },
      openGraph: {
        type: "website",
        siteName: "GAYNAV",
        title,
        description,
        url: `/cities/${city.slug}`,
      },
    };
  }
  const title = "Find a hotel — GAYNAV";
  const description =
    "Search hotels in London, Paris, Rome, Tokyo, Bangkok and Ho Chi Minh City, each reviewed by the GAYNAV team as safe and welcoming for LGBTQ+ travellers.";
  return {
    title,
    description,
    alternates: { canonical: "/search" },
    openGraph: { type: "website", siteName: "GAYNAV", title, description, url: "/search" },
  };
}

/** Paths of the public pages search engines should find. Never staff pages. */
export const PUBLIC_PAGES = ["/", "/how-we-vet", "/about", "/search"] as const;

/** Areas search engines must not crawl (robots.txt). */
export const PRIVATE_PATHS = ["/staff", "/account", "/login", "/auth"] as const;

/**
 * The sitemap: public pages, every city page, and the approved hotels it is
 * given — the caller passes only hotels a visitor may see.
 */
export function sitemapEntries(
  base: URL,
  approvedHids: number[],
): { url: string; changeFrequency: "daily" | "weekly"; priority: number }[] {
  const at = (path: string) => new URL(path, base).href;
  return [
    ...PUBLIC_PAGES.map((p) => ({
      url: at(p),
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : 0.5,
    })),
    ...CITIES.map((c) => ({
      url: at(`/cities/${c.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...approvedHids.map((hid) => ({
      url: at(`/hotels/${hid}`),
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  ];
}
