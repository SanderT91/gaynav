// Checks over HTTP that internal database objects are NOT reachable through
// Supabase's Data API — something the pgTAP tests can't see, because which
// schemas the API serves is API configuration (supabase/config.toml
// [api].schemas), not database state.
//
// Usage (local stack running): node scripts/check-api-exposure.mjs
// Reads the local API URL and publishable key from `supabase status`.
import { execSync } from "node:child_process";

const status = JSON.parse(
  execSync("npx supabase status -o json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const api = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

// Each of these must answer "not found" — the API must not know they exist.
const mustBeHidden = [
  { what: "private.is_staff_with_mfa()", method: "POST", path: "/rest/v1/rpc/is_staff_with_mfa" },
  { what: "admin.set_user_role()", method: "POST", path: "/rest/v1/rpc/set_user_role" },
  { what: "admin.reset_user_mfa()", method: "POST", path: "/rest/v1/rpc/reset_user_mfa" },
  { what: "admin.role_changes", method: "GET", path: "/rest/v1/role_changes" },
  { what: "admin.mfa_resets", method: "GET", path: "/rest/v1/mfa_resets" },
];

let failed = false;
for (const check of mustBeHidden) {
  const res = await fetch(api + check.path, {
    method: check.method,
    headers,
    body: check.method === "POST" ? "{}" : undefined,
  });
  const ok = res.status === 404;
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${check.what} -> HTTP ${res.status}`);
}

// Sanity check that the API itself is up, so "404" really means "hidden".
const pub = await fetch(`${api}/rest/v1/approved_properties?select=hid`, { headers });
console.log(
  `${pub.ok ? "ok  " : "FAIL"} public approved_properties reachable -> HTTP ${pub.status}`,
);
if (!pub.ok) failed = true;

process.exitCode = failed ? 1 : 0;
