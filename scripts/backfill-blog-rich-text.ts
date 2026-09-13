/**
 * One-off backfill: convert legacy plain-text blog articles into the editor
 * format (Tiptap JSON in `content` + sanitized HTML in `contentHtml`).
 *
 * Usage:
 *   pnpm blog:backfill            # dry run — prints what would change
 *   pnpm blog:backfill --apply    # writes to the database
 *
 * Rows already in JSON format (or with rendered HTML) are skipped, so the
 * script is safe to re-run. Run it against production after deploy.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { convertLegacyArticle } from "../src/lib/rich-text-html";

const apply = process.argv.includes("--apply");

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const candidates = await prisma.blogPost.findMany({
    where: { contentHtml: null, content: { not: null } },
    select: { id: true, title: true, content: true },
    orderBy: { createdAt: "asc" },
  });

  const convertible = candidates.filter(
    (c): c is typeof c & { content: string } => convertLegacyArticle(c.content) !== null,
  );
  console.log(
    `Found ${candidates.length} article(s) without rendered HTML, ${convertible.length} convertible to the editor format.`,
  );

  if (!apply) {
    for (const c of convertible) {
      console.log(`  would convert ${c.id} "${c.title}"`);
    }
    if (candidates.length - convertible.length > 0) {
      console.log(`  skipping ${candidates.length - convertible.length} non-convertible row(s).`);
    }
    console.log("Dry run — re-run with --apply to write.");
    return;
  }

  for (const c of convertible) {
    const converted = convertLegacyArticle(c.content);
    if (!converted) continue;
    await prisma.blogPost.update({
      where: { id: c.id },
      data: { content: converted.content, contentHtml: converted.contentHtml },
    });
    console.log(`  converted ${c.id} "${c.title}"`);
  }
  console.log(`Done — converted ${convertible.length} article(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
