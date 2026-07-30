import crypto from "crypto";
import { prisma } from "@/lib/prisma";

// Token lifetimes, centralized so every flow uses the same policy.
export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type VerificationTokenType = "verify" | "reset";

export function generateVerificationTokenValue(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create-or-replace the single active token for (email, type) and return its
 * value. The `(email, type)` unique index means only one active token exists
 * per flow; `upsert` normally handles that, but two concurrent requests can
 * both take the CREATE branch and one loses with P2002 — so we retry that case
 * as an UPDATE, guaranteeing the token we return is the one persisted (never a
 * dead token, never a bubbled 500).
 */
export async function issueVerificationToken(
  email: string,
  type: VerificationTokenType,
  ttlMs: number,
): Promise<string> {
  const token = generateVerificationTokenValue();
  const expiresAt = new Date(Date.now() + ttlMs);

  try {
    await prisma.verificationToken.upsert({
      where: { email_type: { email, type } },
      create: { email, token, type, expiresAt },
      update: { token, expiresAt },
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      // A concurrent request won the insert; the row now exists → update it.
      await prisma.verificationToken.update({
        where: { email_type: { email, type } },
        data: { token, expiresAt },
      });
    } else {
      throw error;
    }
  }

  return token;
}
