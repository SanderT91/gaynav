import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for app logic (TypeScript). Database rules are tested separately
// with pgTAP (`npm run db:test`).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Integration tests need a database: npm run test:integration.
    exclude: ["src/**/*.integration.test.ts", "node_modules/**"],
    environment: "node",
  },
});
