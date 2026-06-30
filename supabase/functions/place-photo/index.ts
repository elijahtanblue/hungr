// Server side only. Resolves a Google photo resource name to a temporary, key-less image URL for
// LIVE display (skipHttpRedirect returns the googleusercontent URI as JSON, so our API key is never
// exposed to the client and no image bytes are stored). Auth gated + rate limited.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;

// A photo name looks like places/<id>/photos/<ref>. Validate before interpolating into the URL.
export function isPhotoName(value: unknown): value is string {
  return typeof value === "string" && /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/.test(value);
}

export function clampWidth(value: unknown): number {
  const n = typeof value === "number" ? value : 600;
  return Math.min(1200, Math.max(120, Math.round(n)));
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 120);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  if (!isPhotoName(body.value.name)) return new Response("Invalid photo name", { status: 400 });
  const maxWidth = clampWidth(body.value.maxWidth);

  const url = `https://places.googleapis.com/v1/${body.value.name}/media?maxWidthPx=${maxWidth}&skipHttpRedirect=true&key=${KEY}`;
  const res = await fetch(url);
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  const uri = data?.photoUri;
  if (typeof uri !== "string") return new Response("No photo", { status: 502 });

  return new Response(JSON.stringify({ uri }), { headers: { "Content-Type": "application/json" } });
}

if (import.meta.main) Deno.serve(handler);
