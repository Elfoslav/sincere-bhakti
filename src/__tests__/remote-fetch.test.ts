import { describe, it, expect, vi, beforeEach } from "vitest";

// The fetcher uses undici's fetch (with a guarded dispatcher), not the global
// fetch, so mock the undici module. Agent is a no-op stub — the guarded
// connect.lookup logic is unit-tested in ssrf.test.ts.
const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

vi.mock("undici", () => ({
  fetch: fetchMock,
  Agent: class {
    constructor(_options?: unknown) {}
  },
}));

vi.mock("@/lib/ssrf", () => ({
  assertPublicHost: vi.fn(async () => undefined),
  guardedLookup: vi.fn(),
}));

import { fetchRemoteBytes, LINK_PREVIEW_FETCH_TIMEOUT_MS } from "@/lib/remote-fetch";
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
  beforeEach(() => {
    fetchMock.mockReset();
    vi.mocked(assertPublicHost).mockReset();
    vi.mocked(assertPublicHost).mockResolvedValue(undefined);
  });

  it("returns the response body with final-hop metadata", async () => {
    fetchMock.mockResolvedValue(makeResponse({ body: new TextEncoder().encode("hello world"), headers: { "content-type": "text/html; charset=utf-8" } }));
    const result = await fetchRemoteBytes("https://example.com");
    expect(result?.bytes.toString()).toBe("hello world");
    expect(result?.finalUrl).toBe("https://example.com");
    expect(result?.contentType).toBe("text/html; charset=utf-8");
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

    const result = await fetchRemoteBytes("https://example.com/start", { maxRedirects: 5 });
    expect(result?.bytes.toString()).toBe("done");
    expect(result?.finalUrl).toBe("https://example.com/final");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("bounds total time across hops with a single deadline", async () => {
    fetchMock.mockResolvedValue(makeResponse({ status: 302, headers: { location: "https://example.com/next" } }));
    const start = 1_700_000_000_000;
    const nowSpy = vi.spyOn(Date, "now")
      .mockReturnValueOnce(start)
      .mockReturnValueOnce(start)
      .mockReturnValue(start + LINK_PREVIEW_FETCH_TIMEOUT_MS + 1);
    try {
      // First hop is fetched, but by the second hop the total budget is
      // spent — no fresh per-hop timeout may extend the request's lifetime.
      expect(await fetchRemoteBytes("https://example.com/start")).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      nowSpy.mockRestore();
    }
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
