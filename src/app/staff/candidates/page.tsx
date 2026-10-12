import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth/current-user";
import { loadCandidateRows } from "@/lib/candidates/load";
import { citiesOf, filterByCity, type WhitelistStatus } from "@/lib/candidates/list";

export const metadata: Metadata = {
  title: "Candidates — GAYNAV staff",
  robots: { index: false },
};

const STATUS_LABEL: Record<WhitelistStatus, string> = {
  not_reviewed: "Not reviewed",
  approved: "Approved",
  suspended: "Suspended",
};

// Staff-only list of candidate hotels (Epic 1.3). Requires the staff role and
// a 2FA session; the data behind it is protected by RLS as well.
export default function CandidatesPage({ searchParams }: PageProps<"/staff/candidates">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "60rem", margin: "0 auto" }}>
      <p>
        <Link href="/staff">← Staff area</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>Candidate hotels</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <CandidateList searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function CandidateList({
  searchParams,
}: {
  searchParams: PageProps<"/staff/candidates">["searchParams"];
}) {
  const params = await searchParams;
  const cityParam = typeof params.city === "string" ? params.city : undefined;
  const nextPath = cityParam
    ? `/staff/candidates?city=${encodeURIComponent(cityParam)}`
    : "/staff/candidates";
  await requireStaff(nextPath);

  const result = await loadCandidateRows();
  if (!result.ok) {
    return (
      <p role="alert" style={{ marginTop: "1rem", color: "#b42318" }}>
        {result.error}
      </p>
    );
  }

  const cities = citiesOf(result.rows);
  const rows = filterByCity(result.rows, cityParam);
  const activeCity = cities.includes(cityParam ?? "") ? cityParam : undefined;

  return (
    <>
      <p style={{ marginTop: "0.75rem" }}>
        Mock data (Phase 1) — fictitious hotels. Every hotel stays off the public site until a staff
        member approves it.
      </p>

      <nav
        aria-label="Filter by city"
        style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <Link href="/staff/candidates" aria-current={activeCity ? undefined : "page"}>
          All ({result.rows.length})
        </Link>
        {cities.map((city) => (
          <Link
            key={city}
            href={`/staff/candidates?city=${encodeURIComponent(city)}`}
            aria-current={activeCity === city ? "page" : undefined}
          >
            {city} ({result.rows.filter((r) => r.city === city).length})
          </Link>
        ))}
      </nav>

      <table style={{ marginTop: "1.5rem", width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th scope="col">Hotel</th>
            <th scope="col">City</th>
            <th scope="col">Type</th>
            <th scope="col">Stars</th>
            <th scope="col">Whitelist</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.hid} style={{ borderTop: "1px solid #8884" }}>
              <td style={{ padding: "0.5rem 0.5rem 0.5rem 0" }}>
                <Link href={`/staff/candidates/${row.hid}`}>{row.name}</Link>
                {row.isClosed && <strong> · Closed — cannot be approved</strong>}
              </td>
              <td>
                {row.city}, {row.countryCode}
              </td>
              <td>{row.kind}</td>
              <td>{row.stars > 0 ? `${row.stars}★` : "—"}</td>
              <td>{STATUS_LABEL[row.whitelist]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
