import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { rateLimit, rateLimitKey, RATE_LIMITS } from "./rate-limit";
import { createPersonalChannel, getPersonalChannel } from "@/lib/services/channel";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip =
          req?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";

        const { allowed } = await rateLimit(rateLimitKey("login", ip), RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs);
        if (!allowed) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.email = user.email!;

        let channel = await getPersonalChannel(user.id!);
        if (!channel) {
          channel = await createPersonalChannel(user.id!, user.name ?? "User");
        }
        token.channelId = channel.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.channelId = token.channelId as string;
      }
      return session;
    },
  },
});
