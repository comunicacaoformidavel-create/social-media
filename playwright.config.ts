import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

const port = 3101;
const dataDir = `/tmp/compasso-e2e-${process.pid}-${Date.now()}`;
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./tests",
  testMatch: "app.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: "list",
  outputDir: "/tmp/compasso-e2e-artifacts",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    viewport: { width: 1440, height: 1000 },
    locale: "pt-BR",
    timezoneId: "Etc/GMT+3",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 10_000,
    launchOptions: { executablePath },
  },
  webServer: {
    command: "npm run build && node server/index.mjs",
    env: { PORT: String(port), DATA_DIR: dataDir, COMPASSO_DEMO: "true" },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
