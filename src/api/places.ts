import { supabase } from "../lib/supabase";
import { isSuppressed } from "../domain/suppression";
import type { Place } from "../domain/types";

export function applyFilters(
  places: Place[],
  f: { selected: string[]; suppressed: string[] },
): Place[] {
  return places.filter((p) => {
    if (isSuppressed(p.cuisines, f.suppressed)) return false;
    if (f.selected.length > 0 && !p.cuisines.some((c) => f.selected.includes(c))) return false;
    return true;
  });
}

// Calls the places-proxy Edge Function. Cuisines are the coarse labels Google place
// types supply. They are refined with first party tags by withFirstPartyCuisines.
export async function searchNearby(lat: number, lng: number, query: string): Promise<Place[]> {
  const { data, error } = await supabase.functions.invoke("places-proxy", {
    body: { lat, lng, query },
  });
  if (error) throw error;
  return (data.places ?? []).map((p: any) => ({
    placeId: p.placeId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating,
    cuisines: p.cuisines ?? [],
  }));
}

// Union our first party place_cuisines tags onto the coarse Google cuisines.
// This is the refinement layer: a place tagged "Sichuan" by the community in v2
// gains that tag on top of Google's coarse "Chinese".
export async function withFirstPartyCuisines(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;
  const ids = places.map((p) => p.placeId);
  const { data } = await supabase
    .from("place_cuisines")
    .select("place_id, cuisines(name)")
    .in("place_id", ids);
  if (!data) return places;
  const byPlace = new Map<string, Set<string>>();
  for (const row of data as any[]) {
    const set = byPlace.get(row.place_id) ?? new Set<string>();
    if (row.cuisines?.name) set.add(row.cuisines.name);
    byPlace.set(row.place_id, set);
  }
  return places.map((p) => {
    const extra = byPlace.get(p.placeId);
    if (!extra) return p;
    return { ...p, cuisines: Array.from(new Set([...p.cuisines, ...extra])) };
  });
}
