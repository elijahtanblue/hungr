import { getPlaceNames } from "../../src/api/placeNames";
import { supabase } from "../../src/lib/supabase";

jest.mock("../../src/lib/supabase", () => ({
  supabase: { functions: { invoke: jest.fn() } },
}));

beforeEach(() => jest.clearAllMocks());

test("resolves names and serves repeats from cache", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: { names: { p1: "Mr Wong" } }, error: null });
  expect(await getPlaceNames(["p1"])).toEqual({ p1: "Mr Wong" });
  // Second call for the same id must not hit the network again.
  expect(await getPlaceNames(["p1"])).toEqual({ p1: "Mr Wong" });
  expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
});

test("fails soft to an empty map on error", async () => {
  (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: null, error: new Error("down") });
  expect(await getPlaceNames(["unknown-id"])).toEqual({});
});
