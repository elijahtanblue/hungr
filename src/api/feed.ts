import { supabase } from "../lib/supabase";

// A single item in the social feed: a review someone you follow posted, with how many approved
// photos it carries. Photo images themselves are shown on the place detail (signed on demand).
export type FeedReview = {
  reviewId: string;
  placeId: string;
  authorId: string;
  authorUsername: string | null;
  authorName: string | null;
  body: string;
  rating: number | null;
  createdAt: string;
  photoCount: number;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

// Recent reviews and photos from people the caller follows (server enforces the follow +
// shares_activity visibility). Fails soft to an empty feed so a read error never blocks the tab.
export async function getFollowingFeed(limit = 30): Promise<FeedReview[]> {
  const { data, error } = await supabase.rpc("following_reviews_feed", { max_rows: limit });
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((row: any) => typeof row.review_id === "string" && typeof row.place_id === "string")
    .map((row: any) => ({
      reviewId: row.review_id,
      placeId: row.place_id,
      authorId: typeof row.author_id === "string" ? row.author_id : "",
      authorUsername: typeof row.author_username === "string" ? row.author_username : null,
      authorName: typeof row.author_name === "string" ? row.author_name : null,
      body: typeof row.body === "string" ? row.body : "",
      rating: row.rating == null ? null : toNumber(row.rating),
      createdAt: typeof row.created_at === "string" ? row.created_at : "",
      photoCount: toNumber(row.photo_count),
    }));
}
