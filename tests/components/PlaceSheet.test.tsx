import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceSheet } from "../../src/components/PlaceSheet";

test("tapping Want to go calls onSetState with go", async () => {
  const onSetState = jest.fn();
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4, cuisines: ["Chinese"] };
  await render(<PlaceSheet place={place} onSetState={onSetState} />);
  expect(screen.getByText("4.0")).toBeTruthy();
  await fireEvent.press(screen.getByText("Want to go"));
  expect(onSetState).toHaveBeenCalledWith("p1", "go");
});

test("saved want to go state is labelled clearly", async () => {
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"], state: "go" as const };

  await render(<PlaceSheet place={place} onSetState={() => {}} />);

  expect(screen.getByText("Saved")).toBeTruthy();
});

test("shows the user's own review on the card and opens detail when tapped", async () => {
  const onOpenDetail = jest.fn();
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"], state: "disliked" as const };

  await render(
    <PlaceSheet
      place={place}
      onSetState={() => {}}
      onOpenDetail={onOpenDetail}
      myReview={{ body: "Too salty for me.", rating: 2 }}
    />,
  );

  expect(screen.getByText("Your review")).toBeTruthy();
  expect(screen.getByText("Too salty for me.")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("See your review"));
  expect(onOpenDetail).toHaveBeenCalledWith("p1");
});

test("shows open-now and available service options on the card", async () => {
  const place = { placeId: "p1", name: "Spicy World", lat: 0, lng: 0, rating: 4.6, cuisines: ["Chinese"] };

  await render(
    <PlaceSheet
      place={place}
      onSetState={() => {}}
      address="1 Food St"
      openNow
      takeout
      dineIn
      delivery={false}
      weekdayDescriptions={["Monday: 11 AM – 9 PM", "Tuesday: 11 AM – 9 PM"]}
    />,
  );

  expect(screen.getByText("1 Food St")).toBeTruthy();
  expect(screen.getByText("Open now")).toBeTruthy();
  expect(screen.getByText("Opening hours")).toBeTruthy();
  expect(screen.getByText("Monday: 11 AM – 9 PM")).toBeTruthy();
  expect(screen.getByText("Dine-in")).toBeTruthy();
  expect(screen.getByText("Takeout")).toBeTruthy();
  expect(screen.queryByText("Delivery")).toBeNull();
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
