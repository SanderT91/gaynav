import type { Metadata } from "next";
import { Lexend_Deca } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/seo";
import "./theme.css";
import "./globals.css";

// The brand font (CLAUDE.md, Design direction). next/font serves it from our
// own domain, so visitors' browsers never contact Google.
const lexendDeca = Lexend_Deca({
  subsets: ["latin"],
  variable: "--font-lexend-deca",
  display: "swap",
});

export const metadata: Metadata = {
  // Makes relative canonical and Open Graph URLs absolute (Epic 2.3).
  metadataBase: siteUrl(),
  title: "GAYNAV",
  description: "Curated LGBTQ+ travel — every hotel reviewed by our team before it is listed.",
  openGraph: { siteName: "GAYNAV", type: "website", locale: "en_GB" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={lexendDeca.variable}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
