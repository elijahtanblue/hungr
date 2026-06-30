// Server side only. Holds GOOGLE_PLACES_KEY. Fetches Google Places live and returns
// only display-safe fields plus a coarse cuisine derived from the Google place type.
// NEVER returns or stores review text. Per-user rate limited and auth gated.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_PER_MIN = 60;

// Map Google place types to our cuisine labels. Covers Google's food/drink type library so
// places get richly classified, not just the original six. Keep in sync with the client list
// in src/domain/cuisines.ts. ("Bubble Tea" has no Google type and is tagged as first-party data.)
const TYPE_TO_CUISINE: Record<string, string> = {
  afghani_restaurant: "Afghan",
  african_restaurant: "African",
  american_restaurant: "American",
  asian_restaurant: "Asian",
  bagel_shop: "Bakery",
  bakery: "Bakery",
  bar: "Bar",
  bar_and_grill: "Bar",
  barbecue_restaurant: "BBQ",
  brazilian_restaurant: "Brazilian",
  breakfast_restaurant: "Breakfast",
  brunch_restaurant: "Brunch",
  cafe: "Cafe",
  cafeteria: "Cafe",
  chinese_restaurant: "Chinese",
  coffee_shop: "Cafe",
  deli: "Deli",
  dessert_restaurant: "Dessert",
  dessert_shop: "Dessert",
  diner: "American",
  donut_shop: "Dessert",
  fast_food_restaurant: "Fast Food",
  fine_dining_restaurant: "Fine Dining",
  french_restaurant: "French",
  greek_restaurant: "Greek",
  hamburger_restaurant: "Burgers",
  ice_cream_shop: "Ice Cream",
  indian_restaurant: "Indian",
  indonesian_restaurant: "Indonesian",
  italian_restaurant: "Italian",
  japanese_restaurant: "Japanese",
  juice_shop: "Juice",
  korean_restaurant: "Korean",
  lebanese_restaurant: "Lebanese",
  mediterranean_restaurant: "Mediterranean",
  mexican_restaurant: "Mexican",
  middle_eastern_restaurant: "Middle Eastern",
  pizza_restaurant: "Pizza",
  pub: "Pub",
  ramen_restaurant: "Ramen",
  sandwich_shop: "Sandwiches",
  seafood_restaurant: "Seafood",
  spanish_restaurant: "Spanish",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  tea_house: "Tea",
  thai_restaurant: "Thai",
  turkish_restaurant: "Turkish",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
  vietnamese_restaurant: "Vietnamese",
  wine_bar: "Wine Bar",
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
  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { lat, lng, query } = body.value;
  if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) {
    return new Response("Invalid coordinates", { status: 400 });
  }
  const textQuery = typeof query === "string" && query.trim() ? query.slice(0, 120) : "food";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.primaryType,places.types,places.attributions",
    },
    body: JSON.stringify({
      textQuery,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: 1500 } },
    }),
  });
  // Never forward an upstream error body to the client (it can echo the request and leak detail).
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  const places = (data.places ?? []).map(shapePlace);
  return new Response(JSON.stringify({ places }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
