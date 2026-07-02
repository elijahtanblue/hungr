// Backend-only AI chat for restaurant discovery.
//
// This endpoint does not store chat history. It may store distilled taste memories such as
// "likes_classy_bars", after validation and sensitive-trait filtering.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AI_CHAT_STYLE_GUARDRAILS, normalizeAiCopyStyle } from "../_shared/ai_style.ts";
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GEMINI_KEY")!;
const PLACES_KEY = Deno.env.get("GOOGLE_PLACES_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("HUNGR_SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("HUNGR_SUPABASE_ANON_KEY")!;
const MAX_PER_MIN = 8;

export type TasteMemory = {
  key: string;
  value: string;
  confidence: number;
};

export type AiChatPromptContext = {
  message: string;
  recentMessages: ChatMessage[];
  favoriteCuisines: string[];
  stateCounts: Record<string, number>;
  memories: TasteMemory[];
  recommendationPlaces: RecommendationPlace[];
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type AiChatResponse = {
  answer: string;
  followUpQuestion: string | null;
  memories: TasteMemory[];
};

export type RecommendationPlace = {
  placeId: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  cuisines: string[];
};

export type SearchIntent = {
  area: string | null;
  wantsNearby: boolean;
  budgetText: string | null;
  reliable: boolean;
  adventurous: boolean;
  cuisines: string[];
  meal: string | null;
};

const FOOD_SCOPE_PATTERN =
  /\b(food|restaurant|restaurants|cafe|cafes|coffee|bar|bars|pub|dinner|lunch|brunch|breakfast|date night|anniversary|birthday|eat|eats|meal|sushi|ramen|thai|korean|japanese|chinese|vietnamese|italian|pizza|pasta|taco|burger|steak|noodle|dessert)\b/i;

const SENSITIVE_MEMORY_PATTERN =
  /(ethnic|ethnicity|heritage|religion|religious|race|racial|health|medical|disability|disabled|gender|sexual|politic|political)/i;

const TYPE_TO_CUISINE: Record<string, string> = {
  asian_fusion_restaurant: "Asian",
  asian_restaurant: "Asian",
  cafe: "Cafe",
  chinese_restaurant: "Chinese",
  japanese_restaurant: "Japanese",
  korean_barbecue_restaurant: "Korean",
  korean_restaurant: "Korean",
  malaysian_restaurant: "Malaysian",
  restaurant: "Restaurant",
  thai_restaurant: "Thai",
  vietnamese_restaurant: "Vietnamese",
};

const PARENT_CUISINES: Record<string, string[]> = {
  Chinese: ["Asian"],
  Japanese: ["Asian"],
  Korean: ["Asian"],
  Malaysian: ["Asian"],
  Thai: ["Asian"],
  Vietnamese: ["Asian"],
};

const FOOD_TYPES = new Set([
  "bar",
  "cafe",
  "food",
  "meal_takeaway",
  "restaurant",
  ...Object.keys(TYPE_TO_CUISINE),
]);

export function isFoodDiscoveryMessage(message: string): boolean {
  return FOOD_SCOPE_PATTERN.test(message);
}

export function isFoodDiscoveryRequest(message: string, recentMessages: ChatMessage[] = []): boolean {
  return isFoodDiscoveryMessage([message, ...recentMessages.map((m) => m.text)].join(" "));
}

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim().slice(0, max);
  return clean ? clean : null;
}

function cleanMemoryKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim().toLowerCase();
  if (!clean || !/^[a-z0-9_]{3,64}$/.test(clean)) return null;
  if (SENSITIVE_MEMORY_PATTERN.test(clean)) return null;
  return clean;
}

function cleanConfidence(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0.6;
  return Math.min(1, Math.max(0, Math.round(n * 100) / 100));
}

