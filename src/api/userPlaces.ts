import { supabase } from "../lib/supabase";
import type { PlaceState } from "../domain/types";

export async function setUserPlaceState(placeId: string, state: PlaceState): Promise<boolean> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const place = await supabase
    .from("places")
    .upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
  if (place.error) throw place.error;

  const userPlace = await supabase
    .from("user_places")
    .upsert({ user_id: data.user.id, place_id: placeId, state });
  if (userPlace.error) throw userPlace.error;

  return true;
}
