import type { MetadataRoute } from "next";
import { approvedInCity } from "@/lib/search/search";
import { fetchPublicWhitelist } from "@/lib/search/whitelist";
import { CITIES } from "@/lib/cities";
import { siteUrl, sitemapEntries } from "@/lib/seo";
import { createClient } from "@/lib/supabase/server";
import { mockHotelContent } from "@/mock/ratehawk";

// sitemap.xml (Epic 2.3). Built per request from the public whitelist, so a
// newly approved hotel appears and a suspended one disappears straight away.
// Only hotels a visitor may see: approved (status-filtered query) and open.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const whitelist = await fetchPublicWhitelist(await createClient());
  const hids = whitelist.ok
    ? CITIES.flatMap((c) =>
        approvedInCity({ approved: whitelist.approved, hotels: mockHotelContent, city: c.name }),
      ).map((h) => h.hid)
    : []; // a database hiccup still serves the static pages
  return sitemapEntries(siteUrl(), hids);
}
