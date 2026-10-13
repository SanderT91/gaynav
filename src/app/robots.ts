import type { MetadataRoute } from "next";
import { PRIVATE_PATHS, siteUrl } from "@/lib/seo";

// robots.txt (Epic 2.3): crawl the public site, never the private areas.
// This only asks well-behaved crawlers to stay out; the real protection of
// /staff and /account is sign-in, 2FA and RLS.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: [...PRIVATE_PATHS] },
    sitemap: new URL("/sitemap.xml", siteUrl()).href,
  };
}
