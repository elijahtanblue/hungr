import { useFilters } from "../../src/store/useFilters";

beforeEach(() => useFilters.setState({
  selected: [],
  suppressed: [],
  budgetMax: null,
  withinKm: 50,
  sortBy: "rating",
  showState: "all",
}));

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

test("toggleSelected and toggleSuppressed are mutually exclusive", () => {
  const { toggleSelected, toggleSuppressed } = useFilters.getState();

  toggleSelected("Thai");
  expect(useFilters.getState().selected).toContain("Thai");

  // suppressing a selected cuisine moves it out of selected
  toggleSuppressed("Thai");
  expect(useFilters.getState().suppressed).toContain("Thai");
  expect(useFilters.getState().selected).not.toContain("Thai");

  // selecting it again moves it out of suppressed
  toggleSelected("Thai");
  expect(useFilters.getState().selected).toContain("Thai");
  expect(useFilters.getState().suppressed).not.toContain("Thai");
});

test("search filters update independently from cuisine preferences", () => {
  const { setBudgetMax, setWithinKm, setSortBy, setShowState } = useFilters.getState();

  setBudgetMax(2);
  setWithinKm(10);
  setSortBy("distance");
  setShowState("liked");

  expect(useFilters.getState()).toEqual(expect.objectContaining({
    budgetMax: 2,
    withinKm: 10,
    sortBy: "distance",
    showState: "liked",
  }));
  expect(useFilters.getState().selected).toEqual([]);
  expect(useFilters.getState().suppressed).toEqual([]);
});
