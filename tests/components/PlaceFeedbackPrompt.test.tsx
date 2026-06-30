import { render, screen, fireEvent } from "@testing-library/react-native";
import { PlaceFeedbackPrompt } from "../../src/components/PlaceFeedbackPrompt";

test("been feedback asks for a quick rating without feeling like a full review", async () => {
  const onClose = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="been" onClose={onClose} />);

  expect(screen.getByText("How was the food?")).toBeTruthy();
  expect(screen.getByText("Spicy World")).toBeTruthy();
  expect(screen.getByPlaceholderText("One quick thought (optional)")).toBeTruthy();

  await fireEvent.press(screen.getByText("5"));
  await fireEvent.press(screen.getByText("Done"));

  expect(onClose).toHaveBeenCalled();
});

test("been feedback hands the chosen rating back to be saved", async () => {
  const onSubmit = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="been" onClose={() => {}} onSubmit={onSubmit} />);

  await fireEvent.press(screen.getByText("4"));
  await fireEvent.press(screen.getByText("Done"));

  expect(onSubmit).toHaveBeenCalledWith({ rating: 4, reason: null, note: "" });
});

test("avoid feedback hands the chosen reason back to be saved", async () => {
  const onSubmit = jest.fn();

  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="avoid" onClose={() => {}} onSubmit={onSubmit} />);

  await fireEvent.press(screen.getByText("Too expensive"));
  await fireEvent.press(screen.getByText("Done"));

  expect(onSubmit).toHaveBeenCalledWith({ rating: null, reason: "Too expensive", note: "" });
});

test("avoid feedback asks why without collecting profile data yet", async () => {
  await render(<PlaceFeedbackPrompt placeName="Spicy World" state="avoid" onClose={() => {}} />);

  expect(screen.getByText("Why avoid this spot?")).toBeTruthy();
  expect(screen.getByText("Not my taste")).toBeTruthy();
  expect(screen.getByPlaceholderText("Tell future you why (optional)")).toBeTruthy();
});
