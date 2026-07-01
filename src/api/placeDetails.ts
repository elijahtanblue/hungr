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

// Google regularOpeningHours.periods: day is 0 (Sunday) to 6 (Saturday). A 24-hour place has a
// single period that is open with no close.
export type OpeningPeriod = {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
};

export type PlaceDetails = {
  placeId: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  address?: string;
  googleMapsUri?: string;
  lat?: number;
  lng?: number;
  photos?: string[];
  reviews: LiveReview[];
  openNow?: boolean;
  nextCloseTime?: string;
  weekdayDescriptions?: string[];
  periods?: OpeningPeriod[];
  takeout?: boolean;
  dineIn?: boolean;
  delivery?: boolean;
  attribution: string;
};

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const { data, error } = await supabase.functions.invoke("place-details", { body: { placeId } });
  if (error) throw error;
  return (data as PlaceDetails) ?? null;
}
