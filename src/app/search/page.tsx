import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MAX_ADULTS, MAX_NIGHTS, parseSearch, type SearchParams } from "@/lib/search/params";
import { LAUNCH_CITIES, loadSearch } from "@/lib/search/load";
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
      <p>
        <Link href="/">GAYNAV</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>Find a hotel</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Searching…</p>}>
        <SearchBody searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);

const dateLabel = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

async function SearchBody({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const raw = await searchParams;
  const today = todayIso();
  const parsed = parseSearch(raw, today, LAUNCH_CITIES);

  const values =
    parsed.status === "invalid"
      ? parsed.values
      : parsed.status === "ok"
        ? {
            city: parsed.params.city ?? "",
            checkin: parsed.params.checkin,
            checkout: parsed.params.checkout,
            adults: String(parsed.params.adults),
          }
        : {
            city: typeof raw.city === "string" ? raw.city : "",
            checkin: "",
            checkout: "",
            adults: "2",
          };
  const errors = parsed.status === "invalid" ? parsed.errors : {};

  return (
    <>
      <SearchForm values={values} errors={errors} today={today} />
      {parsed.status === "empty" && (
        <p style={{ marginTop: "1.5rem" }}>
          Choose your dates and number of guests to see hotels and prices.
        </p>
      )}
      {parsed.status === "ok" && <Results params={parsed.params} today={today} />}
    </>
  );
}

function SearchForm({
  values,
  errors,
  today,
}: {
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  today: string;
}) {
  const field = { display: "grid", gap: "0.25rem" } as const;
  const error = (name: string) =>
    errors[name] ? (
      <span id={`${name}-error`} role="alert" style={{ color: "#b42318", fontSize: "0.9rem" }}>
        {errors[name]}
      </span>
    ) : null;

  // A plain GET form: works without JavaScript, and the URL is shareable.
  return (
    <form
      action="/search"
      method="get"
      style={{
        marginTop: "1rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "end",
      }}
    >
      <label style={field}>
        City
        <select name="city" defaultValue={values.city} aria-describedby="city-error">
          <option value="">All cities</option>
          {LAUNCH_CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {error("city")}
      </label>
      <label style={field}>
        Check-in
        <input
          type="date"
          name="checkin"
          required
          min={today}
          defaultValue={values.checkin}
          aria-describedby="checkin-error"
        />
        {error("checkin")}
      </label>
      <label style={field}>
        Check-out
        <input
          type="date"
          name="checkout"
          required
          min={today}
          defaultValue={values.checkout}
          aria-describedby="checkout-error"
        />
        {error("checkout")}
      </label>
      <label style={field}>
        Guests
        <select
          name="adults"
          required
          defaultValue={values.adults || "2"}
          aria-describedby="adults-error"
        >
          {Array.from({ length: MAX_ADULTS }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? "adult" : "adults"}
            </option>
          ))}
        </select>
        {error("adults")}
      </label>
      <button type="submit">Search</button>
      <p style={{ flexBasis: "100%", fontSize: "0.85rem" }}>
        One room, up to {MAX_ADULTS} adults, stays of up to {MAX_NIGHTS} nights. Sample prices —
        booking isn&apos;t live yet.
      </p>
    </form>
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
            <HotelCard key={hotel.hid} hotel={hotel} />
          ))}
        </ul>
      )}
    </section>
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
