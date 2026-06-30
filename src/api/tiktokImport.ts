import { supabase } from "../lib/supabase";

export type TikTokImportSource = {
  url: string;
  videoId: string | null;
  creator: string | null;
  creatorUrl: string | null;
  title: string;
};

export type TikTokPlaceCandidate = {
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating?: number;
  cuisines: string[];
  confidence: number;
  recommended: boolean;
  evidence: string;
};

export type TikTokImportResult = {
  source: TikTokImportSource;
  dishTags: string[];
  candidates: TikTokPlaceCandidate[];
};

function isCandidate(value: any): value is TikTokPlaceCandidate {
  return (
    value &&
    typeof value.placeId === "string" &&
    typeof value.name === "string" &&
    typeof value.lat === "number" &&
    typeof value.lng === "number" &&
    Array.isArray(value.cuisines) &&
    typeof value.confidence === "number" &&
    typeof value.recommended === "boolean" &&
    typeof value.evidence === "string"
  );
}

function shapeResult(data: any): TikTokImportResult {
  if (!data?.source || typeof data.source.url !== "string" || !Array.isArray(data.candidates)) {
    throw new Error("Invalid TikTok import response");
  }

  return {
    source: {
      url: data.source.url,
      videoId: typeof data.source.videoId === "string" ? data.source.videoId : null,
      creator: typeof data.source.creator === "string" ? data.source.creator : null,
      creatorUrl: typeof data.source.creatorUrl === "string" ? data.source.creatorUrl : null,
      title: typeof data.source.title === "string" ? data.source.title : "",
    },
    dishTags: Array.isArray(data.dishTags) ? data.dishTags.filter((tag: unknown): tag is string => typeof tag === "string") : [],
    candidates: data.candidates.filter(isCandidate),
  };
}

export async function resolveTikTokLink(url: string, bias: { lat: number; lng: number }): Promise<TikTokImportResult> {
  const { data, error } = await supabase.functions.invoke("tiktok-import", {
    body: { url, lat: bias.lat, lng: bias.lng },
  });
  if (error) throw error;
  return shapeResult(data);
}

export async function saveTikTokCandidate(
  source: TikTokImportSource,
  candidate: TikTokPlaceCandidate,
  dishTags: string[] = [],
): Promise<boolean> {
  const { data, error } = await supabase.rpc("save_tiktok_source", {
    target_place_id: candidate.placeId,
    input_source_url: source.url,
    input_source_video_id: source.videoId,
    input_creator_handle: source.creator,
    input_caption: source.title,
    input_evidence: candidate.evidence,
    input_dish_tags: dishTags,
    input_confidence: candidate.confidence,
  });
  if (error) throw error;
  return !!data;
}
