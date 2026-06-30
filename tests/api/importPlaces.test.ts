import { importPlacesToWantToGo } from "../../src/api/importPlaces";
import { searchNearby } from "../../src/api/places";
import { setUserPlaceState } from "../../src/api/userPlaces";

jest.mock("../../src/api/places", () => ({ searchNearby: jest.fn() }));
jest.mock("../../src/api/userPlaces", () => ({ setUserPlaceState: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

const bias = { lat: -33.87, lng: 151.21 };

test("saves the top match as want-to-go and reports unresolved rows as missed", async () => {
  (searchNearby as jest.Mock).mockImplementation(async (_lat, _lng, query: string) =>
    query.startsWith("Mr Wong") ? [{ placeId: "p1", name: "Mr Wong" }] : [],
  );
  (setUserPlaceState as jest.Mock).mockResolvedValue(true);

  const res = await importPlacesToWantToGo(
    [{ name: "Mr Wong", query: "Mr Wong" }, { name: "Nowhere", query: "Nowhere" }],
    bias,
  );

  expect(res).toEqual({ added: ["Mr Wong"], missed: ["Nowhere"] });
  expect(setUserPlaceState).toHaveBeenCalledWith("p1", "go");
  expect(setUserPlaceState).toHaveBeenCalledTimes(1);
});

test("a failing row does not abort the rest of the import", async () => {
  (searchNearby as jest.Mock)
    .mockRejectedValueOnce(new Error("rate limited"))
    .mockResolvedValueOnce([{ placeId: "p2", name: "Gumshara" }]);
  (setUserPlaceState as jest.Mock).mockResolvedValue(true);

  const res = await importPlacesToWantToGo(
    [{ name: "Boom", query: "Boom" }, { name: "Gumshara", query: "Gumshara" }],
    bias,
  );

  expect(res).toEqual({ added: ["Gumshara"], missed: ["Boom"] });
});

test("reports progress for each row", async () => {
  (searchNearby as jest.Mock).mockResolvedValue([{ placeId: "p", name: "X" }]);
  (setUserPlaceState as jest.Mock).mockResolvedValue(true);
  const seen: Array<[number, number]> = [];

  await importPlacesToWantToGo([{ name: "A", query: "A" }, { name: "B", query: "B" }], bias, (d, t) => seen.push([d, t]));

  expect(seen).toEqual([[1, 2], [2, 2]]);
});
