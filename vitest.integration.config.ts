import { defineConfig } from "vitest/config";
import path from "path";

// Integration tests live under test/ and run against real Notes.app.
// They are NOT part of the default `npm test` (unit) run — invoke them
// explicitly with `npm run test:integration` (or `npm run test:all`).
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Live AppleScript calls are synchronous and can block the worker longer
    // than Vitest's fork RPC update deadline. A single thread keeps the live
    // suite in-process and avoids a false unhandled-worker-timeout after the
    // tests themselves have completed.
    pool: "threads",
    poolOptions: {
      threads: { singleThread: true },
    },
    testTimeout: 120_000,
    // vitest 3 enforces a separate hookTimeout (default 10s). The integration
    // suite's beforeAll probes Notes.app via AppleScript, which hangs ~25s on a
    // headless CI runner (no Notes account) before erroring and self-skipping —
    // so the hook needs the same generous budget as the tests.
    hookTimeout: 120_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
