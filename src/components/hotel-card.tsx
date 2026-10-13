import Link from "next/link";
import { dateLabel, money } from "@/lib/format";
import type { SearchResult } from "@/lib/search/search";
import styles from "./hotel-card.module.css";

// One hotel in a list: search results (with a price for the chosen stay) and
// city pages (no dates yet, so no price).
export function HotelCard({
  hotel,
  href,
  showPrice,
}: {
  hotel: SearchResult;
  href: string;
  /** true on search results: shows the price, or "no rooms" when sold out. */
  showPrice: boolean;
}) {
  const price = hotel.price;
  return (
    <li className={styles.card}>
      {hotel.photo && (
        // Mock placeholder images; image optimisation comes with Phase 3's real photos.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.photo}
          src={hotel.photo.replace("{size}", "640x400")}
          alt=""
          width={320}
          height={200}
        />
      )}
      <div className={styles.body}>
        <p className={styles.meta}>
          {hotel.city} · {hotel.kind}
          {hotel.stars > 0 && ` · ${"★".repeat(hotel.stars)}`}
        </p>
        <h2 className={styles.name}>
          <Link href={href}>{hotel.name}</Link>
        </h2>
        <p className={styles.why}>
          <span className={styles.whyLabel}>Why we list it</span>
          {hotel.vettingSummary}
        </p>
      </div>
      <div className={styles.aside}>
        {showPrice &&
          (price ? (
            <p className={styles.price}>
              <strong>{money(price.total, price.currency)}</strong>
              <span>
                {price.nights} {price.nights === 1 ? "night" : "nights"}
                {price.excludedTaxes > 0 &&
                  ` + ${money(price.excludedTaxes, price.currency)} local tax at the hotel`}
              </span>
              {price.breakfastIncluded && <span>Breakfast included</span>}
              <span className={price.freeCancellationBefore ? styles.good : undefined}>
                {price.freeCancellationBefore
                  ? `Free cancellation until ${dateLabel(price.freeCancellationBefore)}`
                  : "Non-refundable"}
              </span>
            </p>
          ) : (
            <p className={styles.soldOut}>No rooms available for these dates.</p>
          ))}
        <Link href={href} className="button button--pill" aria-hidden="true" tabIndex={-1}>
          View hotel
        </Link>
      </div>
    </li>
  );
}
