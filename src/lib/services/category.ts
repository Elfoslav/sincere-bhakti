import { prisma } from "@/lib/prisma";
import { deriveCategorySlug, normalizeCategoryName } from "@/lib/validation";
import type { CategoryRef } from "@/types/category";
import type { Prisma } from "@prisma/client";

type DbClient = Prisma.TransactionClient | typeof prisma;

// Bounded retries when distinct names slugify alike ("Holy-Name" vs "Holy
// Name" → holy-name, holy-name-2, ...).
const MAX_SLUG_ATTEMPTS = 10;

/**
 * Normalize raw user input to canonical category names (Title Case,
 * whitespace-collapsed) and drop empties/duplicates. Zod already does this
 * for validated write paths; the search route and any unvalidated callers
 * go through here so every entry point canonicalizes identically.
 */
export function canonicalizeCategoryNames(names: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of names) {
    const name = normalizeCategoryName(raw);
    if (name) seen.add(name);
  }
  return [...seen];
}

export interface SearchCategoriesParams {
  search?: string;
  limit: number;
  // Scope suggestions to one language (the picker's locale). Omitted = all
  // languages, used only by language-agnostic tooling.
  language?: string;
}

/**
 * Prefix search over canonical names for the picker combobox. Empty search
 * returns the alphabetical head of the taxonomy.
 */
export async function searchCategories(params: SearchCategoriesParams): Promise<CategoryRef[]> {
  const { search, limit, language } = params;
  const prefix = search?.trim() ? normalizeCategoryName(search) : undefined;
  return prisma.category.findMany({
    where: {
      ...(language ? { language } : {}),
      ...(prefix ? { name: { startsWith: prefix } } : {}),
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true, slug: true, language: true },
  });
}

/**
 * Look up one category by its URL slug within a language. The slug is
 * re-derived from raw input so mixed-case URLs still resolve.
 */
export async function getCategoryBySlug(language: string, slug: string): Promise<CategoryRef | null> {
  return prisma.category.findUnique({
    where: { language_slug: { language, slug: deriveCategorySlug(slug) } },
    select: { id: true, name: true, slug: true, language: true },
  });
}

/**
 * Look up one category by its display name within a language (resolves the
 * `?category=` filter to its canonical landing page).
 */
export async function getCategoryByName(language: string, name: string): Promise<CategoryRef | null> {
  const canonical = normalizeCategoryName(name);
  if (!canonical) return null;
  return prisma.category.findUnique({
    where: { language_name: { language, name: canonical } },
    select: { id: true, name: true, slug: true, language: true },
  });
}

/**
 * Get-or-create categories for canonical names within one language.
 * Postgres ON CONFLICT makes each upsert atomic, so concurrent creators of
 * the same name converge on one row without advisory locks (unlike channel
 * names, ownership here is a single composite unique key). Runs on the
 * caller's transaction client so post / blog writes stay atomic with their
 * category links. Distinct names that slugify alike get a numeric suffix
 * (holy-name, holy-name-2, ...) instead of failing.
 */
export async function resolveCategoryIds(
  client: DbClient,
  names: string[],
  language: string,
): Promise<string[]> {
  const canonical = canonicalizeCategoryNames(names);
  if (canonical.length === 0) return [];
  return Promise.all(canonical.map((name) => upsertCategory(client, language, name)));
}

async function upsertCategory(client: DbClient, language: string, name: string): Promise<string> {
  const base = deriveCategorySlug(name);
  for (let attempt = 0; ; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const row = await client.category.upsert({
        where: { language_name: { language, name } },
        update: {},
        create: { name, slug, language },
        select: { id: true },
      });
      return row.id;
    } catch (error) {
      // Same name raced us: the upsert arbiter only covers language_name, so
      // a sibling unique key (language_slug, taken by a different name that
      // slugifies alike) surfaces as P2002 — retry with the next suffix.
      const target = (error as { code?: string; meta?: { target?: string[] | string } });
      const targetsSlug =
        target?.code === "P2002" &&
        (Array.isArray(target.meta?.target)
          ? target.meta.target.includes("slug")
          : typeof target.meta?.target === "string" && target.meta.target.includes("slug"));
      if (targetsSlug && attempt + 1 < MAX_SLUG_ATTEMPTS) continue;
      // Lost the name race after all (or exhausted suffixes): read the
      // winner when it exists, otherwise surface the original error.
      if (target?.code === "P2002") {
        const winner = await client.category.findUnique({
          where: { language_name: { language, name } },
          select: { id: true },
        });
        if (winner) return winner.id;
      }
      throw error;
    }
  }
}

/**
 * Replace a timeline post's category links (create passes an empty current
 * set implicitly — deleteMany on nothing is a no-op).
 */
export async function setPostCategories(client: DbClient, postId: string, categoryIds: string[]): Promise<void> {
  await client.postCategory.deleteMany({ where: { postId } });
  if (categoryIds.length === 0) return;
  await client.postCategory.createMany({
    data: categoryIds.map((categoryId) => ({ postId, categoryId })),
    skipDuplicates: true,
  });
}

/**
 * Replace a blog article's category links (same replace semantics as posts).
 */
export async function setBlogPostCategories(
  client: DbClient,
  blogPostId: string,
  categoryIds: string[],
): Promise<void> {
  await client.blogPostCategory.deleteMany({ where: { blogPostId } });
  if (categoryIds.length === 0) return;
  await client.blogPostCategory.createMany({
    data: categoryIds.map((categoryId) => ({ blogPostId, categoryId })),
    skipDuplicates: true,
  });
}
