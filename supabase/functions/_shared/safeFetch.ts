// SSRF-safe fetch for pulling attacker-influenceable URLs (a place's websiteUri) server-side.
// The IP-safety decision is a pure function so it is unit-tested exhaustively; the resolver and
// fetch are injectable so the redirect-re-check path is testable without real network.
//
//   scheme https-only -> resolve DNS -> reject private/loopback/link-local/multicast IPs
//   -> fetch redirect:manual -> RE-CHECK every redirect target -> size/timeout/content-type caps

export type SafeFetchDeps = {
  resolve: (host: string) => Promise<string[]>; // returns resolved IP strings (A + AAAA)
  fetchImpl: typeof fetch;
};

const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 5000;
const UA = "hungrbot/1.0 (+https://hungr.app/bot)";

export function isAllowedScheme(url: URL): boolean {
  return url.protocol === "https:";
}

function ipv4Blocked(a: number, b: number): boolean {
  if (a === 0) return true;                       // 0.0.0.0/8 "this network"
  if (a === 10) return true;                      // private
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true;        // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true;                       // multicast (224/4) + reserved (240/4) + broadcast
  return false;
}

// True if the address is not safe to connect to (private, loopback, link-local, multicast, etc.).
export function isBlockedAddress(ip: string): boolean {
  const addr = ip.trim().toLowerCase();

  // IPv4 dotted quad
  const v4 = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(1).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return true; // malformed -> block
    return ipv4Blocked(a, b);
  }

  // IPv6
  if (addr.includes(":")) {
    if (addr === "::1" || addr === "::") return true;         // loopback / unspecified
    const mapped = addr.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/); // IPv4-mapped
    if (mapped) return isBlockedAddress(mapped[1]);
    if (/^fe[89ab]/.test(addr)) return true;                 // link-local fe80::/10
    if (/^f[cd]/.test(addr)) return true;                    // unique-local fc00::/7
    if (/^ff/.test(addr)) return true;                       // multicast ff00::/8
    return false;
  }

  return true; // not a recognized literal -> block (fail closed)
}

function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

async function readCapped(res: Response): Promise<string | null> {
  const reader = res.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) { await reader.cancel(); return null; }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder().decode(buf);
}

// Fetch a URL with full SSRF protection. Returns the body text, or null on any rejection/failure.
export async function safeFetch(rawUrl: string, deps: SafeFetchDeps): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isAllowedScheme(url)) return null;

    const ips = isIpLiteral(url.hostname) ? [url.hostname] : await deps.resolve(url.hostname).catch(() => []);
    if (ips.length === 0) return null;
    if (ips.some(isBlockedAddress)) return null; // re-checked on every hop, so redirects cannot bypass

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await deps.fetchImpl(url.toString(), {
        redirect: "manual",
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: "text/html,application/ld+json" },
      });
    } catch {
      clearTimeout(timer);
      return null;
    }
    clearTimeout(timer);

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      try {
        url = new URL(loc, url); // resolve relative; next loop re-checks scheme + IPs
      } catch {
        return null;
      }
      continue;
    }
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/ld\+json/i.test(ct)) return null;
    return await readCapped(res);
  }
  return null; // too many redirects
}
