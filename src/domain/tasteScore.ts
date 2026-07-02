import type { Place } from "./types";

// Taste signals are BEHAVIORAL and OPT-IN only: places your friends have actually been to, and
// cuisines you yourself picked at onboarding. Never demographic, never inferred from identity.
export type TasteContext = { favoriteCuisines: string[]; friendsBeen: Set<string>; checkedIn?: Set<string> };

const STATE_WEIGHT = {
  go: 6,
  liked: 4,
  loved: 8,
  disliked: -7,
} as const;

function matchesFavorite(p: Place, favs: Set<string>): boolean {
  return favs.size > 0 && p.cuisines.some((c) => favs.has(c.toLowerCase()));
}

function favSet(ctx: TasteContext): Set<string> {
  return new Set(ctx.favoriteCuisines.map((c) => c.toLowerCase()));
}

export function tasteBoost(p: Place, ctx: TasteContext): number {
  let b = 0;
  if (p.state && p.state in STATE_WEIGHT) b += STATE_WEIGHT[p.state];
  if (ctx.checkedIn?.has(p.placeId)) b += 2;
  if (ctx.friendsBeen.has(p.placeId)) b += 2; // a friend vouching outweighs a cuisine match
  if (matchesFavorite(p, favSet(ctx))) b += 1;
  return b;
}

export function tasteLabel(p: Place, ctx: TasteContext): string | null {
  if (p.state === "loved") return "You loved this";
  if (p.state === "go") return "You want to try this";
  if (p.state === "liked") return "You liked this";
  if (p.state === "disliked") return "You disliked this";
  if (ctx.checkedIn?.has(p.placeId)) return "You've checked in";
  if (ctx.friendsBeen.has(p.placeId)) return "Friends have been";
  if (matchesFavorite(p, favSet(ctx))) return "Your kind of food";
  return null;
}

const LIKED_LABEL = "You liked this";

// Build the per-place taste notes for a result list, capping "You liked this" so a regular who eats
// nearby a lot is not bombarded with it. Other labels (including "Your kind of food") are unlimited.
// Expects places already taste-ranked, so the capped "You liked this" lands on the strongest matches.
export function tasteNotes(places: Place[], ctx: TasteContext, likedLimit = 3): Record<string, string> {
  const notes: Record<string, string> = {};
  let liked = 0;
  for (const p of places) {
    const label = tasteLabel(p, ctx);
    if (!label) continue;
    if (label === LIKED_LABEL) {
      if (liked >= likedLimit) continue;
      liked += 1;
    }
    notes[p.placeId] = label;
  }
  return notes;
}

// Stable reorder: higher taste boost first, original order preserved within a tier so it only ever
// nudges, never scrambles, the underlying result ranking.
export function tasteRank(places: Place[], ctx: TasteContext): Place[] {
  return places
    .map((p, i) => ({ p, i, b: tasteBoost(p, ctx) }))
    .sort((a, b) => b.b - a.b || a.i - b.i)
    .map((x) => x.p);
}
