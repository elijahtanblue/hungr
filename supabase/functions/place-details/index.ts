// Server side only. Holds GOOGLE_PLACES_KEY. Fetches one place's full details from Google
// Place Details (New), including reviews, for LIVE DISPLAY with attribution. Displaying
// Google content live is allowed; storing it is not, so this is fetched fresh every time and
// never persisted. Auth gated and rate limited via the shared guard.
import { guard } from "../_shared/guard.ts";
import { readJsonObject } from "../_shared/request.ts";

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
  lat?: number;
  lng?: number;
  photos: string[];
  reviews: Review[];
  openNow?: boolean;
  weekdayDescriptions?: string[];
  takeout?: boolean;
  dineIn?: boolean;
  delivery?: boolean;
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
    lat: raw.location?.latitude,
    lng: raw.location?.longitude,
    // Photo resource names only (resolved to live URLs on demand via the place-photo function).
    // We never store the image bytes, consistent with displaying Google content live.
    photos: (raw.photos ?? []).map((p: any) => p?.name).filter((n: any) => typeof n === "string").slice(0, 6),
    reviews,
    openNow: raw.currentOpeningHours?.openNow ?? raw.regularOpeningHours?.openNow,
    weekdayDescriptions: raw.regularOpeningHours?.weekdayDescriptions,
    takeout: raw.takeout,
    dineIn: raw.dineIn,
    delivery: raw.delivery,
    attribution: "Powered by Google",
  };
}

export default async function handler(req: Request): Promise<Response> {
  const blocked = await guard(req, 60);
  if (blocked) return blocked;

  const body = await readJsonObject(req);
  if (!body.ok) return body.response;
  const { placeId } = body.value;
  // Validate before interpolating into the URL: a place_id is a safe token. This prevents
  // path traversal or reaching other Google endpoints with the secret key attached.
  if (typeof placeId !== "string" || !/^[A-Za-z0-9_-]+$/.test(placeId)) {
    return new Response("Invalid placeId", { status: 400 });
  }
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": KEY,
      "X-Goog-FieldMask":
        "id,displayName,rating,userRatingCount,priceLevel,formattedAddress,googleMapsUri,location,photos,reviews,primaryType,types,currentOpeningHours.openNow,regularOpeningHours.weekdayDescriptions,takeout,dineIn,delivery",
    },
  });
  if (!res.ok) return new Response("Upstream error", { status: 502 });
  const data = await res.json();
  return new Response(JSON.stringify(shapePlaceDetails(data)), {
    headers: { "Content-Type": "application/json" },
  });
}

if (import.meta.main) Deno.serve(handler);
