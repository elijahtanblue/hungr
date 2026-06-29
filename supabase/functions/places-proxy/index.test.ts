import { shapePlace } from "./index.ts";

Deno.test("shapePlace keeps display-safe fields, derives a coarse cuisine, drops review text", () => {
  const raw = {
    id: "p1",
    displayName: { text: "Spicy World" },
    location: { latitude: -33.8, longitude: 151.2 },
    rating: 4.6,
    primaryType: "chinese_restaurant",
    types: ["chinese_restaurant", "restaurant"],
    reviews: [{ text: { text: "secret review body" } }],
    attributions: ["Listing by Google"],
  };
  const out = shapePlace(raw);
  if (out.placeId !== "p1") throw new Error("placeId missing");
  if (out.rating !== 4.6) throw new Error("rating missing");
  if (!out.cuisines.includes("Chinese")) throw new Error("coarse cuisine must be derived from place type");
  if (!out.attribution) throw new Error("attribution must be present");
  if (JSON.stringify(out).includes("secret review body")) {
    throw new Error("review text must never leave the proxy");
  }
});
