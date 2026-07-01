import { getFirstPartyFacts, annotateFacts } from "../../src/api/firstPartyFacts";
import type { Place } from "../../src/domain/types";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { rpc: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

function place(id: string, extra: Partial<Place> = {}): Place {
  return { placeId: id, name: id, lat: 0, lng: 0, cuisines: [], ...extra };
}

test("getFirstPartyFacts maps rows keyed by place_id", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({
    data: [{ place_id: "a", price_band: 3, dietary_flags: ["vegetarian"] }],
    error: null,
  });
  const out = await getFirstPartyFacts(["a"]);
  expect(out.a).toEqual({ priceBand: 3, dietaryFlags: ["vegetarian"] });
});

test("getFirstPartyFacts is best effort: an error returns an empty map", async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: new Error("rls") });
  expect(await getFirstPartyFacts(["a"])).toEqual({});
});

test("getFirstPartyFacts skips the round trip for an empty id list", async () => {
  expect(await getFirstPartyFacts([])).toEqual({});
  expect(supabase.rpc).not.toHaveBeenCalled();
});

test("annotateFacts applies price band and unions dietary tags onto name-derived tags", () => {
  const places = [place("a", { dietaryTags: ["vegan"] })];
  const out = annotateFacts(places, { a: { priceBand: 3, dietaryFlags: ["vegetarian"] } });
  expect(out[0].priceBand).toBe(3);
  expect(out[0].dietaryTags).toEqual(expect.arrayContaining(["vegan", "vegetarian"]));
});

test("annotateFacts leaves places without facts untouched", () => {
  const out = annotateFacts([place("a")], {});
  expect(out[0].priceBand).toBeUndefined();
  expect(out[0].dietaryTags).toBeUndefined();
});
