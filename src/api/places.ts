import { supabase } from "../lib/supabase";
import { isSuppressed } from "../domain/suppression";
import { dietaryTagsFromName } from "../domain/dietaryTags";
import type { Place, PlaceState, PriceLevel } from "../domain/types";
import type { SortBy, ShowState } from "../store/useFilters";

type PlaceFilters = {
  selected: string[];
  suppressed: string[];
  budgetMax?: 1 | 2 | 3 | 4 | null;
  withinKm?: number;
  minRating?: number | null;
  sortBy?: SortBy;
  showState?: ShowState;
  preserveOrder?: boolean;
};

const PRICE_RANK: Record<PriceLevel, 1 | 2 | 3 | 4> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function priceRank(level?: string): number | null {
  return level && level in PRICE_RANK ? PRICE_RANK[level as PriceLevel] : null;
}

function finiteOrLast(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function applyFilters(
  places: Place[],
  f: PlaceFilters,
): Place[] {
  const filtered = places.filter((p) => {
    if (isSuppressed(p.cuisines, f.suppressed)) return false;
    if (f.selected.length > 0 && !p.cuisines.some((c) => f.selected.includes(c))) return false;
    if (f.showState && f.showState !== "all" && p.state !== f.showState) return false;
    const rank = priceRank(p.priceLevel);
    if (f.budgetMax && rank !== null && rank > f.budgetMax) return false;
    if (f.minRating && (p.rating ?? 0) < f.minRating) return false;
    // distanceMeters is measured from the search origin (the map viewport centre), so "within"
    // is relative to the area being looked at, not the user's own location.
    if (f.withinKm && typeof p.distanceMeters === "number" && p.distanceMeters > f.withinKm * 1000) return false;
    return true;
  });
  if (f.preserveOrder) return filtered;
  const sortBy = f.sortBy ?? "rating";
  return [...filtered].sort((a, b) => {
    if (sortBy === "distance") return finiteOrLast(a.distanceMeters) - finiteOrLast(b.distanceMeters);
    if (sortBy === "price") return finiteOrLast(priceRank(a.priceLevel) ?? undefined) - finiteOrLast(priceRank(b.priceLevel) ?? undefined);
    return (b.rating ?? -1) - (a.rating ?? -1);
  });
}

// One page (20 results) is enough to fill the map and renders in a single round trip. Fetching
// the extra pages meant nothing showed until three sequential Google calls had all returned, which
// was the main cause of the slow first paint. More pages can be lazily fetched later if needed.
const MAX_GOOGLE_TEXT_SEARCH_PAGES = 1;

function isPlaceState(value: unknown): value is PlaceState {
  return value === "go" || value === "liked" || value === "loved" || value === "disliked";
}

function isPriceLevel(value: unknown): value is PriceLevel {
  return value === "PRICE_LEVEL_INEXPENSIVE" ||
    value === "PRICE_LEVEL_MODERATE" ||
    value === "PRICE_LEVEL_EXPENSIVE" ||
    value === "PRICE_LEVEL_VERY_EXPENSIVE";
}

function distanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(toLat - fromLat);
  const dLng = toRad(toLng - fromLng);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function shapeProxyPlace(p: any, originLat: number, originLng: number): Place | null {
  if (typeof p.placeId !== "string" || typeof p.name !== "string" || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    return null;
  }
  // Name-based dietary flags are first-party (derived from the place name, never Google reviews).
  const dietaryTags = dietaryTagsFromName(p.name);
  return {
    placeId: p.placeId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    rating: p.rating,
    userRatingCount: typeof p.userRatingCount === "number" ? p.userRatingCount : undefined,
    priceLevel: isPriceLevel(p.priceLevel) ? p.priceLevel : undefined,
    photoName: typeof p.photoName === "string" ? p.photoName : undefined,
    distanceMeters: distanceMeters(originLat, originLng, p.lat, p.lng),
    cuisines: p.cuisines ?? [],
    ...(dietaryTags.length > 0 ? { dietaryTags } : {}),
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
      photoName: place.photoName ?? previous?.photoName,
    });
  }
  return Array.from(byId.values());
}

// Calls the places-proxy Edge Function. Cuisines are the coarse labels Google place
// types supply. They are refined with first party tags by withFirstPartyCuisines.
export async function searchNearby(lat: number, lng: number, query: string, options: { radiusMeters?: number; openNow?: boolean } = {}): Promise<Place[]> {
  let pageToken: string | undefined;
  let places: Place[] = [];
  const extra = {
    ...(options.radiusMeters ? { radiusMeters: options.radiusMeters } : {}),
    ...(options.openNow ? { openNow: true } : {}),
  };
  for (let page = 0; page < MAX_GOOGLE_TEXT_SEARCH_PAGES; page++) {
    const body = pageToken
      ? { lat, lng, query, pageToken, ...extra }
      : { lat, lng, query, ...extra };
    const { data, error } = await supabase.functions.invoke("places-proxy", {
      body,
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.places)) throw new Error("Invalid places response");
    const pagePlaces = data.places.map((p: any) => shapeProxyPlace(p, lat, lng)).filter(Boolean) as Place[];
    places = mergePlaces(places, pagePlaces);
    pageToken = typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : undefined;
    if (!pageToken) break;
  }
  return places;
}

// One page of results plus the token for the next page, so the list can lazily load more as the
// user scrolls (endless results) without slowing the first paint.
export async function searchNearbyPage(
  lat: number,
  lng: number,
  query: string,
  options: { radiusMeters?: number; openNow?: boolean; pageToken?: string; searchKind?: "typed" | "nearby" } = {},
): Promise<{ places: Place[]; nextPageToken?: string }> {
  const body = {
    lat,
    lng,
    query,
    ...(options.radiusMeters ? { radiusMeters: options.radiusMeters } : {}),
    ...(options.openNow ? { openNow: true } : {}),
    ...(options.pageToken ? { pageToken: options.pageToken } : {}),
    ...(options.searchKind ? { searchKind: options.searchKind } : {}),
  };
  const { data, error } = await supabase.functions.invoke("places-proxy", { body });
  if (error) throw error;
  if (!data || !Array.isArray(data.places)) throw new Error("Invalid places response");
  const places = data.places.map((p: any) => shapeProxyPlace(p, lat, lng)).filter(Boolean) as Place[];
  const nextPageToken = typeof data.nextPageToken === "string" && data.nextPageToken ? data.nextPageToken : undefined;
  return { places, nextPageToken };
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
