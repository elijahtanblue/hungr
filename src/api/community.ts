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
export type Community = {
  reviews: CommunityReview[];
  tags: string[];
  ratingAverage: number | null;
  ratingCount: number;
};

const MAX_REVIEW_BODY = 2000;
type CommunityReviewRow = {
  id: string;
  body: string;
  rating?: number | null;
  created_at: string;
  is_mine?: boolean | null;
};

type PlaceTagRow = { tag: string };

async function anchorPlace(placeId: string): Promise<void> {
  const place = await supabase
    .from("places")
    .upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
  if (place.error) throw place.error;
}

export async function getCommunity(placeId: string): Promise<Community> {
  const [reviewsRes, tagsRes] = await Promise.all([
    supabase.rpc("get_place_reviews", { target_place_id: placeId }),
    supabase.rpc("get_place_tags", { target_place_id: placeId }),
  ]);
  if (reviewsRes.error) throw reviewsRes.error;
  if (tagsRes.error) throw tagsRes.error;
  const reviews = ((reviewsRes.data ?? []) as CommunityReviewRow[]).map((r) => ({
    id: r.id,
    userId: null,
    isMine: !!r.is_mine,
    body: r.body,
    rating: r.rating ?? undefined,
    createdAt: r.created_at,
  }));
  const tags = Array.from(new Set(((tagsRes.data ?? []) as PlaceTagRow[]).map((t) => t.tag)));
  const ratings = reviews
    .map((r) => r.rating)
    .filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating));
  const ratingCount = ratings.length;
  const ratingAverage = ratingCount > 0
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount) * 10) / 10
    : null;
  return { reviews, tags, ratingAverage, ratingCount };
}

export async function saveCommunityReview(placeId: string, draft: ReviewDraft): Promise<boolean> {
  const body = draft.body.trim().slice(0, MAX_REVIEW_BODY);
  if (!body) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const rating = draft.rating ?? null;
  const res = await supabase.rpc("save_place_review", {
    target_place_id: placeId,
    review_id: draft.id ?? null,
    review_body: body,
    review_rating: rating,
  });
  if (res.error) throw res.error;
  return !!res.data;
}

export async function deleteCommunityReview(id: string): Promise<boolean> {
  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const res = await supabase.rpc("delete_place_review", { review_id: id });
  if (res.error) throw res.error;
  return !!res.data;
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
