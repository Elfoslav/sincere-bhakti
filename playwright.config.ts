import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

const TEST_PORT = 3099;
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: "list",
  timeout: 30_000,

  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
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
      SINCERE_BHAKTI_EMAIL: "test@example.com",
      SINCERE_BHAKTI_PASSWORD: "testpassword",
      SINCERE_BHAKTI_NAME: "Test User",
      NEXT_PUBLIC_SENTRY_DSN: "",
      SENTRY_DSN: "",
      SENTRY_AUTH_TOKEN: "",
    },
  },
});
