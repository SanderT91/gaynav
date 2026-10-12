import { redirect } from "next/navigation";
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
