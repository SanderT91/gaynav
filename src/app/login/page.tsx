import type { Metadata } from "next";
import { Suspense } from "react";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { signIn, signUp } from "./actions";

export const metadata: Metadata = {
  title: "Sign in — GAYNAV",
};

// Fixed messages, looked up by code. The page never echoes text from the URL,
// so a crafted link can't put misleading words on a GAYNAV page.
const ERRORS: Record<string, string> = {
  invalid: "That email and password combination didn't work. Please try again.",
  "weak-password": "Please choose a longer password (at least 10 characters).",
  "signup-failed": "We couldn't create an account right now. Please try again.",
  link: "That sign-in link is invalid or has expired. Please sign in again.",
};
const MESSAGES: Record<string, string> = {
  "check-email": "Check your inbox: we've sent you a link to confirm your email address.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "28rem", margin: "0 auto" }}>
      <h1>Sign in to GAYNAV</h1>
      {/* Reading the URL happens at request time, so it sits behind Suspense. */}
      <Suspense fallback={<p style={{ marginTop: "1.5rem" }}>Loading…</p>}>
        <LoginForms searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginForms({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? params[key] : undefined);
  const next = safeNextPath(pick("next"));
  const error = ERRORS[pick("error") ?? ""];
  const message = MESSAGES[pick("message") ?? ""];

  return (
    <>
      {error && (
        <p role="alert" style={{ marginTop: "1.5rem", color: "var(--color-error)" }}>
          {error}
        </p>
      )}
      {message && (
        <p role="status" style={{ marginTop: "1.5rem" }}>
          {message}
        </p>
      )}

      <AuthForm title="Sign in" action={signIn} next={next} autoComplete="current-password" />
      <AuthForm
        title="New here? Create an account"
        action={signUp}
        next={next}
        autoComplete="new-password"
      />
    </>
  );
}

function AuthForm({
  title,
  action,
  next,
  autoComplete,
}: {
  title: string;
  action: (formData: FormData) => Promise<void>;
  next: string;
  autoComplete: "current-password" | "new-password";
}) {
  const id = autoComplete === "new-password" ? "signup" : "signin";
  return (
    <form action={action} className="panel" style={{ display: "grid", gap: "var(--space-3)" }}>
      <h2 style={{ fontSize: "1.1rem" }}>{title}</h2>
      <input type="hidden" name="next" value={next} />
      <label htmlFor={`${id}-email`}>Email</label>
      <input id={`${id}-email`} name="email" type="email" autoComplete="email" required />
      <label htmlFor={`${id}-password`}>Password</label>
      <input
        id={`${id}-password`}
        name="password"
        type="password"
        autoComplete={autoComplete}
        minLength={autoComplete === "new-password" ? 10 : undefined}
        required
      />
      <button type="submit">
        {autoComplete === "new-password" ? "Create account" : "Sign in"}
      </button>
    </form>
  );
}
