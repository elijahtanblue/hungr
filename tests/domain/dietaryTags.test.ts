import { dietaryTagsFromName } from "../../src/domain/dietaryTags";

test("tags a place literally named vegetarian", () => {
  expect(dietaryTagsFromName("Gigi's Vegetarian Kitchen")).toEqual(["vegetarian"]);
});

test("tags vegan places", () => {
  expect(dietaryTagsFromName("Smith & Daughters Vegan")).toEqual(["vegan"]);
});

test("is case and accent insensitive", () => {
  expect(dietaryTagsFromName("VEGAN Bar")).toEqual(["vegan"]);
});

test("does not tag places that merely mention veg in a word", () => {
  expect(dietaryTagsFromName("Las Vegas Diner")).toEqual([]);
});

test("returns an empty array when nothing matches", () => {
  expect(dietaryTagsFromName("Joe's Steakhouse")).toEqual([]);
});
