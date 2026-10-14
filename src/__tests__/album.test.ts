import { describe, it, expect } from "vitest";
import { isAlbumManager } from "@/lib/album";

describe("isAlbumManager", () => {
  const album = { channel: { id: "channel-1", ownerId: "user-1" } };

  it("returns true for the channel owner", () => {
    expect(isAlbumManager(album, "user-1", [])).toBe(true);
  });

  it("returns true for a manageable channel identity", () => {
    expect(isAlbumManager(album, "user-2", ["channel-1"])).toBe(true);
  });

  it("returns false for strangers", () => {
    expect(isAlbumManager(album, "user-2", ["channel-9"])).toBe(false);
  });

  it("returns false when unauthenticated", () => {
    expect(isAlbumManager(album, undefined, [])).toBe(false);
  });
});
