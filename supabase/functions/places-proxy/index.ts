// Server side only. Holds GOOGLE_PLACES_KEY. Fetches Google Places live and returns
// only display-safe fields plus a coarse cuisine derived from the Google place type.
// NEVER returns or stores review text. Per-user rate limited and auth gated.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_PER_MIN = 60;

// Google Places has a broad food/drink type table. Map the useful signals into the app
// vocabulary, and intentionally omit generic or unsupported labels. Keep in sync with the client.
const TYPE_TO_CUISINE: Record<string, string> = {
  // National / regional cuisines that map to the app vocabulary
  afghani_restaurant: "Afghan",
  african_restaurant: "African",
  american_restaurant: "American",
  argentinian_restaurant: "Argentinian",
  asian_fusion_restaurant: "Asian",
  asian_restaurant: "Asian",
  british_restaurant: "British",
  brazilian_restaurant: "Brazilian",
  cambodian_restaurant: "Cambodian",
  cantonese_restaurant: "Chinese",
  caribbean_restaurant: "Caribbean",
  chinese_restaurant: "Chinese",
  cuban_restaurant: "Cuban",
  ethiopian_restaurant: "Ethiopian",
  filipino_restaurant: "Filipino",
  french_restaurant: "French",
  german_restaurant: "German",
  greek_restaurant: "Greek",
  hawaiian_restaurant: "Hawaiian",
  indian_restaurant: "Indian",
  indonesian_restaurant: "Indonesian",
  italian_restaurant: "Italian",
  japanese_curry_restaurant: "Japanese",
  japanese_izakaya_restaurant: "Japanese",
  japanese_restaurant: "Japanese",
  korean_barbecue_restaurant: "Korean",
  korean_restaurant: "Korean",
  lebanese_restaurant: "Lebanese",
  malaysian_restaurant: "Malaysian",
  mediterranean_restaurant: "Mediterranean",
  mexican_restaurant: "Mexican",
  middle_eastern_restaurant: "Middle Eastern",
  mongolian_barbecue_restaurant: "Mongolian",
  moroccan_restaurant: "Moroccan",
  north_indian_restaurant: "Indian",
  pakistani_restaurant: "Pakistani",
  persian_restaurant: "Persian",
  peruvian_restaurant: "Peruvian",
  polish_restaurant: "Polish",
  portuguese_restaurant: "Portuguese",
  russian_restaurant: "Russian",
  south_indian_restaurant: "Indian",
  spanish_restaurant: "Spanish",
  sri_lankan_restaurant: "Sri Lankan",
  taiwanese_restaurant: "Taiwanese",
  tapas_restaurant: "Spanish",
  thai_restaurant: "Thai",
  tibetan_restaurant: "Tibetan",
  turkish_restaurant: "Turkish",
  vietnamese_restaurant: "Vietnamese",
  // Dishes, formats, and drinks
  acai_shop: "Dessert",
  bagel_shop: "Bakery",
  bakery: "Bakery",
  bar: "Bar",
  bar_and_grill: "Bar",
  barbecue_restaurant: "BBQ",
  beer_garden: "Bar",
  breakfast_restaurant: "Breakfast",
  brewery: "Bar",
  brewpub: "Pub",
  brunch_restaurant: "Brunch",
  burrito_restaurant: "Mexican",
  cafe: "Cafe",
  cafeteria: "Cafe",
  cake_shop: "Dessert",
  candy_store: "Dessert",
  cat_cafe: "Cafe",
  chicken_restaurant: "Fried Chicken",
  chicken_wings_restaurant: "Fried Chicken",
  chinese_noodle_restaurant: "Chinese",
  chocolate_factory: "Dessert",
  chocolate_shop: "Dessert",
  cocktail_bar: "Bar",
  coffee_roastery: "Cafe",
  coffee_shop: "Cafe",
  coffee_stand: "Cafe",
  confectionery: "Dessert",
  deli: "Deli",
  dessert_restaurant: "Dessert",
  dessert_shop: "Dessert",
  dim_sum_restaurant: "Dim Sum",
  diner: "American",
  dog_cafe: "Cafe",
  donut_shop: "Dessert",
  dumpling_restaurant: "Dumplings",
  falafel_restaurant: "Middle Eastern",
  fast_food_restaurant: "Fast Food",
  fine_dining_restaurant: "Fine Dining",
  fish_and_chips_restaurant: "Seafood",
  gastropub: "Pub",
  gyro_restaurant: "Greek",
  hamburger_restaurant: "Burgers",
  hookah_bar: "Bar",
  hot_pot_restaurant: "Hot Pot",
  ice_cream_shop: "Ice Cream",
  juice_shop: "Juice",
  kebab_shop: "Middle Eastern",
  lounge_bar: "Bar",
  noodle_shop: "Noodles",
  oyster_bar_restaurant: "Seafood",
  pastry_shop: "Dessert",
  pizza_delivery: "Pizza",
  pizza_restaurant: "Pizza",
  pub: "Pub",
  ramen_restaurant: "Ramen",
  salad_shop: "Salad",
  sandwich_shop: "Sandwiches",
  seafood_restaurant: "Seafood",
  shawarma_restaurant: "Middle Eastern",
  snack_bar: "Bar",
  sports_bar: "Bar",
  steak_house: "Steakhouse",
  sushi_restaurant: "Sushi",
  taco_restaurant: "Tacos",
  tea_house: "Tea",
  tex_mex_restaurant: "Mexican",
  tonkatsu_restaurant: "Japanese",
  vegan_restaurant: "Vegan",
  vegetarian_restaurant: "Vegetarian",
  wine_bar: "Wine Bar",
  winery: "Wine Bar",
  yakiniku_restaurant: "Japanese",
  yakitori_restaurant: "Japanese",
};

