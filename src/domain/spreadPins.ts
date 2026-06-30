import type { Place } from "./types";

// Two restaurants at (nearly) the same coordinate render as one stacked pin, so the one
// underneath is impossible to tap. We fan co-located pins out onto a small ring around their
// shared point, just for display: only lat/lng shift, every other field (and the placeId we
// select by) is untouched. The offset is tiny (~15m) so a pin still reads as "here".

// ~5 decimal places of latitude is about 1 metre, so anything that rounds to the same key is
// close enough to overlap visually.
const COORD_PRECISION = 5;
// Ring radius in degrees. ~0.00014 deg of latitude is roughly 15 metres.
const RING_RADIUS_DEG = 0.00014;

function keyFor(p: Place): string {
  return `${p.lat.toFixed(COORD_PRECISION)},${p.lng.toFixed(COORD_PRECISION)}`;
}

export function spreadOverlappingPins(places: Place[]): Place[] {
  const groups = new Map<string, Place[]>();
  for (const p of places) {
    const key = keyFor(p);
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }

  const result: Place[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    // Longitude degrees shrink with latitude, so scale the horizontal offset to keep the ring
    // visually circular rather than an ellipse near the poles.
    const lonScale = 1 / Math.max(Math.cos((group[0].lat * Math.PI) / 180), 0.01);
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length;
      result.push({
        ...p,
        lat: p.lat + RING_RADIUS_DEG * Math.sin(angle),
        lng: p.lng + RING_RADIUS_DEG * Math.cos(angle) * lonScale,
      });
    });
  }
  return result;
}
