// Server side only. Holds GEMINI_KEY. The ONLY sanctioned way to use AI over Google Maps
// data. Returns the grounded answer plus the required Google source links. Output is
// shown in its own block in the UI, never interspersed with community content.
const KEY = Deno.env.get("GEMINI_KEY")!;

export function shapeGrounded(raw: any): { text: string; sources: string[] } {
  const text = raw.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const sources = raw.groundingMetadata?.sourceLinks ?? [];
  return { text, sources };
}

export default async function handler(req: Request): Promise<Response> {
  const { placeQuery } = await req.json();
  const res = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `What is ${placeQuery} known for?` }] }],
        tools: [{ googleMaps: {} }],
      }),
    },
  );
  const data = await res.json();
  return new Response(JSON.stringify(shapeGrounded(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

// Note: confirm the exact Grounding request shape against the current Gemini docs during
// the SETUP.md pre-scale legal check (the tool key may be `googleMaps` or via Maps
// Grounding Lite). The `shapeGrounded` contract and the source-link passthrough do not change.

if (import.meta.main) Deno.serve(handler);
