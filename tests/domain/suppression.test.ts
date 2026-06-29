import { isSuppressed } from "../../src/domain/suppression";

test("hidden only when ALL cuisines are suppressed", () => {
  // multi cuisine place stays visible if at least one cuisine is not suppressed
  expect(isSuppressed(["Chinese", "Thai"], ["Thai"])).toBe(false);
  // place hidden only when every tag is suppressed
  expect(isSuppressed(["Thai"], ["Thai"])).toBe(true);
  expect(isSuppressed(["Thai", "Indian"], ["Thai", "Indian"])).toBe(true);
  // no suppression, or no cuisines, never hidden
  expect(isSuppressed(["Thai"], [])).toBe(false);
  expect(isSuppressed([], ["Thai"])).toBe(false);
});
