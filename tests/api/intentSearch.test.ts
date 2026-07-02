import { parseIntent, coerceStructuredQuery } from "../../src/api/intentSearch";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

beforeEach(() => jest.clearAllMocks());

test("coerceStructuredQuery keeps valid facets and drops unknown ones", () => {
  const q = coerceStructuredQuery(
    { queryHint: "wine bar", cuisines: ["Italian"], dietary: ["vegan", "paleo"], prestige: ["guide", "x"], priceBand: { min: 3, max: 5 } },
    "raw",
  );
  expect(q).toEqual({
    queryHint: "wine bar",
    cuisines: ["italian"],
    dietary: ["vegan"],
    prestige: ["guide"],
    priceBand: { min: 3 },
  });
});

test("coerceStructuredQuery falls back to the raw query when hint is missing", () => {
  expect(coerceStructuredQuery({}, "sushi near me")).toEqual({ queryHint: "sushi near me" });
  expect(coerceStructuredQuery("garbage", "tacos")).toEqual({ queryHint: "tacos" });
});

test("parseIntent returns the shaped server query", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({
    data: { queryHint: "italian", prestige: ["top"] },
    error: null,
  });
  await expect(parseIntent("  somewhere nice for a date  ")).resolves.toEqual({
    queryHint: "italian",
    prestige: ["top"],
  });
  expect(supabase.functions.invoke).toHaveBeenCalledWith("intent-parse", {
    body: { query: "somewhere nice for a date" },
  });
});

test("parseIntent degrades to a plain text search when the function errors", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error("boom") });
  await expect(parseIntent("date night")).resolves.toEqual({ queryHint: "date night" });
});

test("parseIntent degrades to a plain text search when invoke throws", async () => {
  (supabase.functions.invoke as jest.Mock).mockRejectedValue(new Error("network"));
  await expect(parseIntent("cheap eats")).resolves.toEqual({ queryHint: "cheap eats" });
});
