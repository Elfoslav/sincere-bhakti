import "dotenv/config";
import { spawnSync } from "node:child_process";

if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is required for pnpm test:web:e2e");
  process.exit(1);
}

const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(command, ["exec", "prisma", "migrate", "deploy"], {
  env: {
    ...process.env,
    DATABASE_URL: process.env.TEST_DATABASE_URL,
  },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
