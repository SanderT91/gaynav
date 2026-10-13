import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { formValues, StayForm } from "@/components/stay-form";
import { dateLabel, money, todayIso } from "@/lib/format";
import { parseSearch, type SearchParams } from "@/lib/search/params";
import { LAUNCH_CITIES } from "@/lib/cities";
import { loadSearch } from "@/lib/search/load";
import { emptyState, type EmptyState } from "@/lib/search/empty-state";
import type { SearchResult } from "@/lib/search/search";

export const metadata: Metadata = {
  title: "Find a hotel — GAYNAV",
  description: "Hotels personally vetted by GAYNAV as safe and welcoming for LGBTQ+ travellers.",
};

// Public search (Epic 2.1). No login needed. Only hotels GAYNAV staff have
// approved. Dates and guests are required: without them there are no real
// prices or availability, so no search runs.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "56rem", margin: "0 auto" }}>
      <h1>Find a hotel</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Searching…</p>}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SearchBody({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const raw = await searchParams;
  await connection(); // "today" is per request, never prerendered
  const today = todayIso();
  const parsed = parseSearch(raw, today, LAUNCH_CITIES);

  const values = formValues(parsed, typeof raw.city === "string" ? raw.city : "");
  const errors = parsed.status === "invalid" ? parsed.errors : {};

  return (
    <>
      <StayForm
        action="/search"
        values={values}
        errors={errors}
        today={today}
        cities={LAUNCH_CITIES}
      />
      {parsed.status === "empty" && (
        <p style={{ marginTop: "1.5rem" }}>
          Choose your dates and number of guests to see hotels and prices.
        </p>
      )}
      {parsed.status === "ok" && <Results params={parsed.params} today={today} />}
    </>
  );
}

async function Results({ params, today }: { params: SearchParams; today: string }) {
  const result = await loadSearch(params, today);
  if (!result.ok) {
    return (
      <p role="alert" style={{ marginTop: "1.5rem" }}>
        {result.error}
      </p>
    );
  }

  return (
    <section aria-label="Search results" style={{ marginTop: "1.5rem" }}>
      <p>
        {params.city ?? "All cities"} · {dateLabel(params.checkin)} – {dateLabel(params.checkout)} ·{" "}
        {params.nights} {params.nights === 1 ? "night" : "nights"} · {params.adults}{" "}
        {params.adults === 1 ? "guest" : "guests"}
      </p>
      {result.results.length === 0 ? (
        <EmptyResults
          state={emptyState({
            city: params.city,
            approvedAnywhere: result.approvedAnywhere,
            query: { checkin: params.checkin, checkout: params.checkout, adults: params.adults },
          })}
        />
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            marginTop: "1rem",
            display: "grid",
            gap: "1.25rem",
          }}
        >
          {result.results.map((hotel) => (
            <HotelCard key={hotel.hid} hotel={hotel} params={params} />
          ))}
        </ul>
      )}
    </section>
  );
}

function HotelCard({ hotel, params }: { hotel: SearchResult; params: SearchParams }) {
  const href = `/hotels/${hotel.hid}?${new URLSearchParams({ checkin: params.checkin, checkout: params.checkout, adults: String(params.adults) })}`;
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
        <h2 style={{ fontSize: "1.15rem" }}>
          <Link href={href}>{hotel.name}</Link>
        </h2>
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
            {hotel.price.nights} {hotel.price.nights === 1 ? "night" : "nights"}
            {hotel.price.excludedTaxes > 0 &&
              ` + ${money(hotel.price.excludedTaxes, hotel.price.currency)} local tax paid at the hotel`}
            {hotel.price.breakfastIncluded && " · breakfast included"}
            <br />
            <span style={{ fontSize: "0.9rem" }}>
              {hotel.price.freeCancellationBefore
                ? `Free cancellation until ${dateLabel(hotel.price.freeCancellationBefore)}`
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

function EmptyResults({ state }: { state: EmptyState }) {
  return (
    <div
      role="status"
      style={{
        marginTop: "1.5rem",
        padding: "1.5rem",
        border: "1px solid #8884",
        borderRadius: "8px",
      }}
    >
      <h2 style={{ fontSize: "1.15rem" }}>{state.title}</h2>
      <p style={{ marginTop: "0.5rem" }}>{state.body}</p>
      {state.action && (
        <p style={{ marginTop: "0.75rem" }}>
          <Link href={state.action.href}>{state.action.label}</Link>
        </p>
      )}
    </div>
  );
}
