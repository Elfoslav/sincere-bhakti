import "next-auth";

declare module "next-auth" {
  interface User {
    sessionVersion?: number;
  }

  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      channelId?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    channelId?: string;
    sessionVersion?: number;
  }
}
