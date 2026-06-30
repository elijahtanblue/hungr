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

Deno.test("shapePlaceDetails surfaces open-now, hours, and service options", () => {
  const out = shapePlaceDetails({
    id: "p1",
    displayName: { text: "Spicy World" },
    currentOpeningHours: { openNow: true },
    regularOpeningHours: { weekdayDescriptions: ["Monday: 11 AM – 9 PM", "Tuesday: 11 AM – 9 PM"] },
    takeout: true,
    dineIn: true,
    delivery: false,
  });
  if (out.openNow !== true) throw new Error("openNow should be surfaced");
  if (!out.weekdayDescriptions || out.weekdayDescriptions.length !== 2) throw new Error("weekday hours should pass through");
  if (out.takeout !== true || out.dineIn !== true || out.delivery !== false) throw new Error("service options should pass through");
});
