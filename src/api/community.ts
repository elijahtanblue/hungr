import { supabase } from "../lib/supabase";
import { getPlacePins } from "./placePins";
import type { PlaceState } from "../domain/types";

// First party content for a place: hungr community reviews and fact tags. This is our owned data,
// separate from the Google block. Reviews are attributed to the author's public handle and link
// through to their profile.
export type CommunityReview = {
  id: string;
  userId: string | null;
  isMine: boolean;
  authorUsername: string | null;
  authorName: string | null;
  body: string;
  rating?: number;
  state?: Exclude<PlaceState, "go">;
  upvotes: number;
  mineUpvoted: boolean;
  createdAt: string;
  photos: ReviewPhoto[];
};

export type ReviewDraft = { id?: string; body: string; rating: number | null };
export type ReviewPhoto = {
  id: string;
  reviewId: string;
  storagePath: string;
  uri: string;
  width?: number;
  height?: number;
  createdAt: string;
};
export type ReviewSort = "newest" | "popular" | "rating";
export type CommunityPageOptions = {
  limit?: number;
  offset?: number;
  search?: string;
  sort?: ReviewSort;
  state?: Exclude<PlaceState, "go"> | null;
  minRating?: number | null;
  photosOnly?: boolean;
};
export type CommunityPage = {
  reviews: CommunityReview[];
  hasMore: boolean;
  nextOffset: number;
};
export type Community = {
  reviews: CommunityReview[];
  tags: string[];
  ratingAverage: number | null;
  ratingCount: number;
  hasMore?: boolean;
  nextOffset?: number;
};

const MAX_REVIEW_BODY = 2000;
type CommunityReviewRow = {
  id: string;
  body: string;
  rating?: number | null;
  created_at: string;
  is_mine?: boolean | null;
  author_id?: string | null;
  author_username?: string | null;
  author_name?: string | null;
  upvotes?: number | null;
  mine_upvoted?: boolean | null;
  state?: string | null;
  photos?: unknown;
};

type PlaceTagRow = { tag: string };
type ReviewPhotoRow = {
  id?: unknown;
  review_id?: unknown;
  storage_path?: unknown;
  width?: unknown;
  height?: unknown;
  created_at?: unknown;
};

function isReviewState(value: unknown): value is Exclude<PlaceState, "go"> {
  return value === "liked" || value === "loved" || value === "disliked";
}

async function anchorPlace(placeId: string): Promise<void> {
  const place = await supabase
    .from("places")
    .upsert({ place_id: placeId }, { onConflict: "place_id", ignoreDuplicates: true });
  if (place.error) throw place.error;
}

function normalizedSearch(search?: string): string | null {
  const next = search?.trim();
  return next ? next.slice(0, 80) : null;
}

function normalizedLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return 25;
  return Math.min(50, Math.max(1, Math.round(limit!)));
}

function reviewPhotosFromRow(row: CommunityReviewRow): ReviewPhotoRow[] {
  return Array.isArray(row.photos) ? row.photos as ReviewPhotoRow[] : [];
}

async function signReviewPhotos(reviewId: string, photos: ReviewPhotoRow[]): Promise<ReviewPhoto[]> {
  if (photos.length === 0) return [];
  const bucket = supabase.storage.from("review-photos");
  const signed = await Promise.all(photos.map(async (photo) => {
    if (typeof photo.id !== "string" || typeof photo.storage_path !== "string") return null;
    const { data, error } = await bucket.createSignedUrl(photo.storage_path, 60 * 60);
    if (error || typeof data?.signedUrl !== "string") return null;
    return {
      id: photo.id,
      reviewId,
      storagePath: photo.storage_path,
      uri: data.signedUrl,
      ...(typeof photo.width === "number" ? { width: photo.width } : {}),
      ...(typeof photo.height === "number" ? { height: photo.height } : {}),
      createdAt: typeof photo.created_at === "string" ? photo.created_at : "",
    };
  }));
  return signed.filter((photo): photo is ReviewPhoto => !!photo);
}

async function mapReviewRow(row: CommunityReviewRow): Promise<CommunityReview> {
  return {
    id: row.id,
    userId: row.author_id ?? null,
    isMine: !!row.is_mine,
    authorUsername: row.author_username ?? null,
    authorName: row.author_name ?? null,
    body: row.body,
    rating: row.rating ?? undefined,
    ...(isReviewState(row.state) ? { state: row.state } : {}),
    upvotes: row.upvotes ?? 0,
    mineUpvoted: !!row.mine_upvoted,
    createdAt: row.created_at,
    photos: await signReviewPhotos(row.id, reviewPhotosFromRow(row)),
  };
}

