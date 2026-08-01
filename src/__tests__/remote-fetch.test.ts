import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchRemoteBytes } from "@/lib/remote-fetch";

vi.mock("@/lib/ssrf", () => ({
  assertPublicHost: vi.fn(async () => undefined),
}));

import { assertPublicHost } from "@/lib/ssrf";

function makeResponse({
  ok = true,
  status = 200,
  body,
  headers,
  contentLength,
}: {
  ok?: boolean;
  status?: number;
  body?: Uint8Array;
  headers?: Record<string, string>;
  contentLength?: number | null;
}): Response {
  const h = new Headers(headers ?? {});
  if (contentLength !== undefined) h.set("content-length", String(contentLength));
  return {
    ok,
    status,
    headers: h,
    body: body
      ? {
          getReader: () => {
            const chunks = [body.slice(0, 2), body.slice(2)];
            let i = 0;
            return {
              read: async () => {
                if (i >= chunks.length) return { done: true, value: undefined };
                return { done: false, value: chunks[i++] };
              },
              releaseLock: vi.fn(),
            };
          },
        }
      : null,
  } as unknown as Response;
}

describe("fetchRemoteBytes", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the response body", async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: new TextEncoder().encode("hello world") }));
    const buffer = await fetchRemoteBytes("https://example.com");
    expect(buffer?.toString()).toBe("hello world");
  });

  it("returns null on non-ok status", async () => {
    fetchMock.mockResolvedValue(makeResponse({ status: 500, ok: false }));
    expect(await fetchRemoteBytes("https://example.com")).toBeNull();
  });

  it("returns null when body is missing", async () => {
    fetchMock.mockResolvedValue(makeResponse({}));
    expect(await fetchRemoteBytes("https://example.com")).toBeNull();
  });

  it("returns null when content-length exceeds maxBytes", async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: new Uint8Array(10), contentLength: 11 }));
    expect(await fetchRemoteBytes("https://example.com", { maxBytes: 10 })).toBeNull();
  });

  it("returns null when the stream exceeds maxBytes", async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: new Uint8Array(20) }));
    expect(await fetchRemoteBytes("https://example.com", { maxBytes: 10 })).toBeNull();
  });

  it("returns null on fetch error", async () => {
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await fetchRemoteBytes("https://example.com")).toBeNull();
  });

  it("follows redirects with manual mode up to the cap", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ status: 302, headers: { location: "https://example.com/next" } }))
      .mockResolvedValueOnce(makeResponse({ status: 302, headers: { location: "https://example.com/final" } }))
      .mockResolvedValueOnce(makeResponse({ body: new TextEncoder().encode("done") }));

    const buffer = await fetchRemoteBytes("https://example.com/start", { maxRedirects: 5 });
    expect(buffer?.toString()).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns null past the redirect cap", async () => {
    fetchMock.mockResolvedValue(makeResponse({ status: 302, headers: { location: "https://example.com/loop" } }));
    expect(await fetchRemoteBytes("https://example.com/start", { maxRedirects: 2 })).toBeNull();
  });

  it("returns null when a redirect lacks a location header", async () => {
    fetchMock.mockResolvedValue(makeResponse({ status: 302 }));
    expect(await fetchRemoteBytes("https://example.com/start")).toBeNull();
  });

  it("checks SSRF on the initial host and every redirect hop", async () => {
    vi.mocked(assertPublicHost).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("blocked"));
    fetchMock.mockResolvedValue(makeResponse({ status: 302, headers: { location: "https://internal.corp/x" } }));
    expect(await fetchRemoteBytes("https://example.com/start", { maxRedirects: 5 })).toBeNull();
    expect(assertPublicHost).toHaveBeenCalledTimes(2);
    expect(assertPublicHost).toHaveBeenLastCalledWith("https://internal.corp/x");
  });
});
