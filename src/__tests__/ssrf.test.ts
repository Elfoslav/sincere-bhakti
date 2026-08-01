import { describe, it, expect } from "vitest";
import { isPrivateIp, resolvesToPrivateIp, assertPublicHost } from "@/lib/ssrf";

const lookup = (addresses: Array<{ address: string; family: number }> | Error) =>
  async () => {
    if (addresses instanceof Error) throw addresses;
    return addresses;
  };

describe("isPrivateIp", () => {
  it("flags loopback v4", () => {
    expect(isPrivateIp("127.0.0.1")).toBe(true);
  });

  it("flags RFC1918 ranges", () => {
    expect(isPrivateIp("10.0.0.1")).toBe(true);
    expect(isPrivateIp("172.16.0.1")).toBe(true);
    expect(isPrivateIp("172.31.255.255")).toBe(true);
    expect(isPrivateIp("192.168.1.1")).toBe(true);
  });

  it("does not flag public v4", () => {
    expect(isPrivateIp("8.8.8.8")).toBe(false);
    expect(isPrivateIp("1.1.1.1")).toBe(false);
    expect(isPrivateIp("203.0.113.10")).toBe(false);
  });

  it("flags cloud metadata and link-local", () => {
    expect(isPrivateIp("169.254.169.254")).toBe(true);
    expect(isPrivateIp("169.254.0.1")).toBe(true);
  });

  it("flags loopback and link-local v6", () => {
    expect(isPrivateIp("::1")).toBe(true);
    expect(isPrivateIp("fe80::1")).toBe(true);
  });

  it("flags v4-mapped private v6", () => {
    expect(isPrivateIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateIp("::ffff:192.168.0.1")).toBe(true);
  });

  it("does not flag public v6", () => {
    expect(isPrivateIp("2606:4700:4700::1111")).toBe(false);
  });

  it("flags invalid addresses as unsafe", () => {
    expect(isPrivateIp("not-an-ip")).toBe(true);
  });
});

describe("resolvesToPrivateIp", () => {
  it("returns false for a public host", async () => {
    const lookupFn = lookup([{ address: "8.8.8.8", family: 4 }]);
    expect(await resolvesToPrivateIp("example.com", lookupFn)).toBe(false);
  });

  it("returns true when any address is private", async () => {
    const lookupFn = lookup([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ]);
    expect(await resolvesToPrivateIp("example.com", lookupFn)).toBe(true);
  });

  it("fails closed on lookup error", async () => {
    const lookupFn = lookup(new Error("ENOTFOUND"));
    expect(await resolvesToPrivateIp("nope.invalid", lookupFn)).toBe(true);
  });

  it("fails closed when no records are returned", async () => {
    const lookupFn = lookup([]);
    expect(await resolvesToPrivateIp("example.com", lookupFn)).toBe(true);
  });
});

describe("assertPublicHost", () => {
  it("resolves public hostnames without throwing", async () => {
    const lookupFn = lookup([{ address: "93.184.216.34", family: 4 }]);
    await expect(assertPublicHost("https://example.com/x", lookupFn)).resolves.toBeUndefined();
  });

  it("throws for private hostnames", async () => {
    const lookupFn = lookup([{ address: "127.0.0.1", family: 4 }]);
    await expect(assertPublicHost("https://localhost:3000", lookupFn)).rejects.toThrow();
  });
});
