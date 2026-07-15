import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit, getClientIp, RATE_LIMITS, RATE_LIMIT_PREFIX } from "./rate-limit";
import { createPersonalChannel, getPersonalChannel } from "@/lib/services/channel";

export const authConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) return null;

        const ip = req?.headers ? getClientIp(req.headers) : "unknown";
        if (!await checkRateLimit(RATE_LIMIT_PREFIX.login, ip, RATE_LIMITS.login.limit, RATE_LIMITS.login.windowMs)) return null;

        const email = (credentials.email as string).trim().toLowerCase();
        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, image: true, password: true, sessionVersion: true },
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
          sessionVersion: user.sessionVersion,
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
        token.sessionVersion = user.sessionVersion ?? 0;

        let channel = await getPersonalChannel(user.id!);
        if (!channel) {
          channel = await createPersonalChannel(user.id!, user.name ?? "User");
        }
        token.channelId = channel.id;
        return token;
      }

      if (!token.id) {
        return token;
      }

      const current = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { sessionVersion: true },
      });

      if (!current || token.sessionVersion !== current.sessionVersion) {
        return null;
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
} satisfies NextAuthConfig;

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);