const NAME_TO_CUISINES: { pattern: RegExp; cuisines: string[] }[] = [
  { pattern: /\bafghan(?:i)?\b/i, cuisines: ["Afghan"] },
  { pattern: /\bafrican\b/i, cuisines: ["African"] },
  { pattern: /\bamerican\b/i, cuisines: ["American"] },
  { pattern: /\bargentin(?:ian|e)\b/i, cuisines: ["Argentinian"] },
  { pattern: /\bbbq\b|\bbarbecue\b|\bbarbeque\b/i, cuisines: ["BBQ"] },
  { pattern: /\bbakery\b|\bbakehouse\b|\bpatisserie\b/i, cuisines: ["Bakery"] },
  { pattern: /\bbar\b/i, cuisines: ["Bar"] },
  { pattern: /\bbreakfast\b/i, cuisines: ["Breakfast"] },
  { pattern: /\bbrazilian\b/i, cuisines: ["Brazilian"] },
  { pattern: /\bbritish\b|\benglish\b/i, cuisines: ["British"] },
  { pattern: /\bbrunch\b/i, cuisines: ["Brunch"] },
  { pattern: /\bboba\b|\bbubble tea\b/i, cuisines: ["Bubble Tea"] },
  { pattern: /\bburger(s)?\b|\bhamburger(s)?\b/i, cuisines: ["Burgers"] },
  { pattern: /\bcambodian\b|\bkhmer\b/i, cuisines: ["Cambodian"] },
  { pattern: /\bcaribbean\b/i, cuisines: ["Caribbean"] },
  { pattern: /\bcafe\b|\bcoffee\b/i, cuisines: ["Cafe"] },
  { pattern: /\bchinese\b/i, cuisines: ["Chinese"] },
  { pattern: /\bcuban\b/i, cuisines: ["Cuban"] },
  { pattern: /\bdeli\b|\bdelicatessen\b/i, cuisines: ["Deli"] },
  { pattern: /\bdessert(s)?\b|\bdonut(s)?\b|\bdoughnut(s)?\b/i, cuisines: ["Dessert"] },
  { pattern: /\bdim sum\b/i, cuisines: ["Dim Sum"] },
  { pattern: /\bdumpling(s)?\b/i, cuisines: ["Dumplings"] },
  { pattern: /\begyptian\b/i, cuisines: ["Egyptian"] },
  { pattern: /\bethiopian\b/i, cuisines: ["Ethiopian"] },
  { pattern: /\bfilipino\b|\bpinoy\b/i, cuisines: ["Filipino"] },
  { pattern: /\bfast food\b/i, cuisines: ["Fast Food"] },
  { pattern: /\bfine dining\b/i, cuisines: ["Fine Dining"] },
  { pattern: /\bfrench\b/i, cuisines: ["French"] },
  { pattern: /\bfried chicken\b/i, cuisines: ["Fried Chicken"] },
  { pattern: /\bgerman\b/i, cuisines: ["German"] },
  { pattern: /\bgreek\b/i, cuisines: ["Greek"] },
  { pattern: /\bhawaiian\b|\bpoke\b/i, cuisines: ["Hawaiian"] },
  { pattern: /\bhot pot\b/i, cuisines: ["Hot Pot"] },
  { pattern: /\bice cream\b|\bgelato\b/i, cuisines: ["Ice Cream"] },
  { pattern: /\bindian\b/i, cuisines: ["Indian"] },
  { pattern: /\bindonesian\b/i, cuisines: ["Indonesian"] },
  { pattern: /\bitalian\b|\bpasta\b/i, cuisines: ["Italian"] },
  { pattern: /\bjapanese\b/i, cuisines: ["Japanese"] },
  { pattern: /\bjuice\b/i, cuisines: ["Juice"] },
  { pattern: /\bkorean\b/i, cuisines: ["Korean"] },
  { pattern: /\blao(?:tian)?\b/i, cuisines: ["Laotian"] },
  { pattern: /\blebanese\b/i, cuisines: ["Lebanese"] },
  { pattern: /\bmalay(sian)?\b/i, cuisines: ["Malaysian"] },
  { pattern: /\bmediterranean\b/i, cuisines: ["Mediterranean"] },
  { pattern: /\bmexican\b|\bburrito(s)?\b/i, cuisines: ["Mexican"] },
  { pattern: /\bmiddle eastern\b/i, cuisines: ["Middle Eastern"] },
  { pattern: /\bmongolian\b/i, cuisines: ["Mongolian"] },
  { pattern: /\bmoroccan\b/i, cuisines: ["Moroccan"] },
  { pattern: /\bnepalese\b|\bnepali\b/i, cuisines: ["Nepalese"] },
  { pattern: /\bnoodle(s)?\b/i, cuisines: ["Noodles"] },
  { pattern: /\bpakistani\b/i, cuisines: ["Pakistani"] },
  { pattern: /\bpersian\b|\birani(?:an)?\b/i, cuisines: ["Persian"] },
  { pattern: /\bperuvian\b/i, cuisines: ["Peruvian"] },
  { pattern: /\bpizza\b/i, cuisines: ["Pizza"] },
  { pattern: /\bpolish\b/i, cuisines: ["Polish"] },
  { pattern: /\bportuguese\b/i, cuisines: ["Portuguese"] },
  { pattern: /\bpub\b/i, cuisines: ["Pub"] },
  { pattern: /\bramen\b/i, cuisines: ["Ramen"] },
  { pattern: /\brussian\b/i, cuisines: ["Russian"] },
  { pattern: /\bsalad(s)?\b/i, cuisines: ["Salad"] },
  { pattern: /\bsandwich(es)?\b|\bsando(s)?\b/i, cuisines: ["Sandwiches"] },
  { pattern: /\bseafood\b|\boyster(s)?\b/i, cuisines: ["Seafood"] },
  { pattern: /\bsingapore(?:an)?\b/i, cuisines: ["Singaporean"] },
  { pattern: /\bspanish\b|\btapas\b/i, cuisines: ["Spanish"] },
  { pattern: /\bsri lankan\b/i, cuisines: ["Sri Lankan"] },
  { pattern: /\bsteakhouse\b|\bsteak house\b/i, cuisines: ["Steakhouse"] },
  { pattern: /\bsushi\b/i, cuisines: ["Sushi"] },
  { pattern: /\btaco(s)?\b/i, cuisines: ["Tacos"] },
  { pattern: /\btaiwan(?:ese)?\b/i, cuisines: ["Taiwanese"] },
  { pattern: /\btea\b|\bteahouse\b|\btea house\b/i, cuisines: ["Tea"] },
  { pattern: /\bthai\b/i, cuisines: ["Thai"] },
  { pattern: /\btibetan\b/i, cuisines: ["Tibetan"] },
  { pattern: /\bturkish\b/i, cuisines: ["Turkish"] },
  { pattern: /\bvegan\b/i, cuisines: ["Vegan"] },
  { pattern: /\bvegetarian\b/i, cuisines: ["Vegetarian"] },
  { pattern: /\bviet(?:namese)?\b/i, cuisines: ["Vietnamese"] },
  { pattern: /\bwine bar\b/i, cuisines: ["Wine Bar", "Bar"] },
];

