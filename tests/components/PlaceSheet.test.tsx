import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceSheet } from "../../src/components/PlaceSheet";

test("tapping Want to go calls onSetState with go", async () => {
  const onSetState = jest.fn();
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"] };
  await render(<PlaceSheet place={place} onSetState={onSetState} />);
  await fireEvent.press(screen.getByText("Want to go"));
  expect(onSetState).toHaveBeenCalledWith("p1", "go");
});
