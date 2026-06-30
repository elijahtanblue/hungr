import { render, screen, fireEvent } from "@testing-library/react-native";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { useFilters } from "../../src/store/useFilters";

beforeEach(() => useFilters.setState({ selected: [], suppressed: [] }));

test("shows only prioritised cuisines and clears one when tapped", async () => {
  useFilters.setState({ selected: ["Indian"], suppressed: [] });
  await render(<CuisineFilter />);
  expect(screen.getByText("Indian")).toBeTruthy();
  await fireEvent.press(screen.getByText("Indian"));
  expect(useFilters.getState().selected).not.toContain("Indian");
});

test("renders nothing when no cuisines are prioritised", async () => {
  const view = await render(<CuisineFilter />);
  expect(view.toJSON()).toBeNull();
});
