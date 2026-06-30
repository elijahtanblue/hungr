import { render, screen, fireEvent } from "@testing-library/react-native";
import { PreferencesSheet } from "../../src/components/PreferencesSheet";
import { useFilters } from "../../src/store/useFilters";
import { saveSuppressedCuisines } from "../../src/api/preferences";

jest.mock("../../src/api/preferences", () => ({
  saveSuppressedCuisines: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useFilters.setState({ selected: [], suppressed: [], budgetMax: null, withinKm: 50, minRating: null, openNow: false, sortBy: "rating", showState: "all" });
  (saveSuppressedCuisines as jest.Mock).mockClear();
});

test("tapping Avoid adds the cuisine to the avoid list and persists it", async () => {
  await render(<PreferencesSheet groups={[{ label: "Cuisine", items: ["Thai", "Chinese"] }]} onClose={() => {}} />);
  await fireEvent.press(screen.getAllByText("Avoid")[0]); // first row is Thai
  expect(useFilters.getState().suppressed).toContain("Thai");
  expect(saveSuppressedCuisines).toHaveBeenCalledWith(["Thai"]);
});

test("Prioritise and Avoid are mutually exclusive in the sheet", async () => {
  useFilters.setState({ selected: [], suppressed: ["Thai"] });
  await render(<PreferencesSheet groups={[{ label: "Cuisine", items: ["Thai"] }]} onClose={() => {}} />);
  await fireEvent.press(screen.getByText("Prioritise"));
  expect(useFilters.getState().selected).toContain("Thai");
  expect(useFilters.getState().suppressed).not.toContain("Thai");
});

test("preference persistence handles rejected saves", async () => {
  const catchSpy = jest.fn();
  (saveSuppressedCuisines as jest.Mock).mockReturnValueOnce({ catch: catchSpy });
  await render(<PreferencesSheet groups={[{ label: "Cuisine", items: ["Thai"] }]} onClose={() => {}} />);
  await fireEvent.press(screen.getByText("Avoid"));
  expect(catchSpy).toHaveBeenCalled();
});

test("advanced search filters render above Cuisine/Food and update the filter store", async () => {
  await render(
    <PreferencesSheet
      groups={[
        { label: "Cuisine", items: ["Thai"] },
        { label: "Food", items: ["Ramen"] },
      ]}
      onClose={() => {}}
    />,
  );

  expect(screen.getByText("Budget")).toBeTruthy();
  expect(screen.getByText("Within")).toBeTruthy();
  expect(screen.getByText("Min rating")).toBeTruthy();
  expect(screen.getByText("Sort by")).toBeTruthy();
  expect(screen.getByText("Show")).toBeTruthy();

  // Budget and Min rating both default to "Any"; the budget button is the first.
  await fireEvent.press(screen.getAllByText("Any")[0]);
  await fireEvent.press(screen.getByText("$$"));
  await fireEvent.press(screen.getByText("50km"));
  await fireEvent.press(screen.getByText("10km"));
  // Budget now reads "$$", so the remaining "Any" is the Min rating button.
  await fireEvent.press(screen.getByText("Any"));
  await fireEvent.press(screen.getByText("★ 4.5+"));
  await fireEvent.press(screen.getByText("Rating"));
  await fireEvent.press(screen.getByText("Distance"));
  await fireEvent.press(screen.getByText("All"));
  await fireEvent.press(screen.getByText("Liked"));

  expect(useFilters.getState()).toEqual(expect.objectContaining({
    budgetMax: 2,
    withinKm: 10,
    minRating: 4.5,
    sortBy: "distance",
    showState: "liked",
  }));
});
