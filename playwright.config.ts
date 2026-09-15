import { defineConfig, devices } from "@playwright/test";

const CI = process.env.CI !== undefined;

/** Where the test API listens; `KIPPU_API_PORT` moves it off a port in use locally. */
const apiPort = process.env.KIPPU_API_PORT ?? "8080";
const apiUrl = `http://127.0.0.1:${apiPort}`;

/**
 * End-to-end tests drive Ichiba's production build, served by `next start`, in
 * Chromium, against the real kippu-api at the commit Ichiba's `@kippu/api` types
 * were vendored from (`tools/test-api.sh`).
 */
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "tools/test-api.sh",
      url: `${apiUrl}/health`,
      reuseExistingServer: !CI,
      timeout: 300_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: "pnpm build && pnpm start",
      env: { KIPPU_API_URL: apiUrl },
      url: "http://localhost:3000/health",
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
});
