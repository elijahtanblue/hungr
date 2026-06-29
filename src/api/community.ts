import { supabase } from "../lib/supabase";

// First party content for a place: hungr community reviews and fact tags. This is our owned
// data, separate from the Google block. Author identity is not shown in v1 because profiles
// are private under RLS, so reviews read as community contributions.
export type CommunityReview = { id: string; body: string; rating?: number; createdAt: string };

export async function getCommunity(placeId: string): Promise<{ reviews: CommunityReview[]; tags: string[] }> {
  const [reviewsRes, tagsRes] = await Promise.all([
    supabase.from("reviews").select("id, body, rating, created_at").eq("place_id", placeId).order("created_at", { ascending: false }),
    supabase.from("place_tags").select("tag").eq("place_id", placeId),
  ]);
  const reviews = (reviewsRes.data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    rating: r.rating ?? undefined,
    createdAt: r.created_at,
  }));
  const tags = Array.from(new Set((tagsRes.data ?? []).map((t: any) => t.tag)));
  return { reviews, tags };
}