const PARENT_CUISINES: Record<string, string[]> = {
  "Bubble Tea": ["Asian"],
  Cambodian: ["Asian"],
  Chinese: ["Asian"],
  "Dim Sum": ["Asian"],
  Dumplings: ["Asian"],
  Filipino: ["Asian"],
  "Hot Pot": ["Asian"],
  Indian: ["Asian"],
  Indonesian: ["Asian"],
  Japanese: ["Asian"],
  Korean: ["Asian"],
  Laotian: ["Asian"],
  Malaysian: ["Asian"],
  Mongolian: ["Asian"],
  Nepalese: ["Asian"],
  Noodles: ["Asian"],
  Pakistani: ["Asian"],
  Pizza: ["Italian"],
  Ramen: ["Asian"],
  Singaporean: ["Asian"],
  "Sri Lankan": ["Asian"],
  Sushi: ["Asian"],
  Tacos: ["Mexican"],
  Taiwanese: ["Asian"],
  Thai: ["Asian"],
  Tibetan: ["Asian"],
  Vietnamese: ["Asian"],
  "Wine Bar": ["Bar"],
};

type SafePlace = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;
  priceLevel?: string;
  cuisines: string[];
  attribution: string;
};

function clampRadius(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1500;
  return Math.max(2000, Math.min(50000, Math.round(value)));
}

