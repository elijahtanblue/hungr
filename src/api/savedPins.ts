import { supabase } from "../lib/supabase";
import type { Place, PlaceState } from "../domain/types";
import { getPlacePins } from "./placePins";

// Loads the user's saved places (want to go / been / avoid) as map-ready pins. We store only the
// place_id, so coordinates and names are fetched live through the place-pins helper. This is what
// makes saved and imported places appear on the map.

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

  const pins = await getPlacePins(ids);

  const out: Place[] = [];
  for (const id of ids) {
    const p = pins[id];
    if (p && typeof p.lat === "number" && typeof p.lng === "number") {
      out.push({ placeId: id, name: p.name, lat: p.lat, lng: p.lng, rating: p.rating, cuisines: [], state: states.get(id) });
    }
  }
  return out;
}