export async function getCommunityPage(placeId: string, options: CommunityPageOptions = {}): Promise<CommunityPage> {
  const limit = normalizedLimit(options.limit);
  const offset = Math.max(0, Math.round(options.offset ?? 0));
  const res = await supabase.rpc("get_place_reviews_page", {
    target_place_id: placeId,
    page_limit: limit + 1,
    page_offset: offset,
    search_query: normalizedSearch(options.search),
    sort_by: options.sort ?? "newest",
    state_filter: options.state ?? null,
    min_rating: options.minRating ?? null,
    photos_only: !!options.photosOnly,
  });
  if (res.error) throw res.error;
  const rows = ((res.data ?? []) as CommunityReviewRow[]);
  const mapped = await Promise.all(rows.slice(0, limit).map(mapReviewRow));
  return { reviews: mapped, hasMore: rows.length > limit, nextOffset: offset + mapped.length };
}

export async function getCommunity(placeId: string): Promise<Community> {
  const [reviewsRes, tagsRes] = await Promise.all([
    getCommunityPage(placeId),
    supabase.rpc("get_place_tags", { target_place_id: placeId }),
  ]);
  if (tagsRes.error) throw tagsRes.error;
  const reviews = reviewsRes.reviews;
  const tags = Array.from(new Set(((tagsRes.data ?? []) as PlaceTagRow[]).map((t) => t.tag)));
  const ratings = reviews
    .map((r) => r.rating)
    .filter((rating): rating is number => typeof rating === "number" && Number.isFinite(rating));
  const ratingCount = ratings.length;
  const ratingAverage = ratingCount > 0
    ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratingCount) * 10) / 10
    : null;
  return { reviews, tags, ratingAverage, ratingCount, hasMore: reviewsRes.hasMore, nextOffset: reviewsRes.nextOffset };
}

export type MyReview = {
  id: string;
  placeId: string;
  placeName: string;
  body: string;
  rating: number | null;
  placeRating: number | null;
  state?: Exclude<PlaceState, "go">;
  createdAt: string;
};

// The caller's own reviews across all places, with live place names, for the profile.
export async function getMyReviews(): Promise<MyReview[]> {
  const { data, error } = await supabase.rpc("get_my_reviews");
  if (error || !Array.isArray(data)) return [];
  const rows = data as any[];
  const pins = await getPlacePins(rows.map((r) => r.place_id));
  return rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeName: pins[r.place_id]?.name ?? "A place",
    body: r.body,
    rating: r.rating ?? null,
    placeRating: pins[r.place_id]?.rating ?? null,
    ...(isReviewState(r.state) ? { state: r.state } : {}),
    createdAt: r.created_at,
  }));
}

// Toggle an upvote on a review (no downvotes).
export async function upvoteReview(reviewId: string, upvote: boolean): Promise<void> {
  const { error } = await supabase.rpc(upvote ? "upvote_review" : "remove_review_upvote", { target_review_id: reviewId });
  if (error) throw error;
}

// Flag a review for founder moderation.
export async function reportReview(reviewId: string, reason: string | null = null): Promise<void> {
  const { error } = await supabase.rpc("report_review", { target_review_id: reviewId, reason });
  if (error) throw error;
}

export async function reportReviewPhoto(photoId: string, reason: string | null = null): Promise<void> {
  const { error } = await supabase.rpc("report_review_photo", { target_photo_id: photoId, reason });
  if (error) throw error;
}

export type UserProfile = {
  id: string;
  username: string | null;
  displayName: string | null;
  followers: number;
  following: number;
  isFollowing: boolean;
};

// Another user's public profile, for visiting them from a review.
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase.rpc("get_user_profile", { target: userId });
  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) return null;
  return {
    id: row.id,
    username: row.username ?? null,
    displayName: row.display_name ?? null,
    followers: Number(row.followers ?? 0),
    following: Number(row.following ?? 0),
    isFollowing: !!row.is_following,
  };
}

export type UserReview = {
  id: string;
  placeId: string;
  placeName: string;
  body: string;
  rating: number | null;
  placeRating: number | null;
  state?: Exclude<PlaceState, "go">;
  upvotes: number;
  createdAt: string;
};

// Another user's reviews, with live place names.
export async function getUserReviews(userId: string): Promise<UserReview[]> {
  const { data, error } = await supabase.rpc("get_user_reviews", { target: userId });
  if (error || !Array.isArray(data)) return [];
  const rows = data as any[];
  const pins = await getPlacePins(rows.map((r) => r.place_id));
  return rows.map((r) => ({
    id: r.id,
    placeId: r.place_id,
    placeName: pins[r.place_id]?.name ?? "A place",
    body: r.body,
    rating: r.rating ?? null,
    placeRating: pins[r.place_id]?.rating ?? null,
    ...(isReviewState(r.state) ? { state: r.state } : {}),
    upvotes: Number(r.upvotes ?? 0),
    createdAt: r.created_at,
  }));
}

export async function saveCommunityReview(placeId: string, draft: ReviewDraft): Promise<string | false> {
  const body = draft.body.trim().slice(0, MAX_REVIEW_BODY);
  if (!body) return false;

  const { data, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!data.user) return false;

  const rating = draft.rating ?? null;
  const res = await supabase.rpc("save_place_review_v2", {
    target_place_id: placeId,
    review_id: draft.id ?? null,
    review_body: body,
    review_rating: rating,
  });
  if (res.error) throw res.error;
  return typeof res.data === "string" ? res.data : false;
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
