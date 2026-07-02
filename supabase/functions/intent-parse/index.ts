// Server side only. Holds GEMINI_KEY. The AI here is a THIN PARSER: it turns a person's free-text
// intent ("somewhere for date night near the water to impress a date") into a structured query.
// It never ranks, never reads Google review content, and never invents facts. The deterministic
// rule engine (src/domain/intentQuery.ts) does all retrieval and ranking on the client. Auth gated
// and rate limited (Gemini is paid).
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GEMINI_KEY")!;
const MAX_PER_MIN = 12;

const PRESTIGE = ["top", "guide", "hidden-gem"];
const DIETARY = ["vegan", "vegetarian", "gluten-free"];

function clampBand(v: unknown): number | undefined {
  const n = typeof v === "number" ? Math.round(v) : NaN;
  return n >= 1 && n <= 4 ? n : undefined;
}

function stringList(v: unknown, allow: string[] | null, max: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const s = item.trim().toLowerCase();
    if (!s) continue;
    if (allow && !allow.includes(s)) continue;
    if (!out.includes(s)) out.push(s);
    if (out.length >= max) break;
  }
  return out.length ? out : undefined;
}

// Validate whatever the model returned down to the StructuredQuery contract, dropping anything
// unrecognized. Always yields a usable query: at worst a plain text search on the raw words.
export function shapeStructuredQuery(raw: unknown, fallbackQuery: string): Record<string, unknown> {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const hint = typeof obj.queryHint === "string" && obj.queryHint.trim()
    ? obj.queryHint.trim().slice(0, 160)
    : fallbackQuery.slice(0, 160);

  const out: Record<string, unknown> = { queryHint: hint };
  const cuisines = stringList(obj.cuisines, null, 6);
  if (cuisines) out.cuisines = cuisines;
  const dietary = stringList(obj.dietary, DIETARY, 4);
  if (dietary) out.dietary = dietary;
  const prestige = stringList(obj.prestige, PRESTIGE, 3);
  if (prestige) out.prestige = prestige;

  const pb = obj.priceBand as Record<string, unknown> | undefined;
  if (pb && typeof pb === "object") {
    const min = clampBand(pb.min);
    const max = clampBand(pb.max);
    const band: Record<string, number> = {};
    if (min !== undefined) band.min = min;
    if (max !== undefined) band.max = max;
    if (Object.keys(band).length) out.priceBand = band;
  }
  return out;
}

const PROMPT = `You convert a diner's request into a JSON search query. Rules:
- queryHint: 2-5 word Google Maps text search (cuisine or venue words only, no fluff).
- cuisines: array of cuisine words if named or clearly implied, else omit.
- dietary: only from ["vegan","vegetarian","gluten-free"] if explicitly required, else omit.
- prestige: "top" for best/impressive/special-occasion, "guide" for michelin/hatted/award, "hidden-gem" for underrated/hidden/local. Omit if none apply.
- priceBand: {min,max} 1=cheap..4=very expensive, only if budget is stated. Omit otherwise.
Never add facts the user did not imply. Request: `;

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { query } = body.value;
  if (typeof query !== "string" || !query.trim()) {
    return new Response("Invalid query", { status: 400 });
  }
  const trimmed = query.trim().slice(0, 200);

  let parsed: unknown = {};
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT + trimmed }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text === "string") parsed = JSON.parse(text);
    }
  } catch {
    parsed = {};
  }

  // Fail open to a plain text search so AI hiccups never block discovery.
  return new Response(JSON.stringify(shapeStructuredQuery(parsed, trimmed)), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
