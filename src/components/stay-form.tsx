import { MAX_ADULTS, MAX_NIGHTS } from "@/lib/search/params";

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
}: {
  action: string;
  values: Record<string, string>;
  errors: Partial<Record<string, string>>;
  today: string;
  /** Show a city picker with these cities; omit on a hotel page. */
  cities?: readonly string[];
  submitLabel?: string;
}) {
  const field = { display: "grid", gap: "0.25rem" } as const;
  const error = (name: string) =>
    errors[name] ? (
      <span id={`${name}-error`} role="alert" style={{ color: "#b42318", fontSize: "0.9rem" }}>
        {errors[name]}
      </span>
    ) : null;

  return (
    <form
      action={action}
      method="get"
      style={{
        marginTop: "1rem",
        display: "flex",
        flexWrap: "wrap",
        gap: "1rem",
        alignItems: "end",
      }}
    >
      {cities && (
        <label style={field}>
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
      <button type="submit">{submitLabel}</button>
      <p style={{ flexBasis: "100%", fontSize: "0.85rem" }}>
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
