export type SearchKind = "typed" | "nearby";
export type LocationMode = "bias" | "restriction";
export type SearchEndpoint = "text" | "nearby";

export type PlaceSearchStrategy = {
  id: string;
  endpoint: SearchEndpoint;
  textQuery: string;
  locationMode: LocationMode;
  includedType?: string;
  includedTypes?: string[];
  rankPreference?: "DISTANCE" | "RELEVANCE" | "POPULARITY";
};

const CATEGORY_TYPES: { label: string; type: string; pattern: RegExp; query: string }[] = [
  { label: "Hot Pot", type: "hot_pot_restaurant", pattern: /\bhot\s*pot\b|\bhotpot\b/i, query: "hot pot restaurant" },
  { label: "Ramen", type: "ramen_restaurant", pattern: /\bramen\b/i, query: "ramen restaurant" },
  { label: "Sushi", type: "sushi_restaurant", pattern: /\bsushi\b/i, query: "sushi restaurant" },
  { label: "Pizza", type: "pizza_restaurant", pattern: /\bpizza\b/i, query: "pizza restaurant" },
  { label: "Cafe", type: "cafe", pattern: /\bcafe\b|\bcoffee\b/i, query: "cafe coffee" },
  { label: "Bar", type: "bar", pattern: /\bbar\b|\bdrinks?\b/i, query: "bar" },
  { label: "Burgers", type: "hamburger_restaurant", pattern: /\bburger(s)?\b|\bhamburger(s)?\b/i, query: "burger restaurant" },
  { label: "Chinese", type: "chinese_restaurant", pattern: /\bchinese\b/i, query: "chinese restaurant" },
  { label: "Japanese", type: "japanese_restaurant", pattern: /\bjapanese\b/i, query: "japanese restaurant" },
  { label: "Korean", type: "korean_restaurant", pattern: /\bkorean\b/i, query: "korean restaurant" },
  { label: "Thai", type: "thai_restaurant", pattern: /\bthai\b/i, query: "thai restaurant" },
  { label: "Vietnamese", type: "vietnamese_restaurant", pattern: /\bviet(?:namese)?\b/i, query: "vietnamese restaurant" },
  { label: "Italian", type: "italian_restaurant", pattern: /\bitalian\b|\bpasta\b/i, query: "italian restaurant" },
  { label: "Mexican", type: "mexican_restaurant", pattern: /\bmexican\b|\btaco(s)?\b/i, query: "mexican restaurant" },
  { label: "Steakhouse", type: "steak_house", pattern: /\bsteakhouse\b|\bsteak house\b|\bsteak\b/i, query: "steakhouse" },
];

function cleanQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim().slice(0, 120);
}

function foodify(query: string): string {
  const clean = cleanQuery(query);
  if (!clean) return "food restaurants";
  if (/\b(food|restaurant|restaurants|cafe|coffee|bar|pub|dinner|lunch|breakfast|brunch)\b/i.test(clean)) {
    return clean;
  }
  return `${clean} restaurant`.slice(0, 120);
}

function categoryFor(query: string) {
  return CATEGORY_TYPES.find((category) => category.pattern.test(query));
}

export function planPlaceSearch(query: string, kind: SearchKind): PlaceSearchStrategy[] {
  const clean = cleanQuery(query);
  if (kind === "nearby") {
    return [
      { id: "nearby-food-types", endpoint: "nearby", textQuery: "food restaurants cafes", locationMode: "restriction", includedTypes: ["restaurant", "cafe", "bar", "bakery", "meal_takeaway"], rankPreference: "POPULARITY" },
      { id: "nearby-food-text", endpoint: "text", textQuery: "food restaurants cafes", locationMode: "restriction", rankPreference: "RELEVANCE" },
    ];
  }

  const category = categoryFor(clean);
  if (category) {
    const typedQuery = foodify(clean);
    return [
      { id: `${category.label.toLowerCase().replace(/\s+/g, "-")}-local-type`, endpoint: "text", textQuery: category.query, locationMode: "restriction", includedType: category.type, rankPreference: "DISTANCE" },
      { id: "typed-local-text", endpoint: "text", textQuery: typedQuery, locationMode: "restriction", rankPreference: "RELEVANCE" },
      { id: "typed-broad-text", endpoint: "text", textQuery: typedQuery, locationMode: "bias", rankPreference: "RELEVANCE" },
    ];
  }

  const typedQuery = foodify(clean);
  return [
    { id: "typed-local-text", endpoint: "text", textQuery: typedQuery, locationMode: "restriction", rankPreference: "RELEVANCE" },
    { id: "typed-local-distance", endpoint: "text", textQuery: typedQuery, locationMode: "restriction", rankPreference: "DISTANCE" },
    { id: "typed-broad-text", endpoint: "text", textQuery: typedQuery, locationMode: "bias", rankPreference: "RELEVANCE" },
  ];
}
