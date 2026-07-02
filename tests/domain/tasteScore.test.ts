import { tasteBoost, tasteLabel, tasteRank, tasteNotes, type TasteContext } from "../../src/domain/tasteScore";
import type { Place } from "../../src/domain/types";

const place = (placeId: string, cuisines: string[] = []): Place => ({
  placeId, name: placeId, lat: 0, lng: 0, cuisines,
});
const ctx = (over: Partial<TasteContext> = {}): TasteContext => ({
  favoriteCuisines: [], friendsBeen: new Set(), ...over,
});

test("a friend having been outweighs a cuisine match", () => {
  const c = ctx({ favoriteCuisines: ["italian"], friendsBeen: new Set(["f1"]) });
  expect(tasteBoost(place("f1"), c)).toBe(2);
  expect(tasteBoost(place("x", ["italian"]), c)).toBe(1);
  expect(tasteBoost(place("f1", ["italian"]), c)).toBe(3);
});

test("own place states use the approved taste-profile weights", () => {
  expect(tasteBoost({ ...place("want"), state: "go" }, ctx())).toBe(6);
  expect(tasteBoost({ ...place("liked"), state: "liked" }, ctx())).toBe(4);
  expect(tasteBoost({ ...place("loved"), state: "loved" }, ctx())).toBe(8);
  expect(tasteBoost({ ...place("disliked"), state: "disliked" }, ctx())).toBe(-7);
});

test("check-ins add a small behavioral signal", () => {
  const c = ctx({ checkedIn: new Set(["p1"]) });
  expect(tasteBoost(place("p1"), c)).toBe(2);
});

test("taste profile has no avoid state or weight", () => {
  const c = ctx();
  expect(tasteBoost({ ...place("old"), state: "avoid" as any }, c)).toBe(0);
});

test("favorite cuisine matching is case-insensitive", () => {
  const c = ctx({ favoriteCuisines: ["Italian"] });
  expect(tasteBoost(place("x", ["italian"]), c)).toBe(1);
  expect(tasteLabel(place("x", ["italian"]), c)).toBe("Your kind of food");
});

test("friend label takes precedence over cuisine label", () => {
  const c = ctx({ favoriteCuisines: ["thai"], friendsBeen: new Set(["f1"]) });
  expect(tasteLabel(place("f1", ["thai"]), c)).toBe("Friends have been");
  expect(tasteLabel(place("x"), c)).toBeNull();
});

test("tasteRank is a stable nudge, preserving order within a tier", () => {
  const c = ctx({ favoriteCuisines: ["italian"], friendsBeen: new Set(["f1"]) });
  const input = [
    place("a"),
    place("f1"),
    place("b", ["italian"]),
    { ...place("saved"), state: "go" as const },
    { ...place("nope"), state: "disliked" as const },
  ];
  expect(tasteRank(input, c).map((p) => p.placeId)).toEqual(["saved", "f1", "b", "a", "nope"]);
});

test("tasteNotes caps 'You liked this' at three but leaves other labels unlimited", () => {
  const c = ctx({ favoriteCuisines: ["thai"] });
  const liked = ["l1", "l2", "l3", "l4", "l5"].map((id) => ({ ...place(id), state: "liked" as const }));
  const kinds = ["k1", "k2", "k3", "k4"].map((id) => place(id, ["thai"]));
  const notes = tasteNotes([...liked, ...kinds], c);

  const likedNotes = Object.values(notes).filter((n) => n === "You liked this");
  const kindNotes = Object.values(notes).filter((n) => n === "Your kind of food");
  expect(likedNotes).toHaveLength(3);
  expect(kindNotes).toHaveLength(4);
});

test("empty context leaves order untouched", () => {
  const input = [place("a"), place("b"), place("c")];
  expect(tasteRank(input, ctx()).map((p) => p.placeId)).toEqual(["a", "b", "c"]);
});
