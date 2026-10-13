import type { Metadata } from "next";
import Link from "next/link";
import styles from "./trust.module.css";

const title = "How we vet hotels — GAYNAV";
const description =
  "Every hotel on GAYNAV is reviewed by a person on our team before it is listed. Here is what we check, and what keeps a hotel off the site.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/how-we-vet" },
  openGraph: { title, description, url: "/how-we-vet" },
};

// The trust page (Epic 2.4): the vetting process in plain language. This is
// the brand promise, so it describes what the product actually does — the
// steps below match the staff workbench (evidence pack → human decision →
// public summary; suspend at any time).
export default function HowWeVetPage() {
  return (
    <main className="page page--narrow">
      <h1>How we vet hotels</h1>
      <p className={styles.lead}>
        No hotel appears on GAYNAV automatically. Before a hotel is listed, a person on our team
        reviews it and decides whether LGBTQ+ travellers can expect to be safe and welcome there.
        That&apos;s why our list is small — on purpose.
      </p>

      <section aria-labelledby="why" className={styles.section}>
        <h2 id="why">Why we review every hotel</h2>
        <p>
          Big booking sites list almost every hotel and leave you to read between the lines. A
          five-star rating doesn&apos;t tell you whether you and your partner will be given a double
          room without questions, or whether staff will treat you with respect. We look for exactly
          that, so you don&apos;t have to.
        </p>
      </section>

      <section aria-labelledby="steps" className={styles.section}>
        <h2 id="steps">What happens before a hotel is listed</h2>
        <ol className={styles.steps}>
          <li>
            <h3>We gather the evidence</h3>
            <p>
              Guest reviews, the hotel&apos;s own policies and house rules, and what has been
              written about it. Software may help us collect and summarise this material, with a
              reference to every source it uses.
            </p>
          </li>
          <li>
            <h3>A person reads it and decides</h3>
            <p>
              Someone on our team reviews the evidence and makes the call. Software never approves a
              hotel. Every decision is recorded with the reason behind it.
            </p>
          </li>
          <li>
            <h3>We tell you why</h3>
            <p>
              Every listed hotel has a short &ldquo;Why we list it&rdquo; summary, written by the
              person who approved it.
            </p>
          </li>
          <li>
            <h3>We keep watching</h3>
            <p>
              If something changes — new reviews, a new policy, a news story — we can take a hotel
              off the site straight away while we look into it.
            </p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="disqualify" className={styles.section}>
        <h2 id="disqualify">What keeps a hotel off GAYNAV</h2>
        <ul className={styles.list}>
          <li>
            Rules that treat LGBTQ+ guests differently — for example, only allowing married couples
            to share a room, or asking guests to prove their relationship.
          </li>
          <li>Requirements to state or prove your gender that go beyond what the law requires.</li>
          <li>
            Credible reports from guests of being refused, harassed or treated differently because
            of who they are or who they travel with.
          </li>
          <li>
            Coverage of discrimination by the hotel, its staff or its owners that hasn&apos;t been
            addressed.
          </li>
        </ul>
        <p className={styles.note}>
          Some countries require hotels to register guests&apos; identity documents. That alone
          doesn&apos;t keep a hotel off GAYNAV — but where it applies, you&apos;ll find it in the
          house rules on the hotel&apos;s page, so nothing comes as a surprise.
        </p>
      </section>

      <section aria-labelledby="limits" className={styles.section}>
        <h2 id="limits">What we can and can&apos;t promise</h2>
        <p>
          We check carefully, but we can&apos;t be in every hotel every night. Our review tells you
          what the evidence shows at the time we look. If your stay doesn&apos;t live up to it, we
          want to know — that&apos;s how the list stays honest.
        </p>
      </section>

      <p className={styles.cta}>
        <Link href="/#cities" className="button button--pill">
          See our hotels
        </Link>
      </p>
    </main>
  );
}
