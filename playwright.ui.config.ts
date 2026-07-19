import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const TEST_PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3099);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${TEST_PORT}`;
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 30_000,

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
