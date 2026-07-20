import { cache } from "react";
import { prisma } from "@/lib/prisma";

export async function getPublicUserById(id: string): Promise<{
  id: string;
  name: string;
  image: string | null;
  createdAt: Date;
} | null> {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      image: true,
      createdAt: true,
    },
  });
}

export const getCachedPublicUserById = cache(getPublicUserById);
