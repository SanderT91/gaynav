import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/current-user";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Your account — GAYNAV",
};

// Phase 0's "hello world behind auth" page.
export default function AccountPage() {
  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>Your account</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}

async function AccountDetails() {
  const user = await requireUser("/account");

  return (
    <>
      <p style={{ marginTop: "1rem" }}>Hello, you&apos;re signed in as {user.email}.</p>
      <p style={{ marginTop: "0.5rem" }}>Account type: {user.role}</p>
      {user.role === "staff" && (
        <p style={{ marginTop: "0.5rem" }}>
          <Link href="/staff">Go to the staff area</Link>
        </p>
      )}
      <form action={signOut} style={{ marginTop: "1.5rem" }}>
        <button type="submit">Sign out</button>
      </form>
    </>
  );
}
