import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LAUNCH_CITIES, loadSearch } from "@/lib/search/load";
import type { SearchResult } from "@/lib/search/search";

export const metadata: Metadata = {
  title: "Find a hotel — GAYNAV",
  description: "Hotels personally vetted by GAYNAV as safe and welcoming for LGBTQ+ travellers.",
};

// Public search (Epic 2.1). No login needed. Shows only hotels GAYNAV staff
// have approved. Dates and guests are fixed to the mock search for now; making
// them required inputs is the next feature.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "56rem", margin: "0 auto" }}>
      <p>
        <Link href="/">GAYNAV</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>Find a hotel</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Searching…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);

const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

async function Results({ searchParams }: { searchParams: PageProps<"/search">["searchParams"] }) {
  const params = await searchParams;
  const city =
    typeof params.city === "string" && LAUNCH_CITIES.includes(params.city)
      ? params.city
      : undefined;

  const result = await loadSearch(city);
  if (!result.ok) {
    return (
      <p role="alert" style={{ marginTop: "1rem" }}>
        {result.error}
      </p>
    );
  }
  const { searched } = result;
  const guests = searched.guests.reduce((n, g) => n + g.adults + g.children.length, 0);

  return (
    <>
      <p style={{ marginTop: "0.5rem" }}>
        {dateLabel(searched.checkin)} – {dateLabel(searched.checkout)} · {guests} guests
        <span style={{ fontSize: "0.85rem" }}>
          {" "}
          (sample dates and prices — booking isn&apos;t live yet)
        </span>
      </p>

      <nav
        aria-label="Choose a city"
        style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <Link href="/search" aria-current={city ? undefined : "page"}>
          All cities
        </Link>
        {LAUNCH_CITIES.map((c) => (
          <Link
            key={c}
            href={`/search?city=${encodeURIComponent(c)}`}
            aria-current={city === c ? "page" : undefined}
          >
            {c}
          </Link>
        ))}
      </nav>

      <ul
        style={{
          listStyle: "none",
          padding: 0,
          marginTop: "1.5rem",
          display: "grid",
          gap: "1.25rem",
        }}
      >
        {result.results.map((hotel) => (
          <HotelCard key={hotel.hid} hotel={hotel} />
        ))}
      </ul>
    </>
  );
}

function HotelCard({ hotel }: { hotel: SearchResult }) {
  return (
    <li
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
        <img src={hotel.photo.replace("{size}", "320x200")} alt="" width={192} height={120} />
      )}
      <div style={{ flex: "1 1 18rem" }}>
        <h2 style={{ fontSize: "1.15rem" }}>{hotel.name}</h2>
        <p style={{ fontSize: "0.9rem" }}>
          {hotel.city}, {hotel.countryCode} · {hotel.kind}
          {hotel.stars > 0 && ` · ${hotel.stars}★`}
        </p>
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Why we list it:</strong> {hotel.vettingSummary}
        </p>
        {hotel.price ? (
          <p style={{ marginTop: "0.5rem" }}>
            <strong>{money(hotel.price.total, hotel.price.currency)}</strong> for{" "}
            {hotel.price.nights} nights
            {hotel.price.excludedTaxes > 0 &&
              ` + ${money(hotel.price.excludedTaxes, hotel.price.currency)} local tax paid at the hotel`}
            {hotel.price.breakfastIncluded && " · breakfast included"}
            <br />
            <span style={{ fontSize: "0.9rem" }}>
              {hotel.price.freeCancellationBefore
                ? `Free cancellation until ${dateLabel(hotel.price.freeCancellationBefore.slice(0, 10))}`
                : "Non-refundable"}
            </span>
          </p>
        ) : (
          <p style={{ marginTop: "0.5rem" }}>No rooms available for these dates.</p>
        )}
      </div>
    </li>
  );
}
