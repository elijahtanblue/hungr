import { searchNearby } from "./places";
import { setUserPlaceState } from "./userPlaces";
import type { ImportRow } from "../domain/importList";
import type { Place } from "../domain/types";

export type ResolvedRow = { name: string; candidates: Place[] };
export type ImportResult = { added: string[]; missed: string[] };

// Resolve each pasted row to up to three candidate places, so the user can confirm the match (or
// pick a different one, or drop the row) before anything is saved. Tries the full line first, then
// the name alone, so a wrong or missing suburb ("Sandoitchi cafe, Surry Hills" when it is really in
// Darlinghurst) still surfaces candidates instead of nothing. Best effort: a row that errors or
// matches nothing comes back with an empty candidate list.
export async function resolveImportRows(
  rows: ImportRow[],
  bias: { lat: number; lng: number },
  onProgress?: (done: number, total: number) => void,
): Promise<ResolvedRow[]> {
  const out: ResolvedRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // A GeoJSON row carries its own coordinates, so bias that row's search to the exact spot;
    // otherwise fall back to the shared bias (the user's location or the default region).
    const origin = typeof row.lat === "number" && typeof row.lng === "number" ? { lat: row.lat, lng: row.lng } : bias;
    let candidates: Place[] = [];
    try {
      let results = await searchNearby(origin.lat, origin.lng, row.query);
      if (results.length === 0 && row.name && row.name !== row.query) {
        results = await searchNearby(origin.lat, origin.lng, row.name);
      }
      candidates = results.slice(0, 3);
    } catch {
      candidates = [];
    }
    out.push({ name: row.name, candidates });
    onProgress?.(i + 1, rows.length);
  }
  return out;
}

// Save the user's confirmed picks as want-to-go. A save that fails lands in `missed`.
export async function addPlacesToWantToGo(places: Place[]): Promise<ImportResult> {
  const added: string[] = [];
  const missed: string[] = [];
  for (const place of places) {
    try {
      const saved = await setUserPlaceState(place.placeId, "go");
      if (saved) added.push(place.name);
      else missed.push(place.name);
    } catch {
      missed.push(place.name);
    }
  }
  return { added, missed };
}
