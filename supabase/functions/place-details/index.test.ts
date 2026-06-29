import { shapePlaceDetails } from "./index.ts";

Deno.test("shapePlaceDetails returns reviews with author and attribution for live display", () => {
  const raw = {
    id: "p1",
    displayName: { text: "Spicy World" },
    rating: 4.6,
    userRatingCount: 128,
    priceLevel: "PRICE_LEVEL_MODERATE",
    formattedAddress: "1 Food St",
    googleMapsUri: "https://maps.google.com/?cid=1",
    reviews: [
      {
        authorAttribution: { displayName: "Jane", photoUri: "https://x/p.jpg" },
        rating: 5,
        text: { text: "The mala actually numbs." },
        relativePublishTimeDescription: "2 weeks ago",
      },
    ],
  };
  const out = shapePlaceDetails(raw);
  if (out.reviews.length !== 1) throw new Error("reviews should pass through for live display");
  if (out.reviews[0].author !== "Jane") throw new Error("author attribution is required on each review");
  if (!out.reviews[0].text.includes("mala")) throw new Error("review text is shown live");
  if (!out.googleMapsUri) throw new Error("google maps link is required for attribution");
  if (out.attribution !== "Powered by Google") throw new Error("source attribution must be present");
});
