import { nearbySearchRegion, listTitleForSearchMode, searchTextForAction } from "../../src/domain/mapSearch";

test("typed search uses the submitted query and a search-results title", () => {
  expect(searchTextForAction("typed", "Sandoitchi Cafe Sydney")).toBe("Sandoitchi Cafe Sydney");
  expect(listTitleForSearchMode("typed", "Sandoitchi Cafe Sydney")).toBe('Search results for "Sandoitchi Cafe Sydney"');
});

test("nearby food ignores the typed query and keeps its own title", () => {
  expect(searchTextForAction("nearby", "Sandoitchi Cafe Sydney")).toBe("food");
  expect(listTitleForSearchMode("nearby", "Sandoitchi Cafe Sydney")).toBe("Food near you");
});

test("nearby food searches the current map area instead of the device location", () => {
  const travelArea = { latitude: -33.87, longitude: 151.21, latitudeDelta: 0.05, longitudeDelta: 0.05 };
  const deviceArea = { latitude: -37.81, longitude: 144.96, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  expect(nearbySearchRegion(travelArea, deviceArea)).toBe(travelArea);
});
