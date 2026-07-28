import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const TEST_PORT = Number(process.env.PLAYWRIGHT_E2E_PORT ?? 3109);
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${TEST_PORT}`;
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === "1";

if (!TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for pnpm test:web:e2e");
}

export default defineConfig({
  testDir: "./e2e-real",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  // Runs against `next dev`, so the first test pays the cold-compile cost of every
  // route it touches (login + post pages ≈ 55–60s observed). 45s was too tight and
  // flaked whichever test happened to run first; 90s clears cold compilation with margin.
  timeout: 90_000,

  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: useExistingServer ? undefined : {
    command: `pnpm exec next dev --hostname localhost --port ${TEST_PORT}`,
    port: TEST_PORT,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PORT: String(TEST_PORT),
      DATABASE_URL: TEST_DATABASE_URL,
      NEXTAUTH_SECRET: "sincere-bhakti-test-secret",
      NEXTAUTH_URL: `http://localhost:${TEST_PORT}`,
      R2_ENDPOINT: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
      R2_BUCKET: "",
      R2_PUBLIC_URL: "",
      SINCERE_BHAKTI_EMAIL: "",
      SINCERE_BHAKTI_PASSWORD: "",
      SINCERE_BHAKTI_NAME: "",
      NEXT_PUBLIC_SENTRY_DSN: "",
      SENTRY_DSN: "",
      SENTRY_AUTH_TOKEN: "",
    },
  },
});
