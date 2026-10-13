import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { HotelCard } from "@/components/hotel-card";
import { formValues, StayForm } from "@/components/stay-form";
import { LAUNCH_CITIES } from "@/lib/cities";
import { dateLabel, todayIso } from "@/lib/format";
import { emptyState, type EmptyState } from "@/lib/search/empty-state";
import { loadSearch } from "@/lib/search/load";
import { parseSearch, type SearchParams } from "@/lib/search/params";

export const metadata: Metadata = {
  title: "Find a hotel — GAYNAV",
  description: "Hotels personally vetted by GAYNAV as safe and welcoming for LGBTQ+ travellers.",
};

// Public search (Epic 2.1). No login needed. Only hotels GAYNAV staff have
// approved. Dates and guests are required: without them there are no real
// prices or availability, so no search runs.
export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <main className="page">
      <h1>Find a hotel</h1>
      <p className="page-lead">Every hotel here has been reviewed by a person on our team.</p>
      <Suspense fallback={<p className="panel">Searching…</p>}>
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
      <div className="panel">
        <StayForm
          action="/search"
          values={values}
          errors={errors}
          today={today}
          cities={LAUNCH_CITIES}
        />
      </div>
      {parsed.status === "empty" && (
        <p className="page-lead" style={{ marginTop: "var(--space-5)" }}>
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
      <p role="alert" className="panel">
        {result.error}
      </p>
    );
  }

  const stay = new URLSearchParams({
    checkin: params.checkin,
    checkout: params.checkout,
    adults: String(params.adults),
  });

  return (
    <section aria-label="Search results" style={{ marginTop: "var(--space-6)" }}>
      <h2 style={{ fontSize: "1.25rem" }}>
        {params.city ?? "All cities"}
        <span className="muted" style={{ fontWeight: "var(--weight-regular)" }}>
          {" "}
          · {dateLabel(params.checkin)} – {dateLabel(params.checkout)} · {params.nights}{" "}
          {params.nights === 1 ? "night" : "nights"} · {params.adults}{" "}
          {params.adults === 1 ? "guest" : "guests"}
        </span>
      </h2>
      {result.results.length === 0 ? (
        <EmptyResults
          state={emptyState({
            city: params.city,
            approvedAnywhere: result.approvedAnywhere,
            query: { checkin: params.checkin, checkout: params.checkout, adults: params.adults },
          })}
        />
      ) : (
        <ul className="result-list">
          {result.results.map((hotel) => (
            <HotelCard
              key={hotel.hid}
              hotel={hotel}
              href={`/hotels/${hotel.hid}?${stay}`}
              showPrice
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyResults({ state }: { state: EmptyState }) {
  return (
    <div role="status" className="panel panel--brand">
      <h2>{state.title}</h2>
      <p>{state.body}</p>
      {state.action && (
        <p>
          <Link href={state.action.href}>{state.action.label}</Link>
        </p>
      )}
    </div>
  );
}
