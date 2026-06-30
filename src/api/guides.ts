import { supabase } from "../lib/supabase";
import type { Place } from "../domain/types";

export type PlaceGuide = { guide: string; award: string; year: number | null };

// Curated guide awards (Michelin, hats, etc.) for a set of places. Display-only first-party
// reference data, fetched live and best-effort: a failure just means no badges this round.
export async function getPlaceGuides(placeIds: string[]): Promise<Record<string, PlaceGuide>> {
  if (placeIds.length === 0) return {};
  const { data, error } = await supabase.rpc("get_place_guides", { place_ids: placeIds });
  if (error || !data) return {};
  const out: Record<string, PlaceGuide> = {};
  for (const row of data as any[]) {
    if (typeof row.place_id === "string") {
      out[row.place_id] = { guide: row.guide, award: row.award, year: row.year ?? null };
    }
  }
  return out;
}

// A short badge label like "Michelin · 1 Star" for the pin / detail chip.
export function guideBadgeLabel(g: PlaceGuide): string {
  return `${g.guide} · ${g.award}`;
}

// Annotate places with a one-line guide award for display on the map.
export function annotateGuides(places: Place[], guides: Record<string, PlaceGuide>): Place[] {
  return places.map((p) => {
    const g = guides[p.placeId];
    return g ? { ...p, guideAward: guideBadgeLabel(g) } : p;
  });
}
