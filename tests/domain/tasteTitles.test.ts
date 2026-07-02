import { deriveTraits, deriveTasteInsights, TRAIT_CATALOG, type FeatureScore } from "../../src/domain/tasteTitles";

const f = (feature: string, score = 3, evidenceCount = 3): FeatureScore => ({ feature, score, evidenceCount });
const earned = (traits: ReturnType<typeof deriveTraits>, id: string) =>
  !!traits.find((t) => t.id === id)?.earned;

test("no trait is earned before there is enough cuisine history", () => {
  const traits = deriveTraits([f("cuisine:steakhouse", 1, 1)]);
  expect(traits.every((t) => !t.earned)).toBe(true);
});

test("Brotein is earned when meat-forward cuisines dominate", () => {
  const traits = deriveTraits([
    f("cuisine:steakhouse", 4, 4),
    f("cuisine:korean bbq", 3, 3),
    f("cuisine:matcha", 1, 1),
  ]);
  expect(earned(traits, "brotein")).toBe(true);
});

test("Koala is earned from vegan/vegetarian tags, not just cuisine names", () => {
  const traits = deriveTraits([
    f("cuisine:restaurant", 3, 3),
    f("tag:vegan", 3, 3),
    f("tag:vegetarian", 2, 2),
  ]);
  expect(earned(traits, "koala")).toBe(true);
});

test("Spicy Poops is boosted by spicy review tags on top of spicy cuisines", () => {
  const traits = deriveTraits([
    f("cuisine:thai", 2, 2),
    f("cuisine:italian", 3, 3),
    f("tag:spicy", 3, 3),
  ]);
  expect(earned(traits, "spicy_poops")).toBe(true);
});

test("Boba Addict reads tea shops without misfiring on 'steak'", () => {
  const boba = deriveTraits([f("cuisine:bubble tea", 4, 4), f("cuisine:steakhouse", 1, 1)]);
  expect(earned(boba, "boba_addict")).toBe(true);
  const steak = deriveTraits([f("cuisine:steakhouse", 4, 4)]);
  expect(earned(steak, "boba_addict")).toBe(false);
});

test("Picky Eater needs more dislikes than likes, and 'liked' does not match 'disliked'", () => {
  const picky = deriveTraits([f("cuisine:thai", 3, 3), f("signal:disliked", 5, 5), f("signal:liked", 3, 2)]);
  expect(earned(picky, "picky_eater")).toBe(true);
  const notPicky = deriveTraits([f("cuisine:thai", 3, 3), f("signal:disliked", 1, 1), f("signal:liked", 6, 6)]);
  expect(earned(notPicky, "picky_eater")).toBe(false);
});

test("Munch is earned by eating out more than four times in the last week", () => {
  const base = [f("cuisine:thai", 3, 3)];
  expect(earned(deriveTraits(base, { recentCheckIns: 6 }), "munch")).toBe(true);
  expect(earned(deriveTraits(base, { recentCheckIns: 2 }), "munch")).toBe(false);
});

test("Follower is earned from opening trending places", () => {
  const traits = deriveTraits([f("cuisine:thai", 3, 3), f("signal:followed_trend", 4, 4)]);
  expect(earned(traits, "follower")).toBe(true);
});

test("Girl Dinner is cafe-heavy with no real meals; Boy Dinner is the opposite", () => {
  const girl = deriveTraits([f("cuisine:cafe", 8, 8), f("cuisine:bakery", 1, 1)]);
  expect(earned(girl, "girl_dinner")).toBe(true);
  expect(earned(girl, "boy_dinner")).toBe(false);

  const boy = deriveTraits([f("cuisine:steakhouse", 5, 5), f("cuisine:thai", 4, 4)]);
  expect(earned(boy, "boy_dinner")).toBe(true);
  expect(earned(boy, "girl_dinner")).toBe(false);
});

test("removed classes (Slice Guy, Caffeine Head) are not in the catalog", () => {
  const ids = TRAIT_CATALOG.map((t) => t.id);
  expect(ids).not.toContain("slice_guy");
  expect(ids).not.toContain("caffeine_head");
  expect(ids).toContain("brunch_girlie");
  expect(ids).toContain("boba_addict");
});

test("insights are human sentences, strongest first, capped at four", () => {
  const lines = deriveTasteInsights(
    [
      f("cuisine:thai", 8, 8),
      f("cuisine:italian", 2, 2),
      f("cuisine:mexican", 2, 2),
      f("cuisine:japanese", 2, 2),
      f("cuisine:ethiopian", 2, 2),
      f("cuisine:peruvian", 2, 2),
      f("signal:disliked", 5, 5),
      f("signal:value", 3, 3),
    ],
    { recentCheckIns: 1 },
  );
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.length).toBeLessThanOrEqual(4);
  expect(lines[0]).toMatch(/picky eater/i);
});
