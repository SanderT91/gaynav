import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { HotelCard } from "@/components/hotel-card";
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
    <main className="page">
      <h1>LGBTQ+ friendly hotels in {city.name}</h1>
      <p className="page-lead">
        Every hotel below has been reviewed by a person on our team and approved as safe and
        welcoming for LGBTQ+ travellers. Choose your dates to see rooms and prices.
      </p>
      <Suspense fallback={<p className="panel">Loading hotels…</p>}>
        <CityBody city={city} />
      </Suspense>
      <nav aria-label="Other cities" className="panel">
        <h2>Other cities</h2>
        <p>
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
      <div className="panel">
        <StayForm
          action="/search"
          values={{ checkin: "", checkout: "", adults: "2" }}
          errors={{}}
          today={today}
          hidden={{ city: city.name }}
          submitLabel={`Search ${city.name}`}
        />
      </div>
      {!result.ok ? (
        <p role="alert" className="panel">
          We couldn&apos;t load hotels just now. Please try again in a moment.
        </p>
      ) : result.hotels.length === 0 ? (
        <div role="status" className="panel panel--brand">
          <h2>{city.name} is still being curated</h2>
          <p>
            We only list hotels our team has checked are genuinely welcoming to LGBTQ+ travellers,
            so we&apos;re starting small on purpose. Please check back soon.
          </p>
        </div>
      ) : (
        <ul className="result-list">
          {result.hotels.map((hotel) => (
            <HotelCard
              key={hotel.hid}
              hotel={hotel}
              href={`/hotels/${hotel.hid}`}
              showPrice={false}
            />
          ))}
        </ul>
      )}
    </>
  );
}
