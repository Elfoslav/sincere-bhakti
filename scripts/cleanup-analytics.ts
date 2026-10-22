import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { cleanupExpiredAnalyticsReceipts } from "../src/lib/services/analytics";

async function main() {
  let total = 0;
  let removed: number;
  do {
    removed = await cleanupExpiredAnalyticsReceipts();
    total += removed;
  } while (removed > 0);
  console.log(`Removed ${total} expired analytics receipts.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
