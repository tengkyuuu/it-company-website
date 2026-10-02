import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// forward slashes: Vite wants posix-style ids even on Windows
const root = path.dirname(fileURLToPath(import.meta.url)).split(path.sep).join("/");

/**
 * Standalone from next.config.mjs on purpose: the test runner has no business
 * booting Next. Tests target derived logic, data integrity and the database
 * contract (supabase/schema.sql run inside PGlite) — not rendering.
 */
export default defineConfig({
  resolve: {
    alias: [
      // same as tsconfig.json "paths": { "@/*": ["./*"] }. A regex, so it can
      // never swallow a scoped package like "@electric-sql/pglite".
      { find: /^@\//, replacement: `${root}/` },
      // `server-only` isn't a real package here — Next resolves it internally
      // (empty under react-server, throws elsewhere). Under Vitest there is no
      // React Server bundle, so treat it as the no-op it is on the server.
      { find: /^server-only$/, replacement: `${root}/tests/helpers/empty.ts` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    // every DB suite holds a ~400 MB WASM Postgres; unbounded parallelism
    // OOMs a dev laptop that is also running `next dev`
    maxWorkers: process.env.CI ? undefined : 2,
    // each DB suite boots its own PGlite (WASM Postgres) and applies the
    // schema twice — a few seconds on a cold machine, more under OneDrive
    hookTimeout: 120_000,
    testTimeout: 60_000,
  },
});
