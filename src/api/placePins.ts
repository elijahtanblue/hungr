import { supabase } from "../lib/supabase";

export type PlacePinDetails = {
  name: string;
  lat?: number;
  lng?: number;
  rating?: number;
};

const cache = new Map<string, PlacePinDetails>();

// Fetches live Google place details through our edge function and keeps them in-memory for the
// session. This lets list screens show the restaurant rating without reading private user feedback.
export async function getPlacePins(ids: string[]): Promise<Record<string, PlacePinDetails>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  const out: Record<string, PlacePinDetails> = {};
  const missing: string[] = [];

  for (const id of unique) {
    const cached = cache.get(id);
    if (cached) out[id] = cached;
    else missing.push(id);
  }

  if (missing.length === 0) return out;

  const { data, error } = await supabase.functions.invoke("place-pins", { body: { ids: missing } });
  if (error || !Array.isArray(data?.pins)) return out;

  for (const pin of data.pins as any[]) {
    if (!pin || typeof pin.id !== "string" || typeof pin.name !== "string") continue;
    const details: PlacePinDetails = {
      name: pin.name,
      ...(typeof pin.lat === "number" ? { lat: pin.lat } : {}),
      ...(typeof pin.lng === "number" ? { lng: pin.lng } : {}),
      ...(typeof pin.rating === "number" ? { rating: pin.rating } : {}),
    };
    cache.set(pin.id, details);
    out[pin.id] = details;
  }

  return out;
}
