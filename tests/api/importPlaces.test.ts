import { resolveImportRows, addPlacesToWantToGo } from "../../src/api/importPlaces";
import { searchNearby } from "../../src/api/places";
import { setUserPlaceState } from "../../src/api/userPlaces";

jest.mock("../../src/api/places", () => ({ searchNearby: jest.fn() }));
jest.mock("../../src/api/userPlaces", () => ({ setUserPlaceState: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const bias = { lat: -33.87, lng: 151.21 };
const place = (placeId: string, name: string) => ({ placeId, name, lat: 0, lng: 0, cuisines: [] });

test("resolveImportRows returns up to three candidates per row", async () => {
  (searchNearby as jest.Mock).mockResolvedValue([place("p1", "Mr Wong"), place("p2", "Mr Wong 2"), place("p3", "Mr Wong 3"), place("p4", "Mr Wong 4")]);

  const out = await resolveImportRows([{ name: "Mr Wong", query: "Mr Wong" }], bias);

  expect(out).toHaveLength(1);
  expect(out[0].name).toBe("Mr Wong");
  expect(out[0].candidates.map((c) => c.placeId)).toEqual(["p1", "p2", "p3"]);
});

test("resolveImportRows retries with the name alone when the full query finds nothing", async () => {
  (searchNearby as jest.Mock)
    .mockResolvedValueOnce([]) // full line "Sandoitchi cafe, Surry Hills" -> nothing
    .mockResolvedValueOnce([place("s1", "Sandoitchi Cafe")]); // name only -> found

  const out = await resolveImportRows([{ name: "Sandoitchi cafe", query: "Sandoitchi cafe, Surry Hills" }], bias);

  expect(out[0].candidates.map((c) => c.placeId)).toEqual(["s1"]);
  expect(searchNearby).toHaveBeenCalledTimes(2);
});

test("resolveImportRows yields an empty candidate list when a row errors", async () => {
  (searchNearby as jest.Mock).mockRejectedValue(new Error("rate limited"));
  const out = await resolveImportRows([{ name: "Boom", query: "Boom" }], bias);
  expect(out[0].candidates).toEqual([]);
});

test("addPlacesToWantToGo saves picks and reports failures", async () => {
  (setUserPlaceState as jest.Mock)
    .mockResolvedValueOnce(true)
    .mockResolvedValueOnce(false);

  const res = await addPlacesToWantToGo([place("p1", "Mr Wong"), place("p2", "Gumshara")]);

  expect(res).toEqual({ added: ["Mr Wong"], missed: ["Gumshara"] });
  expect(setUserPlaceState).toHaveBeenCalledWith("p1", "go");
});
