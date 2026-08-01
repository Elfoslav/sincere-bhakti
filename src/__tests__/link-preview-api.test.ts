import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/remote-fetch", () => ({
  fetchRemoteBytes: vi.fn(),
  MAX_LINK_PREVIEW_HTML_BYTES: 2 * 1024 * 1024,
  MAX_LINK_PREVIEW_IMAGE_BYTES: 10 * 1024 * 1024,
}));

vi.spyOn(console, "error").mockImplementation(() => {});

import { fetchRemoteBytes } from "@/lib/remote-fetch";
import { GET } from "@/app/api/link-preview/route";

const HTML = `
<html>
  <head>
    <meta property="og:title" content="Hello World" />
    <meta property="og:description" content="A description" />
    <meta property="og:image" content="https://cdn.example.com/img.jpg" />
    <meta property="og:site_name" content="Example" />
  </head>
</html>
`;

function mockRequest(url: string) {
  return {
    url,
    headers: new Headers({ "x-forwarded-for": "203.0.113.10" }),
  } as any;
}

describe("GET /api/link-preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed preview when the page has og tags", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(Buffer.from(HTML));

    const res = await GET(mockRequest("http://localhost:3000/api/link-preview?url=https%3A%2F%2Fexample.com%2Fpost"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preview).toEqual({
      url: "https://example.com/post",
      title: "Hello World",
      description: "A description",
      image: "https://cdn.example.com/img.jpg",
      siteName: "Example",
      favicon: null,
    });
    expect(fetchRemoteBytes).toHaveBeenCalledWith(
      "https://example.com/post",
      expect.objectContaining({ maxBytes: 2 * 1024 * 1024 }),
    );
  });

  it("returns 400 for a missing url", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("bad_request");
  });

  it("returns 400 for a non-http(s) url", async () => {
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview?url=javascript%3Aalert(1)"));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("bad_request");
  });

  it("returns null preview when the page cannot be fetched", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(null);
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview?url=https%3A%2F%2Fexample.com"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.preview).toBeNull();
  });

  it("returns null preview when nothing usable is extracted", async () => {
    vi.mocked(fetchRemoteBytes).mockResolvedValue(Buffer.from("<html><body>hi</body></html>"));
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview?url=https%3A%2F%2Fexample.com"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.preview).toBeNull();
  });

  it("returns 500 on server error", async () => {
    vi.mocked(fetchRemoteBytes).mockRejectedValue(new Error("boom"));
    const res = await GET(mockRequest("http://localhost:3000/api/link-preview?url=https%3A%2F%2Fexample.com"));
    expect(res.status).toBe(500);
  });
});
