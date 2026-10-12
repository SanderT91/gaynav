import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { getSupabaseEnv } from "./env";

// Supabase client for Server Components, Server Actions and Route Handlers.
// Acts as the signed-in user (their session cookie), so every query is subject
// to RLS exactly like a browser request would be.
//
// Create a new client per request — never share one across requests.
export async function createClient() {
  // Mark everything that uses this client as request-time work. A session is
  // per-request by definition, and supabase-js reads the clock (token expiry),
  // which Next.js must not bake into a prerendered page.
  await connection();
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabaseEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components can't write cookies. That's fine: the proxy
          // (src/proxy.ts) refreshes the session cookie on every request.
        }
      },
    },
  });
}
