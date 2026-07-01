// Pure parsing of schema.org menu JSON-LD into derived facts. No network, no Deno APIs, so this is
// unit-tested in isolation. The worker fetches a restaurant's own website (never Google content),
// extracts its published Menu/MenuItem/Offer markup, and reduces it to a coarse price band plus
// "friendly" dietary flags (a menu with any vegan item is vegan-friendly, which is the intent:
// somewhere a vegan can eat with non-vegan friends).

export type Price = { amount: number; currency?: string };
export type MenuNodes = { prices: Price[]; diets: string[]; texts: string[] };
export type Band = 1 | 2 | 3 | 4;

// AUD price-band thresholds on the median menu-item price. Launch market is AU; other currencies
// fall back to these thresholds for now (a known limitation, see the spec).
const AUD_BANDS: { max: number; band: Band }[] = [
  { max: 20, band: 1 },
  { max: 40, band: 2 },
  { max: 70, band: 3 },
];

// Pull every <script type="application/ld+json"> block and JSON.parse each independently, so one
// malformed block never loses the rest.
export function extractJsonLd(html: string): unknown[] {
  const out: unknown[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      out.push(JSON.parse(m[1].trim()));
    } catch {
      // Skip malformed blocks; a broken one must not lose a valid one elsewhere on the page.
    }
  }
  return out;
}

function parsePrice(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// Deep-walk arbitrary JSON-LD (handles @graph, Restaurant.hasMenu, Menu.hasMenuSection,
// MenuItem.offers, arrays, single objects). Collect priced nodes' amounts, any suitableForDiet
// declarations, and the names/descriptions of priced nodes (for the dietary keyword fallback).
export function menuNodesFrom(objects: unknown[]): MenuNodes {
  const prices: Price[] = [];
  const diets: string[] = [];
  const texts: string[] = [];

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    const priced = obj.price !== undefined ? parsePrice(obj.price) : null;
    const hasOffers = obj.offers !== undefined;
    if (priced !== null) {
      prices.push({ amount: priced, currency: typeof obj.priceCurrency === "string" ? obj.priceCurrency : undefined });
    }
    if (priced !== null || hasOffers) {
      if (typeof obj.name === "string") texts.push(obj.name);
      if (typeof obj.description === "string") texts.push(obj.description);
    }

    const diet = obj.suitableForDiet;
    if (typeof diet === "string") diets.push(diet);
    else if (Array.isArray(diet)) for (const d of diet) if (typeof d === "string") diets.push(d);

    for (const value of Object.values(obj)) walk(value);
  };

  for (const o of objects) walk(o);
  return { prices, diets, texts };
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Median menu-item price -> 1..4 band. Uses the dominant currency among the prices (default AUD),
// and only the amounts in that currency so a stray foreign price does not skew the median.
export function derivePriceBand(prices: Price[]): Band | null {
  if (prices.length === 0) return null;
  const counts = new Map<string, number>();
  for (const p of prices) {
    const c = p.currency ?? "AUD";
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let currency = "AUD";
  let best = -1;
  for (const [c, n] of counts) if (n > best) { best = n; currency = c; }
  const amounts = prices.filter((p) => (p.currency ?? "AUD") === currency).map((p) => p.amount);
  if (amounts.length === 0) return null;
  const m = median(amounts);
  for (const { max, band } of AUD_BANDS) if (m < max) return band;
  return 4;
}

const DIET_MAP: { needle: string; tag: string }[] = [
  { needle: "vegan", tag: "vegan" },
  { needle: "vegetarian", tag: "vegetarian" },
  { needle: "glutenfree", tag: "gluten-free" },
];

// Union schema.org RestrictedDiet declarations with a keyword scan of item names/descriptions.
// A menu that declares VeganDiet OR names a vegan dish is "vegan-friendly".
export function deriveDietaryFlags(diets: string[], texts: string[]): string[] {
  const found = new Set<string>();
  const haystacks = [...diets, ...texts].map((s) => s.toLowerCase().replace(/[^a-z]/g, ""));
  for (const h of haystacks) {
    for (const { needle, tag } of DIET_MAP) if (h.includes(needle)) found.add(tag);
  }
  return Array.from(found);
}
