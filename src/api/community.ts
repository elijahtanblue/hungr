import { supabase } from "../lib/supabase";

// First party content for a place: hungr community reviews and fact tags. This is our owned
// data, separate from the Google block. Author identity is not shown in v1 because profiles
// are private under RLS, so reviews read as community contributions.
export type CommunityReview = {
  id: string;
  userId: string | null;
  isMine: boolean;
  body: string;
  rating?: number;
  createdAt: string;
};

export type ReviewDraft = { id?: string; body: string; rating: number | null };

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function anchorPlace(placeId: string): Promise<void> {
  const place = await supabase
    .from("places")
    .upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
  if (place.error) throw place.error;
}

export async function getCommunity(placeId: string): Promise<{ reviews: CommunityReview[]; tags: string[] }> {
  const mine = await currentUserId();
  const [reviewsRes, tagsRes] = await Promise.all([
    supabase.from("reviews").select("id, user_id, body, rating, created_at").eq("place_id", placeId).order("created_at", { ascending: false }),
    supabase.from("place_tags").select("tag").eq("place_id", placeId),
  ]);
  if (reviewsRes.error) throw reviewsRes.error;
  if (tagsRes.error) throw tagsRes.error;
  const reviews = (reviewsRes.data ?? []).map((r: any) => ({
    id: r.id,
    userId: typeof r.user_id === "string" ? r.user_id : null,
    isMine: !!mine && r.user_id === mine,
    body: r.body,
    rating: r.rating ?? undefined,
    createdAt: r.created_at,
  }));
  const tags = Array.from(new Set((tagsRes.data ?? []).map((t: any) => t.tag)));
  return { reviews, tags };
}

export async function saveCommunityReview(placeId: string, draft: ReviewDraft): Promise<boolean> {
  const body = draft.body.trim();
  if (!body) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const rating = draft.rating ?? null;
  if (draft.id) {
    const res = await supabase
      .from("reviews")
      .update({ body, rating })
      .eq("id", draft.id)
      .eq("user_id", data.user.id);
    if (res.error) throw res.error;
    return true;
  }

  await anchorPlace(placeId);
  const res = await supabase
    .from("reviews")
    .insert({ user_id: data.user.id, place_id: placeId, body, rating });
  if (res.error) throw res.error;
  return true;
}

export async function deleteCommunityReview(id: string): Promise<boolean> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const res = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", data.user.id);
  if (res.error) throw res.error;
  return true;
}

export async function addPlaceTag(placeId: string, rawTag: string): Promise<boolean> {
  const tag = rawTag.trim().replace(/\s+/g, " ").slice(0, 40);
  if (!tag) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  await anchorPlace(placeId);
  const res = await supabase
    .from("place_tags")
    .insert({ place_id: placeId, tag, created_by: data.user.id });
  if (res.error) throw res.error;
  return true;
}
