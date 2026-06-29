// Server side only. Holds GOOGLE_PLACES_KEY. Fetches one place's full details from Google
// Place Details (New), including reviews, for LIVE DISPLAY with attribution. Displaying
// Google content live is allowed; storing it is not, so this is fetched fresh every time and
// never persisted. Auth gated and rate limited via the shared guard.
import { guard } from "../_shared/guard.ts";

const KEY = Deno.env.get("GOOGLE_PLACES_KEY")!;

type Review = {
  author: string;
  rating?: number;
  text: string;
  relativeTime: string;
  authorPhoto?: string;
};

type PlaceDetails = {
  placeId: string;
  name: string;
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  address?: string;
  googleMapsUri?: string;
  reviews: Review[];
  attribution: string;
};

export function shapePlaceDetails(raw: any): PlaceDetails {
  const reviews: Review[] = (raw.reviews ?? []).map((r: any) => ({
    author: r.authorAttribution?.displayName ?? "",
    rating: r.rating,
    text: r.text?.text ?? r.originalText?.text ?? "",
    relativeTime: r.relativePublishTimeDescription ?? "",
    authorPhoto: r.authorAttribution?.photoUri,
  }));
  return {
    placeId: raw.id,
    name: raw.displayName?.text ?? "",
    rating: raw.rating,
    userRatingCount: raw.userRatingCount,
    priceLevel: raw.priceLevel,
    address: raw.formattedAddress,
    googleMapsUri: raw.googleMapsUri,
    reviews,
    attribution: "Powered by Google",
  };
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 60);
  if (blocked) return blocked;

  const { placeId } = await req.json();
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,priceLevel,formattedAddress,googleMapsUri,reviews,primaryType,types",
    },
  });
  const data = await res.json();
  return new Response(JSON.stringify(shapePlaceDetails(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
