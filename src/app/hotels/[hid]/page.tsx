import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { formValues, StayForm } from "@/components/stay-form";
import { LAUNCH_CITIES } from "@/lib/cities";
import { dateLabel, money, todayIso } from "@/lib/format";
import type { HotelDetail, RoomOption } from "@/lib/hotels/detail";
import { loadPublicHotel } from "@/lib/hotels/load";
import { parseSearch, type SearchParams } from "@/lib/search/params";
import { hotelMetadata } from "@/lib/seo";
import styles from "./hotel.module.css";

// Title, description and Open Graph tags per hotel (Epic 2.3). Runs the same
// approval check as the page: a hidden hotel gets generic, unindexed
// metadata, never its name. The page reads per-request data inside Suspense,
// so this per-request metadata is allowed under Cache Components.
export async function generateMetadata({ params }: PageProps<"/hotels/[hid]">): Promise<Metadata> {
  const result = await loadPublicHotel((await params).hid, null, "");
  return hotelMetadata(result.status === "ok" ? result.hotel : null);
}

// Public property page (Epic 2.2, styled in 2.6). No login needed. Only
// approved hotels: anything else — unknown, under review, suspended, closed —
// is a plain 404. Prices appear once dates and guests are chosen; booking
// comes in Phase 4.
export default function HotelPage({ params, searchParams }: PageProps<"/hotels/[hid]">) {
  return (
    <main className="page">
      <Suspense fallback={<p className="panel">Loading…</p>}>
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
      <p role="alert" className="panel">
        We couldn&apos;t load this hotel just now. Please try again in a moment.
      </p>
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
      <p className={styles.back}>
        <Link href={backToSearch}>← Hotels in {hotel.city}</Link>
      </p>
      <h1 className={styles.title}>{hotel.name}</h1>
      <p className={styles.meta}>
        {hotel.kind}
        {hotel.stars > 0 && ` · ${"★".repeat(hotel.stars)}`} · {hotel.address}, {hotel.city},{" "}
        {hotel.countryCode}
      </p>

      <Photos hotel={hotel} />

      <div className={styles.layout}>
        <section aria-labelledby="why" className={styles.why}>
          <h2 id="why">Why we list it</h2>
          <p>{hotel.vettingSummary}</p>
          <p className={styles.whyNote}>
            Every GAYNAV hotel is reviewed by a person on our team before it appears here.{" "}
            <Link href="/how-we-vet">How we vet hotels</Link>
          </p>
        </section>

        <section aria-labelledby="availability" className={styles.aside}>
          <h2 id="availability">Check availability</h2>
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
              <p className={styles.notLive}>
                Choose your dates and number of guests to see rooms and prices.
              </p>
            )
          )}
        </section>

        <div className={styles.details}>
          {hotel.description.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </section>
          ))}

          {hotel.amenities.length > 0 && (
            <section aria-labelledby="amenities">
              <h2 id="amenities">Amenities</h2>
              <div className={styles.amenities}>
                {hotel.amenities.map((g) => (
                  <div key={g.group}>
                    <h3>{g.group}</h3>
                    <ul>
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

          <section aria-labelledby="rules">
            <h2 id="rules">House rules</h2>
            <ul className={styles.rules}>
              <li>Check-in from {hotel.checkIn}</li>
              <li>Check-out until {hotel.checkOut}</li>
              {hotel.rules.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {hotel.extraInfo && (
              <p>
                <strong>From the hotel:</strong> {hotel.extraInfo}
              </p>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

function Photos({ hotel }: { hotel: HotelDetail }) {
  if (hotel.photos.length === 0) return null;
  // Mock placeholder images; image optimisation comes with the real photos in Phase 3.
  /* eslint-disable @next/next/no-img-element */
  return (
    <section aria-label="Photos" className={styles.gallery}>
      {hotel.photos.slice(0, 5).map((p, i) => (
        <img
          key={p.url}
          src={p.url.replace("{size}", i === 0 ? "1024x768" : "640x400")}
          alt={`${hotel.name}: ${p.category}`}
        />
      ))}
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
      <div role="status">
        <p className={styles.stay}>{summary}</p>
        <p className={styles.notLive}>
          No rooms available for these dates. Try other dates, or{" "}
          <Link href="/search">look at other hotels</Link>.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className={styles.stay}>{summary}</p>
      <ul className={styles.rooms}>
        {rooms.map((room, i) => (
          <li key={i} className={styles.room}>
            <span className={styles.roomName}>{room.name}</span>
            <span className={styles.muted}>
              {room.price.breakfastIncluded ? "Breakfast included" : "Room only"}
            </span>
            <span className={styles.roomPrice}>{money(room.price.total, room.price.currency)}</span>
            <span className={styles.muted}>
              {room.price.nights} {room.price.nights === 1 ? "night" : "nights"}
              {room.price.excludedTaxes > 0 &&
                ` + ${money(room.price.excludedTaxes, room.price.currency)} local tax paid at the hotel`}
            </span>
            <span className={room.price.freeCancellationBefore ? styles.good : styles.muted}>
              {room.price.freeCancellationBefore
                ? `Free cancellation until ${dateLabel(room.price.freeCancellationBefore)}`
                : "Non-refundable"}
            </span>
          </li>
        ))}
      </ul>
      <p className={styles.notLive}>
        Sample prices. Booking opens soon — for now you can&apos;t reserve a room here yet.
      </p>
    </div>
  );
}
