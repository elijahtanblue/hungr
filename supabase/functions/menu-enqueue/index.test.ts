import { validPlaces } from "./index.ts";

Deno.test("validPlaces keeps well-formed candidates", () => {
  const out = validPlaces([{ placeId: "ChIJ_abc-123456", lng: 151.2 }]);
  if (out.length !== 1 || out[0].lng !== 151.2) throw new Error("valid candidate should pass");
});

Deno.test("validPlaces rejects bad ids, out-of-range lng, and non-objects", () => {
  const out = validPlaces([
    { placeId: "short", lng: 10 },              // too short
    { placeId: "bad id!", lng: 10 },            // illegal chars
    { placeId: "ChIJ_ok_1234567", lng: 999 },   // lng out of range
    { placeId: "ChIJ_ok_7654321" },             // no lng
    "not-an-object",
  ]);
  if (out.length !== 0) throw new Error(`expected all rejected, got ${JSON.stringify(out)}`);
});

Deno.test("validPlaces caps the batch at 10", () => {
  const many = Array.from({ length: 25 }, (_, i) => ({ placeId: `ChIJ_place_${i}0000`, lng: 100 }));
  if (validPlaces(many).length !== 10) throw new Error("batch should be capped at 10");
});

Deno.test("validPlaces returns empty for a non-array", () => {
  if (validPlaces({ nope: true }).length !== 0) throw new Error("non-array -> empty");
});
