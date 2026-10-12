import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string | undefined;
  role: "traveler" | "partner" | "staff";
};

// The single place pages ask "who is signed in?" (a Data Access Layer).
//
// Uses getUser(), which checks the session with Supabase Auth's server rather
// than trusting the cookie, so a revoked or forged session is rejected. The
// role is read from public.users through RLS (a user can read only their own
// row) — never from the session token or user metadata.
//
// Returns only the fields the UI needs.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // A signed-in account without a profile row should never happen (a database
  // trigger creates it at sign-up). Treat it as signed out rather than guessing
  // a role.
  if (error || !profile) return null;

  return { id: user.id, email: user.email, role: profile.role };
}

// For pages that require a signed-in user. Redirects to the login page
// otherwise, remembering where to come back to.
export async function requireUser(nextPath: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

// Did this session complete a second factor? Read from the verified session
// token's `aal` claim — the same claim the database's RLS policies check.
export async function sessionHasMfa(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.aal === "aal2";
}

// Signed in AND staff role, regardless of 2FA. Only for the 2FA set-up and
// code-entry steps themselves. Anyone else gets a plain 404, so the staff
// area doesn't advertise itself.
export async function requireStaffRole(nextPath: string): Promise<CurrentUser> {
  const user = await requireUser(nextPath);
  if (user.role !== "staff") notFound();
  return user;
}

// For every staff page: staff role AND a 2FA session (CLAUDE.md, Decisions #2).
// Staff without 2FA are sent to set it up or enter their code first. The
// database enforces the same rule independently through RLS.
export async function requireStaff(nextPath: string): Promise<CurrentUser> {
  const user = await requireStaffRole(nextPath);
  if (!(await sessionHasMfa())) redirect(`/staff/mfa?next=${encodeURIComponent(nextPath)}`);
  return user;
}
