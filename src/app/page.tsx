import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StayForm } from "@/components/stay-form";
import { CITIES, LAUNCH_CITIES } from "@/lib/cities";
import { todayIso } from "@/lib/format";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "GAYNAV — LGBTQ+ friendly hotels, personally vetted",
  description:
    "Hotels in London, Paris, Rome, Tokyo, Bangkok and Ho Chi Minh City, each reviewed by the GAYNAV team as safe and welcoming for LGBTQ+ travellers.",
};

// Homepage (Epic 2.5, styled in 2.6): replaces gaynav.com's entry points.
// A hero with the search box, a card per launch city ("City curations"),
// and the vetting promise in three lines.
export default function Home() {
  return (
    <main>
      <section aria-labelledby="hero" className={styles.hero}>
        <div className={styles.heroInner}>
          <h1 id="hero" className={styles.heroTitle}>
            Travel where you&apos;re welcome
          </h1>
          <p className={styles.heroLead}>
            Every hotel on GAYNAV is reviewed by a person on our team and approved as safe and
            welcoming for LGBTQ+ travellers — before it&apos;s ever listed.
          </p>
          <div className={styles.searchCard}>
            <Suspense fallback={null}>
              <HeroSearch />
            </Suspense>
          </div>
        </div>
      </section>

      <section id="cities" aria-labelledby="cities-title" className={styles.section}>
        <h2 id="cities-title" className={styles.sectionTitle}>
          City curations
        </h2>
        <p className={styles.sectionLead}>
          We&apos;re starting with six cities and a small, hand-picked list of hotels in each.
        </p>
        <ul className={styles.cityGrid}>
          {CITIES.map((city) => (
            <li key={city.slug}>
              <Link href={`/cities/${city.slug}`} className={styles.cityCard}>
                <span className={styles.cityImage} aria-hidden="true">
                  {city.name}
                </span>
                <span className={styles.cityMeta}>
                  <span>
                    <strong>{city.name}</strong>, {city.country}
                  </span>
                  <span>See hotels →</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="promise-title" className={styles.section}>
        <h2 id="promise-title" className={styles.sectionTitle}>
          Why GAYNAV
        </h2>
        <ul className={styles.promise}>
          <li>
            <h3>Reviewed by a person</h3>
            <p>No hotel is listed automatically. Someone on our team checks every one.</p>
          </li>
          <li>
            <h3>Small on purpose</h3>
            <p>We&apos;d rather show you a few hotels we trust than many we don&apos;t know.</p>
          </li>
          <li>
            <h3>Taken down if things change</h3>
            <p>If a hotel stops meeting our standard, we take it off the site.</p>
          </li>
        </ul>
        <p className={styles.sectionLead}>
          <Link href="/how-we-vet">How we vet hotels →</Link>
        </p>
      </section>
    </main>
  );
}

async function HeroSearch() {
  await connection(); // "today" is per request, never prerendered
  return (
    <StayForm
      action="/search"
      values={{ city: "", checkin: "", checkout: "", adults: "2" }}
      errors={{}}
      today={todayIso()}
      cities={LAUNCH_CITIES}
    />
  );
}