function titleCaseArea(area: string): string {
  return area
    .split(/\s+/)
    .map((part) => part.length <= 3 && part.toLowerCase() === "cbd" ? "CBD" : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function addCuisine(out: Set<string>, cuisine: string) {
  if (cuisine === "Restaurant") return;
  out.add(cuisine);
  for (const parent of PARENT_CUISINES[cuisine] ?? []) out.add(parent);
}

export function extractSearchIntent(message: string, recentMessages: ChatMessage[] = []): SearchIntent {
  const conversationText = [message, ...recentMessages.map((m) => m.text)].join(" ");
  const lower = conversationText.toLowerCase();
  const currentLower = message.toLowerCase();
  const knownAreas = [
    "sydney cbd",
    "melbourne cbd",
    "surry hills",
    "darlinghurst",
    "haymarket",
    "chinatown",
    "newtown",
    "bondi",
    "san francisco",
  ];
  const area =
    knownAreas.find((a) => currentLower.includes(a)) ??
    knownAreas.find((a) => lower.includes(a)) ??
    (/\bcbd\b/i.test(message) ? "cbd" : null);

  const budgetMatch = conversationText.match(/(?:under|less than|below|<)\s*\$?\s*(\d{1,3})\s*(?:\$?\s*pp|per person)?/i) ??
    conversationText.match(/\$?\s*(\d{1,3})\s*\$?\s*pp/i);
  const cuisines = new Set<string>();
  for (const [pattern, label] of [
    [/\basian\b/i, "Asian"],
    [/\bthai\b/i, "Thai"],
    [/\bjapanese|sushi|ramen\b/i, "Japanese"],
    [/\bkorean\b/i, "Korean"],
    [/\bchinese\b/i, "Chinese"],
    [/\bvietnamese|viet\b/i, "Vietnamese"],
    [/\bmalaysian|malay\b/i, "Malaysian"],
  ] as const) {
    if (pattern.test(conversationText)) cuisines.add(label);
  }

  return {
    area: area ? titleCaseArea(area) : null,
    wantsNearby: /\bnear me|nearby\b/i.test(conversationText),
    budgetText: budgetMatch ? `under $${budgetMatch[1]}pp` : (/\bcheap|budget|inexpensive\b/i.test(conversationText) ? "cheap" : null),
    reliable: /\breliable|safe|classic|consistent|sure thing\b/i.test(conversationText),
    adventurous: /\badventurous|wildcard|interesting|different|new\b/i.test(conversationText),
    cuisines: Array.from(cuisines),
    meal: /\blunch\b/i.test(conversationText) ? "lunch" : (/\bdinner|date night|anniversary\b/i.test(conversationText) ? "dinner" : null),
  };
}

export function buildSearchTextQuery(intent: SearchIntent): string {
  const parts = [
    intent.budgetText === "cheap" || intent.budgetText?.includes("$") ? "cheap" : "",
    intent.reliable ? "highly rated" : "",
    intent.adventurous ? "interesting" : "",
    intent.cuisines.length ? intent.cuisines.join(" ") : "",
    intent.meal ?? "food",
    "restaurants",
    intent.area ?? "",
  ].filter(Boolean);
  return parts.join(" ").slice(0, 160);
}

export function shapeRecommendationPlace(raw: any): RecommendationPlace | null {
  const types: string[] = [raw?.primaryType, ...(raw?.types ?? [])].filter((x): x is string => typeof x === "string");
  if (!types.some((type) => FOOD_TYPES.has(type))) return null;
  const name = cleanString(raw?.displayName?.text, 120);
  const id = cleanString(raw?.id, 220);
  if (!name || !id) return null;
  const cuisines = new Set<string>();
  for (const type of types) {
    const cuisine = TYPE_TO_CUISINE[type];
    if (cuisine) addCuisine(cuisines, cuisine);
  }
  return {
    placeId: id,
    name,
    rating: typeof raw.rating === "number" ? raw.rating : undefined,
    userRatingCount: typeof raw.userRatingCount === "number" ? raw.userRatingCount : undefined,
    priceLevel: typeof raw.priceLevel === "string" ? raw.priceLevel : undefined,
    cuisines: Array.from(cuisines),
  };
}

export function shapeRecentMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatMessage[] = [];
  for (const item of raw) {
    const obj = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const role = obj.role === "user" || obj.role === "assistant" ? obj.role : null;
    const text = cleanString(obj.text, 500);
    if (!role || !text) continue;
    out.push({ role, text });
    if (out.length >= 8) break;
  }
  return out;
}

export function shapeMemoryWrites(raw: unknown): TasteMemory[] {
  if (!Array.isArray(raw)) return [];
  const out: TasteMemory[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const obj = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const key = cleanMemoryKey(obj.key);
    const value = cleanString(obj.value, 240);
    if (!key || !value || SENSITIVE_MEMORY_PATTERN.test(value) || seen.has(key)) continue;
    out.push({ key, value, confidence: cleanConfidence(obj.confidence) });
    seen.add(key);
    if (out.length >= 5) break;
  }
  return out;
}

export function shapeAiChatResponse(raw: unknown): AiChatResponse {
  const obj = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
  const answer = normalizeAiCopyStyle(
    cleanString(obj.answer, 1200) ??
      "I can help narrow this down. Tell me the area, budget, and whether you want reliable or adventurous.",
  );
  const followUpQuestion = cleanString(obj.followUpQuestion, 180);
  return {
    answer,
    followUpQuestion,
    memories: shapeMemoryWrites(obj.memories),
  };
}

function mentionsBudget(text: string): boolean {
  return /(\$|pp|per person|budget|cheap|expensive|under|less than|not too expensive|\b\d{2,3}\b)/i.test(text);
}

function mentionsArea(text: string): boolean {
  return /\b(sydney|cbd|surry hills|darlinghurst|haymarket|chinatown|newtown|bondi|melbourne|san francisco|near me|nearby)\b/i.test(text);
}

function areaLabel(text: string): string {
  const knownAreas = [
    "Sydney CBD",
    "Melbourne CBD",
    "San Francisco",
    "Surry Hills",
    "Darlinghurst",
    "Haymarket",
    "Chinatown",
    "Newtown",
    "Bondi",
  ];
  const lower = text.toLowerCase();
  for (const area of knownAreas) {
    if (lower.includes(area.toLowerCase())) return area;
  }
  if (/\bcbd\b/i.test(text)) return "the CBD";
  if (/\bnear me|nearby\b/i.test(text)) return "nearby";
  return "that area";
}

function mentionsCuisine(text: string): boolean {
  return /\b(asian|japanese|korean|thai|chinese|vietnamese|italian|pizza|pasta|sushi|ramen|bbq|steak|seafood|vegetarian|vegan)\b/i.test(text);
}

function mentionsOccasion(text: string): boolean {
  return /\b(date|anniversary|birthday|celebrate|impress|romantic|dinner|lunch|brunch)\b/i.test(text);
}

function priceLabel(priceLevel?: string): string | null {
  switch (priceLevel) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return "cheap";
    case "PRICE_LEVEL_MODERATE":
      return "moderate";
    case "PRICE_LEVEL_EXPENSIVE":
      return "pricey";
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "very pricey";
    default:
      return null;
  }
}

