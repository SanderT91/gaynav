import type { Metadata } from "next";
import { InfoPage, PlaceholderNotice } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Terms — GAYNAV",
  description: "The terms for using GAYNAV. Placeholder text, not final.",
  robots: { index: false }, // until the final legal text is in place
};

// PLACEHOLDER (Epic 2.5): the final terms of service and complaint
// escalation copy come from legal review (Epic 5.3) and replace this page.
export default function TermsPage() {
  return (
    <InfoPage title="Terms">
      <PlaceholderNotice />
      <p>
        GAYNAV is not taking bookings yet. Hotel information and prices on the site are shown for
        preview purposes; prices are samples and no reservation can be made.
      </p>
      <p>
        When booking opens, this page will set out the terms that apply to bookings made through
        GAYNAV, including payment, cancellation and how to raise a complaint.
      </p>
    </InfoPage>
  );
}
