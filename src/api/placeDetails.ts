import { supabase } from "../lib/supabase";

// Live Google place details, including reviews, for DISPLAY ONLY. Fetched fresh through the
// place-details Edge Function every time, never persisted. Always shown with attribution.
export type LiveReview = {
  author: string;
  rating?: number;
  text: string;
  relativeTime: string;
  authorPhoto?: string;
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  address?: string;
  googleMapsUri?: string;
  reviews: LiveReview[];
  attribution: string;
};

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const { data, error } = await supabase.functions.invoke("place-details", { body: { placeId } });
  if (error) throw error;
  return (data as PlaceDetails) ?? null;
}