function placeLine(place: RecommendationPlace, intent: SearchIntent, index: number): string {
  const meta = [
    typeof place.rating === "number" ? `${place.rating.toFixed(1)} Google rating` : null,
    typeof place.userRatingCount === "number" && place.userRatingCount >= 50 ? `${place.userRatingCount} ratings` : null,
    priceLabel(place.priceLevel),
    place.cuisines.slice(0, 2).join(", "),
  ].filter(Boolean).join(", ");
  const reason = intent.reliable && typeof place.userRatingCount === "number" && place.userRatingCount >= 200
    ? "It has enough rating volume to feel safer."
    : intent.budgetText
      ? "It fits the cheap-lunch direction better than a formal booking."
      : "It matches the food direction you gave.";
  return `${index}. ${place.name}${meta ? ` (${meta})` : ""}. ${reason}`;
}

export function buildRecommendationAnswer(ctx: AiChatPromptContext): AiChatResponse {
  const intent = extractSearchIntent(ctx.message, ctx.recentMessages);
  const places = ctx.recommendationPlaces.slice(0, 4);
  if (places.length === 0) return fallbackAiChatResponse({ ...ctx, recommendationPlaces: [] });
  const area = intent.area ? ` around ${intent.area}` : "";
  const brief = [
    intent.budgetText,
    intent.reliable ? "reliable" : null,
    intent.adventurous ? "with one more interesting option" : null,
    intent.cuisines.length ? intent.cuisines.join("/") : null,
    intent.meal,
  ].filter(Boolean).join(", ");
  const lines = places.map((place, i) => placeLine(place, intent, i + 1));
  return {
    answer: normalizeAiCopyStyle(`For ${brief || "this"}${area}, I would start here:\n\n${lines.join("\n")}`),
    followUpQuestion: null,
    memories: [],
  };
}

