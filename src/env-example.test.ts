import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Keeps .env.example honest: every environment variable the code reads must be
// documented there, and every variable documented there must actually be used.
// Without this, .env.example silently drifts and a new developer (or a new
// Vercel environment) ends up missing a variable at runtime.

const ROOT = join(__dirname, "..");
const SCAN_DIRS = ["src", "scripts"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mjs|js)$/.test(name) && !name.includes(".test.") ? [path] : [];
  });
}

function variablesReadByCode(): Set<string> {
  const found = new Set<string>();
  for (const file of SCAN_DIRS.flatMap((dir) => sourceFiles(join(ROOT, dir)))) {
    for (const match of readFileSync(file, "utf8").matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      found.add(match[1]);
    }
  }
  // Set by Node, Next.js or Vercel themselves, not by us.
  for (const builtIn of [
    "NODE_ENV",
    "NEXT_RUNTIME",
    "VERCEL_ENV",
    "VERCEL_PROJECT_PRODUCTION_URL",
    "CI",
  ])
    found.delete(builtIn);
  // Set by our own test runners (scripts/run-*-test*.mjs), never by a developer.
  for (const testOnly of [
    "SUPABASE_TEST_URL",
    "SUPABASE_TEST_PUBLISHABLE_KEY",
    "SUPABASE_TEST_SECRET_KEY",
    "PUBLIC_FLOW_BASE_URL",
  ])
    found.delete(testOnly);
  return found;
}

function variablesInEnvExample(): Set<string> {
  const text = readFileSync(join(ROOT, ".env.example"), "utf8");
  // Only active `NAME=` lines count; commented-out future variables don't.
  return new Set([...text.matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1]));
}

describe(".env.example", () => {
  const used = variablesReadByCode();
  const documented = variablesInEnvExample();

  it("documents every environment variable the code reads", () => {
    expect([...used].filter((name) => !documented.has(name))).toEqual([]);
  });

  it("lists no variables that nothing reads", () => {
    expect([...documented].filter((name) => !used.has(name))).toEqual([]);
  });

  it("contains no values, only names", () => {
    const text = readFileSync(join(ROOT, ".env.example"), "utf8");
    expect(text.match(/^[A-Z0-9_]+=.+$/gm) ?? []).toEqual([]);
  });

  it("never exposes a secret through a NEXT_PUBLIC_ variable", () => {
    const leaky = [...documented].filter(
      (name) => name.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|PRIVATE/.test(name),
    );
    expect(leaky).toEqual([]);
  });
});
