import { OCCASIONS, occasionById } from "../../src/domain/occasionPresets";

test("every occasion has a label and a non-empty query hint", () => {
  for (const o of OCCASIONS) {
    expect(o.label.length).toBeGreaterThan(0);
    expect(o.query.queryHint.length).toBeGreaterThan(0);
  }
});

test("occasion ids are unique", () => {
  const ids = OCCASIONS.map((o) => o.id);
  expect(new Set(ids).size).toBe(ids.length);
});

test("date night is a mid-to-high price, guide-aware occasion", () => {
  const dn = occasionById("date-night");
  expect(dn).toBeDefined();
  expect(dn!.query.priceBand?.min).toBe(2);
  expect(dn!.query.prestige).toContain("guide");
});

test("occasionById returns undefined for an unknown id", () => {
  expect(occasionById("nope")).toBeUndefined();
});
