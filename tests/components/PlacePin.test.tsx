import { render, screen } from "@testing-library/react-native";
import { PlacePin } from "../../src/components/PlacePin";

test("want to go pins render a saved marker instead of only the rating bubble", async () => {
  await render(<PlacePin state="go" rating={4.6} />);

  expect(screen.getByTestId("place-pin-go")).toBeTruthy();
});

test("rating pins always render one decimal place", async () => {
  await render(<PlacePin rating={4} />);

  expect(screen.getByText("4.0")).toBeTruthy();
});

test("a guide award shows a ribbon badge on the pin", async () => {
  await render(<PlacePin rating={4.8} guideAward="Michelin · 1 Star" />);

  expect(screen.getByTestId("place-pin-guide")).toBeTruthy();
});

test("pins without a guide award have no badge", async () => {
  await render(<PlacePin rating={4.8} />);

  expect(screen.queryByTestId("place-pin-guide")).toBeNull();
});
