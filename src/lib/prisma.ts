import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Serverless-friendly pool sizing: each Vercel lambda instance gets its own
// pool, so the default (max 10) multiplies fast under concurrency and can
// exhaust Postgres connections. A small per-instance pool with a short idle
// timeout keeps total connections bounded.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.NODE_ENV === "production" ? 3 : 10,
  idleTimeoutMillis: 30_000,
});
const adapter = new PrismaPg(pool);

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
