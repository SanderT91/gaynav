import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { loadAudit } from "@/lib/audit/load";
import { DECISIONS, DECISION_LABEL, parseAuditFilters } from "@/lib/audit/rows";
import { requireStaff } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Audit log — GAYNAV staff",
  robots: { index: false },
};

// Staff-only audit log (Epic 1.4): every vetting decision and every AI
// evidence-pack run, with who did it. Per Decisions #5 this is the only place
// "who did it" is shown. Requires staff + 2FA; RLS enforces the same.
export default function AuditPage({ searchParams }: PageProps<"/staff/audit">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "64rem", margin: "0 auto" }}>
      <p>
        <Link href="/staff">← Staff area</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>Audit log</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <AuditLog searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const cell = { padding: "0.5rem 0.75rem 0.5rem 0", verticalAlign: "top" } as const;

async function AuditLog({
  searchParams,
}: {
  searchParams: PageProps<"/staff/audit">["searchParams"];
}) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const query = new URLSearchParams();
  if (filters.hid) query.set("hid", String(filters.hid));
  if (filters.decision) query.set("decision", filters.decision);
  await requireStaff(`/staff/audit${query.size ? `?${query}` : ""}`);

  const result = await loadAudit(filters);
  if (!result.ok) {
    return (
      <p role="alert" style={{ marginTop: "1rem", color: "var(--color-error)" }}>
        {result.error}
      </p>
    );
  }

  const withDecision = (decision?: string) => {
    const q = new URLSearchParams();
    if (filters.hid) q.set("hid", String(filters.hid));
    if (decision) q.set("decision", decision);
    return `/staff/audit${q.size ? `?${q}` : ""}`;
  };

  return (
    <>
      <p style={{ marginTop: "0.75rem" }}>
        Every approve, reject, suspend and reactivate decision, newest first. Entries can&apos;t be
        edited or deleted.
        {filters.hid && (
          <>
            {" "}
            Showing one hotel only — <Link href="/staff/audit">show all hotels</Link>.
          </>
        )}
      </p>

      <nav
        aria-label="Filter by decision"
        style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <Link href={withDecision()} aria-current={filters.decision ? undefined : "page"}>
          All decisions
        </Link>
        {DECISIONS.map((d) => (
          <Link
            key={d}
            href={withDecision(d)}
            aria-current={filters.decision === d ? "page" : undefined}
          >
            {DECISION_LABEL[d]}
          </Link>
        ))}
      </nav>

      {result.decisions.length === 0 ? (
        <p style={{ marginTop: "1.5rem" }}>No decisions recorded yet.</p>
      ) : (
        <table style={{ marginTop: "1.5rem", width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th scope="col" style={cell}>
                When
              </th>
              <th scope="col" style={cell}>
                Who
              </th>
              <th scope="col" style={cell}>
                Decision
              </th>
              <th scope="col" style={cell}>
                Hotel
              </th>
              <th scope="col" style={cell}>
                Reason / note
              </th>
            </tr>
          </thead>
          <tbody>
            {result.decisions.map((d) => (
              <tr key={d.id} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={cell}>{new Date(d.decided_at).toLocaleString("en-GB")}</td>
                <td style={cell}>{d.who}</td>
                <td style={cell}>
                  {DECISION_LABEL[d.decision]}
                  {d.concerns_acknowledged && (
                    <div style={{ fontSize: "0.85rem" }}>concerns reviewed</div>
                  )}
                  {d.decision === "approved" && !d.evidence_pack_id && (
                    <div style={{ fontSize: "0.85rem" }}>no evidence pack</div>
                  )}
                </td>
                <td style={cell}>
                  <Link href={`/staff/candidates/${d.hid}`}>{d.hotel}</Link>
                </td>
                <td style={cell}>
                  {d.note ?? "—"}
                  {d.public_summary && (
                    <div style={{ fontSize: "0.85rem" }}>Public summary: “{d.public_summary}”</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {result.truncated && (
        <p style={{ marginTop: "0.75rem" }}>
          Showing the latest 200 decisions. Filter by hotel to see older ones.
        </p>
      )}

      <h2 style={{ fontSize: "1.2rem", marginTop: "2.5rem" }}>AI evidence pack runs</h2>
      {result.evidenceRuns.length === 0 ? (
        <p style={{ marginTop: "0.5rem" }}>No evidence packs generated yet.</p>
      ) : (
        <ul style={{ marginTop: "0.5rem", paddingLeft: "1.2rem", display: "grid", gap: "0.35rem" }}>
          {result.evidenceRuns.map((r, i) => (
            <li key={i}>
              {new Date(r.generated_at).toLocaleString("en-GB")} · {r.who} ·{" "}
              <Link href={`/staff/candidates/${r.hid}`}>{r.hotel}</Link> ·{" "}
              {r.status === "ready"
                ? `ready${r.model ? ` (${r.model})` : ""}`
                : `failed (${r.failure_reason})`}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
