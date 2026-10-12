import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GAYNAV",
  description: "Curated LGBTQ+ travel — every hotel reviewed by our team before it is listed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
