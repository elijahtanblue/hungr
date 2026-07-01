export type PlaceState = "go" | "liked" | "loved" | "disliked";
export type PriceLevel = "PRICE_LEVEL_INEXPENSIVE" | "PRICE_LEVEL_MODERATE" | "PRICE_LEVEL_EXPENSIVE" | "PRICE_LEVEL_VERY_EXPENSIVE";

export type Place = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;       // live from Google, never persisted
  userRatingCount?: number; // live from Google, used for density-scaled quality
  priceLevel?: PriceLevel;
  priceBand?: 1 | 2 | 3 | 4; // curated/first-party price band (overrides priceLevel when set)
  photoName?: string;    // live Google photo resource name, resolved to a display URL on demand
  distanceMeters?: number;
  cuisines: string[];    // coarse from Google place type, refined by first party tags
  dietaryTags?: string[]; // first-party dietary flags, e.g. ["vegetarian"], never from Google reviews
  state?: PlaceState;     // first party, from user_places
  guideAward?: string;    // curated guide badge, e.g. "Michelin · 1 Star" (display only)
};
