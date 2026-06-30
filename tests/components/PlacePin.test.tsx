import { render, screen } from "@testing-library/react-native";
import { PlacePin } from "../../src/components/PlacePin";

test("want to go pins render a saved marker instead of only the rating bubble", async () => {
  await render(<PlacePin state="go" rating={4.6} />);

  expect(screen.getByTestId("place-pin-go")).toBeTruthy();
});
