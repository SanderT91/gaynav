import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { StayForm } from "@/components/stay-form";
import { CITIES, cityBySlug, type City } from "@/lib/cities";
import { todayIso } from "@/lib/format";
import { loadCityHotels } from "@/lib/search/load";

// City page per launch city (Epic 2.5): only the approved hotels in that city.
// The page shell and its metadata are built ahead of time for the six
// cities; the hotel list is read per request, so a newly approved (or
// suspended) hotel shows up (or disappears) straight away.

export function generateStaticParams() {
  return CITIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cities/[slug]">): Promise<Metadata> {
  const city = cityBySlug((await params).slug);
  if (!city) notFound();
  const title = `LGBTQ+ friendly hotels in ${city.name} — GAYNAV`;
  const description = `Hotels in ${city.name}, ${city.country}, each reviewed by the GAYNAV team as safe and welcoming for LGBTQ+ travellers.`;
  return {
    title,
    description,
    alternates: { canonical: `/cities/${city.slug}` },
    openGraph: { title, description, type: "website", url: `/cities/${city.slug}` },
  };
}

export default async function CityPage({ params }: PageProps<"/cities/[slug]">) {
  const city = cityBySlug((await params).slug);
  if (!city) notFound();

  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "56rem", margin: "0 auto" }}>
      <p>
        <Link href="/">GAYNAV</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>LGBTQ+ friendly hotels in {city.name}</h1>
      <p style={{ marginTop: "0.5rem" }}>
        Every hotel below has been reviewed by a person on our team and approved as safe and
        welcoming for LGBTQ+ travellers. Choose your dates to see rooms and prices.
      </p>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading hotels…</p>}>
        <CityBody city={city} />
      </Suspense>
      <nav aria-label="Other cities" style={{ marginTop: "2.5rem" }}>
        <h2 style={{ fontSize: "1rem" }}>Other cities</h2>
        <p style={{ marginTop: "0.25rem" }}>
          {CITIES.filter((c) => c.slug !== city.slug).map((c, i) => (
            <span key={c.slug}>
              {i > 0 && " · "}
              <Link href={`/cities/${c.slug}`}>{c.name}</Link>
            </span>
          ))}
        </p>
      </nav>
    </main>
  );
}

async function CityBody({ city }: { city: City }) {
  await connection(); // "today" and the whitelist are per request
  const today = todayIso();
  const result = await loadCityHotels(city.name);

  return (
    <>
      <StayForm
        action="/search"
        values={{ checkin: "", checkout: "", adults: "2" }}
        errors={{}}
        today={today}
        hidden={{ city: city.name }}
        submitLabel={`Search ${city.name}`}
      />
      {!result.ok ? (
        <p role="alert" style={{ marginTop: "1.5rem" }}>
          We couldn&apos;t load hotels just now. Please try again in a moment.
        </p>
      ) : result.hotels.length === 0 ? (
        <div
          role="status"
          style={{
            marginTop: "1.5rem",
            padding: "1.5rem",
            border: "1px solid #8884",
            borderRadius: "8px",
          }}
        >
          <h2 style={{ fontSize: "1.15rem" }}>{city.name} is still being curated</h2>
          <p style={{ marginTop: "0.5rem" }}>
            We only list hotels our team has checked are genuinely welcoming to LGBTQ+ travellers,
            so we&apos;re starting small on purpose. Please check back soon.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1.5rem",
            display: "grid",
            gap: "1.25rem",
          }}
        >
          {result.hotels.map((hotel) => (
            <li
              key={hotel.hid}
              style={{
                display: "flex",
                gap: "1rem",
                borderTop: "1px solid #8884",
                paddingTop: "1rem",
                flexWrap: "wrap",
              }}
            >
              {hotel.photo && (
                // Mock placeholder images; image optimisation comes with the design pass.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hotel.photo.replace("{size}", "320x200")}
                  alt=""
                  width={192}
                  height={120}
                />
              )}
              <div style={{ flex: "1 1 18rem" }}>
                <h2 style={{ fontSize: "1.15rem" }}>
                  <Link href={`/hotels/${hotel.hid}`}>{hotel.name}</Link>
                </h2>
                <p style={{ fontSize: "0.9rem" }}>
                  {hotel.kind}
                  {hotel.stars > 0 && ` · ${hotel.stars}★`}
                </p>
                <p style={{ marginTop: "0.5rem" }}>
                  <strong>Why we list it:</strong> {hotel.vettingSummary}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
