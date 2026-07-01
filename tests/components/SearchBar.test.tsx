import { render, screen, fireEvent } from "@testing-library/react-native";
import { SearchBar } from "../../src/components/SearchBar";

test("submitting the search field triggers a manual refresh", async () => {
  const onSubmit = jest.fn();

  await render(
    <SearchBar
      value="food near me"
      onChange={() => {}}
      onPreferences={() => {}}
      onSubmit={onSubmit}
    />,
  );

  fireEvent(screen.getByPlaceholderText('Food near me, or "reviewed by Jenny"'), "submitEditing");

  expect(onSubmit).toHaveBeenCalled();
});

test("tapping the AI icon toggles AI search mode", async () => {
  const onToggleAi = jest.fn();

  await render(
    <SearchBar value="" onChange={() => {}} onPreferences={() => {}} onToggleAi={onToggleAi} />,
  );

  await fireEvent.press(screen.getByLabelText("AI search"));

  expect(onToggleAi).toHaveBeenCalled();
});

test("AI mode swaps the placeholder to an ask-style prompt", async () => {
  await render(
    <SearchBar value="" onChange={() => {}} onPreferences={() => {}} aiMode />,
  );

  expect(screen.getByPlaceholderText("Try asking hungrAI where to go for date night")).toBeTruthy();
});
