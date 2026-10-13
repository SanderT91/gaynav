import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/info-page";

export const metadata: Metadata = {
  title: "About GAYNAV",
  description:
    "GAYNAV is an LGBTQ+ travel platform. Every hotel is reviewed by a person on our team before it is listed.",
};

export default function AboutPage() {
  return (
    <InfoPage title="About GAYNAV">
      <p>
        GAYNAV is a travel platform for LGBTQ+ travellers and everyone travelling with them. We list
        hotels where you can be yourself — and we only list hotels we have checked.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>How we choose hotels</h2>
      <p>
        No hotel appears on GAYNAV automatically. A person on our team reviews every hotel before it
        is listed: guest reviews, the hotel&apos;s own policies and house rules, and what has been
        written about it. We may use software to gather and summarise that material, but a person
        always makes the decision. If something changes, we can take a hotel off the site at any
        time.
      </p>
      <p>
        That means our list is deliberately small, especially at the start. We&apos;d rather show
        you a few hotels we trust than many we don&apos;t know.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>Where we are</h2>
      <p>
        We&apos;re starting with London, Paris, Rome, Tokyo, Bangkok and Ho Chi Minh City.{" "}
        <Link href="/">See our city curations</Link>.
      </p>
      <h2 style={{ fontSize: "1.15rem" }}>Booking</h2>
      <p>
        Booking on the new GAYNAV is not live yet. Prices shown on the site are samples for now.
      </p>
    </InfoPage>
  );
}
