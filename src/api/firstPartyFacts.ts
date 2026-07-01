import { supabase } from "../lib/supabase";
import type { Place } from "../domain/types";

export type FirstPartyFact = { priceBand?: number; dietaryFlags: string[] };

// Curated/derived first-party facts (price band, dietary flags) for a set of places. Best-effort
// and display-only, exactly like getPlaceGuides: a failure just means no enrichment this round.
export async function getFirstPartyFacts(placeIds: string[]): Promise<Record<string, FirstPartyFact>> {
  if (placeIds.length === 0) return {};
  const { data, error } = await supabase.rpc("get_first_party_facts", { place_ids: placeIds });
  if (error || !data) return {};
  const out: Record<string, FirstPartyFact> = {};
  for (const row of data as any[]) {
    if (typeof row.place_id === "string") {
      out[row.place_id] = {
        priceBand: typeof row.price_band === "number" ? row.price_band : undefined,
        dietaryFlags: Array.isArray(row.dietary_flags) ? row.dietary_flags : [],
      };
    }
  }
  return out;
}

// Merge facts onto places for the rule engine: curated price band wins, dietary tags are unioned
// on top of any name-derived tags already on the place.
export function annotateFacts(places: Place[], facts: Record<string, FirstPartyFact>): Place[] {
  return places.map((p) => {
    const f = facts[p.placeId];
    if (!f) return p;
    const band = f.priceBand === 1 || f.priceBand === 2 || f.priceBand === 3 || f.priceBand === 4 ? f.priceBand : undefined;
    const dietaryTags = f.dietaryFlags.length > 0
      ? Array.from(new Set([...(p.dietaryTags ?? []), ...f.dietaryFlags]))
      : p.dietaryTags;
    return { ...p, ...(band ? { priceBand: band } : {}), ...(dietaryTags ? { dietaryTags } : {}) };
  });
}
