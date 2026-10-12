import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireStaffRole, sessionHasMfa } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";
import { EnrollTotp, VerifyCodeForm } from "./mfa-forms";

export const metadata: Metadata = {
  title: "Two-factor authentication — GAYNAV staff",
  robots: { index: false },
};

export default function StaffMfaPage({ searchParams }: PageProps<"/staff/mfa">) {
  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "32rem", margin: "0 auto" }}>
      <h1>Two-factor authentication</h1>
      <Suspense fallback={<p style={{ marginTop: "1rem" }}>Loading…</p>}>
        <MfaStep searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MfaStep({
  searchParams,
}: {
  searchParams: PageProps<"/staff/mfa">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : undefined, "/staff");

  await requireStaffRole(`/staff/mfa?next=${encodeURIComponent(next)}`);
  if (await sessionHasMfa()) redirect(next);

  const supabase = await createClient();
  const { data } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = data?.totp?.[0];

  if (verifiedTotp) {
    return (
      <>
        <p style={{ marginTop: "1rem" }}>
          Staff access needs a code from your authenticator app, every time you sign in.
        </p>
        <VerifyCodeForm factorId={verifiedTotp.id} next={next} />
        <p style={{ marginTop: "1.5rem", fontSize: "0.9rem" }}>
          Lost your authenticator? Ask a GAYNAV admin to reset it — there is no self-service bypass.
        </p>
      </>
    );
  }

  return (
    <>
      <p style={{ marginTop: "1rem" }}>
        Staff accounts must use two-factor authentication. Set up an authenticator app once; after
        that you&apos;ll enter a 6-digit code whenever you sign in.
      </p>
      <EnrollTotp next={next} />
    </>
  );
}
