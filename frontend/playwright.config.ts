import { defineConfig } from "@playwright/test"

// Smoke tests run against a live stack: backend (start_services.ps1) + `npm run dev`.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
  },
})
