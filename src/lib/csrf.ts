import type { NextRequest } from "next/server";

export function validateOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("host");

  if (!host) {
    console.warn("CSRF: missing Host header");
    return false;
  }

  const allowedOrigins = [
    process.env.NEXTAUTH_URL,
    ...(process.env.NODE_ENV === "development"
      ? ["http://localhost:3000"]
      : []),
  ].filter(Boolean) as string[];

  if (origin) {
    const originHost = origin.replace(/^https?:\/\//, "").split("/")[0];
    if (originHost === host) return true;
    if (allowedOrigins.some((o) => {
      try { return new URL(origin).host === new URL(o).host; }
      catch { return false; }
    })) return true;
    console.warn("CSRF: origin mismatch", { origin, host, allowedOrigins });
    return false;
  }

  if (referer) {
    const refererHost = referer.replace(/^https?:\/\//, "").split("/")[0];
    if (refererHost === host) return true;
    if (allowedOrigins.some((o) => {
      try { return new URL(referer).host === new URL(o).host; }
      catch { return false; }
    })) return true;
    console.warn("CSRF: referer mismatch", { referer, host, allowedOrigins });
    return false;
  }

  console.warn("CSRF: no Origin or Referer header", { host });
  return false;
}
