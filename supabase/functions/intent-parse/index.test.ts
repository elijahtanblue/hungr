import { shapeStructuredQuery } from "./index.ts";

Deno.test("shapeStructuredQuery keeps recognized facets and drops the rest", () => {
  const out = shapeStructuredQuery({
    queryHint: "italian restaurant",
    cuisines: ["Italian", "italian", "  "],
    dietary: ["vegan", "keto"],
    prestige: ["guide", "nonsense"],
    priceBand: { min: 2, max: 9 },
  }, "raw words");
  if (out.queryHint !== "italian restaurant") throw new Error("hint lost");
  if (JSON.stringify(out.cuisines) !== JSON.stringify(["italian"])) throw new Error("cuisine dedupe failed");
  if (JSON.stringify(out.dietary) !== JSON.stringify(["vegan"])) throw new Error("dietary allow-list failed");
  if (JSON.stringify(out.prestige) !== JSON.stringify(["guide"])) throw new Error("prestige allow-list failed");
  if (JSON.stringify(out.priceBand) !== JSON.stringify({ min: 2 })) throw new Error("band clamp failed");
});

Deno.test("shapeStructuredQuery falls back to the raw query when the model gives nothing usable", () => {
  const out = shapeStructuredQuery({}, "sushi near me");
  if (out.queryHint !== "sushi near me") throw new Error("fallback hint missing");
  if ("cuisines" in out || "prestige" in out || "priceBand" in out) throw new Error("unexpected facets");
});

Deno.test("shapeStructuredQuery survives a garbage payload", () => {
  const out = shapeStructuredQuery("not an object", "tacos");
  if (out.queryHint !== "tacos") throw new Error("fallback hint missing");
});
