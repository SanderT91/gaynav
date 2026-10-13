import { MAX_ADULTS, MAX_NIGHTS } from "@/lib/search/params";
import styles from "./stay-form.module.css";

// The dates-and-guests form, used by search (with a city picker) and by the
// hotel page (without). A plain GET form: works without JavaScript and the
// URL can be shared.
export function StayForm({
  action,
  values,
  errors,
  today,
  cities,
  submitLabel = "Search",
  hidden = {},
}: {
  action: string;
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  today: string;
  /** Show a city picker with these cities; omit on a hotel page. */
  cities?: readonly string[];
  submitLabel?: string;
  /** Extra fixed values sent with the form, e.g. the city on a city page. */
  hidden?: Record<string, string>;
}) {
  const error = (name: string) =>
    errors[name] ? (
      <span id={`${name}-error`} role="alert" className={styles.error}>
        {errors[name]}
      </span>
    ) : null;

  return (
    <form action={action} method="get" className={styles.form}>
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {cities && (
        <label className={styles.field}>
          City
          <select name="city" defaultValue={values.city} aria-describedby="city-error">
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {error("city")}
        </label>
      )}
      <label className={styles.field}>
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
      <label className={styles.field}>
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
      <label className={styles.field}>
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
      <button type="submit" className={styles.submit}>
        {submitLabel}
      </button>
      <p className={styles.hint}>
        One room, up to {MAX_ADULTS} adults, stays of up to {MAX_NIGHTS} nights. Sample prices —
        booking isn&apos;t live yet.
      </p>
    </form>
  );
}

/** Form values to show again after a search (valid, invalid or empty). */
export function formValues(
  parsed:
    | { status: "empty" }
    | { status: "invalid"; values: Record<string, string> }
    | {
        status: "ok";
        params: { city?: string; checkin: string; checkout: string; adults: number };
      },
  fallbackCity = "",
): Record<string, string> {
  if (parsed.status === "invalid") return parsed.values;
  if (parsed.status === "ok") {
    return {
      city: parsed.params.city ?? "",
      checkin: parsed.params.checkin,
      checkout: parsed.params.checkout,
      adults: String(parsed.params.adults),
    };
  }
  return { city: fallbackCity, checkin: "", checkout: "", adults: "2" };
}
