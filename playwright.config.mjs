import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests",
  timeout: 60000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { browserName: "chromium", timezoneId: "America/Toronto", serviceWorkers: "block" },
  webServer: { command: "node tests/serve.mjs", url: "http://127.0.0.1:4173/index.html", reuseExistingServer: true }
});
