import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: app code against a real (local or CI) Supabase database.
// Run with `npm run test:integration`, which supplies the connection details.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    // One shared database: run files one after another.
    fileParallelism: false,
  },
});
