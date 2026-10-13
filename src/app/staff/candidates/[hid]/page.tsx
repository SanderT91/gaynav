import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth/current-user";
import { approvalRequirements, type DecisionEntry } from "@/lib/candidates/decisions";
import { findCandidate, imageUrl } from "@/lib/candidates/detail";
import type { EvidenceSignal } from "@/lib/evidence/schema";
import type { CitableSource } from "@/lib/evidence/sources";
import { loadLatestEvidencePack } from "@/lib/evidence/store";
import { createClient } from "@/lib/supabase/server";
import { DecisionPanel } from "./decision-panel";
import { GenerateButton } from "./generate-button";
import { StatusPanel } from "./status-panel";

export const metadata: Metadata = {
  title: "Candidate — GAYNAV staff",
  robots: { index: false },
};

const TONE: Record<EvidenceSignal["tone"], { label: string; color: string }> = {
  positive: { label: "Positive", color: "var(--color-success)" },
  neutral: { label: "Neutral", color: "var(--color-muted)" },
  concern: { label: "Concern", color: "var(--color-error)" },
};

const WHITELIST_LABEL = {
  approved: "Approved — visible to travellers",
  suspended: "Suspended — hidden from travellers",
} as const;

// Staff-only detail view of one candidate (Epic 1.3): the hotel's own data
// and the latest AI evidence pack, the approve / reject decision, and the
// audit log of every decision about this hotel.
export default function CandidatePage({ params }: PageProps<"/staff/candidates/[hid]">) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "52rem", margin: "0 auto" }}>
      <p>
        <Link href="/staff/candidates">← All candidates</Link>
      </p>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <CandidateDetail params={params} />
      </Suspense>
    </main>
  );
}

