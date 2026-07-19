import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { Pool } from "pg";

export const TEST_PASSWORD = "testpassword123";

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
if (!TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL is required for database-backed e2e tests");
}

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

function slugifyName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "channel";
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function uniqueE2EEmail(label: string) {
  return `e2e-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
}

export async function cleanupUsersByEmail(emails: string[]) {
  if (emails.length === 0) return;

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;

  const channels = await prisma.channel.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const channelIds = channels.map((channel) => channel.id);

  await prisma.media.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.pendingUpload.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.channelEditor.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds } },
        ...(channelIds.length ? [{ channelId: { in: channelIds } }] : []),
      ],
    },
  });
  if (channelIds.length > 0) {
    await prisma.post.deleteMany({ where: { channelId: { in: channelIds } } });
    await prisma.channelSlugHistory.deleteMany({ where: { channelId: { in: channelIds } } });
    await prisma.channel.deleteMany({ where: { id: { in: channelIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

export async function createUserWithPersonalChannel({
  name,
  email,
  password = TEST_PASSWORD,
}: {
  name: string;
  email: string;
  password?: string;
}) {
  await cleanupUsersByEmail([email]);

  const hashedPassword = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });
  const channel = await prisma.channel.create({
    data: {
      name,
      normalizedName: normalizeName(name),
      slug: slugifyName(name),
      ownerId: user.id,
      isPersonal: true,
    },
  });

  return { user, channel };
}

export async function loginViaUi(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.getByPlaceholder("your@email.com").fill(email);
  await page.getByPlaceholder("••••••••").fill(password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await page.waitForURL("**/posts");
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

export async function clearSession(page: Page) {
  await page.context().clearCookies();
}

export async function createPostForChannel({
  channelId,
  content,
  isPublic = true,
  language = "en",
}: {
  channelId: string;
  content: string;
  isPublic?: boolean;
  language?: "en" | "cs" | "sk";
}) {
  return prisma.post.create({
    data: {
      channelId,
      content,
      isPublic,
      language,
    },
    select: { id: true },
  });
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
  await pool.end();
}
