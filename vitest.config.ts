import { defineConfig } from "vitest/config";

// Unit tests run on Node, beside the sources they test. What must run in a browser
// runs in the Playwright tests under `e2e/`.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tools/**/*.test.ts"],
    passWithNoTests: true,
  },
});
