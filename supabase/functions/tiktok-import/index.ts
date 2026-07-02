// Personal TikTok capture. Reads TikTok oEmbed metadata, searches Google Places live, and
// returns candidates for user confirmation. It never saves a place and never downloads video.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const GOOGLE_KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_PER_MIN = 20;
const MIN_CONFIDENCE = 0.9;

type TikTokSource = {
  url: string;
  videoId: string | null;
  creator: string | null;
  creatorUrl: string | null;
  title: string;
  hashtags: string[];
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

const TYPE_TO_CUISINE: Record<string, string> = {
  bar: "Bar",
  cafe: "Cafe",
  coffee_shop: "Cafe",
  hamburger_restaurant: "Burgers",
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  korean_restaurant: "Korean",
  pizza_restaurant: "Pizza",
  ramen_restaurant: "Ramen",
  restaurant: "Restaurant",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  thai_restaurant: "Thai",
  vietnamese_restaurant: "Vietnamese",
};

const DISH_TAGS = [
  "bbq",
  "burger",
  "coffee",
  "croissant",
  "dumpling",
  "laksa",
  "noodle",
  "pasta",
  "pizza",
  "ramen",
  "rib eye",
  "steak",
  "sushi",
  "taco",
];

export function isSafeTikTokUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "tiktok.com" || host.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

export function videoIdFromUrl(url: string): string | null {
  const match = /\/video\/(\d+)/.exec(url);
  return match?.[1] ?? null;
}

export function cleanTikTokTitle(title: string): string {
  return title
    .replace(/#[\p{L}\p{N}_]+/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

export function hashtagsFromTitle(title: string): string[] {
  const out: string[] = [];
  const matches = title.matchAll(/#([\p{L}\p{N}_]+)/gu);
  for (const match of matches) {
    const tag = normalize(match[1]).replace(/\s+/g, "");
    if (tag.length < 2 || tag.length > 32) continue;
    if (!out.includes(tag)) out.push(tag);
    if (out.length >= 10) break;
  }
  return out;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function wordOverlap(title: string, name: string): number {
  const titleWords = new Set(normalize(title).split(" ").filter((word) => word.length > 2));
  const nameWords = normalize(name).split(" ").filter((word) => word.length > 2);
  if (nameWords.length === 0) return 0;
  return nameWords.filter((word) => titleWords.has(word)).length / nameWords.length;
}

function cuisinesFor(raw: any): string[] {
  const types = [raw.primaryType, ...(raw.types ?? [])].filter((type): type is string => typeof type === "string");
  const out = new Set<string>();
  for (const type of types) {
    const cuisine = TYPE_TO_CUISINE[type];
    if (cuisine) out.add(cuisine);
  }
  return Array.from(out).filter((label) => label !== "Restaurant");
}

function scoreCandidate(title: string, name: string, rank: number): { confidence: number; evidence: string; recommended: boolean } {
  const cleanTitle = cleanTikTokTitle(title);
  const normalizedTitle = normalize(cleanTitle);
  const normalizedName = normalize(name);
  if (normalizedName && normalizedTitle.includes(normalizedName)) {
    return {
      confidence: 0.99,
      recommended: true,
      evidence: `TikTok caption mentions ${name}.`,
    };
  }

  const overlap = wordOverlap(cleanTitle, name);
  if (overlap >= 0.67) {
    return {
      confidence: 0.94,
      recommended: false,
      evidence: `TikTok caption partly matches ${name}.`,
    };
  }

  if (rank === 0 && cleanTitle.length >= 12) {
    return {
      confidence: 0.9,
      recommended: false,
      evidence: "Closest Google match for the TikTok caption.",
    };
  }

  return {
    confidence: 0,
    recommended: false,
    evidence: "Weak match.",
  };
}

export function shapeCandidates(rawPlaces: any[], title: string): TikTokPlaceCandidate[] {
  return rawPlaces
    .map((raw, rank): TikTokPlaceCandidate | null => {
      const name = raw?.displayName?.text;
      const lat = raw?.location?.latitude;
      const lng = raw?.location?.longitude;
      if (typeof raw?.id !== "string" || typeof name !== "string" || typeof lat !== "number" || typeof lng !== "number") {
        return null;
      }
      const score = scoreCandidate(title, name, rank);
      if (score.confidence < MIN_CONFIDENCE) return null;
      return {
        placeId: raw.id,
        name,
        address: typeof raw.formattedAddress === "string" ? raw.formattedAddress : "",
        lat,
        lng,
        rating: typeof raw.rating === "number" ? raw.rating : undefined,
        cuisines: cuisinesFor(raw),
        confidence: score.confidence,
        recommended: score.recommended,
        evidence: score.evidence,
      };
    })
    .filter((candidate): candidate is TikTokPlaceCandidate => candidate !== null)
    .slice(0, 3);
}

export function dishTagsFromTitle(title: string): string[] {
  const text = normalize(title);
  return DISH_TAGS.filter((tag) => text.includes(normalize(tag))).slice(0, 5);
}

async function resolveTikTokUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return isSafeTikTokUrl(res.url) ? res.url : url;
  } catch {
    return url;
  }
}

async function getOembed(url: string): Promise<TikTokSource> {
  const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error("TikTok oEmbed failed");
  const data = await res.json();
  const rawTitle = typeof data?.title === "string" ? data.title : "";
  const title = cleanTikTokTitle(rawTitle);
  return {
    url,
    videoId: videoIdFromUrl(url),
    creator: typeof data?.author_name === "string" ? data.author_name : null,
    creatorUrl: typeof data?.author_url === "string" ? data.author_url : null,
    title,
    hashtags: hashtagsFromTitle(rawTitle),
  };
}

async function searchGooglePlaces(title: string, lat?: number, lng?: number): Promise<any[]> {
  const body = {
    textQuery: `${title || "food"} restaurant`.slice(0, 180),
    pageSize: 5,
    ...(typeof lat === "number" && typeof lng === "number"
      ? { locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 8000 } } }
      : {}),
  };
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.primaryType,places.types",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Google Places failed");
  const data = await res.json();
  return Array.isArray(data?.places) ? data.places : [];
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { url, lat, lng } = body.value;
  if (!isSafeTikTokUrl(url)) return new Response("Invalid TikTok URL", { status: 400 });

  try {
    const canonicalUrl = await resolveTikTokUrl(url);
    const source = await getOembed(canonicalUrl);
    const rawPlaces = await searchGooglePlaces(
      source.title,
      typeof lat === "number" && Number.isFinite(lat) ? lat : undefined,
      typeof lng === "number" && Number.isFinite(lng) ? lng : undefined,
    );
    const candidates = shapeCandidates(rawPlaces, source.title);
    return new Response(JSON.stringify({ source, dishTags: source.hashtags, candidates }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
}

if (import.meta.main) Deno.serve(handler);
