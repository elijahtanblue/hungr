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

export type PlaceFeedback = { rating?: number | null; note?: string | null; avoidReason?: string | null };

// Persists the quick Been/Avoid feedback onto the user's existing user_places row (own-row RLS).
// Only the keys present in `feedback` are written, so a been rating never clears an avoid reason
// and vice versa.
export async function savePlaceFeedback(placeId: string, feedback: PlaceFeedback): Promise<boolean> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const patch: Record<string, unknown> = {};
  if (feedback.rating !== undefined) patch.rating = feedback.rating;
  if (feedback.note !== undefined) patch.note = feedback.note;
  if (feedback.avoidReason !== undefined) patch.avoid_reason = feedback.avoidReason;
  if (Object.keys(patch).length === 0) return true;

  const res = await supabase
    .from("user_places")
    .update(patch)
    .eq("user_id", data.user.id)
    .eq("place_id", placeId);
  if (res.error) throw res.error;

  return true;
}
