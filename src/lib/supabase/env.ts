// Public Supabase connection settings. Both values are safe to expose to the
// browser: the publishable key only grants what RLS policies allow.
// Secret keys (service role) must never be read here or in any client code.
export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
        "Copy .env.example to .env.local and fill them in (see README).",
    );
  }

  return { url, publishableKey };
}
