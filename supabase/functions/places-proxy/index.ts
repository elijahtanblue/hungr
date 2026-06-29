// Server side only. Holds GOOGLE_PLACES_KEY. Fetches Google Places live and returns
// only display-safe fields plus a coarse cuisine derived from the Google place type.
// NEVER returns or stores review text. Per-user rate limited and auth gated.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE")!;
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
  // 1. Authenticate the caller from the forwarded bearer token.
  const authHeader = req.headers.get("Authorization") ?? "";
  const jwt = authHeader.replace("Bearer ", "");
  const anon = createClient(SUPABASE_URL, ANON);
  const { data: userData } = await anon.auth.getUser(jwt);
  if (!userData?.user) return new Response("Unauthorized", { status: 401 });

  // 2. Per-user rate limit (durable, server side).
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: allowed } = await admin.rpc("bump_rate_limit", {
    uid: userData.user.id,
    max_per_min: MAX_PER_MIN,
  });
  if (allowed === false) return new Response("Rate limited", { status: 429 });

  // 3. Fetch Google Places live, asking only for fields we are allowed to display.
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
