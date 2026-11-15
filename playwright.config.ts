import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WORKERS = Number(process.env.PW_WORKERS ?? 1);
const OUTPUT_DIR = process.env.PW_OUTPUT ?? "test-results";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  // Each test boots Phaser/WebGL at 1920x1080; parallel workers starve the CPU
  // and turn `page.goto`/`tick` into timeouts on slower machines.
  workers: WORKERS,
  timeout: 60_000,
  outputDir: OUTPUT_DIR,
  // Polls after a level switch may wait for one slow frame.
  expect: { timeout: 10_000 },
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    // --strict makes serve.mjs fail instead of probing the next free port,
    // so Playwright never waits on a URL the server did not take.
    command: `node tools/build.mjs && node tools/serve.mjs build ${PORT} --strict`,
    url: BASE_URL,
    // A stale server from an earlier run can die mid-suite and turn every later
    // `page.goto` into "connection refused"; always start a fresh one.
    reuseExistingServer: false,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
