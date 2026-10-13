import Link from "next/link";
import type { ReactNode } from "react";

// Layout for the plain information pages (About, Privacy, Terms).
export function InfoPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main style={{ padding: "3rem 1.5rem", maxWidth: "44rem", margin: "0 auto", lineHeight: 1.6 }}>
      <p>
        <Link href="/">GAYNAV</Link>
      </p>
      <h1 style={{ marginTop: "0.5rem" }}>{title}</h1>
      <div style={{ display: "grid", gap: "1rem", marginTop: "1rem" }}>{children}</div>
    </main>
  );
}

/**
 * A clear, visible flag on text that is not final legal copy (CLAUDE.md:
 * placeholder text is acceptable only if it is flagged as such).
 */
export function PlaceholderNotice() {
  return (
    <p
      role="note"
      style={{
        padding: "1rem",
        border: "2px dashed #b54708",
        borderRadius: "8px",
        fontWeight: 600,
      }}
    >
      Placeholder — not final legal text. This page will be replaced by text reviewed by our legal
      advisers before GAYNAV takes bookings.
    </p>
  );
}
