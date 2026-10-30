import { expect, test } from "./fixtures";
import { cleanupUsersByEmail, createUserWithChannel, prisma, TEST_PASSWORD, uniqueE2EEmail } from "./helpers";

test("album feeds and legacy links preserve private visibility", async ({ page, request }) => {
  // Cold compilation of both album API and SSR routes is expensive in next dev.
  test.setTimeout(180_000);
  const email = uniqueE2EEmail("album-access");
  const { user, channel } = await createUserWithChannel({ name: `Album Author ${Date.now()}`, email });
  try {
    const albums = await Promise.all([true, false].map((isPublic) => prisma.album.create({ data: {
      shortId: isPublic ? "e2ealb01" : "e2ealb02", title: isPublic ? "Public Album" : "Private Album",
      slug: isPublic ? "public-album" : "private-album", description: "Album access test", isPublic,
      channelId: channel.id,
    } })));
    const [publicAlbum, privateAlbum] = albums;
    const feed = await request.get(`/api/albums?scope=public&channelId=${channel.id}`);
    expect(feed.status()).toBe(200);
    const body = await feed.json();
    expect(body.posts.map((album: { id: string }) => album.id)).toEqual([publicAlbum.id]);
    expect((await request.get(`/api/albums/${publicAlbum.id}`)).status()).toBe(200);
    expect((await request.get(`/api/albums/${privateAlbum.id}`)).status()).toBe(404);
    // Streaming pages may return 200 with a not-found boundary. Neither the
    // headers nor the body may disclose the private title/slug through a redirect.
    const legacy = await request.get(`/gallery/${privateAlbum.id}`, { maxRedirects: 0 });
    expect(legacy.headers().location ?? "").not.toContain(privateAlbum.slug!);
    const html = await legacy.text();
    expect(html).not.toContain("Private Album");
    expect(html).not.toContain(`/gallery/${privateAlbum.shortId}/${privateAlbum.slug}`);

    // Authenticate through the real credentials endpoint; the login UI has
    // separate coverage and would add unrelated cold route compilations here.
    const csrf = await page.request.get("/api/auth/csrf");
    const { csrfToken } = await csrf.json();
    const signIn = await page.request.post("/api/auth/callback/credentials", {
      form: { csrfToken, email, password: TEST_PASSWORD, callbackUrl: "/gallery" },
      headers: { "X-Auth-Return-Redirect": "1" },
    });
    expect(signIn.status()).toBe(200);
    const session = await page.request.get("/api/auth/session");
    expect((await session.json()).user.id).toBe(user.id);
    const owned = await page.request.get(`/api/albums?scope=private&channelId=${channel.id}`);
    expect(owned.status()).toBe(200);
    expect((await owned.json()).posts.map((album: { id: string }) => album.id)).toEqual([privateAlbum.id]);
    await page.goto(`/gallery/${privateAlbum.id}`);
    await expect(page).toHaveURL(new RegExp(`/gallery/${privateAlbum.shortId}/${privateAlbum.slug}`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Private Album" })).toBeVisible({ timeout: 30_000 });
  } finally {
    await page.close();
    await cleanupUsersByEmail([email]);
  }
});
