import type { Metadata } from "next";
import { Suspense } from "react";
import { requireStaff } from "@/lib/auth/current-user";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Staff — GAYNAV",
  robots: { index: false },
};

// Staff area. Requires the staff role AND a 2FA session. The curation
// workbench (Phase 1) will live here.
export default function StaffPage() {
  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>Staff area</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <StaffHome />
      </Suspense>
    </main>
  );
}

async function StaffHome() {
  const user = await requireStaff("/staff");
  return (
    <>
      <p style={{ marginTop: "1rem" }}>Signed in as {user.email} with two-factor authentication.</p>
      <p style={{ marginTop: "0.5rem" }}>The curation workbench arrives in Phase 1.</p>
      <form action={signOut} style={{ marginTop: "1.5rem" }}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
