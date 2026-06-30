// Server side only. Resolves a batch of Google place_ids to display names for LIVE display
// (e.g. the friends check-in feed, which stores only place_id). Uses the minimal id+displayName
// field mask, the cheapest Google tier, and never persists anything. Auth gated + rate limited.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_IDS = 30;

// A place_id is a safe token; reject anything else before interpolating into the Google URL.
export function safeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id))
    .slice(0, MAX_IDS);
}

export default async function handler(req: Request): Promise<Response> {
  // Each call fans out to up to MAX_IDS Google fetches, so this name-resolution helper gets a
  // tighter per-minute cap than interactive search. The client batches and caches, so a handful
  // of calls a minute is plenty for the feed.
  const blocked = await guard(req, 20);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const ids = safeIds(body.value.ids);

  const names: Record<string, string> = {};
  await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
        headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "id,displayName" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const name = data?.displayName?.text;
      if (typeof name === "string" && name) names[id] = name;
    }),
  );

  return new Response(JSON.stringify({ names }), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
