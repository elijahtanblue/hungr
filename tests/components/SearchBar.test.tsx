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
