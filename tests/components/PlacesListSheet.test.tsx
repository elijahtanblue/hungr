import { render, screen } from "@testing-library/react-native";
import { PlacesListSheet } from "../../src/components/PlacesListSheet";

test("PlacesListSheet shows loading copy instead of empty copy while a search is running", async () => {
  await render(
    <PlacesListSheet
      places={[]}
      loading
      onSelect={() => {}}
      onClose={() => {}}
      title="Search results"
    />,
  );

  expect(screen.getByText("Finding places...")).toBeTruthy();
  expect(screen.queryByText(/No spots match/i)).toBeNull();
});
