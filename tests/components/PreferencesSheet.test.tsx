import { render, screen, fireEvent } from "@testing-library/react-native";
import { PreferencesSheet } from "../../src/components/PreferencesSheet";
import { useFilters } from "../../src/store/useFilters";
import { saveSuppressedCuisines } from "../../src/api/preferences";

jest.mock("../../src/api/preferences", () => ({
  saveSuppressedCuisines: jest.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  useFilters.setState({ selected: [], suppressed: [] });
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
