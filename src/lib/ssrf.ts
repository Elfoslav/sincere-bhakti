import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// SSRF guard: the link-preview routes fetch arbitrary user-supplied URLs, so
// we must never let them reach loopback/private/link-local addresses (e.g.
// http://169.254.169.254 cloud metadata, internal services). The guard
// resolves every A/AAAA record for the host and rejects if ANY is private.

type LookupFn = (
  hostname: string,
  options: { all: true },
) => Promise<Array<{ address: string; family: number }>>;

function isPrivateV4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  return (
    a === 0 || // "this" network
    a === 10 || // RFC 1918
    a === 127 || // loopback
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local (incl. cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // RFC 1918
    (a === 192 && b === 168) || // RFC 1918
    (a === 192 && b === 0 && parts[2] === 0) || // IETF protocol assignments
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a === 255
  );
}

function isPrivateV6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true; // unspecified, loopback
  if (lower.startsWith("::ffff:")) {
    return isPrivateV4(lower.slice(7));
  }
  if (lower.startsWith("2001:db8:")) return true; // documentation
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
  if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
    return true; // link-local
  }
  return false;
}

/** True when the given IP is private/loopback/link-local/reserved. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isPrivateV4(ip);
  if (version === 6) return isPrivateV6(ip);
  // Not a valid IP — treat as unsafe.
  return true;
}

/**
 * Resolve the hostname and return true when ANY resolved address is private.
 * Non-resolving hostnames are treated as unsafe (fail closed).
 */
export async function resolvesToPrivateIp(
  hostname: string,
  lookupFn: LookupFn = lookup,
): Promise<boolean> {
  let addresses: string[];
  try {
    const result = await lookupFn(hostname, { all: true });
    addresses = result.map((entry) => entry.address);
  } catch {
    return true;
  }
  if (addresses.length === 0) return true;
  return addresses.some(isPrivateIp);
}

/**
 * Throw when the URL's host resolves to any private address. Used by the
 * link-preview fetcher before contacting a user-supplied host.
 */
export async function assertPublicHost(
  url: string,
  lookupFn: LookupFn = lookup,
): Promise<void> {
  const { hostname } = new URL(url);
  if (await resolvesToPrivateIp(hostname, lookupFn)) {
    throw new Error("blocked: host resolves to a private IP");
  }
}
