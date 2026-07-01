import { parseImportText, MAX_IMPORT_ROWS } from "../../src/domain/importList";

test("parses a Google Takeout style CSV, using Title and an address-ish column", () => {
  const csv = [
    "Title,Note,URL",
    'Mr Wong,"Great yum cha, Bridge St",http://maps.google.com/?cid=1',
    "Gumshara Ramen,,http://maps.google.com/?cid=2",
  ].join("\n");
  expect(parseImportText(csv)).toEqual([
    { name: "Mr Wong", query: "Mr Wong Great yum cha, Bridge St" },
    { name: "Gumshara Ramen", query: "Gumshara Ramen" },
  ]);
});

test("parses a Google Takeout GeoJSON export with address and per-row coordinates", () => {
  const geojson = JSON.stringify({
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [151.2076, -33.8649] },
        properties: { Title: "Mr Wong", Location: { Address: "3 Bridge Ln, Sydney NSW 2000" } },
      },
      {
        type: "Feature",
        geometry: { type: "Point", coordinates: [151.2, -33.87] },
        properties: { Title: "Gumshara Ramen" },
      },
    ],
  });
  expect(parseImportText(geojson)).toEqual([
    { name: "Mr Wong", query: "Mr Wong 3 Bridge Ln, Sydney NSW 2000", lat: -33.8649, lng: 151.2076 },
    { name: "Gumshara Ramen", query: "Gumshara Ramen", lat: -33.87, lng: 151.2 },
  ]);
});

test("falls back to line parsing when JSON is not a Takeout FeatureCollection", () => {
  expect(parseImportText('{"not":"geojson"}')).toEqual([
    { name: '{"not":"geojson"}', query: '{"not":"geojson"}' },
  ]);
});

test("parses plain notes, one place per line, searching the whole line", () => {
  expect(parseImportText("Gumshara Ramen\nMr Wong, Bridge St")).toEqual([
    { name: "Gumshara Ramen", query: "Gumshara Ramen" },
    { name: "Mr Wong", query: "Mr Wong, Bridge St" },
  ]);
});

test("ignores blank lines and de-duplicates by name", () => {
  expect(parseImportText("Mr Wong\n\n  \nmr wong\nGumshara")).toEqual([
    { name: "Mr Wong", query: "Mr Wong" },
    { name: "Gumshara", query: "Gumshara" },
  ]);
});

test("caps the number of rows so a giant paste cannot flood lookups", () => {
  const many = Array.from({ length: MAX_IMPORT_ROWS + 20 }, (_, i) => `Place ${i}`).join("\n");
  expect(parseImportText(many)).toHaveLength(MAX_IMPORT_ROWS);
});

test("returns nothing for empty input", () => {
  expect(parseImportText("   \n  ")).toEqual([]);
});
