import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StayForm } from "@/components/stay-form";
import { CITIES, LAUNCH_CITIES } from "@/lib/cities";
import { todayIso } from "@/lib/format";

export const metadata: Metadata = {
  title: "GAYNAV — LGBTQ+ friendly hotels, personally vetted",
  description:
    "Hotels in London, Paris, Rome, Tokyo, Bangkok and Ho Chi Minh City, each reviewed by the GAYNAV team as safe and welcoming for LGBTQ+ travellers.",
};

// Homepage (Epic 2.5): replaces gaynav.com's entry points. A hero, the search
// box, and a card per launch city ("City curations"). Styling comes in the
// light design round (Epic 2.6).
export default function Home() {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "56rem", margin: "0 auto" }}>
      <p style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>GAYNAV</strong>
        <Link href="/login">Sign in</Link>
      </p>

      <section aria-labelledby="hero" style={{ marginTop: "2.5rem" }}>
        <h1 id="hero">Travel where you&apos;re welcome</h1>
        <p style={{ marginTop: "0.75rem", fontSize: "1.1rem" }}>
          Every hotel on GAYNAV is reviewed by a person on our team and approved as safe and
          welcoming for LGBTQ+ travellers — before it&apos;s ever listed.
        </p>
        <Suspense fallback={null}>
          <HeroSearch />
        </Suspense>
      </section>

      <section aria-labelledby="cities" style={{ marginTop: "3rem" }}>
        <h2 id="cities">City curations</h2>
        <p style={{ marginTop: "0.5rem" }}>
          We&apos;re starting with six cities and a small, hand-picked list of hotels in each.
        </p>
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))",
            gap: "1rem",
          }}
        >
          {CITIES.map((city) => (
            <li
              key={city.slug}
              style={{ border: "1px solid #8884", borderRadius: "8px", padding: "1.25rem" }}
            >
              <h3 style={{ fontSize: "1.15rem" }}>
                <Link href={`/cities/${city.slug}`}>{city.name}</Link>
              </h3>
              <p style={{ fontSize: "0.9rem" }}>{city.country}</p>
            </li>
          ))}
        </ul>
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
