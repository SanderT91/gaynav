import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formValues, StayForm } from "@/components/stay-form";
import { dateLabel, money, todayIso } from "@/lib/format";
import type { HotelDetail, RoomOption } from "@/lib/hotels/detail";
import { loadPublicHotel } from "@/lib/hotels/load";
import { LAUNCH_CITIES } from "@/lib/cities";
import { parseSearch, type SearchParams } from "@/lib/search/params";

// Per-hotel titles and Open Graph tags come with Epic 2.3 (SEO).
export const metadata: Metadata = {
  title: "Hotel — GAYNAV",
  description: "A hotel personally vetted by GAYNAV as safe and welcoming for LGBTQ+ travellers.",
};

// Public property page (Epic 2.2). No login needed. Only approved hotels:
// anything else — unknown, under review, suspended, closed — is a plain 404.
// Prices appear once dates and guests are chosen; booking comes in Phase 4.
export default function HotelPage({ params, searchParams }: PageProps<"/hotels/[hid]">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "56rem", margin: "0 auto" }}>
      <Suspense fallback={<p>Loading…</p>}>
        <HotelBody params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function HotelBody({
  params,
  searchParams,
}: {
  params: PageProps<"/hotels/[hid]">["params"];
  searchParams: PageProps<"/hotels/[hid]">["searchParams"];
}) {
  const { hid } = await params;
  // The city belongs to the hotel, not the visitor's choice here.
  const raw = { ...(await searchParams) };
  delete raw.city;
  await connection(); // "today" is per request, never prerendered
  const today = todayIso();
  const parsed = parseSearch(raw, today, LAUNCH_CITIES);
  const stay = parsed.status === "ok" ? parsed.params : null;

  const result = await loadPublicHotel(hid, stay, today);
  if (result.status === "not-found") notFound();
  if (result.status === "error") {
    return (
      <p role="alert">We couldn&apos;t load this hotel just now. Please try again in a moment.</p>
    );
  }
  const hotel = result.hotel;
  const backToSearch = `/search?${new URLSearchParams({
    city: hotel.city,
    ...(stay
      ? { checkin: stay.checkin, checkout: stay.checkout, adults: String(stay.adults) }
      : {}),
  })}`;

  return (
    <article>
      <p>
        <Link href="/">GAYNAV</Link> / <Link href={backToSearch}>Hotels in {hotel.city}</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>{hotel.name}</h1>
      <p>
        {hotel.city}, {hotel.countryCode} · {hotel.kind}
        {hotel.stars > 0 && ` · ${hotel.stars}★`}
      </p>
      <p style={{ fontSize: "0.9rem" }}>{hotel.address}</p>
      <p style={{ marginTop: "0.75rem" }}>
        <a href="#availability">Check availability</a>
      </p>

      <Photos hotel={hotel} />

      <section
        aria-labelledby="why"
        style={{
          marginTop: "2rem",
          padding: "1.25rem",
          border: "1px solid #8884",
          borderRadius: "8px",
        }}
      >
        <h2 id="why" style={{ fontSize: "1.15rem" }}>
          Why we list it
        </h2>
        <p style={{ marginTop: "0.5rem" }}>{hotel.vettingSummary}</p>
        <p style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
          Every GAYNAV hotel is reviewed by a person on our team before it appears here.
        </p>
      </section>

      <section aria-labelledby="availability" style={{ marginTop: "2rem" }}>
        <h2 id="availability" style={{ fontSize: "1.15rem" }}>
          Check availability
        </h2>
        <StayForm
          action={`/hotels/${hotel.hid}`}
          values={formValues(parsed)}
          errors={parsed.status === "invalid" ? parsed.errors : {}}
          today={today}
          submitLabel="Check availability"
        />
        {stay ? (
          <Rooms rooms={hotel.rooms ?? []} stay={stay} />
        ) : (
          parsed.status === "empty" && (
            <p style={{ marginTop: "1rem" }}>
              Choose your dates and number of guests to see rooms and prices.
            </p>
          )
        )}
      </section>

      {hotel.description.map((section) => (
        <section key={section.title} style={{ marginTop: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} style={{ marginTop: "0.5rem" }}>
              {p}
            </p>
          ))}
        </section>
      ))}

      {hotel.amenities.length > 0 && (
        <section aria-labelledby="amenities" style={{ marginTop: "2rem" }}>
          <h2 id="amenities" style={{ fontSize: "1.15rem" }}>
            Amenities
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(14rem, 1fr))",
              gap: "1rem",
              marginTop: "0.5rem",
            }}
          >
            {hotel.amenities.map((g) => (
              <div key={g.group}>
                <h3 style={{ fontSize: "1rem" }}>{g.group}</h3>
                <ul style={{ paddingLeft: "1.25rem" }}>
                  {g.free.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                  {g.paid.map((a) => (
                    <li key={a}>{a} (extra charge)</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="rules" style={{ marginTop: "2rem" }}>
        <h2 id="rules" style={{ fontSize: "1.15rem" }}>
          House rules
        </h2>
        <ul style={{ paddingLeft: "1.25rem", marginTop: "0.5rem" }}>
          <li>Check-in from {hotel.checkIn}</li>
          <li>Check-out until {hotel.checkOut}</li>
          {hotel.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        {hotel.extraInfo && (
          <p style={{ marginTop: "0.5rem" }}>
            <strong>From the hotel:</strong> {hotel.extraInfo}
          </p>
        )}
      </section>
    </article>
  );
}

function Photos({ hotel }: { hotel: HotelDetail }) {
  if (hotel.photos.length === 0) return null;
  const [first, ...rest] = hotel.photos;
  // Mock placeholder images; image optimisation comes with the design pass.
  /* eslint-disable @next/next/no-img-element */
  return (
    <section aria-label="Photos" style={{ marginTop: "1.5rem" }}>
      <img
        src={first.url.replace("{size}", "1024x768")}
        alt={`${hotel.name}: ${first.category}`}
        style={{ width: "100%", height: "auto", borderRadius: "8px" }}
      />
      {rest.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
            gap: "0.5rem",
            marginTop: "0.5rem",
          }}
        >
          {rest.map((p) => (
            <img
              key={p.url}
              src={p.url.replace("{size}", "320x200")}
              alt={`${hotel.name}: ${p.category}`}
              style={{ width: "100%", height: "auto", borderRadius: "4px" }}
            />
          ))}
        </div>
      )}
    </section>
  );
  /* eslint-enable @next/next/no-img-element */
}

function Rooms({ rooms, stay }: { rooms: RoomOption[]; stay: SearchParams }) {
  const summary = `${dateLabel(stay.checkin)} – ${dateLabel(stay.checkout)} · ${stay.nights} ${
    stay.nights === 1 ? "night" : "nights"
  } · ${stay.adults} ${stay.adults === 1 ? "guest" : "guests"}`;

  if (rooms.length === 0) {
    return (
      <div role="status" style={{ marginTop: "1rem" }}>
        <p>{summary}</p>
        <p style={{ marginTop: "0.5rem" }}>
          No rooms available for these dates. Try other dates, or{" "}
          <Link href="/search">look at other hotels</Link>.
        </p>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p>{summary}</p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gap: "0.75rem",
          marginTop: "0.5rem",
        }}
      >
        {rooms.map((room, i) => (
          <li key={i} style={{ borderTop: "1px solid #8884", paddingTop: "0.75rem" }}>
            <strong>{room.name}</strong>
            {room.price.breakfastIncluded ? " · breakfast included" : " · room only"}
            <br />
            <strong>{money(room.price.total, room.price.currency)}</strong> for {room.price.nights}{" "}
            {room.price.nights === 1 ? "night" : "nights"}
            {room.price.excludedTaxes > 0 &&
              ` + ${money(room.price.excludedTaxes, room.price.currency)} local tax paid at the hotel`}
            <br />
            <span style={{ fontSize: "0.9rem" }}>
              {room.price.freeCancellationBefore
                ? `Free cancellation until ${dateLabel(room.price.freeCancellationBefore)}`
                : "Non-refundable"}
            </span>
          </li>
        ))}
      </ul>
      <p style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
        Sample prices. Booking opens soon — for now you can&apos;t reserve a room here yet.
      </p>
    </div>
  );
}