export function fallbackAiChatResponse(ctx: AiChatPromptContext): AiChatResponse {
  if (ctx.recommendationPlaces.length > 0) return buildRecommendationAnswer(ctx);

  const conversationText = [ctx.message, ...ctx.recentMessages.map((m) => m.text)].join(" ");
  const hasContext = ctx.recentMessages.length > 0;
  const hasUsefulFollowUp = mentionsArea(conversationText) || mentionsBudget(conversationText) || mentionsCuisine(conversationText);
  const intent = extractSearchIntent(ctx.message, ctx.recentMessages);

  if ((intent.wantsNearby || intent.budgetText || intent.meal) && !intent.area) {
    return {
      answer: "I can search that. Which area should I use?",
      followUpQuestion: null,
      memories: [],
    };
  }

  if (hasContext && hasUsefulFollowUp) {
    const area = mentionsArea(conversationText) ? areaLabel(conversationText) : "that area";
    const cuisine = mentionsCuisine(conversationText) ? "Asian-leaning" : "food";
    const budget = mentionsBudget(conversationText) ? "inside your budget" : "at a sensible price";
    const occasion = mentionsOccasion(conversationText) ? "for the occasion" : "for this plan";
    return {
      answer: `I have enough to work with: ${area}, ${cuisine}, ${budget}, ${occasion}. I would shortlist polished places with strong recent hungr reviews, then keep one more adventurous option as the wildcard.`,
      followUpQuestion: "Do you want quieter and polished, or lively and more fun?",
      memories: [],
    };
  }

  return shapeAiChatResponse({});
}

export function buildAiChatPrompt(ctx: AiChatPromptContext): string {
  return [
    AI_CHAT_STYLE_GUARDRAILS,
    "",
    "Task:",
    "Help the user find restaurants, cafes, bars, or food places only.",
    "Do not store or expose chat history. You may use the active in-session conversation passed in this request to understand follow-up answers.",
    "If live recommendation candidates are provided: Recommend from these places by name. Do not ask for another trait first.",
    "If no candidates are provided and the area is missing, ask only for the area.",
    "Return JSON only with this shape:",
    `{"answer":"string","followUpQuestion":"string or null","memories":[{"key":"snake_case","value":"short distilled preference","confidence":0.0}]}`,
    "",
    "Allowed memory examples:",
    "- likes_classy_bars",
    "- date_night_prefers_reliable",
    "- curious_about_exotic_cuisines",
    "- prefers_mid_price",
    "- recently_liked_japanese",
    "",
    "Never create memories about heritage, ethnicity, race, religion, health, politics, gender, or sexuality.",
    "",
    `Favorite cuisines: ${ctx.favoriteCuisines.length ? ctx.favoriteCuisines.join(", ") : "none yet"}`,
    `Place state counts: ${JSON.stringify(ctx.stateCounts)}`,
    `Existing memories: ${JSON.stringify(ctx.memories)}`,
    `Active in-session conversation, not stored: ${JSON.stringify(ctx.recentMessages)}`,
    `Live recommendation candidates from Google Places, display-only: ${JSON.stringify(ctx.recommendationPlaces)}`,
    `Current message: ${ctx.message.slice(0, 500)}`,
  ].join("\n");
}

function clientForRequest(req: Request) {
  const authorization = req.headers.get("Authorization") ?? "";
  return createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authorization } },
  });
}

