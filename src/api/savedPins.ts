import { supabase } from "../lib/supabase";
import type { Place, PlaceState } from "../domain/types";

// Loads the user's saved places (want to go / been / avoid) as map-ready pins. We store only the
// place_id, so coordinates and names are fetched live through the place-pins function and cached in
// memory for the session. This is what makes saved and imported places appear on the map.
const cache = new Map<string, { name: string; lat: number; lng: number; rating?: number }>();

function isPlaceState(value: unknown): value is PlaceState {
  return value === "go" || value === "liked" || value === "loved" || value === "disliked";
}

export async function getSavedPlacePins(): Promise<Place[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];

  const { data, error } = await supabase
    .from("user_places")
    .select("place_id, state")
    .eq("user_id", u.user.id);
  if (error || !data) return [];

  const states = new Map<string, PlaceState>();
  for (const row of data as any[]) {
    if (typeof row.place_id === "string" && isPlaceState(row.state)) states.set(row.place_id, row.state);
  }
  const ids = [...states.keys()];
  if (ids.length === 0) return [];

  const missing = ids.filter((id) => !cache.has(id));
  if (missing.length > 0) {
    const { data: res, error: fnErr } = await supabase.functions.invoke("place-pins", { body: { ids: missing } });
    if (!fnErr && res?.pins && Array.isArray(res.pins)) {
      for (const pin of res.pins as any[]) {
        if (pin && typeof pin.id === "string" && typeof pin.lat === "number" && typeof pin.lng === "number") {
          cache.set(pin.id, { name: pin.name, lat: pin.lat, lng: pin.lng, rating: pin.rating });
        }
      }
    }
  }

  const out: Place[] = [];
  for (const id of ids) {
    const p = cache.get(id);
    if (p) out.push({ placeId: id, name: p.name, lat: p.lat, lng: p.lng, rating: p.rating, cuisines: [], state: states.get(id) });
  }
  return out;
}
