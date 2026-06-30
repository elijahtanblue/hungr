import { buildTextSearchBody, shapePlace } from "./index.ts";

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
