// Runs the integration tests against the running local Supabase stack (or
// the throwaway one in CI). Reads its connection details from
// `supabase status`, so no keys are stored anywhere.
//
//   npm run test:integration
import { execSync, spawnSync } from "node:child_process";

let status;
try {
  status = JSON.parse(
    execSync("npx supabase status -o json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }),
  );
} catch {
  console.error("Supabase isn't running. Start it with `npm run db:start` first.");
  process.exit(1);
}

const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.integration.config.mts"], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY ?? status.ANON_KEY,
    SUPABASE_TEST_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  },
});
process.exitCode = result.status ?? 1;
