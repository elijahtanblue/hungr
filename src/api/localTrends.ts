import { supabase } from "../lib/supabase";

export type WeeklyPlaceTrend = {
  placeId: string;
  trendScore: number;
  reviewCount: number;
  checkInCount: number;
  saveCount: number;
  lovedCount: number;
  likedCount: number;
  goCount: number;
  dislikedCount: number;
};

export type LocalTrendType = "popping_off" | "consistently_loved" | "up_and_coming" | "quieter_pick";

export type LocalTrendCard = {
  placeId: string;
  trendType: LocalTrendType;
  headline: string;
  summary: string;
  trendScore: number;
  reviewCount: number;
  checkInCount: number;
  saveCount: number;
  lovedCount: number;
  likedCount: number;
  goCount: number;
  dislikedCount: number;
  actorCount: number;
  averageHungrRating?: number;
};

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getWeeklyPlaceTrends(options: { weeksBack?: number; limit?: number } = {}): Promise<WeeklyPlaceTrend[]> {
  const { data, error } = await supabase.rpc("get_weekly_place_trends", {
    weeks_back: options.weeksBack ?? 1,
    max_rows: options.limit ?? 25,
  });
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((row: any) => typeof row.place_id === "string")
    .map((row: any) => ({
      placeId: row.place_id,
      trendScore: toNumber(row.trend_score),
      reviewCount: toNumber(row.review_count),
      checkInCount: toNumber(row.check_in_count),
      saveCount: toNumber(row.save_count),
      lovedCount: toNumber(row.loved_count),
      likedCount: toNumber(row.liked_count),
      goCount: toNumber(row.go_count),
      dislikedCount: toNumber(row.disliked_count),
    }));
}

function trendType(value: unknown): LocalTrendType {
  return value === "consistently_loved" || value === "up_and_coming" || value === "quieter_pick"
    ? value
    : "popping_off";
}

export async function getLocalTrendCards(
  placeIds: string[],
  options: { weeksBack?: number; limit?: number; minActorCount?: number } = {},
): Promise<LocalTrendCard[]> {
  const candidateIds = Array.from(new Set(placeIds.filter(Boolean))).slice(0, 100);
  if (candidateIds.length === 0) return [];

  const { data, error } = await supabase.rpc("get_local_trend_cards", {
    candidate_place_ids: candidateIds,
    weeks_back: options.weeksBack ?? 1,
    max_rows: options.limit ?? 6,
    min_actor_count: options.minActorCount ?? 2,
  });
  if (error || !Array.isArray(data)) return [];

  return data
    .filter((row: any) => typeof row.place_id === "string")
    .map((row: any) => ({
      placeId: row.place_id,
      trendType: trendType(row.trend_type),
      headline: typeof row.headline === "string" ? row.headline : "Trending nearby",
      summary: typeof row.summary === "string" ? row.summary : "Hungr activity is picking up nearby.",
      trendScore: toNumber(row.trend_score),
      reviewCount: toNumber(row.review_count),
      checkInCount: toNumber(row.check_in_count),
      saveCount: toNumber(row.save_count),
      lovedCount: toNumber(row.loved_count),
      likedCount: toNumber(row.liked_count),
      goCount: toNumber(row.go_count),
      dislikedCount: toNumber(row.disliked_count),
      actorCount: toNumber(row.actor_count),
      averageHungrRating: row.average_hungr_rating == null ? undefined : toNumber(row.average_hungr_rating),
    }));
}
