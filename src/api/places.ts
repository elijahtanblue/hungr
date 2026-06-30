import { supabase } from "../lib/supabase";
import { isSuppressed } from "../domain/suppression";
import type { Place, PlaceState } from "../domain/types";

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

const MAX_GOOGLE_TEXT_SEARCH_PAGES = 3;

function isPlaceState(value: unknown): value is PlaceState {
  return value === "go" || value === "been" || value === "avoid";
}

function shapeProxyPlace(p: any): Place | null {
  if (typeof p.placeId !== "string" || typeof p.name !== "string" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    return null;
  }
  return {
    placeId: p.placeId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating,
    cuisines: p.cuisines ?? [],
    state: isPlaceState(p.state) ? p.state : undefined,
  };
}

export function mergePlaces(existing: Place[], incoming: Place[]): Place[] {
  const byId = new Map<string, Place>();
  for (const place of existing) byId.set(place.placeId, place);
  for (const place of incoming) {
    const previous = byId.get(place.placeId);
    byId.set(place.placeId, {
      ...previous,
      ...place,
      state: place.state ?? previous?.state,
    });
  }
  return Array.from(byId.values());
}

// Calls the places-proxy Edge Function. Cuisines are the coarse labels Google place
// types supply. They are refined with first party tags by withFirstPartyCuisines.
export async function searchNearby(lat: number, lng: number, query: string): Promise<Place[]> {
  let pageToken: string | undefined;
  let places: Place[] = [];
  for (let page = 0; page < MAX_GOOGLE_TEXT_SEARCH_PAGES; page++) {
    const { data, error } = await supabase.functions.invoke("places-proxy", {
      body: pageToken ? { lat, lng, query, pageToken } : { lat, lng, query },
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.places)) throw new Error("Invalid places response");
    const pagePlaces = data.places.map(shapeProxyPlace).filter(Boolean) as Place[];
    places = mergePlaces(places, pagePlaces);
    pageToken = typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return places;
}

// Union our first party place_cuisines tags onto the coarse Google cuisines.
// This is the refinement layer: a place tagged "Sichuan" by the community in v2
// gains that tag on top of Google's coarse "Chinese".
export async function withFirstPartyCuisines(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;
  const ids = places.map((p) => p.placeId);
  const { data, error } = await supabase
    .from("place_cuisines")
    .select("place_id, cuisines(name)")
    .in("place_id", ids);
  // Refinement is best effort: if the join fails, return the base (Google coarse) cuisines
  // rather than throwing, so a transient place_cuisines error never wipes the map pins.
  if (error || !data) return places;
  const byPlace = new Map<string, Set<string>>();
  for (const row of data as any[]) {
    const set = byPlace.get(row.place_id) ?? new Set<string>();
    // Supabase may return the related row as an object or an array depending on the
    // relationship config; handle both so first party tags are never silently dropped.
    const rel = row.cuisines;
    const names = Array.isArray(rel) ? rel.map((c: any) => c?.name) : [rel?.name];
    for (const n of names) if (typeof n === "string") set.add(n);
    byPlace.set(row.place_id, set);
  }
  return places.map((p) => {
    const extra = byPlace.get(p.placeId);
    if (!extra) return p;
    return { ...p, cuisines: Array.from(new Set([...p.cuisines, ...extra])) };
  });
}

export async function withUserPlaceStates(places: Place[]): Promise<Place[]> {
  if (places.length === 0) return places;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return places;

  const ids = places.map((p) => p.placeId);
  const { data, error } = await supabase
    .from("user_places")
    .select("place_id, state")
    .in("place_id", ids);
  if (error || !data) return places;

  const byPlace = new Map<string, PlaceState>();
  for (const row of data as any[]) {
    if (typeof row.place_id === "string" && isPlaceState(row.state)) byPlace.set(row.place_id, row.state);
  }
  return places.map((p) => {
    const state = byPlace.get(p.placeId);
    return state ? { ...p, state } : p;
  });
}
