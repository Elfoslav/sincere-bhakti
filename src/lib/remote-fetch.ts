import { fetch as undiciFetch, Agent } from "undici";
import { assertPublicHost, guardedLookup } from "@/lib/ssrf";

// Safeguarded fetcher for user-supplied URLs (link previews). Combines an
// SSRF host check, an HTTP timeout, a redirect cap, and a streamed byte cap so
// a hostile/endless URL cannot hang or exhaust the server.
//
// We use undici's own fetch with a dispatcher whose connect.lookup validates
// and PINS the resolved address (see guardedLookup). assertPublicHost is only a
// pre-check; the dispatcher is what guarantees the actual socket connects to a
// vetted address, defeating DNS rebinding. (Node's built-in fetch rejects an
// externally-installed undici Agent as a dispatcher, so we call undici's fetch.)
const guardedAgent = new Agent({
  connect: { lookup: guardedLookup },
});

export const MAX_LINK_PREVIEW_HTML_BYTES = 2 * 1024 * 1024;
export const MAX_LINK_PREVIEW_IMAGE_BYTES = 10 * 1024 * 1024;
export const LINK_PREVIEW_FETCH_TIMEOUT_MS = 5000;
export const LINK_PREVIEW_MAX_REDIRECTS = 5;

export interface RemoteFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  /** Short-circuit on any redirect that targets a private host (default true). */
  guardRedirects?: boolean;
}

function parseContentLength(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

/**
 * Fetch `url` and return its body as a Buffer, with the following guards:
 * - the resolved host (and every redirect hop) must not be private (SSRF);
 * - an AbortController timeout bounds total time;
 * - content-length and the stream itself are capped at `maxBytes`.
 * Returns null on any non-2xx status, timeout, SSRF rejection, or overflow.
 */
export async function fetchRemoteBytes(
  url: string,
  options: RemoteFetchOptions = {},
): Promise<Buffer | null> {
  const {
    maxBytes = MAX_LINK_PREVIEW_IMAGE_BYTES,
    timeoutMs = LINK_PREVIEW_FETCH_TIMEOUT_MS,
    maxRedirects = LINK_PREVIEW_MAX_REDIRECTS,
    guardRedirects = true,
  } = options;

  let current = url;
  let redirects = 0;

  while (true) {
    if (guardRedirects) {
      try {
        await assertPublicHost(current);
      } catch {
        return null;
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let res: Awaited<ReturnType<typeof undiciFetch>>;
    try {
      res = await undiciFetch(current, {
        signal: controller.signal,
        redirect: "manual",
        dispatcher: guardedAgent,
      });
    } catch {
      clearTimeout(timeout);
      return null;
    }

    if (res.status >= 300 && res.status < 400) {
      clearTimeout(timeout);
      const location = res.headers.get("location");
      if (!location) return null;
      redirects += 1;
      if (redirects > maxRedirects) return null;
      try {
        current = new URL(location, current).href;
      } catch {
        return null;
      }
      continue;
    }

    if (!res.ok) {
      clearTimeout(timeout);
      return null;
    }

    try {
      const contentLength = parseContentLength(res.headers.get("content-length"));
      if (contentLength !== null && contentLength > maxBytes) return null;
      if (!res.body) return null;

      const reader = res.body.getReader();
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            controller.abort();
            return null;
          }
          chunks.push(Buffer.from(value));
        }
      } finally {
        reader.releaseLock();
      }

      return Buffer.concat(chunks, totalBytes);
    } finally {
      clearTimeout(timeout);
    }
  }
}
