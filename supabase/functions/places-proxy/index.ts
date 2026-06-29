// Server side only. Holds GOOGLE_PLACES_KEY. Fetches Google Places live and returns
// only display-safe fields plus a coarse cuisine derived from the Google place type.
// NEVER returns or stores review text. Per-user rate limited and auth gated.
import { guard } from "../_shared/guard.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_PER_MIN = 60;

// Google place types are coarse. Map the ones we support to a v1 cuisine label.
const TYPE_TO_CUISINE: Record<string, string> = {
  chinese_restaurant: "Chinese",
  korean_restaurant: "Korean",
  japanese_restaurant: "Japanese",
  sushi_restaurant: "Japanese",
  ramen_restaurant: "Japanese",
  thai_restaurant: "Thai",
  vietnamese_restaurant: "Vietnamese",
  indian_restaurant: "Indian",
};

type SafePlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  cuisines: string[];
  attribution: string;
};

export function shapePlace(raw: any): SafePlace {
  const types: string[] = [raw.primaryType, ...(raw.types ?? [])].filter(Boolean);
  const cuisines = Array.from(
    new Set(types.map((t) => TYPE_TO_CUISINE[t]).filter(Boolean) as string[]),
  );
  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? "",
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    rating: raw.rating,
    cuisines,
    attribution: (raw.attributions && raw.attributions[0]) || "Listing by Google",
  };
}

export default async function handler(req: Request): Promise<Response> {
  // Authenticate the caller and enforce the per-user rate limit.
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  // Fetch Google Places live, asking only for fields we are allowed to display.
  const { lat, lng, query } = await req.json();
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.primaryType,places.types,places.attributions",
    },
    body: JSON.stringify({
      textQuery: query ?? "food",
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 1500 } },
    }),
  });
  const data = await res.json();
  const places = (data.places ?? []).map(shapePlace);
  return new Response(JSON.stringify({ places }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
