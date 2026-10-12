"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export type EnrollmentState =
  | { status: "idle" }
  | { status: "enrolling"; factorId: string; qrCode: string; secret: string }
  | { status: "error"; message: string };

export type VerifyState = { error?: string };

// Server Actions are public endpoints, so each one re-checks who is calling
// instead of trusting that the page already did.
async function assertStaff() {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") throw new Error("Not allowed");
  return user;
}

// Step 1 of setting up an authenticator app: create a new (unverified) TOTP
// factor and return its QR code. Any earlier unfinished set-up is discarded
// first, so abandoned attempts don't pile up.
export async function startTotpEnrollment(): Promise<EnrollmentState> {
  await assertStaff();
  const supabase = await createClient();

  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === "totp" && factor.status === "unverified") {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator app ${new Date().toISOString().slice(0, 10)}`,
    issuer: "GAYNAV",
  });
  if (error || !data) {
    return { status: "error", message: "Couldn't start the set-up. Please try again." };
  }

  return {
    status: "enrolling",
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

// Step 2 (set-up) or every later sign-in: check a 6-digit code. On success
// Supabase upgrades the session to aal2 and writes the new session cookie.
export async function verifyTotpCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  await assertStaff();

  const factorId = String(formData.get("factorId") ?? "");
  const code = String(formData.get("code") ?? "").replace(/\s+/g, "");
  const next = safeNextPath(formData.get("next"), "/staff");

  if (!/^\d{6}$/.test(code))
    return { error: "Enter the 6-digit code from your authenticator app." };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error)
    return { error: "That code didn't work. Codes change every 30 seconds — try the current one." };

  redirect(next);
}
