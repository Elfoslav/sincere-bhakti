import { expect, test } from "@playwright/test";
import { cleanupUsersByEmail, prisma } from "./helpers";

// Normalize like the app does. Test names are ASCII, so this is just
// trim + lowercase + whitespace-collapse (no diacritics to fold).
function normalize(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Real-DB concurrency guard for the global "one name = one channel across ALL
// languages" ownership rule. The DB only enforces per-language uniqueness, so
// without the advisory lock in `claimChannelName` two concurrent registrations
// of the same name in DIFFERENT languages would both pass the read-before-write
// check and both create a channel. This test fires that exact race against the
// real server + Postgres and asserts exactly one registration wins.
test("concurrent same-name registrations across languages yield exactly one owner", async ({ request, baseURL }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const name = `Race Channel ${suffix}`;
  const warmupEmail = `race-warmup-${suffix}@example.test`;
  // Same name, different languages (and a couple of repeats) fired at once.
  const langs = ["en", "cs", "sk", "en", "cs", "sk"] as const;
  const emails = langs.map((lang, i) => `race-${lang}-${i}-${suffix}@example.test`);
  // register enforces CSRF (validateOrigin), so a same-origin Origin header is required.
  const headers = { Origin: baseURL ?? "" };

  await cleanupUsersByEmail([warmupEmail, ...emails]);

  try {
    // Warm the /api/register route so cold compilation doesn't serialize the
    // batch — we want the requests to genuinely contend at the DB.
    const warm = await request.post("/api/register", {
      headers,
      data: { name: `Warmup ${suffix}`, email: warmupEmail, password: "secret123", terms: true, language: "en" },
    });
    expect(warm.status()).toBe(201);

    const responses = await Promise.all(
      langs.map((language, i) =>
        request.post("/api/register", {
          headers,
          data: { name, email: emails[i], password: "secret123", terms: true, language },
        }),
      ),
    );
    const statuses = responses.map((r) => r.status());
    const created = statuses.filter((s) => s === 201).length;
    const conflicts = statuses.filter((s) => s === 409).length;

    // Exactly one may claim the name across ALL languages; the rest get 409.
    expect(created).toBe(1);
    expect(conflicts).toBe(langs.length - 1);

    // The DB agrees: the normalized name is owned by exactly one channel.
    const owners = await prisma.channelTranslation.findMany({
      where: { normalizedName: normalize(name) },
      select: { channelId: true },
      distinct: ["channelId"],
    });
    expect(owners).toHaveLength(1);
  } finally {
    await cleanupUsersByEmail([warmupEmail, ...emails]);
  }
});
