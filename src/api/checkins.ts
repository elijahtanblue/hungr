import { supabase } from "../lib/supabase";

// Lightweight, private check-ins. The count is the user's own memory aid and a personalization
// signal (first time vs regular); it is protected by own-row RLS and never shown to anyone else.

// Record one visit. Anchors the place_id first (same pattern as setUserPlaceState) so the FK holds.
// Returns the user's new total visit count for the place, or null if not signed in.
export async function checkIn(placeId: string): Promise<number | null> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return null;

  const place = await supabase
    .from("places")
    .upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
  if (place.error) throw place.error;

  const insert = await supabase.from("check_ins").insert({ user_id: data.user.id, place_id: placeId });
  if (insert.error) throw insert.error;

  return getVisitCount(placeId);
}

// How many times the signed-in user has checked in here. Zero when signed out or never visited.
export async function getVisitCount(placeId: string): Promise<number> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return 0;

  const { count, error } = await supabase
    .from("check_ins")
    .select("id", { count: "exact", head: true })
    .eq("user_id", data.user.id)
    .eq("place_id", placeId);
  if (error) return 0;
  return count ?? 0;
}
