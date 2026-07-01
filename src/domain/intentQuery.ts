import type { Place, PriceLevel } from "./types";

export type Band = 1 | 2 | 3 | 4;
export type Prestige = "top" | "guide" | "hidden-gem";

export type StructuredQuery = {
  queryHint: string;                        // text sent to Google Text Search
  cuisines?: string[];                      // include filter (any-match), relaxable
  dietary?: string[];                       // keep-and-label: never drops, flags unconfirmed
  priceBand?: { min?: Band; max?: Band };   // soft: nudges rank, never drops
  prestige?: Prestige[];                    // quality axis
};

export type IntentResult = { place: Place; unconfirmed: string[] };
export type IntentOutcome = { results: IntentResult[]; relaxed: string[] };

// Below this fraction of the set's median review count, a place is treated as statistical
// noise (e.g. 4.9 from 8 reviews) and dropped unless it carries a curated guide award.
const NOISE_FRACTION = 0.1;

const PRICE_RANK: Record<PriceLevel, Band> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function bandOf(p: Place): Band | null {
  if (p.priceBand) return p.priceBand;
  return p.priceLevel && p.priceLevel in PRICE_RANK ? PRICE_RANK[p.priceLevel] : null;
}

function medianCount(counts: number[]): number {
  if (counts.length === 0) return 0;
  const s = [...counts].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// Base score is the rating, which is exactly the "top" prestige behavior (rank best first), so
// "top" needs no extra term. "guide" lifts curated places to the top; "hidden-gem" nudges toward
// low review counts; price band is a soft nudge that never drops a place.
function score(p: Place, q: StructuredQuery): number {
  let s = p.rating ?? 0;
  if (q.prestige?.includes("guide") && p.guideAward) s += 5;
  if (q.prestige?.includes("hidden-gem")) {
    const c = p.userRatingCount ?? 0;
    s += c > 0 ? Math.max(0, 1 - c / 1000) : 0;
  }
  const band = bandOf(p);
  if (q.priceBand && band !== null) {
    const within =
      (q.priceBand.min === undefined || band >= q.priceBand.min) &&
      (q.priceBand.max === undefined || band <= q.priceBand.max);
    s += within ? 0.5 : -0.5;
  }
  return s;
}

export function runIntentQuery(places: Place[], q: StructuredQuery): IntentOutcome {
  const hasCuisine = !!(q.cuisines && q.cuisines.length > 0);

  // "hidden-gem" intent deliberately hunts high-rated, low-review-count places, so the noise
  // floor must stand down for it (otherwise it would drop the very gems the user asked for).
  const wantsGems = !!q.prestige?.includes("hidden-gem");

  const build = (dropCuisine: boolean): IntentResult[] => {
    let list = places;

    if (!dropCuisine && hasCuisine) {
      list = list.filter((p) => p.cuisines.some((c) => q.cuisines!.includes(c)));
    }

    const counts = list
      .map((p) => p.userRatingCount)
      .filter((n): n is number => typeof n === "number");
    const noiseFloor = wantsGems ? 0 : medianCount(counts) * NOISE_FRACTION;
    list = list.filter((p) => {
      if (p.guideAward) return true;                       // prestige override
      if (typeof p.userRatingCount !== "number") return true; // unknown => keep
      return p.userRatingCount >= noiseFloor;
    });

    return list
      .map((p) => {
        const unconfirmed: string[] = [];
        for (const tag of q.dietary ?? []) {
          if (!(p.dietaryTags ?? []).includes(tag)) unconfirmed.push(tag);
        }
        return { place: p, unconfirmed };
      })
      .sort((a, b) => score(b.place, q) - score(a.place, q));
  };

  // Relaxation ladder. The density floor can never empty a non-empty set (the median-count place
  // always clears median * 0.1), so the only constraint that can block all results is the cuisine
  // filter. Report "cuisine" only when dropping it actually recovers results, so "relaxed" names
  // the true blocker. (Price is already soft and dietary already keep-and-label, so neither drops.)
  let results = build(false);
  const relaxed: string[] = [];
  if (results.length === 0 && hasCuisine) {
    const dropped = build(true);
    if (dropped.length > 0) {
      relaxed.push("cuisine");
      results = dropped;
    }
  }
  return { results, relaxed };
}
