import { searchNearby } from "./places";
import { setUserPlaceState } from "./userPlaces";
import type { ImportRow } from "../domain/importList";

// Resolves pasted rows to real Google places and saves the matches as "want to go".
//
// Each row is searched individually (top text-search match wins) and saved sequentially, so we
// stay within the places-proxy rate limit rather than firing a burst. Resolution is best effort:
// a row we cannot match, or one that fails to save, lands in `missed` instead of aborting the run.
export type ImportResult = { added: string[]; missed: string[] };

export async function importPlacesToWantToGo(
  rows: ImportRow[],
  bias: { lat: number; lng: number },
  onProgress?: (done: number, total: number) => void,
): Promise<ImportResult> {
  const added: string[] = [];
  const missed: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const results = await searchNearby(bias.lat, bias.lng, row.query);
      const match = results[0];
      if (!match) { missed.push(row.name); }
      else {
        const saved = await setUserPlaceState(match.placeId, "go");
        if (saved) added.push(match.name); else missed.push(row.name);
      }
    } catch {
      missed.push(row.name);
    }
    onProgress?.(i + 1, rows.length);
  }

  return { added, missed };
}
