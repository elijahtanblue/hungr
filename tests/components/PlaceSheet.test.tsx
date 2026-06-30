import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceSheet } from "../../src/components/PlaceSheet";

test("tapping Want to go calls onSetState with go", async () => {
  const onSetState = jest.fn();
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"] };
  await render(<PlaceSheet place={place} onSetState={onSetState} />);
  await fireEvent.press(screen.getByText("Want to go"));
  expect(onSetState).toHaveBeenCalledWith("p1", "go");
});

test("saved want to go state is labelled clearly", async () => {
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"], state: "go" as const };

  await render(<PlaceSheet place={place} onSetState={() => {}} />);

  expect(screen.getByText("Saved")).toBeTruthy();
});

test("checked in state uses a green tick without showing cooldown copy", async () => {
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"] };

  await render(
    <PlaceSheet
      place={place}
      onSetState={() => {}}
      onCheckIn={() => {}}
      visitCount={3}
      checkedInRecently
    />,
  );

  expect(screen.getByText("Checked in")).toBeTruthy();
  expect(screen.getByText("You've checked in")).toBeTruthy();
  expect(screen.getByText("Visited 3 times · only you can see this")).toBeTruthy();
  expect(screen.queryByText(/next in/i)).toBeNull();
});
