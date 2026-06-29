export type PlaceState = "go" | "been" | "avoid";

export type Place = {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  rating?: number;       // live from Google, never persisted
  cuisines: string[];    // coarse from Google place type, refined by first party tags
  state?: PlaceState;     // first party, from user_places
};
