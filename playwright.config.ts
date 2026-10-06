import { defineConfig, devices } from "@playwright/test";
import { basePath } from "./e2e/helpers";

const PORT = 4400;

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL: `http://localhost:${PORT}${basePath}`, trace: "retain-on-failure" },
  webServer: {
    command: `pnpm build && pnpm astro preview --port ${PORT} --ignore-lock`,
    url: `http://localhost:${PORT}${basePath}`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
