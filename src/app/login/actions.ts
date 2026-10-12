"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function loginUrl(params: Record<string, string>): string {
  return `/login?${new URLSearchParams(params).toString()}`;
}

export async function signIn(formData: FormData) {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const next = safeNextPath(field(formData, "next"));

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // One generic message for every failure, so the form can't be used to
    // find out which email addresses have an account.
    redirect(loginUrl({ error: "invalid", next }));
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  const next = safeNextPath(field(formData, "next"));

  // The confirmation link brings the user back to this same site. Supabase only
  // honours it if the URL is on the project's allowed redirect list.
  const origin = (await headers()).get("origin") ?? "";
  const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const supabase = await createClient();
  // No role is sent: every new account is a traveler. Even if a client sent
  // one in `options.data`, the database ignores it (see the users migration).
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo },
  });

  if (error) {
    const code = error.code === "weak_password" ? "weak-password" : "signup-failed";
    redirect(loginUrl({ error: code, next }));
  }

  // With email confirmation on (the default), there is no session until the
  // user clicks the link. With it off (local development), they're signed in.
  if (data.session) redirect(next);
  redirect(loginUrl({ message: "check-email", next }));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
