import type { Metadata } from "next";
import { InfoPage, PlaceholderNotice } from "@/components/info-page";

export const metadata: Metadata = {
  title: "Privacy — GAYNAV",
  description: "How GAYNAV handles your personal data. Placeholder text, not final.",
  robots: { index: false }, // until the final legal text is in place
};

// PLACEHOLDER (Epic 2.5): a plain description of what this build actually
// does with data. The final privacy notice comes from legal review (Epic
// 5.3/5.4) and replaces this page.
export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy">
      <PlaceholderNotice />
      <p>
        You can search and read about hotels on GAYNAV without an account and without giving us any
        personal details.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>If you create an account</h2>
      <p>
        We store your email address and a securely hashed password with our database provider, so
        you can sign in. We use them to run your account and, once booking is live, to send you
        messages about your bookings.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>Payments</h2>
      <p>
        Booking is not live yet. When it is, card payments will be handled by a payment provider;
        GAYNAV will not store your card details.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>Your rights</h2>
      <p>
        You will be able to ask for a copy of your data or for your account to be deleted. How to do
        that will be described here in the final version of this notice.
      </p>
    </InfoPage>
  );
}