function addCuisine(cuisines: Set<string>, cuisine: string) {
  cuisines.add(cuisine);
  for (const parent of PARENT_CUISINES[cuisine] ?? []) cuisines.add(parent);
}

function normalizeName(raw: any): string {
  const text = raw.displayName?.text;
  if (typeof text !== "string") return "";
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function shapePlace(raw: any): SafePlace {
  const types: string[] = [raw.primaryType, ...(raw.types ?? [])].filter(Boolean);
  const cuisines = new Set<string>();
  for (const type of types) {
    const cuisine = TYPE_TO_CUISINE[type];
    if (cuisine) addCuisine(cuisines, cuisine);
  }
  const name = normalizeName(raw);
  for (const { pattern, cuisines: matches } of NAME_TO_CUISINES) {
    if (!pattern.test(name)) continue;
    for (const cuisine of matches) addCuisine(cuisines, cuisine);
  }
  // Bubble tea: trust Google's own category label (e.g. "Bubble tea store"), not the place name,
  // since plenty of places sell tea without being a bubble tea shop.
  const displayType = raw.primaryTypeDisplayName?.text;
  if (typeof displayType === "string" && /bubble tea|boba/i.test(displayType)) {
    addCuisine(cuisines, "Bubble Tea");
  }
  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? "",
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    rating: raw.rating,
    priceLevel: raw.priceLevel,
    cuisines: Array.from(cuisines),
    attribution: (raw.attributions && raw.attributions[0]) || "Listing by Google",
  };
}

export function buildTextSearchBody(lat: number, lng: number, textQuery: string, pageToken?: string, radiusMeters?: number, openNow?: boolean) {
  return {
    textQuery,
    pageSize: 20,
    locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: clampRadius(radiusMeters) } },
    // Server-side "open now" filtering: free (a Text Search request param), unlike pulling each
    // place's full hours into the result set.
    ...(openNow ? { openNow: true } : {}),
    ...(pageToken ? { pageToken } : {}),
  };
}

export default async function handler(req: Request): Promise<Response> {
  // Authenticate the caller and enforce the per-user rate limit.
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  // Fetch Google Places live, asking only for fields we are allowed to display.
  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { lat, lng, query, pageToken, radiusMeters, openNow } = body.value;
  if (typeof lat !== "number" || typeof lng !== "number" || !isFinite(lat) || !isFinite(lng)) {
    return new Response("Invalid coordinates", { status: 400 });
  }
  const textQuery = typeof query === "string" && query.trim() ? query.slice(0, 120) : "food";
  const token = typeof pageToken === "string" && pageToken.trim() ? pageToken : undefined;
  const radius = typeof radiusMeters === "number" ? radiusMeters : undefined;
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.location,places.rating,places.priceLevel,places.primaryType,places.primaryTypeDisplayName,places.types,places.attributions",
    },
    body: JSON.stringify(buildTextSearchBody(lat, lng, textQuery, token, radius, openNow === true)),
  });
  // Never forward an upstream error body to the client (it can echo the request and leak detail).
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  const places = (data.places ?? []).map(shapePlace);
  return new Response(JSON.stringify({ places, nextPageToken: data.nextPageToken }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
