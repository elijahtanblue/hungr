import { supabase } from "../lib/supabase";
import { deriveTraits, deriveTasteInsights, type Trait } from "../domain/tasteTitles";
import { getRecentCheckInCount } from "./checkins";

export type { Trait };

export type SearchTasteEvent = {
  cuisines?: string[];
  dietary?: string[];
  priceBand?: { min?: number | null; max?: number | null } | null;
  occasion?: string | null;
};

export type TasteFeatureScore = {
  feature: string;
  score: number;
  evidenceCount: number;
  lastSeenAt: string;
};

export type TasteTrackingSettings = {
  tasteTrackingEnabled: boolean;
};

function finiteNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function cleanList(values?: string[]): string[] {
  return Array.isArray(values)
    ? values.map((value) => value.trim()).filter(Boolean).slice(0, 20)
    : [];
}

// A tag someone adds on a review (e.g. "spicy", "great for groups") is a taste signal. It already
// attaches to the place via place_tags; this also records it against the user's own taste profile
// as a review_text_tag event. Server no-ops if the user has opted out of personalization.
export async function recordReviewTagTaste(placeId: string, tag: string): Promise<boolean> {
  const cleanTag = tag.trim().slice(0, 80);
  if (!cleanTag) return false;
  const { data, error } = await supabase.rpc("record_taste_event", {
    input_event_type: "review_text_tag",
    input_place_id: placeId,
    input_tag: cleanTag,
    input_signal: "review_tag",
    input_weight: 1,
    input_source: "review",
  });
  return !error && data === true;
}

export async function recordSearchTasteEvent(event: SearchTasteEvent): Promise<number> {
  const { data, error } = await supabase.rpc("record_search_taste_event", {
    input_cuisines: cleanList(event.cuisines),
    input_dietary: cleanList(event.dietary),
    input_price_min: event.priceBand?.min ?? null,
    input_price_max: event.priceBand?.max ?? null,
    input_occasion: event.occasion?.trim() || null,
  });
  if (error) return 0;
  return finiteNumber(data);
}

export async function getTasteFeatureScores(limit = 50): Promise<TasteFeatureScore[]> {
  const { data, error } = await supabase.rpc("get_taste_feature_scores", { max_rows: limit });
  if (error || !Array.isArray(data)) return [];
  return data
    .filter((row: any) => typeof row.feature === "string")
    .map((row: any) => ({
      feature: row.feature,
      score: finiteNumber(row.score),
      evidenceCount: finiteNumber(row.evidence_count),
      lastSeenAt: typeof row.last_seen_at === "string" ? row.last_seen_at : "",
    }));
}

// The earned taste "traits" for the current user, derived deterministically from their taste vector
// plus how often they have eaten out lately. Shown as golden bubbles on the account. Fails soft.
export async function getMyTraits(): Promise<Trait[]> {
  const [features, recentCheckIns] = await Promise.all([
    getTasteFeatureScores(100),
    getRecentCheckInCount(7).catch(() => 0),
  ]);
  const vector = features.map((f) => ({ feature: f.feature, score: f.score, evidenceCount: f.evidenceCount }));
  return deriveTraits(vector, { recentCheckIns }).filter((t) => t.earned);
}

// Short, human insight sentences for the account "what hungr has learned" section. Fails soft to [].
export async function getMyTasteInsights(): Promise<string[]> {
  const [features, recentCheckIns] = await Promise.all([
    getTasteFeatureScores(100),
    getRecentCheckInCount(7).catch(() => 0),
  ]);
  const vector = features.map((f) => ({ feature: f.feature, score: f.score, evidenceCount: f.evidenceCount }));
  return deriveTasteInsights(vector, { recentCheckIns });
}

// A light "you follow trends" signal: recorded when the user opens a place from the Local trends
// rail. Uses the search_facet event type (no schema change) with a distinct signal name. Server
// no-ops if the user has opted out of personalization.
export async function recordTrendFollowTaste(placeId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("record_taste_event", {
    input_event_type: "search_facet",
    input_place_id: placeId,
    input_signal: "followed_trend",
    input_weight: 1,
    input_source: "system",
  });
  return !error && data === true;
}

export async function getTasteTrackingSettings(): Promise<TasteTrackingSettings> {
  const { data, error } = await supabase.rpc("get_taste_tracking_settings");
  const row = Array.isArray(data) ? data[0] : null;
  if (error || !row) return { tasteTrackingEnabled: true };
  return { tasteTrackingEnabled: row.taste_tracking_enabled !== false };
}

export async function setTasteTrackingEnabled(enabled: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc("set_taste_tracking_enabled", { enabled });
  return !error && data === true;
}

export async function deleteMyTasteEvents(): Promise<boolean> {
  const { data, error } = await supabase.rpc("delete_my_taste_events");
  return !error && data === true;
}
