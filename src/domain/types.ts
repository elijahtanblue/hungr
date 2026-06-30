export type PlaceState = "go" | "liked" | "loved" | "disliked";
export type PriceLevel = "PRICE_LEVEL_INEXPENSIVE" | "PRICE_LEVEL_MODERATE" | "PRICE_LEVEL_EXPENSIVE" | "PRICE_LEVEL_VERY_EXPENSIVE";

export type Place = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;       // live from Google, never persisted
  priceLevel?: PriceLevel;
  distanceMeters?: number;
  cuisines: string[];    // coarse from Google place type, refined by first party tags
  state?: PlaceState;     // first party, from user_places
  guideAward?: string;    // curated guide badge, e.g. "Michelin · 1 Star" (display only)
};
