import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceFeedbackPrompt } from "../../src/components/PlaceFeedbackPrompt";

test("been feedback asks for a quick rating without feeling like a full review", async () => {
  const onClose = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="been" onClose={onClose} />);

  expect(screen.getByText("How was the food?")).toBeTruthy();
  expect(screen.getByText("Spicy World")).toBeTruthy();
  expect(screen.getByPlaceholderText("Leave a short review")).toBeTruthy();
  expect(screen.getByText("Be the first in your friend group to review this spot.")).toBeTruthy();

  await fireEvent.press(screen.getByLabelText("5 stars"));
  await fireEvent.press(screen.getByText("Post"));

  expect(onClose).toHaveBeenCalled();
});

test("been feedback hands a half-star rating and review text back to be saved", async () => {
  const onSubmit = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="been" onClose={() => {}} onSubmit={onSubmit} />);

  await fireEvent.press(screen.getByLabelText("4.5 stars"));
  await fireEvent.changeText(screen.getByPlaceholderText("Leave a short review"), "Great noodles.");
  await fireEvent.press(screen.getByText("Post"));

  expect(onSubmit).toHaveBeenCalledWith({ rating: 4.5, reason: null, note: "Great noodles." });
});

test("avoid feedback hands the chosen reason and half-star rating back to be saved", async () => {
  const onSubmit = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="avoid" onClose={() => {}} onSubmit={onSubmit} />);

  await fireEvent.press(screen.getByText("Too expensive"));
  await fireEvent.press(screen.getByLabelText("2.5 stars"));
  await fireEvent.press(screen.getByText("Post"));

  expect(onSubmit).toHaveBeenCalledWith({ rating: 2.5, reason: "Too expensive", note: "" });
});

test("avoid feedback asks why without collecting profile data yet", async () => {
  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="avoid" onClose={() => {}} />);

  expect(screen.getByText("Why avoid this spot?")).toBeTruthy();
  expect(screen.getByText("Not my taste")).toBeTruthy();
  expect(screen.getByPlaceholderText("Leave a short review")).toBeTruthy();
});
