// Runs the public-flow test: builds the app against the running local
// Supabase stack (or the throwaway one in CI), starts it, and checks the
// anonymous visitor's journey over HTTP. Reads connection details from
// `supabase status`, so no keys are stored anywhere.
//
// The build goes to .next/public-flow, so your normal build is untouched,
// and is deleted afterwards: its generated route types are picked up by
// tsconfig.json and would break `npm run typecheck` after a branch switch.
//
//   npm run test:public-flow
import { execSync, spawn, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";

const PORT = 3100;
const DIST_DIR = ".next/public-flow";
const cleanUp = () => rmSync(DIST_DIR, { recursive: true, force: true });
const shell = process.platform === "win32";

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

const publishableKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
const env = {
  ...process.env,
  GAYNAV_DIST_DIR: DIST_DIR,
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
};

cleanUp();
console.log("Building the app against the local database…");
const build = spawnSync("npx", ["next", "build"], { stdio: "inherit", shell, env });
if (build.status !== 0) {
  cleanUp();
  process.exit(build.status ?? 1);
}

const server = spawn("npx", ["next", "start", "-p", String(PORT)], {
  stdio: ["ignore", "inherit", "inherit"],
  shell,
  env,
});
const stop = () => {
  if (shell) spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else server.kill();
  cleanUp();
};

const base = `http://localhost:${PORT}`;
let ready = false;
for (let i = 0; i < 60 && !ready; i++) {
  try {
    ready = (await fetch(base)).ok;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}
if (!ready) {
  console.error("The app didn't start.");
  stop();
  process.exit(1);
}

const result = spawnSync("npx", ["vitest", "run", "--config", "vitest.e2e.config.mts"], {
  stdio: "inherit",
  shell,
  env: {
    ...process.env,
    PUBLIC_FLOW_BASE_URL: base,
    SUPABASE_TEST_URL: status.API_URL,
    SUPABASE_TEST_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_TEST_SECRET_KEY: status.SECRET_KEY ?? status.SERVICE_ROLE_KEY,
  },
});
stop();
process.exit(result.status ?? 1);