async function CandidateDetail({
  params,
}: {
  params: PageProps<"/staff/candidates/[hid]">["params"];
}) {
  const { hid } = await params;
  await requireStaff(`/staff/candidates/${encodeURIComponent(hid)}`);

  const candidate = findCandidate(hid);
  if (!candidate) notFound();
  const { hotel } = candidate;

  const supabase = await createClient();
  const [{ data: approval }, latest, { data: history }] = await Promise.all([
    supabase.from("approved_properties").select("status").eq("hid", hotel.hid).maybeSingle(),
    loadLatestEvidencePack(supabase, hotel.hid),
    supabase
      .from("vetting_decisions")
      .select("decision, note, concerns_acknowledged, decided_at")
      .eq("hid", hotel.hid)
      .order("decided_at", { ascending: false }),
  ]);
  const decisions = (history ?? []) as DecisionEntry[];
  const amenities = hotel.amenity_groups.flatMap((g) => g.amenities);

  return (
    <>
      <h1 style={{ marginTop: "0.5rem" }}>{hotel.name}</h1>
      <p style={{ marginTop: "0.25rem" }}>
        {hotel.address}, {hotel.region.name} ({hotel.region.country_code}) ·{" "}
        {hotel.kind.replaceAll("_", " ")}
        {hotel.star_rating > 0 && ` · ${hotel.star_rating}★`} · RateHawk hid {hotel.hid}
      </p>
      <p style={{ marginTop: "0.5rem" }}>
        <strong>Whitelist:</strong>{" "}
        {approval
          ? WHITELIST_LABEL[approval.status as keyof typeof WHITELIST_LABEL]
          : "Not reviewed"}
      </p>
      {hotel.is_closed && (
        <p role="alert" style={{ marginTop: "0.5rem", color: "var(--color-error)" }}>
          This hotel is marked closed by RateHawk. It cannot be approved.
        </p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", marginTop: "1rem" }}>
        {hotel.images_ext.slice(0, 4).map((img, i) => (
          // Mock placeholder images; next/image optimisation comes with the public pages.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={imageUrl(img.url, "320x200")}
            alt={`${hotel.name}, ${img.category_slug}`}
            width={192}
            height={120}
          />
        ))}
      </div>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.2rem" }}>From RateHawk</h2>
        {hotel.description_struct.map((s) => (
          <p key={s.title} style={{ marginTop: "0.5rem" }}>
            {s.paragraphs.join(" ")}
          </p>
        ))}
        <p style={{ marginTop: "0.5rem" }}>
          <strong>House rules:</strong> {hotel.metapolicy_extra_info || "None stated."}
        </p>
        {hotel.is_gender_specification_required && (
          <p style={{ marginTop: "0.5rem" }}>
            <strong>Booking requirement:</strong> each guest&apos;s gender must be specified.
          </p>
        )}
        <p style={{ marginTop: "0.5rem" }}>
          <strong>Amenities:</strong> {amenities.join(", ")}
        </p>
      </section>

      <section style={{ marginTop: "2rem" }} aria-labelledby="evidence-heading">
        <h2 id="evidence-heading" style={{ fontSize: "1.2rem" }}>
          AI evidence pack
        </h2>
        <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
          Written by AI from the sources below. Check its claims against the sources — the decision
          is yours, not the AI&apos;s.
        </p>

        {!latest && (
          <>
            <p style={{ marginTop: "1rem" }}>No evidence pack has been generated yet.</p>
            <GenerateButton hid={String(hotel.hid)} label="Generate evidence pack" />
          </>
        )}

        {latest?.status === "failed" && (
          <>
            <p role="alert" style={{ marginTop: "1rem", color: "var(--color-error)" }}>
              Last attempt ({new Date(latest.generated_at).toLocaleString("en-GB")}):{" "}
              {latest.failure_message}
            </p>
            <GenerateButton hid={String(hotel.hid)} label="Try again" />
          </>
        )}

        {latest?.status === "ready" && (
          <>
            <p style={{ marginTop: "1rem" }}>{latest.pack.summary}</p>

            {latest.pack.signals.length > 0 && (
              <ul
                style={{
                  marginTop: "1rem",
                  paddingLeft: "1.2rem",
                  display: "grid",
                  gap: "0.75rem",
                }}
              >
                {latest.pack.signals.map((signal, i) => (
                  <li key={i}>
                    <strong style={{ color: TONE[signal.tone].color }}>
                      {TONE[signal.tone].label}
                    </strong>{" "}
                    · {signal.topic.replaceAll("_", " ")} — {signal.statement}
                    <Citations ids={signal.source_ids} sources={latest.sources} />
                  </li>
                ))}
              </ul>
            )}

            {latest.pack.open_questions.length > 0 && (
              <>
                <h3 style={{ fontSize: "1rem", marginTop: "1rem" }}>Questions for the reviewer</h3>
                <ul style={{ paddingLeft: "1.2rem" }}>
                  {latest.pack.open_questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </>
            )}

            <p style={{ marginTop: "1rem", fontSize: "0.85rem" }}>
              Generated {new Date(latest.generated_at).toLocaleString("en-GB")}
              {latest.model && ` by ${latest.model}`}.
            </p>
            <GenerateButton hid={String(hotel.hid)} label="Regenerate" />
          </>
        )}
      </section>
      <section style={{ marginTop: "2rem" }} aria-labelledby="decision-heading">
        <h2 id="decision-heading" style={{ fontSize: "1.2rem" }}>
          Decision
        </h2>
        {approval ? (
          <StatusPanel
            hid={String(hotel.hid)}
            status={approval.status === "suspended" ? "suspended" : "approved"}
          />
        ) : hotel.is_closed ? (
          <p style={{ marginTop: "0.5rem" }}>Closed hotels can&apos;t be approved.</p>
        ) : (
          <DecisionPanel hid={String(hotel.hid)} requirements={approvalRequirements(latest)} />
        )}
      </section>

      <section style={{ marginTop: "2rem" }} aria-labelledby="history-heading">
        <h2 id="history-heading" style={{ fontSize: "1.2rem" }}>
          Decision history
        </h2>
        <p style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
          Who made each decision is in the{" "}
          <Link href={`/staff/audit?hid=${hotel.hid}`}>audit log for this hotel</Link>.
        </p>
        {decisions.length === 0 ? (
          <p style={{ marginTop: "0.5rem" }}>No decisions yet.</p>
        ) : (
          <ul
            style={{ marginTop: "0.5rem", paddingLeft: "1.2rem", display: "grid", gap: "0.5rem" }}
          >
            {decisions.map((d, i) => (
              <li key={i}>
                <strong>{d.decision}</strong> · {new Date(d.decided_at).toLocaleString("en-GB")} ·
                {d.concerns_acknowledged && " · concerns reviewed"}
                {d.note && <div style={{ fontSize: "0.9rem" }}>“{d.note}”</div>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Citations({ ids, sources }: { ids: string[]; sources: CitableSource[] }) {
  const byId = new Map(sources.map((s) => [s.source_id, s]));
  return (
    <div style={{ marginTop: "0.25rem", fontSize: "0.9rem" }}>
      {ids.map((id) => {
        const source = byId.get(id);
        return (
          <details key={id}>
            <summary>Source: {source ? source.label : id}</summary>
            <blockquote style={{ margin: "0.25rem 0 0 1rem" }}>
              {source ? source.text : "Source not found."}
            </blockquote>
          </details>
        );
      })}
    </div>
  );
}
