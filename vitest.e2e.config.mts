import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// End-to-end tests: HTTP requests against a running production build backed
// by a real (local or CI) Supabase database. Run with `npm run test:public-flow`,
// which builds and starts the app and supplies the connection details.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.e2e.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
