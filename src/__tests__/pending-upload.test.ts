import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    pendingUpload: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { prisma } from "@/lib/prisma";
import { deletePendingUploads } from "@/lib/pending-upload";

describe("deletePendingUploads", () => {
  const OLD_ENV = process.env.R2_PUBLIC_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.R2_PUBLIC_URL = "https://cdn.example.com";
  });

  afterEach(() => {
    if (OLD_ENV === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = OLD_ENV;
  });

  it("deletes pending claims for storage URLs", async () => {
    await deletePendingUploads(["https://cdn.example.com/uploads/a.jpg"]);

    expect(prisma.pendingUpload.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: ["uploads/a.jpg"] } },
    });
  });

  it("ignores foreign URLs", async () => {
    await deletePendingUploads(["https://evil.example/x.jpg"]);

    expect(prisma.pendingUpload.deleteMany).not.toHaveBeenCalled();
  });

  it("does nothing without a storage domain (fail closed elsewhere)", async () => {
    delete process.env.R2_PUBLIC_URL;

    await deletePendingUploads(["https://cdn.example.com/uploads/a.jpg"]);

    expect(prisma.pendingUpload.deleteMany).not.toHaveBeenCalled();
  });
});
