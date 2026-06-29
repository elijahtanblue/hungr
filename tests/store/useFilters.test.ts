import { useFilters } from "../../src/store/useFilters";

beforeEach(() => useFilters.setState({ selected: [], suppressed: [] }));

test("setPreference is mutually exclusive across prioritise, avoid, neutral", () => {
  const { setPreference } = useFilters.getState();

  setPreference("Thai", "prioritise");
  expect(useFilters.getState().selected).toContain("Thai");
  expect(useFilters.getState().suppressed).not.toContain("Thai");

  // switching to avoid removes it from the prioritise list
  setPreference("Thai", "avoid");
  expect(useFilters.getState().suppressed).toContain("Thai");
  expect(useFilters.getState().selected).not.toContain("Thai");

  // neutral clears it from both
  setPreference("Thai", "neutral");
  expect(useFilters.getState().selected).not.toContain("Thai");
  expect(useFilters.getState().suppressed).not.toContain("Thai");
});

test("setSuppressed replaces the avoid list wholesale", () => {
  useFilters.getState().setSuppressed(["Nepalese", "Indian"]);
  expect(useFilters.getState().suppressed).toEqual(["Nepalese", "Indian"]);
});
