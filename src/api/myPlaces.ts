import { getPlaceNames } from "./placeNames";
import { supabase } from "../lib/supabase";
import type { PlaceState } from "../domain/types";

export type MyPlace = {
  placeId: string;
  name: string;
  state: PlaceState;
  updatedAt: string;
  rating: number | null;
  note: string | null;
  avoidReason: string | null;
};

export type MyPlaces = Record<PlaceState, MyPlace[]>;

const empty = (): MyPlaces => ({ go: [], been: [], avoid: [] });

function isPlaceState(value: unknown): value is PlaceState {
  return value === "go" || value === "been" || value === "avoid";
}

export async function getMyPlaces(): Promise<MyPlaces> {
  const grouped = empty();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) return grouped;

  const { data, error } = await supabase
    .from("user_places")
    .select("place_id, state, updated_at, rating, note, avoid_reason")
    .eq("user_id", userData.user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []).filter((row: any) => typeof row.place_id === "string" && isPlaceState(row.state));
  const names = await getPlaceNames(rows.map((row: any) => row.place_id));
  for (const row of rows as any[]) {
    grouped[row.state as PlaceState].push({
      placeId: row.place_id,
      name: names[row.place_id] ?? "Saved place",
      state: row.state,
      updatedAt: row.updated_at,
      rating: row.rating ?? null,
      note: row.note ?? null,
      avoidReason: row.avoid_reason ?? null,
    });
  }
  return grouped;
}