async function fetchRecommendationPlaces(intent: SearchIntent): Promise<RecommendationPlace[]> {
  if (!PLACES_KEY) return [];
  if (!intent.area && intent.wantsNearby) return [];
  const textQuery = buildSearchTextQuery(intent);
  if (!textQuery.trim()) return [];
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": PLACES_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.rating,places.userRatingCount,places.priceLevel,places.primaryType,places.types",
    },
    body: JSON.stringify({ textQuery, pageSize: 8 }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (Array.isArray(data?.places) ? data.places : [])
    .map(shapeRecommendationPlace)
    .filter((p: RecommendationPlace | null): p is RecommendationPlace => p !== null)
    .sort((a: RecommendationPlace, b: RecommendationPlace) =>
      (b.rating ?? 0) - (a.rating ?? 0) || (b.userRatingCount ?? 0) - (a.userRatingCount ?? 0)
    )
    .slice(0, 4);
}

function answerMentionsCandidate(answer: string, places: RecommendationPlace[]): boolean {
  const lower = answer.toLowerCase();
  return places.some((place) => lower.includes(place.name.toLowerCase()));
}

async function readPromptContext(req: Request, message: string, recentMessages: ChatMessage[]): Promise<AiChatPromptContext> {
  const supabase = clientForRequest(req);
  const intent = extractSearchIntent(message, recentMessages);
  const [profileRes, memoryRes, recommendationPlaces] = await Promise.all([
    supabase.rpc("get_taste_profile"),
    supabase.rpc("get_taste_memories"),
    fetchRecommendationPlaces(intent),
  ]);

  const profileRow = Array.isArray(profileRes.data) ? profileRes.data[0] : profileRes.data;
  const favoriteCuisines = Array.isArray(profileRow?.favorite_cuisines)
    ? profileRow.favorite_cuisines.filter((x: unknown): x is string => typeof x === "string").slice(0, 30)
    : [];
  const stateCounts = profileRow?.state_counts && typeof profileRow.state_counts === "object"
    ? profileRow.state_counts as Record<string, number>
    : {};
  const memories = Array.isArray(memoryRes.data)
    ? memoryRes.data.map((m: any) => ({
      key: String(m.memory_key ?? ""),
      value: String(m.memory_value ?? ""),
      confidence: cleanConfidence(m.confidence),
    })).filter((m: TasteMemory) => cleanMemoryKey(m.key) && m.value).slice(0, 50)
    : [];

  return { message, recentMessages, favoriteCuisines, stateCounts, memories, recommendationPlaces };
}

async function writeMemories(req: Request, memories: TasteMemory[]): Promise<number> {
  if (memories.length === 0) return 0;
  const supabase = clientForRequest(req);
  let updated = 0;
  for (const memory of memories) {
    const { data, error } = await supabase.rpc("upsert_taste_memory", {
      input_key: memory.key,
      input_value: memory.value,
      input_confidence: memory.confidence,
      input_source: "chat",
    });
    if (!error && data === true) updated += 1;
  }
  return updated;
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const message = cleanString(body.value.message, 500);
  const recentMessages = shapeRecentMessages(body.value.recentMessages);
  if (!message) return new Response("Invalid message", { status: 400 });
  if (!isFoodDiscoveryRequest(message, recentMessages)) {
    return new Response(JSON.stringify({
      error: "out_of_scope",
      answer: "I can help with restaurants, cafes, bars, and food plans. Ask me where to eat.",
    }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let shaped: AiChatResponse;
  let ctx: AiChatPromptContext = { message, recentMessages, favoriteCuisines: [], stateCounts: {}, memories: [], recommendationPlaces: [] };
  try {
    ctx = await readPromptContext(req, message, recentMessages);
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildAiChatPrompt(ctx) }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );
    if (!res.ok) throw new Error("Gemini failed");
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    shaped = shapeAiChatResponse(typeof text === "string" ? JSON.parse(text) : {});
    if (ctx.recommendationPlaces.length > 0 && !answerMentionsCandidate(shaped.answer, ctx.recommendationPlaces)) {
      shaped = buildRecommendationAnswer(ctx);
    }
  } catch {
    shaped = fallbackAiChatResponse(ctx);
  }

  const memoriesUpdated = await writeMemories(req, shaped.memories);
  return new Response(JSON.stringify({
    answer: shaped.answer,
    followUpQuestion: shaped.followUpQuestion,
    memoriesUpdated,
  }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
