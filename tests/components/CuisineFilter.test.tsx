import { render, screen, fireEvent } from "@testing-library/react-native";
import { CuisineFilter } from "../../src/components/CuisineFilter";
import { useFilters } from "../../src/store/useFilters";

test("long pressing a cuisine chip moves it to the avoid list", async () => {
  await render(<CuisineFilter cuisines={["Indian", "Chinese"]} />);
  await fireEvent(screen.getByText("Indian"), "onLongPress");
  expect(useFilters.getState().suppressed).toContain("Indian");
});
