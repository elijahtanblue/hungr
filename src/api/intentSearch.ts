import { supabase } from "../lib/supabase";
import type { Band, Prestige, StructuredQuery } from "../domain/intentQuery";

const PRESTIGE: Prestige[] = ["top", "guide", "hidden-gem"];
const DIETARY = ["vegan", "vegetarian", "gluten-free"];

function bands(v: unknown): Band | undefined {
  return v === 1 || v === 2 || v === 3 || v === 4 ? v : undefined;
}

function list<T extends string>(v: unknown, allow: readonly T[] | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: T[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim().toLowerCase() as T;
    if (!s || (allow && !allow.includes(s))) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out.length ? out : undefined;
}

// The server already validates, but the network boundary is untrusted, so re-shape here too and
// always return a usable query. Any failure degrades to a plain text search (queryHint = raw text),
// so AI search never leaves the user worse off than the basic search.
export function coerceStructuredQuery(raw: unknown, fallbackQuery: string): StructuredQuery {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const q: StructuredQuery = {
    queryHint: typeof obj.queryHint === "string" && obj.queryHint.trim() ? obj.queryHint.trim() : fallbackQuery,
  };
  const cuisines = list(obj.cuisines, null);
  if (cuisines) q.cuisines = cuisines;
  const dietary = list(obj.dietary, DIETARY);
  if (dietary) q.dietary = dietary;
  const prestige = list(obj.prestige, PRESTIGE);
  if (prestige) q.prestige = prestige;
  const pb = obj.priceBand as Record<string, unknown> | undefined;
  if (pb && typeof pb === "object") {
    const min = bands(pb.min);
    const max = bands(pb.max);
    const band: { min?: Band; max?: Band } = {};
    if (min !== undefined) band.min = min;
    if (max !== undefined) band.max = max;
    if (min !== undefined || max !== undefined) q.priceBand = band;
  }
  return q;
}

export async function parseIntent(query: string): Promise<StructuredQuery> {
  const text = query.trim();
  try {
    const { data, error } = await supabase.functions.invoke("intent-parse", { body: { query: text } });
    if (error) return { queryHint: text };
    return coerceStructuredQuery(data, text);
  } catch {
    return { queryHint: text };
  }
}
