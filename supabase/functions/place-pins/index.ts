// Server side only. Resolves a batch of saved place_ids to the minimum needed to draw a map pin
// (name, coordinates, rating) for LIVE display. Like place-names, it stores nothing and uses a
// tight field mask. Used to plot a user's saved / imported places, which we hold as place_id only.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;
const MAX_IDS = 60;

// A place_id is a safe token; reject anything else before interpolating into the Google URL.
export function safeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .filter((id): id is string => typeof id === "string" && /^[A-Za-z0-9_-]+$/.test(id))
    .slice(0, MAX_IDS);
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 30);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const ids = safeIds(body.value.ids);

  const pins = (
    await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}`, {
          headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "id,displayName,location,rating" },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const lat = data?.location?.latitude;
        const lng = data?.location?.longitude;
        const name = data?.displayName?.text;
        if (typeof lat !== "number" || typeof lng !== "number" || typeof name !== "string" || !name) return null;
        return { id, name, lat, lng, rating: typeof data?.rating === "number" ? data.rating : undefined };
      }),
    )
  ).filter(Boolean);

  return new Response(JSON.stringify({ pins }), { headers: { "Content-Type": "application/json" } });
}

if (import.meta.main) Deno.serve(handler);
