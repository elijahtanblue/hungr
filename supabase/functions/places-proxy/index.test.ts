import { buildTextSearchBody, isFoodPlace, rankPlacesForSearch, shapePlace } from "./index.ts";

Deno.test("shapePlace keeps display-safe fields, derives a coarse cuisine, drops review text", () => {
  const raw = {
    id: "p1",
    displayName: { text: "Spicy World" },
    location: { latitude: -33.8, longitude: 151.2 },
    rating: 4.6,
    userRatingCount: 512,
    priceLevel: "PRICE_LEVEL_MODERATE",
    primaryType: "chinese_restaurant",
    types: ["chinese_restaurant", "restaurant"],
    photos: [
      { name: "places/p1/photos/first", widthPx: 1200 },
      { name: "places/p1/photos/second", widthPx: 1200 },
    ],
    reviews: [{ text: { text: "secret review body" } }],
    attributions: ["Listing by Google"],
  };
  const out = shapePlace(raw);
  if (out.placeId !== "p1") throw new Error("placeId missing");
  if (out.rating !== 4.6) throw new Error("rating missing");
  if (out.userRatingCount !== 512) throw new Error("userRatingCount missing");
  if (out.priceLevel !== "PRICE_LEVEL_MODERATE") throw new Error("price level missing");
  if (out.photoName !== "places/p1/photos/first") throw new Error("first photo resource name missing");
  if (!out.cuisines.includes("Chinese")) throw new Error("coarse cuisine must be derived from place type");
  if (!out.attribution) throw new Error("attribution must be present");
  if (JSON.stringify(out).includes("secret review body")) {
    throw new Error("review text must never leave the proxy");
  }
});

Deno.test("isFoodPlace rejects non-food businesses returned by broad text search", () => {
  const datingService = {
    id: "p-dating",
    displayName: { text: "It's Just Lunch San Francisco" },
    location: { latitude: 37.8, longitude: -122.4 },
    primaryType: "dating_service",
    types: ["dating_service", "point_of_interest", "establishment"],
  };

  if (isFoodPlace(datingService)) throw new Error("dating services must not pass the food gate");
});

Deno.test("isFoodPlace allows restaurant and cafe-like Google food types", () => {
  if (!isFoodPlace({ primaryType: "restaurant", types: ["restaurant"] })) {
    throw new Error("generic restaurants should pass the food gate");
  }
  if (!isFoodPlace({ primaryType: "cafe", types: ["cafe", "food"] })) {
    throw new Error("cafes should pass the food gate");
  }
});

