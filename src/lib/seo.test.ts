import { afterEach, describe, expect, it, vi } from "vitest";
import { buildHotelDetail } from "@/lib/hotels/detail";
import { mockHotelContent } from "@/mock/ratehawk";
import {
  hotelMetadata,
  PRIVATE_PATHS,
  searchMetadata,
  siteUrl,
  sitemapEntries,
  snippet,
} from "./seo";

const CASA = 9990000006;
const casa = buildHotelDetail({
  approval: { hid: CASA, vetting_summary: "Owned and run by an LGBTQ+ couple; reviewed in 2026." },
  hotel: mockHotelContent.find((h) => h.hid === CASA),
  rates: null,
})!;

describe("hotelMetadata", () => {
  it("describes an approved hotel: name, city, the public summary, canonical URL, image", () => {
    const m = hotelMetadata(casa);
    expect(m.title).toBe(`${casa.name}, Rome — GAYNAV`);
    expect(m.description).toContain("Owned and run by an LGBTQ+ couple");
    expect(m.alternates?.canonical).toBe(`/hotels/${CASA}`);
    const og = m.openGraph as { url: string; images: { url: string }[] };
    expect(og.url).toBe(`/hotels/${CASA}`);
    expect(og.images[0].url).toContain("1200x630");
    expect(og.images[0].url).not.toContain("{size}");
  });

  it("never names a hidden hotel, and keeps it out of search engines", () => {
    const m = hotelMetadata(null);
    expect(JSON.stringify(m)).not.toContain("Casa");
    expect(m.robots).toEqual({ index: false, follow: false });
    expect(m.openGraph).toBeUndefined();
  });

  it("keeps the description to snippet length", () => {
    const long = buildHotelDetail({
      approval: { hid: CASA, vetting_summary: "word ".repeat(200) },
      hotel: mockHotelContent.find((h) => h.hid === CASA),
      rates: null,
    })!;
    expect((hotelMetadata(long).description ?? "").length).toBeLessThanOrEqual(160);
  });
});

describe("searchMetadata", () => {
  it("is about the chosen launch city, with the city page as canonical", () => {
    const m = searchMetadata("Ho Chi Minh City");
    expect(m.title).toBe("Hotels in Ho Chi Minh City — GAYNAV");
    expect(m.alternates?.canonical).toBe("/cities/ho-chi-minh-city");
  });

  it("falls back to the general search page for no or an unknown city", () => {
    for (const city of [undefined, "Atlantis", "<script>"]) {
      const m = searchMetadata(city);
      expect(m.title).toBe("Find a hotel — GAYNAV");
      expect(m.alternates?.canonical).toBe("/search");
      expect(JSON.stringify(m)).not.toContain("Atlantis");
    }
  });
});

describe("snippet", () => {
  it("leaves short text alone and cuts long text at a word", () => {
    expect(snippet("Short  text\n here")).toBe("Short text here");
    const cut = snippet("alpha beta gamma delta", 12);
    expect(cut).toBe("alpha beta…");
    expect(cut.length).toBeLessThanOrEqual(12);
  });
});

describe("siteUrl", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses Vercel's production domain when deployed", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "gaynav.example");
    expect(siteUrl().href).toBe("https://gaynav.example/");
  });

  it("falls back to localhost in development", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteUrl().href).toBe("http://localhost:3000/");
  });
});

describe("sitemapEntries", () => {
  const base = new URL("https://gaynav.example");

  it("lists the public pages, every city and the hotels it is given, as absolute URLs", () => {
    const urls = sitemapEntries(base, [9990000006]).map((e) => e.url);
    expect(urls).toContain("https://gaynav.example/");
    expect(urls).toContain("https://gaynav.example/how-we-vet");
    expect(urls).toContain("https://gaynav.example/cities/ho-chi-minh-city");
    expect(urls).toContain("https://gaynav.example/hotels/9990000006");
    expect(urls.filter((u) => u.includes("/cities/"))).toHaveLength(6);
  });

  it("never lists a private area", () => {
    const urls = sitemapEntries(base, []).map((e) => new URL(e.url).pathname);
    for (const path of PRIVATE_PATHS) {
      expect(urls.some((u) => u.startsWith(path))).toBe(false);
    }
  });
});
