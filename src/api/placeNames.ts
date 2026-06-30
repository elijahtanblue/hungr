import { supabase } from "../lib/supabase";

// Resolves place_ids to display names via the place-names Edge Function, caching results in
// memory so a feed never re-fetches a name it already knows. Google names are shown live and
// never persisted (we only ever store place_id), consistent with the rest of the app.
const cache = new Map<string, string>();

export async function getPlaceNames(ids: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const missing: string[] = [];
  for (const id of ids) {
    const cached = cache.get(id);
    if (cached !== undefined) result[id] = cached;
    else missing.push(id);
  }
  if (missing.length === 0) return result;

  const { data, error } = await supabase.functions.invoke("place-names", { body: { ids: missing } });
  const names = data?.names;
  if (!error && names && typeof names === "object") {
    for (const [id, name] of Object.entries(names as Record<string, unknown>)) {
      if (typeof name === "string") { cache.set(id, name); result[id] = name; }
    }
  }
  return result;
}
