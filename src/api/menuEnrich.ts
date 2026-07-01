import { supabase } from "../lib/supabase";
import type { Place } from "../domain/types";

// Fire-and-forget: nominate surfaced places for background menu enrichment. The server (guarded,
// rate-limited, freshness-gated) decides what actually needs work. Never awaited on a user path, so
// a failure or slow round trip cannot affect the map. Places without a longitude are skipped (the
// worker needs it for off-peak scheduling).
export function enqueueMenuEnrich(places: Place[]): void {
  const payload = places
    .filter((p) => typeof p.lng === "number")
    .slice(0, 10)
    .map((p) => ({ placeId: p.placeId, lng: p.lng }));
  if (payload.length === 0) return;
  supabase.functions.invoke("menu-enqueue", { body: { places: payload } }).catch(() => {});
}
