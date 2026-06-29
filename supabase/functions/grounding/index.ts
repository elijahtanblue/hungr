// Server side only. Holds GEMINI_KEY. The ONLY sanctioned way to use AI over Google Maps
// data. Returns the grounded answer plus the required Google source links. Output is
// shown in its own block in the UI, never interspersed with community content.
// Auth gated and rate limited (Gemini is paid, so the limit is tighter than Places).
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GEMINI_KEY")!;
const MAX_PER_MIN = 20;

export function shapeGrounded(raw: any): { text: string; sources: string[] } {
  const candidate = raw.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text ?? "";
  // Grounding metadata lives on the candidate, not the top level. Source URIs come from
  // groundingChunks (web.uri for search, maps.uri / retrievedContext.uri for Maps grounding).
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  const sources: string[] = chunks
    .map((c: any) => c?.web?.uri ?? c?.maps?.uri ?? c?.retrievedContext?.uri)
    .filter((u: unknown): u is string => typeof u === "string");
  return { text, sources };
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, MAX_PER_MIN);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { placeQuery } = body.value;
  if (typeof placeQuery !== "string" || !placeQuery.trim()) {
    return new Response("Invalid placeQuery", { status: 400 });
  }
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `What is ${placeQuery.slice(0, 160)} known for?` }] }],
        tools: [{ googleMaps: {} }],
      }),
    },
  );
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  return new Response(JSON.stringify(shapeGrounded(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

// Note: confirm the exact Grounding request shape against the current Gemini docs during
// the SETUP.md pre-scale legal check (the tool key may be `googleMaps` or via Maps
// Grounding Lite). The `shapeGrounded` contract and the source-link passthrough do not change.

if (import.meta.main) Deno.serve(handler);
