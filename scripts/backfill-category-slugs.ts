/**
 * One-off repair: recompute Category.slug values with deriveCategorySlug
 * (the same slugifyText helper behind channel and post slugs: NFD fold,
 * lowercase, non-alphanumeric runs to dashes).
 *
 * Background: the initial slug backfill migration derived slugs in SQL
 * without diacritics folding, so names like "Kršna" became "kr-na" instead
 * of "krsna". Application code always derived slugs correctly — only stored
 * rows need repair. Distinct names that slugify alike get a numeric suffix.
 *
 * Usage:
 *   pnpm category:backfill            # dry run — prints what would change
 *   pnpm category:backfill --apply    # writes to the database
 *
 * Rows already carrying the proper slug are skipped, so the script is safe
 * to re-run. Run it against production after deploy.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { deriveCategorySlug } from "../src/lib/validation";

const apply = process.argv.includes("--apply");

async function freeSlug(language: string, base: string, excludeId: string): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.category.findUnique({
      where: { language_slug: { language, slug } },
      select: { id: true },
    });
    if (!taken || taken.id === excludeId) return slug;
  }
  throw new Error(`could not find a free slug for base "${base}" (${language})`);
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const rows = await prisma.category.findMany({
    select: { id: true, name: true, slug: true, language: true },
    orderBy: { createdAt: "asc" },
  });

  const repairs = [] as { id: string; name: string; from: string; to: string; language: string }[];
  for (const row of rows) {
    const proper = deriveCategorySlug(row.name);
    if (row.slug === proper) continue;
    repairs.push({
      id: row.id,
      name: row.name,
      from: row.slug,
      to: await freeSlug(row.language, proper, row.id),
      language: row.language,
    });
  }

  console.log(`Found ${rows.length} categor(ies), ${repairs.length} with wrong slug.`);
  if (!apply) {
    for (const r of repairs) {
      console.log(`  would fix [${r.language}] "${r.name}": "${r.from}" -> "${r.to}"`);
    }
    console.log("Dry run — re-run with --apply to write.");
    return;
  }

  for (const r of repairs) {
    await prisma.category.update({ where: { id: r.id }, data: { slug: r.to } });
    console.log(`  fixed [${r.language}] "${r.name}": "${r.from}" -> "${r.to}"`);
  }
  console.log(`Done — fixed ${repairs.length} categor(ies).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