Deno.test("shapePlace adds broader cuisine tags from Google types", () => {
  const thai = shapePlace({
    id: "p2",
    displayName: { text: "Thai Corner" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "thai_restaurant",
    types: ["thai_restaurant", "restaurant"],
  });

  if (!thai.cuisines.includes("Thai")) throw new Error("specific cuisine missing");
  if (!thai.cuisines.includes("Asian")) throw new Error("Asian parent cuisine missing");

  const pizza = shapePlace({
    id: "p3",
    displayName: { text: "Pizza Corner" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "pizza_restaurant",
    types: ["pizza_restaurant", "restaurant"],
  });

  if (!pizza.cuisines.includes("Pizza")) throw new Error("pizza cuisine missing");
  if (!pizza.cuisines.includes("Italian")) throw new Error("Italian parent cuisine missing");
});

Deno.test("shapePlace derives conservative cuisine tags from names", () => {
  const cafe = shapePlace({
    id: "p4",
    displayName: { text: "Harbour Cafe Bar" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!cafe.cuisines.includes("Cafe")) throw new Error("cafe name tag missing");
  if (!cafe.cuisines.includes("Bar")) throw new Error("bar name tag missing");

  const chinese = shapePlace({
    id: "p5",
    displayName: { text: "Golden Chinese Noodles" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!chinese.cuisines.includes("Chinese")) throw new Error("Chinese name tag missing");
  if (!chinese.cuisines.includes("Asian")) throw new Error("Asian parent from name tag missing");

  const pasta = shapePlace({
    id: "p6",
    displayName: { text: "Fresh Pasta House" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!pasta.cuisines.includes("Italian")) throw new Error("Italian name tag missing");
});

Deno.test("shapePlace name tags cover expanded first-party categories", () => {
  const filipino = shapePlace({
    id: "p7",
    displayName: { text: "Filipino BBQ House" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!filipino.cuisines.includes("Filipino")) throw new Error("Filipino name tag missing");
  if (!filipino.cuisines.includes("Asian")) throw new Error("Asian parent for Filipino missing");

  const dimSum = shapePlace({
    id: "p8",
    displayName: { text: "Golden Dim Sum" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!dimSum.cuisines.includes("Dim Sum")) throw new Error("Dim Sum name tag missing");
  if (!dimSum.cuisines.includes("Asian")) throw new Error("Asian parent for Dim Sum missing");

  const tacos = shapePlace({
    id: "p9",
    displayName: { text: "Tacos Dorados" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "restaurant",
    types: ["restaurant"],
  });

  if (!tacos.cuisines.includes("Tacos")) throw new Error("Tacos name tag missing");
  if (!tacos.cuisines.includes("Mexican")) throw new Error("Mexican parent for Tacos missing");
});

Deno.test("shapePlace covers expanded Google food types that match app labels", () => {
  const filipino = shapePlace({
    id: "p10",
    displayName: { text: "Lola's Kitchen" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "filipino_restaurant",
    types: ["filipino_restaurant", "restaurant"],
  });

  if (!filipino.cuisines.includes("Filipino")) throw new Error("Filipino type tag missing");
  if (!filipino.cuisines.includes("Asian")) throw new Error("Asian parent for Filipino type missing");

  const tacos = shapePlace({
    id: "p11",
    displayName: { text: "El Centro" },
    location: { latitude: -33.8, longitude: 151.2 },
    primaryType: "taco_restaurant",
    types: ["taco_restaurant", "restaurant"],
  });

  if (!tacos.cuisines.includes("Tacos")) throw new Error("Tacos type tag missing");
  if (!tacos.cuisines.includes("Mexican")) throw new Error("Mexican parent for Tacos type missing");
});

Deno.test("buildTextSearchBody requests one Google page and forwards the page token", () => {
  const body = buildTextSearchBody(-33.87, 151.21, "food", "next-page");

  if (body.pageSize !== 20) throw new Error("must request 20 results per Google page");
  if (body.pageToken !== "next-page") throw new Error("page token missing");
  if (body.textQuery !== "food") throw new Error("text query missing");
});

Deno.test("buildTextSearchBody uses the selected radius with a safe clamp", () => {
  const body = buildTextSearchBody(-33.87, 151.21, "food", undefined, 10000);
  if (body.locationBias.circle.radius !== 10000) throw new Error("selected radius missing");

  const tooLarge = buildTextSearchBody(-33.87, 151.21, "food", undefined, 999999);
  if (tooLarge.locationBias.circle.radius !== 50000) throw new Error("radius should clamp to 50km");
});

Deno.test("buildTextSearchBody only sets openNow when requested", () => {
  const off = buildTextSearchBody(-33.87, 151.21, "food");
  if ("openNow" in off) throw new Error("openNow should be omitted by default");

  const on = buildTextSearchBody(-33.87, 151.21, "food", undefined, undefined, true);
  if (on.openNow !== true) throw new Error("openNow should be set when requested");
});

Deno.test("buildTextSearchBody can restrict text search to the local area and type", () => {
  const body = buildTextSearchBody(37.79, -122.4, "hot pot restaurant", undefined, 8000, false, {
    id: "hot-pot-local",
    endpoint: "text",
    textQuery: "hot pot restaurant",
    locationMode: "restriction",
    includedType: "hot_pot_restaurant",
    rankPreference: "DISTANCE",
  });

  if (!("locationRestriction" in body)) throw new Error("local search should use a restriction");
  if ("locationBias" in body) throw new Error("local search should not also use a bias");
  if (body.includedType !== "hot_pot_restaurant") throw new Error("includedType missing");
  if (body.rankPreference !== "DISTANCE") throw new Error("rank preference missing");
});

Deno.test("rankPlacesForSearch prefers a nearby branch over a far exact-looking branch", () => {
  const far = shapePlace({
    id: "far",
    displayName: { text: "Nan Hot Pot & Bar" },
    location: { latitude: 33.02, longitude: -96.7 },
    rating: 4.8,
    userRatingCount: 900,
    primaryType: "restaurant",
    types: ["restaurant", "food"],
  });
  const near = shapePlace({
    id: "near",
    displayName: { text: "Nan Hotpot SF" },
    location: { latitude: 37.8, longitude: -122.41 },
    rating: 4.7,
    userRatingCount: 120,
    primaryType: "hot_pot_restaurant",
    types: ["hot_pot_restaurant", "restaurant", "food"],
  });

  const out = rankPlacesForSearch([far, near], 37.79, -122.4, "Nan Hot pot");

  if (out[0].placeId !== "near") throw new Error("nearby branch should win");
});

Deno.test("shapePlace tags Bubble Tea from Google's category, not the place name", () => {
  const boba = shapePlace({
    id: "p1",
    displayName: { text: "Happy Lemon" },
    location: { latitude: 0, longitude: 0 },
    primaryTypeDisplayName: { text: "Bubble tea store" },
  });
  if (!boba.cuisines.includes("Bubble Tea")) throw new Error("Google bubble tea category should tag Bubble Tea");

  // A place merely named "... Tea" with no bubble-tea category must NOT be auto-tagged.
  const plainTea = shapePlace({
    id: "p2",
    displayName: { text: "Mariage Frères Tea House" },
    location: { latitude: 0, longitude: 0 },
    primaryTypeDisplayName: { text: "Tea house" },
  });
  if (plainTea.cuisines.includes("Bubble Tea")) throw new Error("a plain tea house must not be tagged Bubble Tea");
});
